import { loadPdfJsDoc } from "@/lib/pdf/pdfjs";
import { recognizePdfText } from "@/lib/ai/ocr";
import type { ExtractedDocument, ExtractedPage } from "@/lib/ai/document/document-types";
import {
  countWords,
  estimateReadingTimeMinutes,
  extractDocumentOutline,
  extractTopKeywords,
} from "@/lib/ai/utils";

export interface ExtractionProgressCallback {
  (percent: number, status: string): void;
}

/**
 * Normalizes text content from PDF.js items, preserving paragraph breaks
 * while removing excess internal whitespace and isolated empty lines.
 */
function normalizePageText(rawText: string): string {
  return rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * Robust, privacy-first PDF text extraction pipeline.
 * Extracts text page-by-page, detects scanned pages, and constructs
 * an ExtractedDocument representation with statistics and outlines.
 */
export async function extractDocumentText(
  source: File | ArrayBuffer,
  filename?: string,
  onProgress?: ExtractionProgressCallback,
): Promise<ExtractedDocument> {
  const actualFilename = filename || (source instanceof File ? source.name : "document.pdf");
  const buffer = source instanceof File ? await source.arrayBuffer() : source;

  if (!buffer || buffer.byteLength === 0) {
    throw new Error("Cannot extract text from an empty or missing file buffer.");
  }

  onProgress?.(5, "Loading PDF structure...");
  let doc;
  try {
    doc = await loadPdfJsDoc(buffer);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read PDF document: ${errorMsg}`);
  }

  const numPages = doc.numPages;
  if (numPages === 0) {
    throw new Error("The PDF document contains no pages.");
  }

  const pages: ExtractedPage[] = [];
  let totalChars = 0;
  let totalWords = 0;
  let emptyPageCount = 0;

  for (let i = 1; i <= numPages; i++) {
    const progressPercent = Math.min(80, Math.round(10 + (i / numPages) * 70));
    onProgress?.(progressPercent, `Extracting text from page ${i} of ${numPages}...`);

    try {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();

      // Combine text items respecting line structure
      let pageRaw = "";
      let lastY: number | null = null;

      for (const item of textContent.items) {
        if (!("str" in item)) continue;
        const textItem = item as { str: string; transform: number[] };
        const currentY = textItem.transform[5] ?? 0;

        if (lastY !== null && Math.abs(currentY - lastY) > 6) {
          pageRaw += "\n" + textItem.str;
        } else {
          pageRaw +=
            (pageRaw.length > 0 && !pageRaw.endsWith("\n") && !pageRaw.endsWith(" ") ? " " : "") +
            textItem.str;
        }
        lastY = currentY;
      }

      const cleanText = normalizePageText(pageRaw);
      const pageWords = countWords(cleanText);
      const pageChars = cleanText.length;

      if (pageChars < 15) {
        emptyPageCount++;
      }

      pages.push({
        pageNumber: i,
        text: cleanText,
        wordCount: pageWords,
        charCount: pageChars,
      });

      totalChars += pageChars;
      totalWords += pageWords;
    } catch (pageErr) {
      console.warn(`Failed to extract text from page ${i}:`, pageErr);
      pages.push({
        pageNumber: i,
        text: "",
        wordCount: 0,
        charCount: 0,
      });
      emptyPageCount++;
    }
  }

  // Scanned Document Fallback: If more than 70% of pages are essentially blank,
  // run OCR fallback using the existing Tesseract implementation if a File object was passed
  let isScanned = false;
  const isLikelyScanned = numPages > 0 && emptyPageCount / numPages >= 0.7 && totalWords < 30;

  if (isLikelyScanned && source instanceof File) {
    onProgress?.(82, "Document appears scanned. Initializing OCR fallback...");
    try {
      const ocrResult = await recognizePdfText(source, "eng", (ocrPct, ocrStatus) => {
        const scaledPct = Math.round(82 + (ocrPct / 100) * 15);
        onProgress?.(scaledPct, ocrStatus || "Running OCR on scanned document...");
      });

      if (ocrResult.pages && ocrResult.pages.length > 0) {
        isScanned = true;
        pages.length = 0;
        totalChars = 0;
        totalWords = 0;

        for (const p of ocrResult.pages) {
          const cleanOcrText = normalizePageText(p.text);
          const wCount = countWords(cleanOcrText);
          const cCount = cleanOcrText.length;

          pages.push({
            pageNumber: p.pageNumber,
            text: cleanOcrText,
            wordCount: wCount,
            charCount: cCount,
          });
          totalChars += cCount;
          totalWords += wCount;
        }
      }
    } catch (ocrErr) {
      console.warn("OCR fallback failed, retaining initial extraction:", ocrErr);
    }
  }

  onProgress?.(98, "Analyzing document structure & keywords...");

  const fullText = pages
    .map((p) =>
      p.text
        ? `[Page ${p.pageNumber}]\n${p.text}`
        : `[Page ${p.pageNumber}]\n(No text detected on this page)`,
    )
    .join("\n\n");

  const outline = extractDocumentOutline(pages, 10);
  const topKeywords = extractTopKeywords(fullText, 8);
  const readingTime = estimateReadingTimeMinutes(totalWords);
  const hasExtractableText = totalWords >= 5 && totalChars >= 15;

  onProgress?.(100, "Text extraction complete.");

  return {
    filename: actualFilename,
    totalPages: numPages,
    totalWords,
    totalCharacters: totalChars,
    estimatedReadingMinutes: readingTime,
    pages,
    fullText,
    isScanned,
    hasExtractableText,
    outline,
    topKeywords,
  };
}
