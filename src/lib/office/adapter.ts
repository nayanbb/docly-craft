/**
 * Office Document Conversion Adapter for Docly.
 *
 * Rules:
 * - High-fidelity Office conversions (Word, Excel, PowerPoint) require server-side
 *   layout rendering engines (LibreOffice / Gotenberg / CloudConvert).
 * - Never fake conversions by renaming extensions or returning empty documents.
 * - Server secrets are kept strictly server-side.
 */

import { convertDocumentViaBackend, fetchConversionStatus } from "@/lib/office/conversion";
import type { OfficeConversionOperation } from "@/lib/office/types";

export * from "@/lib/office/types";
export * from "@/lib/office/conversion";
export * from "@/lib/office/validation";

/**
 * Legacy compatibility wrapper for converting an office document.
 */
export async function convertOfficeDocument(
  file: File,
  targetFormat: "pdf" | "docx" | "xlsx" | "pptx",
): Promise<Blob> {
  let operation: OfficeConversionOperation = "word-to-pdf";
  const nameLower = file.name.toLowerCase();

  if (targetFormat === "pdf") {
    if (nameLower.endsWith(".xlsx") || nameLower.endsWith(".xls")) {
      operation = "excel-to-pdf";
    } else if (nameLower.endsWith(".pptx") || nameLower.endsWith(".ppt")) {
      operation = "powerpoint-to-pdf";
    } else {
      operation = "word-to-pdf";
    }
  } else if (targetFormat === "docx") {
    operation = "pdf-to-word";
  } else if (targetFormat === "xlsx") {
    operation = "pdf-to-excel";
  } else if (targetFormat === "pptx") {
    operation = "pdf-to-powerpoint";
  }

  const { blob } = await convertDocumentViaBackend(file, operation);
  return blob;
}

/**
 * Checks if conversion backend is configured asynchronously.
 */
export async function isOfficeConversionConfigured(): Promise<boolean> {
  const status = await fetchConversionStatus();
  return status.configured;
}
