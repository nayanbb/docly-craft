import { PDFDocument } from "pdf-lib";

/**
 * Backward compatibility wrapper for mergePdfFiles.
 */
export async function mergePdfFiles(
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<Uint8Array> {
  if (files.length === 0) {
    throw new Error("No files provided.");
  }

  const merged = await PDFDocument.create();
  const step = 100 / files.length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch {
      throw new Error(`Failed to read file "${file.name}". The file may be corrupted.`);
    }

    let donor: PDFDocument;
    try {
      donor = await PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.toLowerCase().includes("encrypt") ||
        message.toLowerCase().includes("password") ||
        message.toLowerCase().includes("decrypt")
      ) {
        throw new Error(
          `"${file.name}" is password-protected (encrypted). Please unlock it before merging.`,
        );
      }
      throw new Error(`Failed to parse "${file.name}". Make sure it is a valid PDF file.`);
    }

    if (donor.isEncrypted) {
      throw new Error(
        `"${file.name}" is password-protected (encrypted). Please unlock it before merging.`,
      );
    }

    const pageCount = donor.getPageCount();
    const indices = Array.from({ length: pageCount }, (_, n) => n);
    const copiedPages = await merged.copyPages(donor, indices);
    copiedPages.forEach((page) => merged.addPage(page));
    onProgress?.(Math.round((i + 1) * step));
  }

  return merged.save();
}
