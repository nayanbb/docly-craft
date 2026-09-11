import type { ExtractedDocument, ExtractedPage } from "./DocumentMetadata";
import { extractPdfTextPages, type ExtractionProgressCallback } from "./DocumentTextExtractor";
import { OCRProcessor } from "./OCRProcessor";
import { countWords, detectScripts } from "@/lib/ai/utils";

export interface DocumentParserOptions {
  enableOcrFallback?: boolean;
  ocrLanguage?: string;
  onProgress?: ExtractionProgressCallback;
}

/**
 * Unified DocumentParser for PDF and Image inputs.
 * Gracefully cascades from native PDF digital text extraction to OCR fallback for scanned documents.
 */
export class DocumentParser {
  static async parse(
    source: File | ArrayBuffer,
    filename?: string,
    options: DocumentParserOptions = {},
  ): Promise<ExtractedDocument> {
    const { enableOcrFallback = true, ocrLanguage = "eng", onProgress } = options;
    const actualFilename = filename || (source instanceof File ? source.name : "document.pdf");
    const isImage = source instanceof File && source.type.startsWith("image/");

    if (isImage && source instanceof File) {
      onProgress?.(10, "Processing image with OCR...");
      const ocrResult = await OCRProcessor.processImage(
        source,
        ocrLanguage,
        (pct, status) => onProgress?.(pct, status),
      );

      const page: ExtractedPage = {
        pageNumber: 1,
        text: ocrResult.text,
        wordCount: ocrResult.wordCount,
        charCount: ocrResult.text.length,
      };

      return {
        filename: actualFilename,
        totalPages: 1,
        totalWords: ocrResult.wordCount,
        totalCharacters: ocrResult.text.length,
        hasExtractableText: ocrResult.wordCount > 0,
        detectedScripts: detectScripts(ocrResult.text),
        pages: [page],
        fullText: ocrResult.text,
      };
    }

    // Default: PDF extraction
    onProgress?.(5, "Reading PDF structure...");
    let extracted = await extractPdfTextPages(source, actualFilename, onProgress);

    // If PDF text is minimal or missing and OCR fallback is enabled and we have a File
    if (!extracted.hasExtractableText && enableOcrFallback && source instanceof File) {
      onProgress?.(50, "Minimal text detected. Running OCR on scanned document...");
      try {
        const ocrResult = await OCRProcessor.processPdf(
          source,
          ocrLanguage,
          (pct, status) => {
            const scaled = Math.round(50 + (pct / 100) * 45);
            onProgress?.(scaled, status || "OCR in progress...");
          },
        );

        if (ocrResult.pages.length > 0 && ocrResult.wordCount > extracted.totalWords) {
          const pages: ExtractedPage[] = ocrResult.pages.map((p) => ({
            pageNumber: p.pageNumber,
            text: p.text,
            wordCount: countWords(p.text),
            charCount: p.text.length,
          }));

          const fullText = pages.map((p) => p.text).filter(Boolean).join("\n\n");
          extracted = {
            filename: actualFilename,
            totalPages: pages.length,
            totalWords: countWords(fullText),
            totalCharacters: fullText.length,
            hasExtractableText: fullText.trim().length > 0,
            detectedScripts: detectScripts(fullText),
            pages,
            fullText,
          };
        }
      } catch (err) {
        console.warn("OCR fallback encountered an error, falling back to raw extracted text:", err);
      }
    }

    onProgress?.(100, "Document parsing complete.");
    return extracted;
  }
}
