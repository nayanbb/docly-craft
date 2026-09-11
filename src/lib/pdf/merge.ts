import { PDFDocument } from "pdf-lib";

/**
 * Merges multiple PDF files into a single PDF document.
 *
 * @param files Array of PDF File objects
 * @param onProgress Callback receiving percentage complete (0-100)
 * @returns Blob containing the combined PDF
 */
export async function mergePdfFiles(
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  if (files.length < 2) {
    throw new Error("Please select at least 2 PDF files to merge.");
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
      const message = err instanceof Error ? err.message.toLowerCase() : "";
      if (
        message.includes("encrypt") ||
        message.includes("password") ||
        message.includes("decrypt")
      ) {
        throw new Error(`"${file.name}" is password-protected. Please unlock it before merging.`);
      }
      throw new Error(`Failed to parse "${file.name}". Make sure it is a valid PDF.`);
    }

    if (donor.isEncrypted) {
      throw new Error(`"${file.name}" is password-protected. Please unlock it before merging.`);
    }

    const pageCount = donor.getPageCount();
    const indices = Array.from({ length: pageCount }, (_, n) => n);
    const copiedPages = await merged.copyPages(donor, indices);
    copiedPages.forEach((page) => merged.addPage(page));

    onProgress?.(Math.round((i + 1) * step));
  }

  if (merged.getPageCount() === 0) {
    throw new Error("No pages could be merged from the selected documents.");
  }

  const bytes = await merged.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
