import { FILE_SIZE_LIMITS, getMaxFileSizeBytes, getMaxFileSizeMb } from "@/lib/monetization/config";

export const MAX_FILE_SIZE_BYTES = FILE_SIZE_LIMITS.freeMaxBytes; // 50 MB Free default

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  isFileSizeLimitExceeded?: boolean;
  fileSize?: number;
  limitBytes?: number;
}

export async function validatePdfFile(
  file: File,
  isPro: boolean = false,
): Promise<FileValidationResult> {
  const maxBytes = getMaxFileSizeBytes(isPro);
  const maxMb = getMaxFileSizeMb(isPro);

  if (file.size <= 0) {
    return { valid: false, error: `"${file.name}" is empty.` };
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
    const slice = file.slice(0, 5);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const header = String.fromCharCode(...bytes);
    if (!header.startsWith("%PDF-")) {
      return {
        valid: false,
        error: `"${file.name}" does not appear to be a valid PDF document.`,
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

export async function validateImageFile(
  file: File,
  isPro: boolean = false,
): Promise<FileValidationResult> {
  const maxBytes = getMaxFileSizeBytes(isPro);
  const maxMb = getMaxFileSizeMb(isPro);

  if (file.size <= 0) {
    return { valid: false, error: `"${file.name}" is empty.` };
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

  return { valid: true };
}
