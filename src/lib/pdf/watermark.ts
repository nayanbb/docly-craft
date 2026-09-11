import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

export interface WatermarkOptions {
  text: string;
  opacity?: number | undefined;
  fontSize?: number | undefined;
  rotation?: number | undefined;
  color?: "gray" | "red" | "blue" | "black" | undefined;
}

/**
 * Adds a diagonal text watermark across every page of a PDF document.
 */
export async function addPdfWatermark(
  file: File,
  options: WatermarkOptions,
  onProgress?: (percent: number) => void,
): Promise<{ blob: Blob; pageCount: number }> {
  const text = options.text.trim();
  if (!text) {
    throw new Error("Watermark text cannot be empty.");
  }

  const opacity = options.opacity ?? 0.25;
  const fontSize = options.fontSize ?? 48;
  const rotationDegrees = options.rotation ?? 45;

  const colorMap = {
    gray: rgb(0.5, 0.5, 0.5),
    red: rgb(0.9, 0.1, 0.1),
    blue: rgb(0.1, 0.3, 0.8),
    black: rgb(0, 0, 0),
  };
  const watermarkColor = colorMap[options.color ?? "gray"];

  const buffer = await file.arrayBuffer();
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: false });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const total = doc.getPageCount();

  for (let i = 0; i < total; i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    // Approximate center placement for rotated text
    const x = width / 2 - (textWidth / 2) * Math.cos((rotationDegrees * Math.PI) / 180);
    const y = height / 2 - (textHeight / 2) * Math.sin((rotationDegrees * Math.PI) / 180);

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: watermarkColor,
      opacity,
      rotate: degrees(rotationDegrees),
    });

    onProgress?.(Math.round(((i + 1) / total) * 90));
  }

  const bytes = await doc.save();
  onProgress?.(100);

  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  return { blob, pageCount: total };
}
