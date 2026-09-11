import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PageNumberPosition =
  "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right";

export type PageNumberFormat = "page-x-of-y" | "x-slash-y" | "x-only" | "dash-x-dash";

export interface PageNumberOptions {
  position?: PageNumberPosition;
  startingNumber?: number;
  format?: PageNumberFormat;
  fontSize?: number;
}

/**
 * Inserts formatted page numbers onto each page of a PDF document.
 */
export async function addPdfPageNumbers(
  file: File,
  options?: PageNumberOptions,
  onProgress?: (percent: number) => void,
): Promise<{ blob: Blob; pageCount: number }> {
  const position = options?.position ?? "bottom-center";
  const startingNumber = options?.startingNumber ?? 1;
  const format = options?.format ?? "page-x-of-y";
  const fontSize = options?.fontSize ?? 10;

  const buffer = await file.arrayBuffer();
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const total = doc.getPageCount();

  const margin = 24;

  for (let i = 0; i < total; i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const currentNum = startingNumber + i;

    let text = "";
    switch (format) {
      case "page-x-of-y":
        text = `Page ${currentNum} of ${total + startingNumber - 1}`;
        break;
      case "x-slash-y":
        text = `${currentNum} / ${total + startingNumber - 1}`;
        break;
      case "dash-x-dash":
        text = `- ${currentNum} -`;
        break;
      case "x-only":
      default:
        text = `${currentNum}`;
        break;
    }

    const textWidth = font.widthOfTextAtSize(text, fontSize);

    let x = margin;
    let y = margin;

    if (position === "bottom-center") {
      x = (width - textWidth) / 2;
      y = margin;
    } else if (position === "bottom-right") {
      x = width - textWidth - margin;
      y = margin;
    } else if (position === "bottom-left") {
      x = margin;
      y = margin;
    } else if (position === "top-center") {
      x = (width - textWidth) / 2;
      y = height - margin - fontSize;
    } else if (position === "top-right") {
      x = width - textWidth - margin;
      y = height - margin - fontSize;
    }

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    onProgress?.(Math.round(((i + 1) / total) * 90));
  }

  const bytes = await doc.save();
  onProgress?.(100);

  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  return { blob, pageCount: total };
}
