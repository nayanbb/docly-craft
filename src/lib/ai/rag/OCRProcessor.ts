import { recognizeImageText, recognizePdfText, type OcrResult } from "@/lib/ai/ocr";

export interface OCRProgressCallback {
  (percent: number, status?: string): void;
}

export interface OCRPageResult {
  pageNumber: number;
  text: string;
}

export interface OCRDocumentResult {
  text: string;
  confidence: number;
  wordCount: number;
  pages: OCRPageResult[];
}

/**
 * Robust OCR Processor for RAG pipelines.
 * Leverages Tesseract.js to extract text from scanned documents and images.
 */
export class OCRProcessor {
  /**
   * Performs optical character recognition on an image file.
   */
  static async processImage(
    file: File,
    language: string = "eng",
    onProgress?: OCRProgressCallback,
  ): Promise<OCRDocumentResult> {
    const result: OcrResult = await recognizeImageText(file, language, onProgress);
    return {
      text: result.text,
      confidence: result.confidence,
      wordCount: result.wordCount,
      pages: [{ pageNumber: 1, text: result.text }],
    };
  }

  /**
   * Performs optical character recognition on a scanned PDF file.
   */
  static async processPdf(
    file: File,
    language: string = "eng",
    onProgress?: OCRProgressCallback,
  ): Promise<OCRDocumentResult> {
    const result: OcrResult = await recognizePdfText(file, language, onProgress);
    return {
      text: result.text,
      confidence: result.confidence,
      wordCount: result.wordCount,
      pages: result.pages || [{ pageNumber: 1, text: result.text }],
    };
  }
}
