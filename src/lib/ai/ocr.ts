import { convertPdfToImages } from "@/lib/pdf/pdf-to-images";

export interface OcrResult {
  text: string;
  confidence: number;
  wordCount: number;
  pages?: Array<{ pageNumber: number; text: string }>;
}

/**
 * Runs OCR on an image file using Tesseract.js.
 */
export async function recognizeImageText(
  file: File,
  language: string = "eng",
  onProgress?: (percent: number, status?: string) => void,
): Promise<OcrResult> {
  onProgress?.(10, "Initializing OCR engine...");
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(language);

  onProgress?.(30, "Analyzing image text...");
  const ret = await worker.recognize(file);
  await worker.terminate();

  onProgress?.(100, "Done");

  const text = ret.data.text.trim();
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

  return {
    text,
    confidence: Math.round(ret.data.confidence),
    wordCount,
  };
}

/**
 * Runs OCR on a PDF document by rendering pages with PDF.js and running Tesseract on each page.
 */
export async function recognizePdfText(
  file: File,
  language: string = "eng",
  onProgress?: (percent: number, status?: string) => void,
): Promise<OcrResult> {
  onProgress?.(10, "Rendering PDF pages...");
  const pageImages = await convertPdfToImages(file, "png", 0.95, 1.5, (cur, tot) => {
    onProgress?.(10 + Math.round((cur / tot) * 20), `Rendering page ${cur} of ${tot}...`);
  });

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(language);
  const totalPages = pageImages.length;
  const pageResults: Array<{ pageNumber: number; text: string }> = [];
  let totalConfidence = 0;

  for (let i = 0; i < totalPages; i++) {
    const p = pageImages[i];
    if (!p) continue;

    onProgress?.(
      30 + Math.round(((i + 1) / totalPages) * 65),
      `Running OCR on page ${p.pageNumber} of ${totalPages}...`,
    );

    const ret = await worker.recognize(p.blob);
    totalConfidence += ret.data.confidence;
    pageResults.push({
      pageNumber: p.pageNumber,
      text: ret.data.text.trim(),
    });
  }

  await worker.terminate();
  onProgress?.(100, "Complete");

  const combinedText = pageResults
    .map((p) => `=== Page ${p.pageNumber} ===\n${p.text}`)
    .join("\n\n");
  const wordCount = combinedText.split(/\s+/).filter(Boolean).length;

  return {
    text: combinedText,
    confidence: totalPages > 0 ? Math.round(totalConfidence / totalPages) : 0,
    wordCount,
    pages: pageResults,
  };
}
