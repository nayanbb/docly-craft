import { PDFDocument } from "pdf-lib";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt";

export interface ProtectPdfResult {
  blob: Blob;
  pageCount: number;
  fileName: string;
}

/**
 * Protects a PDF file with genuine password encryption.
 * Applies standard PDF security handler encryption (AES-256 / RC4 128-bit)
 * compliant with the PDF standard.
 *
 * Runs 100% locally in the browser/client without transmitting passwords
 * or document data to external services.
 */
export async function protectPdf(
  file: File,
  password: string,
  onProgress?: (percent: number) => void,
): Promise<ProtectPdfResult> {
  const trimmed = password.trim();
  if (!trimmed) {
    throw new Error("Please enter a password to protect this document.");
  }

  if (trimmed.length < 4) {
    throw new Error("Password is too short. Please choose a password of at least 4 characters.");
  }

  onProgress?.(15);
  const buffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(buffer);

  onProgress?.(35);
  // Verify document is readable and determine page count
  let pageCount = 1;
  try {
    const doc = await PDFDocument.load(fileBytes, { ignoreEncryption: false });
    pageCount = doc.getPageCount();
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes("encrypted")) {
      throw new Error(
        "This document is already encrypted or password protected. Please unlock it first.",
      );
    }
    throw new Error("Invalid or unreadable PDF document.");
  }

  onProgress?.(60);

  // Apply standard PDF encryption
  let encryptedBytes: Uint8Array;
  try {
    encryptedBytes = await encryptPDF(fileBytes, trimmed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Encryption processing failed.";
    throw new Error(`Failed to protect PDF: ${msg}`);
  }

  onProgress?.(95);

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const fileName = `${baseName}-protected.pdf`;
  const blob = new Blob([encryptedBytes as unknown as BlobPart], { type: "application/pdf" });

  onProgress?.(100);

  return {
    blob,
    pageCount,
    fileName,
  };
}
