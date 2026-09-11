/**
 * Universal Download Utility for Docly.
 *
 * Requirements:
 * 1. Verify Blob exists and has size > 0
 * 2. Create URL.createObjectURL(blob)
 * 3. Create a temporary anchor element
 * 4. Trigger download with correct filename
 * 5. Safely clean up anchor and revoke URL after sufficient delay
 */

export function downloadBlob(blob: Blob, filename: string): void {
  if (!blob || blob.size <= 0) {
    throw new Error("Cannot download an empty or non-existent file.");
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.style.display = "none";
  anchor.href = url;
  anchor.download = filename;

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
 * Helper to bundle multiple files into a single ZIP Blob.
 */
export async function createZipBlob(files: Array<{ name: string; blob: Blob }>): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  for (const item of files) {
    zip.file(item.name, item.blob);
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
  downloadBlob(blob, zipFilename);
}
