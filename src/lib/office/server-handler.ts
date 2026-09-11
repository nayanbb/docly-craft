import type { OfficeConversionOperation } from "@/lib/office/types";
import { validateOfficeFile } from "@/lib/office/validation";
import {
  getOfficeConversionProvider,
  getOfficeConversionProviderForOperation,
  LocalOfficeProvider,
  resolveServerEnvVar,
  OfficeBackendNotConfiguredError,
  UnsupportedOfficeConversionError,
} from "@/lib/office/providers";
import { CONVERSION_LIMITS, UPGRADE_MESSAGES } from "@/lib/monetization/config";
import { getUtcDateString } from "@/lib/monetization/usage";
import { verifyServerUserSubscription } from "@/lib/monetization/subscription";

const VALID_OPERATIONS = new Set<OfficeConversionOperation>([
  "word-to-pdf",
  "excel-to-pdf",
  "powerpoint-to-pdf",
  "pdf-to-word",
  "pdf-to-excel",
  "pdf-to-powerpoint",
]);

// In-memory server-side usage store per (identifier, operation, utcDate)
const serverDailyUsage = new Map<string, number>();

export function getServerConversionUsage(
  identifier: string,
  operation: string,
  utcDate: string = getUtcDateString(),
): number {
  return serverDailyUsage.get(`${identifier}:${operation}:${utcDate}`) ?? 0;
}

export function incrementServerConversionUsage(
  identifier: string,
  operation: string,
  utcDate: string = getUtcDateString(),
): number {
  const key = `${identifier}:${operation}:${utcDate}`;
  const current = serverDailyUsage.get(key) ?? 0;
  const updated = current + 1;
  serverDailyUsage.set(key, updated);
  return updated;
}

export function resetServerConversionUsage(): void {
  serverDailyUsage.clear();
}

function getCallerIdentifier(request: Request): string {
  const auth = request.headers.get("Authorization");
  if (auth && auth.startsWith("Bearer ")) {
    return "user_" + auth.slice(7, 32);
  }
  const clientId = request.headers.get("X-Docly-Client-Id");
  if (clientId) return clientId;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return "ip_" + forwarded.split(",")[0]?.trim();
  return "anon_client";
}

/**
 * Handles /api/convert/status endpoint.
 * Informs the frontend whether the Docly self-hosted conversion engine is configured and reachable.
 * Accepts optional ?operation query param to report status for a specific tool.
 */
