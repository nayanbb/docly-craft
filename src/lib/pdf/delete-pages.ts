import { PDFDocument } from "pdf-lib";

/**
 * Removes specified pages (1-indexed) from a PDF document.
 *
 * @param file The source PDF File
 * @param pagesToRemove Array of 1-indexed page numbers to delete
 * @returns Blob of the new PDF with pages removed
 */
export async function deletePdfPages(
  file: File,
  pagesToRemove: number[],
  onProgress?: (percent: number) => void,
): Promise<{ blob: Blob; originalCount: number; newCount: number }> {
  const buffer = await file.arrayBuffer();
  const sourceDoc = await PDFDocument.load(buffer, { ignoreEncryption: false });
  const originalCount = sourceDoc.getPageCount();

  const toRemoveSet = new Set(pagesToRemove);
  const remainingIndices: number[] = [];

  for (let i = 1; i <= originalCount; i++) {
    if (!toRemoveSet.has(i)) {
      remainingIndices.push(i - 1);
    }
  }

  if (remainingIndices.length === 0) {
    throw new Error("You cannot remove all pages from the document. At least 1 page must remain.");
  }
  if (remainingIndices.length === originalCount) {
    throw new Error("No pages were selected for removal.");
  }

  onProgress?.(30);

  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(sourceDoc, remainingIndices);
  copied.forEach((p) => newDoc.addPage(p));

  onProgress?.(80);

  const bytes = await newDoc.save();
  const newCount = newDoc.getPageCount();

  if (newCount !== originalCount - pagesToRemove.length && newCount !== remainingIndices.length) {
    throw new Error("Page removal validation failed. Page count did not match expected result.");
  }

  onProgress?.(100);

  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  return { blob, originalCount, newCount };
}
