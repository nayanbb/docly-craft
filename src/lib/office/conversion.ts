import type { ConversionBackendStatus, OfficeConversionOperation } from "@/lib/office/types";
import { validateOfficeFile } from "@/lib/office/validation";

export class ClientConversionError extends Error {
  code?: string | undefined;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "ClientConversionError";
    this.code = code;
  }
}

/**
 * Checks the status of the server-side conversion backend.
 */
export async function fetchConversionStatus(
  operation?: OfficeConversionOperation,
): Promise<ConversionBackendStatus> {
  try {
    const url = operation
      ? `/api/convert/status?operation=${encodeURIComponent(operation)}`
      : "/api/convert/status";
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        configured: false,
        provider: "none",
        supportedOperations: [],
      };
    }

    return await res.json();
  } catch {
    return {
      configured: false,
      provider: "none",
      supportedOperations: [],
    };
  }
}

/**
 * Converts a document via Docly's secure server conversion endpoint.
 */
export async function convertDocumentViaBackend(
  file: File,
  operation: OfficeConversionOperation,
  onProgress?: (status: string) => void,
): Promise<{ blob: Blob; fileName: string }> {
  // 1. Client-side validation
  onProgress?.("Validating file structure...");
  const validation = await validateOfficeFile(file, operation);
  if (!validation.valid) {
    throw new ClientConversionError(validation.error || "Invalid file.", "INVALID_FILE");
  }

  // 2. Prepare upload payload
  onProgress?.("Uploading document to conversion backend...");
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("operation", operation);

  onProgress?.("Converting document via server engine...");

  const response = await fetch("/api/convert", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => null);
    const message =
      errorJson?.error ||
      (response.status === 503
        ? "Document conversion is temporarily unavailable. Please try again later."
        : "Conversion failed on server.");
    const code =
      errorJson?.code || (response.status === 503 ? "BACKEND_NOT_CONFIGURED" : "CONVERSION_FAILED");

    throw new ClientConversionError(message, code);
  }

  onProgress?.("Preparing download...");

  // Extract filename from header or fallback
  let fileName = "";
  const disposition = response.headers.get("Content-Disposition");
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename=["']?([^"';]+)["']?/);
    if (match?.[1]) {
      fileName = decodeURIComponent(match[1]);
    }
  }

  if (!fileName) {
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    let targetExt = "pdf";
    if (operation === "pdf-to-word") targetExt = "docx";
    else if (operation === "pdf-to-excel") targetExt = "xlsx";
    else if (operation === "pdf-to-powerpoint") targetExt = "pptx";

    fileName = `${baseName}.${targetExt}`;
  }

  const blob = await response.blob();
  return { blob, fileName };
}