export async function handleConversionStatusRequest(
  request: Request,
  env?: unknown,
): Promise<Response> {
  const url = new URL(request.url);
  const operation = url.searchParams.get("operation") as OfficeConversionOperation | null;

  // 1. Operation-specific status check
  if (operation && VALID_OPERATIONS.has(operation)) {
    const provider = getOfficeConversionProviderForOperation(
      operation,
      env as Record<string, unknown> | undefined,
    );

    if (provider.id === "self-hosted") {
      const isConfigured = provider.isConfigured;
      let reachable = isConfigured;
      let statusMessage = "Docly Self-Hosted Engine is active and reachable.";

      if (isConfigured && typeof provider.checkHealth === "function") {
        try {
          reachable = await provider.checkHealth();
          statusMessage = reachable
            ? "Docly Self-Hosted Engine is active and reachable."
            : "Document conversion service is temporarily unreachable.";
        } catch {
          reachable = false;
          statusMessage = "Document conversion service health check failed.";
        }
      } else if (!isConfigured) {
        statusMessage = "Document conversion is temporarily unavailable. Please try again later.";
      }

      return new Response(
        JSON.stringify({
          configured: isConfigured && reachable,
          provider: "self-hosted",
          supportedOperations: isConfigured && reachable ? provider.supportedOperations : [],
          reachable,
          statusMessage,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        },
      );
    }
  }

  // 2. Default or forward conversion status check
  let provider = getOfficeConversionProvider(env as Record<string, unknown> | undefined);

  let isConfigured = provider.isConfigured;
  let reachable = isConfigured;
  let statusMessage: string | undefined = undefined;

  if (isConfigured && typeof provider.checkHealth === "function") {
    try {
      reachable = await provider.checkHealth();
      if (!reachable) {
        // Check if native Microsoft Office is installed locally on Windows
        const localOffice = new LocalOfficeProvider();
        if (localOffice.isConfigured) {
          provider = localOffice;
          isConfigured = true;
          reachable = true;
          statusMessage =
            "Native Microsoft Office desktop engine is active for local Office to PDF conversions.";
        } else {
          isConfigured = false;
          statusMessage = `${provider.name} is configured but service is unreachable.`;
        }
      } else {
        statusMessage = `${provider.name} is active and reachable.`;
      }
    } catch {
      const localOffice = new LocalOfficeProvider();
      if (localOffice.isConfigured) {
        provider = localOffice;
        isConfigured = true;
        reachable = true;
        statusMessage =
          "Native Microsoft Office desktop engine is active for local Office to PDF conversions.";
      } else {
        reachable = false;
        isConfigured = false;
        statusMessage = `${provider.name} health check failed.`;
      }
    }
  } else if (!isConfigured) {
    statusMessage = "Document conversion is temporarily unavailable. Please try again later.";
  }

  return new Response(
    JSON.stringify({
      configured: isConfigured,
      provider: provider.id,
      supportedOperations: isConfigured ? provider.supportedOperations : [],
      reachable,
      ...(statusMessage ? { statusMessage } : {}),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * Handles POST /api/convert endpoint.
 * Validates document signatures, dispatches to active backend provider,
 * and streams back the converted output file.
 */
export async function handleConversionApiRequest(
  request: Request,
  env?: unknown,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const operation = formData.get("operation") as OfficeConversionOperation | null;

    if (!file || typeof file !== "object" || !("size" in file)) {
      return new Response(JSON.stringify({ error: "Missing document file in request." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!operation || !VALID_OPERATIONS.has(operation)) {
      return new Response(
        JSON.stringify({ error: "Invalid or unsupported conversion operation." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Verify user Pro entitlement
    const userSub = await verifyServerUserSubscription(request, env);
    const isPro = userSub.isPro;

    // Validate file integrity, size limit, and magic bytes (up to 250MB for Pro)
    const validation = await validateOfficeFile(file, operation, isPro);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error || "Invalid file." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check per-tool daily free limit (10 files/day per tool) - bypassed for Pro users
    const callerId = userSub.userId ? `user_${userSub.userId}` : getCallerIdentifier(request);
    const today = getUtcDateString();

    if (!isPro) {
      const currentUsage = getServerConversionUsage(callerId, operation, today);

      if (currentUsage >= CONVERSION_LIMITS.dailyFreeLimitPerTool) {
        return new Response(
          JSON.stringify({
            error: UPGRADE_MESSAGES.conversionLimit.title,
            code: "USAGE_LIMIT_EXCEEDED",
            message: UPGRADE_MESSAGES.conversionLimit.description,
            price: UPGRADE_MESSAGES.conversionLimit.price,
            upgradeUrl: "/pricing?upgrade=pro",
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    let provider = getOfficeConversionProviderForOperation(
      operation,
      env as Record<string, unknown> | undefined,
    );

    if (!provider.isConfigured) {
      return new Response(
        JSON.stringify({
          error: "Document conversion is temporarily unavailable. Please try again later.",
          code: "BACKEND_NOT_CONFIGURED",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    const result = await provider.convert({
      fileBuffer,
      fileName: file.name,
      operation,
    });

    // ONLY increment counter upon successful conversion for non-Pro users!
    if (!isPro) {
      incrementServerConversionUsage(callerId, operation, today);
    }


    return new Response(result.outputBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(result.outputFileName)}"`,
        "X-Converted-By": provider.id,
      },
    });
  } catch (err: unknown) {
    if (err instanceof OfficeBackendNotConfiguredError) {
      return new Response(
        JSON.stringify({
          error: err.message,
          code: "BACKEND_NOT_CONFIGURED",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (err instanceof UnsupportedOfficeConversionError) {
      return new Response(
        JSON.stringify({
          error: err.message,
          code: "UNSUPPORTED_CONVERSION",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    console.error("Office conversion error:", err instanceof Error ? err.name : "Error");
    const safeMessage = "Conversion is temporarily unavailable. Please try again shortly.";
    return new Response(
      JSON.stringify({
        ok: false,
        error: safeMessage,
        code: "CONVERSION_FAILED",
        message: safeMessage,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
