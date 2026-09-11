import { loadPdfJsDoc } from "@/lib/pdf/pdfjs";
import type { ExtractedDocument, ExtractedPage } from "./DocumentMetadata";
import { countWords, detectScripts } from "@/lib/ai/utils";

export interface ExtractionProgressCallback {
  (percent: number, status: string): void;
}

function normalizePageText(rawText: string): string {
  return rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * Reusable DocumentTextExtractor component.
 * Extracts text page-by-page from PDF documents, preserving exact page boundaries.
 */
export async function extractPdfTextPages(
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
  const doc = await loadPdfJsDoc(buffer);
  const numPages = doc.numPages;

  if (numPages === 0) {
    throw new Error("The PDF document contains no pages.");
  }

  const pages: ExtractedPage[] = [];
  let totalChars = 0;
  let totalWords = 0;
  let emptyPageCount = 0;

  for (let i = 1; i <= numPages; i++) {
    const progressPercent = Math.min(85, Math.round(10 + (i / numPages) * 75));
    onProgress?.(progressPercent, `Extracting text from page ${i} of ${numPages}...`);

    try {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();

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

      totalWords += pageWords;
      totalChars += pageChars;
    } catch {
      pages.push({
        pageNumber: i,
        text: "",
        wordCount: 0,
        charCount: 0,
      });
      emptyPageCount++;
    }
  }

  const hasExtractableText = totalWords >= 20 || emptyPageCount < numPages * 0.75;
  const fullText = pages.map((p) => p.text).filter(Boolean).join("\n\n");
  const detectedScripts = detectScripts(fullText);

  return {
    filename: actualFilename,
    totalPages: numPages,
    totalWords,
    totalCharacters: totalChars,
    hasExtractableText,
    detectedScripts,
    pages,
    fullText,
  };
}
