import type {
  ConversionInput,
  ConversionOutput,
  OfficeConversionOperation,
  OfficeConversionProvider,
} from "@/lib/office/providers/types";
import { OfficeBackendNotConfiguredError } from "@/lib/office/providers/types";
import { GotenbergProvider } from "@/lib/office/providers/gotenberg";
import { CloudConvertProvider } from "@/lib/office/providers/cloudconvert";
import { LocalOfficeProvider } from "@/lib/office/providers/local-office";
import { SelfHostedProvider } from "@/lib/office/providers/self-hosted";

export * from "@/lib/office/providers/types";
export {
  GotenbergProvider,
  CloudConvertProvider,
  LocalOfficeProvider,
  SelfHostedProvider,
};

export class UnconfiguredOfficeProvider implements OfficeConversionProvider {
  readonly id = "none";
  readonly name = "Unconfigured Conversion Backend";
  readonly isConfigured = false;
  readonly supportedOperations: OfficeConversionOperation[] = [];
  private readonly customReason?: string | undefined;

  constructor(reason?: string) {
    this.customReason = reason;
  }

  async convert(_input: ConversionInput): Promise<ConversionOutput> {
    throw new OfficeBackendNotConfiguredError(
      this.customReason ||
        "Document conversion is temporarily unavailable. Please try again later.",
    );
  }
}

/**
 * Safely resolves a server-side environment variable across runtime environments:
 * 1. Cloudflare Workers / Nitro request environment bindings (env, env.env)
 * 2. Node.js process environment (process.env from .env or .dev.vars)
 * 3. Global worker scope (globalThis)
 */
export function resolveServerEnvVar(name: string, env?: unknown): string {
  // 1. Direct Cloudflare Workers / Nitro bindings on request
  if (env && typeof env === "object") {
    const directVal = (env as Record<string, unknown>)[name];
    if (typeof directVal === "string" && directVal.trim().length > 0) {
      return directVal.trim();
    }
    const nestedEnv = (env as Record<string, unknown>)["env"];
    if (nestedEnv && typeof nestedEnv === "object") {
      const nestedVal = (nestedEnv as Record<string, unknown>)[name];
      if (typeof nestedVal === "string" && nestedVal.trim().length > 0) {
        return nestedVal.trim();
      }
    }
  }

  // 2. Node.js process.env
  if (typeof process !== "undefined" && process.env) {
    const processVal = process.env[name];
    if (typeof processVal === "string" && processVal.trim().length > 0) {
      return processVal.trim();
    }
  }

  // 3. Global worker scope
  if (typeof globalThis !== "undefined") {
    const globalVal = (globalThis as Record<string, unknown>)[name];
    if (typeof globalVal === "string" && globalVal.trim().length > 0) {
      return globalVal.trim();
    }
  }

  return "";
}

/**
 * Resolves the active server-side conversion provider based on environment variables
 * and local environment capabilities (e.g. self-hosted service, Gotenberg, local Office).
 */
export function getOfficeConversionProvider(
  env?: Record<string, unknown>,
): OfficeConversionProvider {
  const configuredProvider = (
    resolveServerEnvVar("OFFICE_CONVERSION_PROVIDER", env) ||
    resolveServerEnvVar("CONVERTER_PROVIDER", env)
  ).toLowerCase();

  const converterUrl =
    resolveServerEnvVar("DOCLY_CONVERTER_URL", env) ||
    resolveServerEnvVar("CONVERTER_SERVICE_URL", env);
  const converterSecret =
    resolveServerEnvVar("DOCLY_CONVERTER_SECRET", env) ||
    resolveServerEnvVar("CONVERTER_SECRET", env);

  const gotenbergUrl = resolveServerEnvVar("GOTENBERG_URL", env);
  const cloudConvertKey = resolveServerEnvVar("CLOUDCONVERT_API_KEY", env);

  if (configuredProvider === "none") {
    return new UnconfiguredOfficeProvider();
  }

  if (configuredProvider === "self-hosted") {
    return new SelfHostedProvider(converterUrl, converterSecret, env);
  }

  if (configuredProvider === "local-office") {
    return new LocalOfficeProvider();
  }

  if (configuredProvider === "gotenberg") {
    return new GotenbergProvider(gotenbergUrl);
  }

  if (configuredProvider === "cloudconvert") {
    return new CloudConvertProvider(cloudConvertKey);
  }

  // Primary default: Self-Hosted Engine if URL is configured
  if (converterUrl) {
    const selfHosted = new SelfHostedProvider(converterUrl, converterSecret, env);
    if (selfHosted.isConfigured) {
      return selfHosted;
    }
  }

  // Secondary fallbacks
  if (gotenbergUrl) {
    return new GotenbergProvider(gotenbergUrl);
  }

  if (cloudConvertKey) {
    return new CloudConvertProvider(cloudConvertKey);
  }

  // Check if native Microsoft Office is installed locally on Windows
  const localOffice = new LocalOfficeProvider();
  if (localOffice.isConfigured) {
    return localOffice;
  }

  return new UnconfiguredOfficeProvider();
}

/**
 * Resolves the appropriate provider for a given operation.
 * - If Self-Hosted is configured (DOCLY_CONVERTER_URL), routes ALL operations to SelfHostedProvider.
 * - If CloudConvert is explicitly configured or active for reverse conversions, routes to CloudConvertProvider.
 * - Otherwise routes to Gotenberg / LocalOffice for Office -> PDF.
 */
export function getOfficeConversionProviderForOperation(
  operation: OfficeConversionOperation,
  env?: Record<string, unknown>,
): OfficeConversionProvider {
  const configuredProvider = (
    resolveServerEnvVar("OFFICE_CONVERSION_PROVIDER", env) ||
    resolveServerEnvVar("CONVERTER_PROVIDER", env)
  ).toLowerCase();

  const converterUrl =
    resolveServerEnvVar("DOCLY_CONVERTER_URL", env) ||
    resolveServerEnvVar("CONVERTER_SERVICE_URL", env);
  const converterSecret =
    resolveServerEnvVar("DOCLY_CONVERTER_SECRET", env) ||
    resolveServerEnvVar("CONVERTER_SECRET", env);

  // If self-hosted is explicitly requested or converter URL is present, use SelfHostedProvider
  if (configuredProvider === "self-hosted" || (converterUrl && configuredProvider !== "cloudconvert")) {
    const selfHosted = new SelfHostedProvider(converterUrl, converterSecret, env);
    if (selfHosted.isConfigured) {
      return selfHosted;
    }
  }

  const isReverse =
    operation === "pdf-to-word" ||
    operation === "pdf-to-excel" ||
    operation === "pdf-to-powerpoint";

  if (isReverse) {
    const cloudConvertKey = resolveServerEnvVar("CLOUDCONVERT_API_KEY", env);
    if (cloudConvertKey && configuredProvider !== "none") {
      return new CloudConvertProvider(cloudConvertKey);
    }
    return new UnconfiguredOfficeProvider(
      "Document conversion is temporarily unavailable. Please try again later.",
    );
  }

  // Forward conversion: Office -> PDF
  return getOfficeConversionProvider(env);
}

