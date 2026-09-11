import type { ExtractedDocument, ExtractedPage } from "./DocumentMetadata";
import { countWords } from "@/lib/ai/utils";

export interface DocumentChunk {
  id: string;
  pageNumber: number;
  pageEndNumber?: number;
  text: string;
  charCount: number;
  wordCount: number;
  index: number;
}

export interface ChunkerOptions {
  maxChunkSize?: number; // In characters, default 1200
  chunkOverlap?: number; // In characters, default 200
}

/**
 * Semantic document chunker that splits document text by page and paragraph boundaries
 * while maintaining page metadata and configurable overlapping windows for retrieval.
 */
export class DocumentChunker {
  static chunkDocument(
    doc: ExtractedDocument,
    options: ChunkerOptions = {},
  ): DocumentChunk[] {
    const maxChunkSize = options.maxChunkSize ?? 1200;
    const chunkOverlap = options.chunkOverlap ?? 200;

    const chunks: DocumentChunk[] = [];
    let chunkCounter = 0;

    for (const page of doc.pages) {
      const pageChunks = DocumentChunker.chunkPage(page, maxChunkSize, chunkOverlap, chunkCounter);
      chunkCounter += pageChunks.length;
      chunks.push(...pageChunks);
    }

    return chunks;
  }

  private static chunkPage(
    page: ExtractedPage,
    maxSize: number,
    overlap: number,
    startIndex: number,
  ): DocumentChunk[] {
    const text = page.text.trim();
    if (!text) return [];

    if (text.length <= maxSize) {
      return [
        {
          id: `p${page.pageNumber}_c0`,
          pageNumber: page.pageNumber,
          text,
          charCount: text.length,
          wordCount: countWords(text),
          index: startIndex,
        },
      ];
    }

    // Split page text into paragraphs
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const result: DocumentChunk[] = [];
    let currentBuffer = "";
    let chunkIdx = 0;

    for (const para of paragraphs) {
      if (currentBuffer.length + para.length + 2 <= maxSize) {
        currentBuffer = currentBuffer ? `${currentBuffer}\n\n${para}` : para;
      } else {
        if (currentBuffer) {
          result.push({
            id: `p${page.pageNumber}_c${chunkIdx++}`,
            pageNumber: page.pageNumber,
            text: currentBuffer,
            charCount: currentBuffer.length,
            wordCount: countWords(currentBuffer),
            index: startIndex + result.length,
          });

          // Compute overlap carry-over
          if (overlap > 0 && currentBuffer.length > overlap) {
            const words = currentBuffer.split(/\s+/);
            const tailWords = words.slice(-Math.max(5, Math.floor(overlap / 6)));
            currentBuffer = tailWords.join(" ") + "\n\n" + para;
          } else {
            currentBuffer = para;
          }
        } else {
          // A single paragraph is larger than maxSize, split by sentence or slice
          const sentences = para.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [para];
          for (const s of sentences) {
            const trimmed = s.trim();
            if (!trimmed) continue;
            if (currentBuffer.length + trimmed.length + 1 <= maxSize) {
              currentBuffer = currentBuffer ? `${currentBuffer} ${trimmed}` : trimmed;
            } else {
              if (currentBuffer) {
                result.push({
                  id: `p${page.pageNumber}_c${chunkIdx++}`,
                  pageNumber: page.pageNumber,
                  text: currentBuffer,
                  charCount: currentBuffer.length,
                  wordCount: countWords(currentBuffer),
                  index: startIndex + result.length,
                });
              }
              currentBuffer = trimmed;
            }
          }
        }
      }
    }

    if (currentBuffer.trim()) {
      result.push({
        id: `p${page.pageNumber}_c${chunkIdx++}`,
        pageNumber: page.pageNumber,
        text: currentBuffer.trim(),
        charCount: currentBuffer.length,
        wordCount: countWords(currentBuffer),
        index: startIndex + result.length,
      });
    }

    return result;
  }
}
