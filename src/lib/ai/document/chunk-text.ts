import type {
  ChunkingOptions,
  DocumentChunk,
  ExtractedDocument,
  ExtractedPage,
} from "@/lib/ai/document/document-types";
import { countWords } from "@/lib/ai/utils";

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  maxChunkWords: 500,
  overlapWords: 60,
  preserveParagraphs: true,
};

interface TextUnit {
  text: string;
  pageNumber: number;
  wordCount: number;
}

/**
 * Splits a document into manageable, context-preserving chunks.
 * Every chunk maintains an array of source page numbers so any citations
 * can trace back precisely to the original PDF pages.
 */
export function chunkDocument(
  document: ExtractedDocument,
  options?: ChunkingOptions,
): DocumentChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const units: TextUnit[] = [];

  // Break pages down into paragraph units
  for (const page of document.pages) {
    if (!page.text.trim()) continue;

    const paragraphs = page.text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (paragraphs.length === 0 && page.text.trim().length > 0) {
      const words = countWords(page.text);
      units.push({ text: page.text.trim(), pageNumber: page.pageNumber, wordCount: words });
    } else {
      for (const para of paragraphs) {
        const words = countWords(para);
        units.push({ text: para, pageNumber: page.pageNumber, wordCount: words });
      }
    }
  }

  if (units.length === 0) {
    return [];
  }

  const chunks: DocumentChunk[] = [];
  let currentUnits: TextUnit[] = [];
  let currentWordCount = 0;
  let chunkIndex = 0;

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    if (!unit) continue;

    // If a single unit exceeds maxChunkWords, split it by sentences
    if (unit.wordCount > opts.maxChunkWords) {
      const sentences = unit.text.match(/[^.!?]+[.!?]+(\s|$)/g) || [unit.text];
      for (const sent of sentences) {
        const sentWords = countWords(sent);
        if (currentWordCount + sentWords > opts.maxChunkWords && currentUnits.length > 0) {
          chunks.push(createChunk(currentUnits, chunkIndex++));
          // Apply overlap
          currentUnits = getOverlapUnits(currentUnits, opts.overlapWords);
          currentWordCount = currentUnits.reduce((sum, u) => sum + u.wordCount, 0);
        }
        currentUnits.push({ text: sent.trim(), pageNumber: unit.pageNumber, wordCount: sentWords });
        currentWordCount += sentWords;
      }
      continue;
    }

    if (currentWordCount + unit.wordCount > opts.maxChunkWords && currentUnits.length > 0) {
      chunks.push(createChunk(currentUnits, chunkIndex++));
      currentUnits = getOverlapUnits(currentUnits, opts.overlapWords);
      currentWordCount = currentUnits.reduce((sum, u) => sum + u.wordCount, 0);
    }

    currentUnits.push(unit);
    currentWordCount += unit.wordCount;
  }

  if (currentUnits.length > 0) {
    chunks.push(createChunk(currentUnits, chunkIndex++));
  }

  return chunks;
}

function getOverlapUnits(units: TextUnit[], targetOverlapWords: number): TextUnit[] {
  const overlap: TextUnit[] = [];
  let words = 0;

  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    if (!u) continue;
    overlap.unshift(u);
    words += u.wordCount;
    if (words >= targetOverlapWords) break;
  }

  return overlap;
}

function createChunk(units: TextUnit[], index: number): DocumentChunk {
  const text = units.map((u) => u.text).join("\n\n");
  const pageNumbers = Array.from(new Set(units.map((u) => u.pageNumber))).sort((a, b) => a - b);
  const startPage = pageNumbers[0] ?? 1;
  const endPage = pageNumbers[pageNumbers.length - 1] ?? startPage;
  const wordCount = units.reduce((sum, u) => sum + u.wordCount, 0);
  const charCount = text.length;

  return {
    id: `chunk-${index}-${startPage}-${endPage}`,
    chunkIndex: index,
    startPage,
    endPage,
    pageNumbers,
    text,
    wordCount,
    charCount,
  };
}
