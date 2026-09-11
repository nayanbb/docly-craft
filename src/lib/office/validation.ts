import type { OfficeConversionOperation } from "@/lib/office/types";
import { FILE_SIZE_LIMITS, getMaxFileSizeBytes, getMaxFileSizeMb } from "@/lib/monetization/config";

export const MAX_OFFICE_FILE_SIZE_BYTES = FILE_SIZE_LIMITS.freeMaxBytes; // 50 MB Free

export interface OfficeValidationResult {
  valid: boolean;
  error?: string;
  isFileSizeLimitExceeded?: boolean;
  fileSize?: number;
  limitBytes?: number;
}

export interface FileLike {
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Checks if a byte buffer matches a specific signature.
 */
function matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

// OpenXML format (DOCX, XLSX, PPTX) magic bytes: PK\x03\x04
const OPENXML_MAGIC = [0x50, 0x4b, 0x03, 0x04];
// OLE2 Binary format (DOC, XLS, PPT) magic bytes: D0 CF 11 E0 A1 B1 1A E1
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
// PDF format magic bytes: %PDF-
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

/**
 * Validates an Office or PDF file for a given conversion operation.
 * Performs size, extension, and magic-byte signature checks.
 */
export async function validateOfficeFile(
  file: FileLike,
  operation: OfficeConversionOperation,
  isPro: boolean = false,
): Promise<OfficeValidationResult> {
  const maxBytes = getMaxFileSizeBytes(isPro);
  const maxMb = getMaxFileSizeMb(isPro);

  if (!file || file.size <= 0) {
    return { valid: false, error: "The selected file is empty." };
  }

  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File is too large. Maximum allowed size is ${maxMb} MB.`,
      isFileSizeLimitExceeded: true,
      fileSize: file.size,
      limitBytes: maxBytes,
    };
  }

  const nameLower = file.name.toLowerCase();

  // 1. Word to PDF
  if (operation === "word-to-pdf") {
    const isDocx = nameLower.endsWith(".docx");
    const isDoc = nameLower.endsWith(".doc");

    if (!isDocx && !isDoc) {
      return { valid: false, error: "Unsupported file type. Please provide a .docx or .doc file." };
    }

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer.slice(0, 8));

      if (isDocx && !matchesSignature(bytes, OPENXML_MAGIC)) {
        return {
          valid: false,
          error: "Invalid Word document. File does not match the DOCX format specification.",
        };
      }
      if (isDoc && !matchesSignature(bytes, OLE2_MAGIC)) {
        return {
          valid: false,
          error: "Invalid Word document. File does not match the DOC format specification.",
        };
      }
    } catch {
      return { valid: false, error: "Invalid Word document. Could not read file." };
    }
  }

  // 2. Excel to PDF
  else if (operation === "excel-to-pdf") {
    const isXlsx = nameLower.endsWith(".xlsx");
    const isXls = nameLower.endsWith(".xls");

    if (!isXlsx && !isXls) {
      return { valid: false, error: "Unsupported file type. Please provide a .xlsx or .xls file." };
    }

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer.slice(0, 8));

      if (isXlsx && !matchesSignature(bytes, OPENXML_MAGIC)) {
        return {
          valid: false,
          error: "Invalid Excel document. File does not match the XLSX format specification.",
        };
      }
      if (isXls && !matchesSignature(bytes, OLE2_MAGIC)) {
        return {
          valid: false,
          error: "Invalid Excel document. File does not match the XLS format specification.",
        };
      }
    } catch {
      return { valid: false, error: "Invalid Excel document. Could not read file." };
    }
  }

  // 3. PowerPoint to PDF
  else if (operation === "powerpoint-to-pdf") {
    const isPptx = nameLower.endsWith(".pptx");
    const isPpt = nameLower.endsWith(".ppt");

    if (!isPptx && !isPpt) {
      return { valid: false, error: "Unsupported file type. Please provide a .pptx or .ppt file." };
    }

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer.slice(0, 8));

      if (isPptx && !matchesSignature(bytes, OPENXML_MAGIC)) {
        return {
          valid: false,
          error: "Invalid PowerPoint document. File does not match the PPTX format specification.",
        };
      }
      if (isPpt && !matchesSignature(bytes, OLE2_MAGIC)) {
        return {
          valid: false,
          error: "Invalid PowerPoint document. File does not match the PPT format specification.",
        };
      }
    } catch {
      return { valid: false, error: "Invalid PowerPoint document. Could not read file." };
    }
  }

  // 4. PDF to Word, Excel, PowerPoint
  else if (
    operation === "pdf-to-word" ||
    operation === "pdf-to-excel" ||
    operation === "pdf-to-powerpoint"
  ) {
    if (!nameLower.endsWith(".pdf")) {
      return { valid: false, error: "Unsupported file type. Please provide a .pdf document." };
    }

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer.slice(0, 5));
      if (!matchesSignature(bytes, PDF_MAGIC)) {
        return {
          valid: false,
          error: "Invalid PDF. File does not match the PDF format specification.",
        };
      }
    } catch {
      return { valid: false, error: "Invalid PDF. Could not read file." };
    }
  }

  return { valid: true };
}
