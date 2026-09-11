import { PDFDocument } from "pdf-lib";

/**
 * Extracts specified pages (1-indexed) from a PDF document into a new PDF.
 *
 * @param file Source PDF
 * @param pagesToExtract Array of 1-indexed page numbers to extract
 * @returns Blob of extracted PDF
 */
export async function extractPdfPages(
  file: File,
  pagesToExtract: number[],
  onProgress?: (percent: number) => void,
): Promise<{ blob: Blob; pageCount: number }> {
  if (pagesToExtract.length === 0) {
    throw new Error("Please select at least one page to extract.");
  }

  const buffer = await file.arrayBuffer();
  const sourceDoc = await PDFDocument.load(buffer, { ignoreEncryption: false });
  const maxPages = sourceDoc.getPageCount();

  const validIndices: number[] = [];
  for (const p of pagesToExtract) {
    if (p < 1 || p > maxPages) {
      throw new Error(`Invalid page number: ${p}. Document has ${maxPages} pages.`);
    }
    validIndices.push(p - 1);
  }

  onProgress?.(30);

  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(sourceDoc, validIndices);
  copied.forEach((page) => newDoc.addPage(page));

  onProgress?.(80);

  const bytes = await newDoc.save();
  onProgress?.(100);

  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  return { blob, pageCount: newDoc.getPageCount() };
}
