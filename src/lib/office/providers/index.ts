import type {
  ConversionInput,
  ConversionOutput,
  OfficeConversionOperation,
  OfficeConversionProvider,
} from "@/lib/office/providers/types";
import { OfficeBackendNotConfiguredError } from "@/lib/office/providers/types";
import { LocalOfficeProvider } from "@/lib/office/providers/local-office";
import { SelfHostedProvider } from "@/lib/office/providers/self-hosted";

export * from "@/lib/office/providers/types";
export {
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
 * Resolves the active server-side conversion provider based on environment variables.
 * Exclusively uses Docly's self-hosted document conversion engine.
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

  if (configuredProvider === "none") {
    return new UnconfiguredOfficeProvider();
  }

  // Primary and Only Conversion Engine: Docly Self-Hosted Provider
  if (converterUrl || configuredProvider === "self-hosted") {
    const selfHosted = new SelfHostedProvider(converterUrl, converterSecret, env);
    if (selfHosted.isConfigured) {
      return selfHosted;
    }
  }

  // Fallback solely for local Windows developer host with native MS Office installed
  if (configuredProvider === "local-office") {
    return new LocalOfficeProvider();
  }
  const localOffice = new LocalOfficeProvider();
  if (localOffice.isConfigured) {
    return localOffice;
  }

  return new UnconfiguredOfficeProvider(
    "Document conversion is temporarily unavailable. Please try again later.",
  );
}

/**
 * Resolves the appropriate provider for a given operation.
 * Routes all 6 operations exclusively to the Docly Self-Hosted Engine.
 */
export function getOfficeConversionProviderForOperation(
  _operation: OfficeConversionOperation,
  env?: Record<string, unknown>,
): OfficeConversionProvider {
  return getOfficeConversionProvider(env);
}


