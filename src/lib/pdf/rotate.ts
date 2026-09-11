import { PDFDocument, degrees } from "pdf-lib";

export type RotationAngle = 90 | 180 | 270;

/**
 * Rotates pages in a PDF document.
 *
 * @param file Source PDF
 * @param angle Rotation angle (90, 180, 270)
 * @param selectedPages Optional array of 1-indexed pages to rotate. If omitted, all pages are rotated.
 * @returns Blob of rotated PDF
 */
export async function rotatePdfPages(
  file: File,
  angle: RotationAngle,
  selectedPages?: number[],
  onProgress?: (percent: number) => void,
): Promise<{ blob: Blob; pageCount: number }> {
  const buffer = await file.arrayBuffer();
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: false });
  const total = doc.getPageCount();

  const selectedSet = selectedPages ? new Set(selectedPages) : null;

  for (let i = 0; i < total; i++) {
    const pageNum = i + 1;
    if (selectedSet && !selectedSet.has(pageNum)) {
      continue;
    }

    const page = doc.getPage(i);
    const currentRotation = page.getRotation().angle;
    const newRotation = (currentRotation + angle) % 360;
    page.setRotation(degrees(newRotation));

    onProgress?.(Math.round(((i + 1) / total) * 90));
  }

  const bytes = await doc.save();
  onProgress?.(100);

  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  return { blob, pageCount: total };
}
