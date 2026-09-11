import type {
  ConversionInput,
  ConversionOutput,
  OfficeConversionOperation,
  OfficeConversionProvider,
} from "@/lib/office/providers/types";
import {
  OfficeBackendNotConfiguredError,
  UnsupportedOfficeConversionError,
} from "@/lib/office/providers/types";

/**
 * Safely resolves a server-side environment variable across runtime environments:
 * 1. Cloudflare Workers / Nitro request environment bindings (env, env.env)
 * 2. Node.js process environment (process.env from .env or .dev.vars)
 * 3. Global worker scope (globalThis)
 */
function getRuntimeEnv(name: string, customEnv?: unknown): string {
  if (customEnv && typeof customEnv === "object") {
    const val = (customEnv as Record<string, unknown>)[name];
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
    const nested = (customEnv as Record<string, unknown>)["env"];
    if (nested && typeof nested === "object") {
      const nestedVal = (nested as Record<string, unknown>)[name];
      if (typeof nestedVal === "string" && nestedVal.trim().length > 0) return nestedVal.trim();
    }
  }

  if (typeof process !== "undefined" && process.env) {
    const val = process.env[name];
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
  }

  if (typeof globalThis !== "undefined") {
    const val = (globalThis as Record<string, unknown>)[name];
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
  }

  return "";
}

/**
 * Self-Hosted Document Conversion Provider for Docly.
 * Connects to the Docker-deployable FastAPI conversion microservice.
 * Supports all 6 bidirectional Office <-> PDF operations with 100% permissively licensed engines.
 */
export class SelfHostedProvider implements OfficeConversionProvider {
  readonly id = "self-hosted";
  readonly name = "Docly Self-Hosted Engine";
  readonly isConfigured: boolean;
  private readonly baseUrl: string;
  private readonly secret: string;

  readonly supportedOperations: OfficeConversionOperation[] = [
    "pdf-to-word",
    "pdf-to-excel",
    "pdf-to-powerpoint",
    "word-to-pdf",
    "excel-to-pdf",
    "powerpoint-to-pdf",
  ];

  constructor(url?: string, secret?: string, env?: unknown) {
    const targetUrl =
      url ||
      getRuntimeEnv("DOCLY_CONVERTER_URL", env) ||
      getRuntimeEnv("CONVERTER_SERVICE_URL", env);

    this.baseUrl = targetUrl ? targetUrl.trim().replace(/\/+$/, "") : "";
    this.secret =
      secret ||
      getRuntimeEnv("DOCLY_CONVERTER_SECRET", env) ||
      getRuntimeEnv("CONVERTER_SECRET", env);

    this.isConfigured = this.baseUrl.length > 0;
  }

  /**
   * Health check verifying whether the conversion service is reachable.
   */
  async checkHealth(): Promise<boolean> {
    if (!this.isConfigured) return false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return false;
      const data = (await res.json().catch(() => null)) as { status?: string } | null;
      return data?.status === "ok";
    } catch (err) {
      return false;
    }
  }

  async convert(input: ConversionInput): Promise<ConversionOutput> {
    if (!this.isConfigured) {
      throw new OfficeBackendNotConfiguredError(
        "Document conversion is temporarily unavailable. Please try again later.",
      );
    }

    if (!this.supportedOperations.includes(input.operation)) {
      throw new UnsupportedOfficeConversionError(input.operation, this.name);
    }

    if (input.fileBuffer.length === 0) {
      throw new Error("The uploaded document is empty (0 bytes).");
    }

    if (input.fileBuffer.length > 50 * 1024 * 1024) {
      throw new Error("Document is too large. Maximum supported file size is 50 MB.");
    }

    const endpoint = `${this.baseUrl}/convert`;
    const formData = new FormData();
    const blob = new Blob([input.fileBuffer as unknown as BlobPart]);
    formData.append("file", blob, input.fileName);
    formData.append("operation", input.operation);

    const headers: Record<string, string> = {};
    if (this.secret) {
      headers["X-Converter-Secret"] = this.secret;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 75000); // 75s client-side abort timeout

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorJson = (await response.json().catch(() => null)) as { detail?: string } | null;
        const errDetail = errorJson?.detail || response.statusText;
        throw new Error(`Self-hosted conversion failed (${response.status}): ${errDetail}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const outputBuffer = new Uint8Array(arrayBuffer);

      if (outputBuffer.length === 0) {
        throw new Error("Conversion engine returned an empty output file.");
      }

      // Format determination and magic byte verification
      let mimeType = "application/pdf";
      let targetExt = "pdf";

      if (input.operation === "pdf-to-word") {
        mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        targetExt = "docx";
      } else if (input.operation === "pdf-to-excel") {
        mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        targetExt = "xlsx";
      } else if (input.operation === "pdf-to-powerpoint") {
        mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        targetExt = "pptx";
      } else {
        mimeType = "application/pdf";
        targetExt = "pdf";
      }

      // Verify OpenXML (ZIP header: PK\x03\x04)
      if (["docx", "xlsx", "pptx"].includes(targetExt)) {
        const isZip =
          outputBuffer[0] === 0x50 &&
          outputBuffer[1] === 0x4b &&
          outputBuffer[2] === 0x03 &&
          outputBuffer[3] === 0x04;
        if (!isZip) {
          throw new Error("Conversion engine returned an invalid Office document package.");
        }
      } else {
        // Verify PDF header (%PDF-)
        const pdfHeader = String.fromCharCode(...outputBuffer.slice(0, 5));
        if (!pdfHeader.startsWith("%PDF-")) {
          throw new Error("Conversion engine returned an invalid PDF document.");
        }
      }

      // Output filename extraction
      let outputFileName = "";
      const disposition = response.headers.get("Content-Disposition");
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename=["']?([^"';]+)["']?/);
        if (match?.[1]) {
          outputFileName = decodeURIComponent(match[1]);
        }
      }

      if (!outputFileName) {
        const baseName = input.fileName.replace(/\.[^/.]+$/, "");
        outputFileName = `${baseName}.${targetExt}`;
      }

      return {
        outputBuffer,
        outputFileName,
        mimeType,
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          throw new Error("Conversion request timed out. Please try again with a smaller document.");
        }
        throw err;
      }
      throw new Error("Conversion engine failed unexpectedly.");
    }
  }
}
