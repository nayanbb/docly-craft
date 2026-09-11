import { detectFileSignature, sanitizeFileName } from "./validation";

/**
 * Validates a generated Blob prior to download.
 * Ensures the output is not empty and matches the expected file format signature.
 * Prevents corrupted files, HTML error pages, or empty buffers from being downloaded.
 */
export async function validateGeneratedBlob(
  blob: Blob,
  filename: string,
): Promise<{ valid: boolean; error?: string }> {
  if (!blob || blob.size <= 0) {
    return { valid: false, error: "Cannot download an empty or non-existent file." };
  }

  const cleanName = sanitizeFileName(filename);
  const lowerName = cleanName.toLowerCase();

  try {
    const slice = blob.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const sig = detectFileSignature(bytes);

    if (lowerName.endsWith(".pdf")) {
      if (sig !== "pdf") {
        return {
          valid: false,
          error:
            "Generated file is not a valid PDF document. Download prevented to protect against corrupted output.",
        };
      }
    } else if (
      lowerName.endsWith(".zip") ||
      lowerName.endsWith(".docx") ||
      lowerName.endsWith(".xlsx") ||
      lowerName.endsWith(".pptx")
    ) {
      if (sig !== "zip") {
        return {
          valid: false,
          error: "Generated document package is corrupted or invalid. Download prevented.",
        };
      }
    } else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
      if (sig !== "jpeg") {
        return {
          valid: false,
          error: "Generated image is not a valid JPEG. Download prevented.",
        };
      }
    } else if (lowerName.endsWith(".png")) {
      if (sig !== "png") {
        return {
          valid: false,
          error: "Generated image is not a valid PNG. Download prevented.",
        };
      }
    } else if (lowerName.endsWith(".webp")) {
      if (sig !== "webp") {
        return {
          valid: false,
          error: "Generated image is not a valid WEBP. Download prevented.",
        };
      }
    }
  } catch {
    return {
      valid: false,
      error: "Failed to verify file integrity prior to download.",
    };
  }

  return { valid: true };
}

/**
 * Universal Download Utility for Docly.
 *
 * Requirements:
 * 1. Verify Blob exists and has size > 0
 * 2. Sanitize filename
 * 3. Create URL.createObjectURL(blob)
 * 4. Create a temporary anchor element
 * 5. Trigger download with correct sanitized filename
 * 6. Safely clean up anchor and revoke URL after sufficient delay
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (!blob || blob.size <= 0) {
    throw new Error("Cannot download an empty or non-existent file.");
  }

  if (typeof document === "undefined") {
    return;
  }

  const safeFilename = sanitizeFileName(filename, "docly-download");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.style.display = "none";
  anchor.href = url;
  anchor.download = safeFilename;

  document.body.appendChild(anchor);
  anchor.click();

  // Give the browser sufficient time to begin the file stream before revoking
  setTimeout(() => {
    try {
      if (document.body.contains(anchor)) {
        document.body.removeChild(anchor);
      }
      URL.revokeObjectURL(url);
    } catch {
      // Ignore if already revoked or cleaned up
    }
  }, 40000);
}

/**
 * Validates generated blob output before initiating browser download.
 */
export async function downloadValidatedBlob(blob: Blob, filename: string): Promise<void> {
  const check = await validateGeneratedBlob(blob, filename);
  if (!check.valid) {
    throw new Error(check.error || "Generated file failed validation. Download cancelled.");
  }
  downloadBlob(blob, filename);
}

/**
 * Helper to bundle multiple files into a single ZIP Blob.
 */
export async function createZipBlob(files: Array<{ name: string; blob: Blob }>): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  for (const item of files) {
    const safeName = sanitizeFileName(item.name, "file");
    zip.file(safeName, item.blob);
  }

  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/**
 * Helper to download multiple files bundled as a ZIP.
 */
export async function downloadZip(
  files: Array<{ name: string; blob: Blob }>,
  zipFilename: string,
): Promise<void> {
  const blob = await createZipBlob(files);
  await downloadValidatedBlob(blob, zipFilename);
}
