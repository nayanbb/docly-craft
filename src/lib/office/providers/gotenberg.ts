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

export class GotenbergProvider implements OfficeConversionProvider {
  readonly id = "gotenberg";
  readonly name = "Gotenberg (LibreOffice Engine)";
  readonly isConfigured: boolean;
  private readonly baseUrl: string;

  readonly supportedOperations: OfficeConversionOperation[] = [
    "word-to-pdf",
    "excel-to-pdf",
    "powerpoint-to-pdf",
  ];

  constructor(url?: string) {
    const targetUrl =
      url || (typeof process !== "undefined" ? process.env["GOTENBERG_URL"] : "") || "";
    this.baseUrl = targetUrl.trim().replace(/\/+$/, "");
    this.isConfigured = this.baseUrl.length > 0;
  }

  async checkHealth(): Promise<boolean> {
    if (!this.baseUrl) return false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
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

    const endpoint = `${this.baseUrl}/forms/libreoffice/convert`;
    const formData = new FormData();

    // Attach file using field name 'files' as required by Gotenberg LibreOffice endpoint
    const blob = new Blob([input.fileBuffer as unknown as BlobPart]);
    formData.append("files", blob, input.fileName);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for complex docs

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Gotenberg conversion failed with HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const outputBuffer = new Uint8Array(arrayBuffer);

      // Verify that the output is genuinely a PDF
      const pdfHeader = String.fromCharCode(...outputBuffer.slice(0, 5));
      if (!pdfHeader.startsWith("%PDF-")) {
        throw new Error(
          "Conversion engine returned an invalid response that does not match the PDF specification.",
        );
      }

      const baseName = input.fileName.replace(/\.[^/.]+$/, "");
      const outputFileName = `${baseName}.pdf`;

      return {
        outputBuffer,
        outputFileName,
        mimeType: "application/pdf",
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("The conversion took too long. Please try again with a smaller file.");
      }
      // Check for network connection failures (e.g. Gotenberg container is not running)
      const isConnectionError =
        err instanceof Error &&
        (err.message.includes("fetch failed") ||
          err.message.includes("ECONNREFUSED") ||
          (err as { cause?: { code?: string } }).cause?.code === "ECONNREFUSED");

      if (isConnectionError) {
        throw new OfficeBackendNotConfiguredError(
          `Unable to connect to Gotenberg engine at ${this.baseUrl}. Please ensure Gotenberg is running with Docker: docker run --rm -p 3000:3000 gotenberg/gotenberg:8`,
        );
      }
      throw err;
    }
  }
}
