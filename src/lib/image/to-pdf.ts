import { PDFDocument } from "pdf-lib";
import { loadImage } from "./convert";

/**
 * Converts an array of image files into a single multi-page PDF document.
 */
export async function imagesToPdf(
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<{ blob: Blob; pageCount: number; size: number }> {
  if (files.length === 0) {
    throw new Error("Please select at least one image to convert to PDF.");
  }

  const pdfDoc = await PDFDocument.create();
  const step = 100 / files.length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;

    const lowerName = file.name.toLowerCase();
    const isJpg =
      file.type === "image/jpeg" || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg");
    const isPng = file.type === "image/png" || lowerName.endsWith(".png");

    let embeddedImage;

    try {
      if (isJpg) {
        const buffer = await file.arrayBuffer();
        embeddedImage = await pdfDoc.embedJpg(buffer);
      } else if (isPng) {
        const buffer = await file.arrayBuffer();
        embeddedImage = await pdfDoc.embedPng(buffer);
      }
    } catch {
      embeddedImage = undefined;
    }

    // Fallback: Use HTML5 canvas to decode and re-encode to PNG for 100% compatibility
    if (!embeddedImage) {
      const img = await loadImage(file);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize canvas context for image conversion.");
      ctx.drawImage(img, 0, 0);

      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Canvas conversion failed"))),
          "image/png",
        );
      });
      const pngBuffer = await pngBlob.arrayBuffer();
      embeddedImage = await pdfDoc.embedPng(pngBuffer);
    }

    const { width, height } = embeddedImage;
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width,
      height,
    });

    onProgress?.(Math.round((i + 1) * step));
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  return { blob, size: blob.size, pageCount: files.length };
}
