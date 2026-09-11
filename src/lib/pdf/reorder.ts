import { PDFDocument } from "pdf-lib";

/**
 * Reorders pages of a PDF document according to an array of 1-indexed page numbers.
 *
 * @param file Source PDF
 * @param newOrder Array of 1-indexed page numbers in their new sequence
 * @returns Blob of reordered PDF
 */
export async function reorderPdfPages(
  file: File,
  newOrder: number[],
  onProgress?: (percent: number) => void,
): Promise<{ blob: Blob; pageCount: number }> {
  if (newOrder.length === 0) {
    throw new Error("No page order specified.");
  }

  const buffer = await file.arrayBuffer();
  const sourceDoc = await PDFDocument.load(buffer, { ignoreEncryption: false });
  const total = sourceDoc.getPageCount();

  if (newOrder.length !== total) {
    throw new Error(`Reorder list must contain all ${total} pages.`);
  }

  const indices = newOrder.map((num) => {
    if (num < 1 || num > total) {
      throw new Error(`Invalid page number in reorder sequence: ${num}`);
    }
    return num - 1;
  });

  onProgress?.(30);

  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(sourceDoc, indices);
  copied.forEach((page) => newDoc.addPage(page));

  onProgress?.(80);

  const bytes = await newDoc.save();
  onProgress?.(100);

  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  return { blob, pageCount: newDoc.getPageCount() };
}
