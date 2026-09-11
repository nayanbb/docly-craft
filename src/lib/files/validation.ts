import { FILE_SIZE_LIMITS, getMaxFileSizeBytes, getMaxFileSizeMb } from "@/lib/monetization/config";

export const MAX_FILE_SIZE_BYTES = FILE_SIZE_LIMITS.freeMaxBytes; // 50 MB Free default

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  isFileSizeLimitExceeded?: boolean;
  fileSize?: number;
  limitBytes?: number;
}

/**
 * Sanitizes uploaded filenames to prevent directory traversal, control characters,
 * or shell injections. Preserves clean alphanumeric basenames and extensions.
 */
export function sanitizeFileName(name: string, fallback = "document"): string {
  if (!name || typeof name !== "string") return fallback;
  // Strip null bytes, paths, and control characters
  const clean = name
    .replace(/\0/g, "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .trim();

  return clean.length > 0 ? clean : fallback;
}

/**
 * Inspects leading magic bytes to identify true file type regardless of extension.
 */
export function detectFileSignature(
  bytes: Uint8Array,
): "pdf" | "jpeg" | "png" | "webp" | "zip" | "unknown" {
  if (bytes.length < 4) return "unknown";

  // PDF: %PDF- (0x25, 0x50, 0x44, 0x46)
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "pdf";
  }

  // PNG: \x89PNG (0x89, 0x50, 0x4E, 0x47)
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }

  // JPEG: \xFF\xD8\xFF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }

  // ZIP / DOCX / XLSX / PPTX: PK\x03\x04 or PK\x05\x06 or PK\x07\x08
  if (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
  ) {
    return "zip";
  }

  // WEBP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "webp";
  }

  return "unknown";
}

/**
 * Validates PDF file integrity, size limit, and %PDF- magic bytes signature.
 */
export async function validatePdfFile(
  file: File,
  isPro: boolean = false,
): Promise<FileValidationResult> {
  const maxBytes = getMaxFileSizeBytes(isPro);
  const maxMb = getMaxFileSizeMb(isPro);

  if (!file || file.size <= 0) {
    return { valid: false, error: `"${file?.name || "File"}" is empty.` };
  }
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `"${file.name}" exceeds the ${maxMb} MB limit.`,
      isFileSizeLimitExceeded: true,
      fileSize: file.size,
      limitBytes: maxBytes,
    };
  }

  // Check extension
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return {
      valid: false,
      error: `"${file.name}" does not have a .pdf extension.`,
    };
  }

  // Magic bytes check (%PDF-)
  try {
    const slice = file.slice(0, 8);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const sig = detectFileSignature(bytes);
    if (sig !== "pdf") {
      return {
        valid: false,
        error: `"${file.name}" does not appear to be a valid PDF document. Corrupted or renamed files are not supported.`,
      };
    }
  } catch {
    return {
      valid: false,
      error: `Could not read "${file.name}". The file may be damaged.`,
    };
  }

  return { valid: true };
}

/**
 * Validates Image file integrity, size limit, and real JPEG/PNG/WEBP magic bytes signature.
 */
export async function validateImageFile(
  file: File,
  isPro: boolean = false,
): Promise<FileValidationResult> {
  const maxBytes = getMaxFileSizeBytes(isPro);
  const maxMb = getMaxFileSizeMb(isPro);

  if (!file || file.size <= 0) {
    return { valid: false, error: `"${file?.name || "File"}" is empty.` };
  }
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `"${file.name}" exceeds the ${maxMb} MB limit.`,
      isFileSizeLimitExceeded: true,
      fileSize: file.size,
      limitBytes: maxBytes,
    };
  }

  const validExts = [".jpg", ".jpeg", ".png", ".webp"];
  const lowerName = file.name.toLowerCase();
  const hasExt = validExts.some((ext) => lowerName.endsWith(ext));

  if (!hasExt && !file.type.startsWith("image/")) {
    return {
      valid: false,
      error: `"${file.name}" is not a supported image file (JPG, PNG, WEBP).`,
    };
  }

  // Magic bytes inspection
  try {
    const slice = file.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const sig = detectFileSignature(bytes);

    if (sig !== "jpeg" && sig !== "png" && sig !== "webp") {
      return {
        valid: false,
        error: `"${file.name}" is not a recognized or supported image format (JPG, PNG, WEBP). Corrupted or renamed files are not supported.`,
      };
    }
  } catch {
    return {
      valid: false,
      error: `Could not inspect "${file.name}". The file may be corrupt.`,
    };
  }

  return { valid: true };
}

/**
 * Validates Office file integrity, size limit, and real PK ZIP container magic bytes signature.
 */
export async function validateOfficeDocument(
  file: File,
  isPro: boolean = false,
): Promise<FileValidationResult> {
  const maxBytes = getMaxFileSizeBytes(isPro);
  const maxMb = getMaxFileSizeMb(isPro);

  if (!file || file.size <= 0) {
    return { valid: false, error: `"${file?.name || "File"}" is empty.` };
  }
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `"${file.name}" exceeds the ${maxMb} MB limit.`,
      isFileSizeLimitExceeded: true,
      fileSize: file.size,
      limitBytes: maxBytes,
    };
  }

  const validExts = [".docx", ".xlsx", ".pptx", ".doc", ".xls", ".ppt"];
  const lowerName = file.name.toLowerCase();
  const hasExt = validExts.some((ext) => lowerName.endsWith(ext));

  if (!hasExt) {
    return {
      valid: false,
      error: `"${file.name}" is not a supported Office document format (.docx, .xlsx, .pptx).`,
    };
  }

  // Inspect magic bytes for modern OpenXML files (.docx, .xlsx, .pptx)
  if (lowerName.endsWith(".docx") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".pptx")) {
    try {
      const slice = file.slice(0, 8);
      const buffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const sig = detectFileSignature(bytes);

      if (sig !== "zip") {
        return {
          valid: false,
          error: `"${file.name}" does not have a valid OpenXML document container. Corrupted or renamed files are not supported.`,
        };
      }
    } catch {
      return {
        valid: false,
        error: `Could not inspect "${file.name}". The file may be corrupt.`,
      };
    }
  }

  return { valid: true };
}
