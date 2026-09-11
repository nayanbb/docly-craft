import { PDFDocument } from "pdf-lib";

export interface CropMargins {
  top: number; // in points (1 pt = 1/72 inch)
  bottom: number;
  left: number;
  right: number;
}

/**
 * Adjusts the CropBox and MediaBox of all pages in a PDF document to trim margins.
 */
export async function cropPdf(
  file: File,
  margins: CropMargins,
  onProgress?: (percent: number) => void,
): Promise<{ blob: Blob; pageCount: number }> {
  const buffer = await file.arrayBuffer();
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: false });
  const total = doc.getPageCount();

  for (let i = 0; i < total; i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();

    const newX = margins.left;
    const newY = margins.bottom;
    const newWidth = width - (margins.left + margins.right);
    const newHeight = height - (margins.top + margins.bottom);

    if (newWidth <= 20 || newHeight <= 20) {
      throw new Error(
        `Margins are too large for page ${i + 1} (${Math.round(width)}x${Math.round(height)} pt). Resulting size would be invalid.`,
      );
    }

    page.setCropBox(newX, newY, newWidth, newHeight);

    onProgress?.(Math.round(((i + 1) / total) * 90));
  }

  const bytes = await doc.save();
  onProgress?.(100);

  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  return { blob, pageCount: total };
}
