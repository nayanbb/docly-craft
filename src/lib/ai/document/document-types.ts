/**
 * Document types and interfaces for Docly's AI document processing pipeline.
 */

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  wordCount: number;
  charCount: number;
}

export interface ExtractedOutlineItem {
  title: string;
  snippet: string;
  pageNumber: number;
}

export interface KeywordMetric {
  word: string;
  count: number;
}

export interface ExtractedDocument {
  filename: string;
  totalPages: number;
  totalWords: number;
  totalCharacters: number;
  estimatedReadingMinutes: number;
  pages: ExtractedPage[];
  fullText: string;
  isScanned: boolean;
  hasExtractableText: boolean;
  outline: ExtractedOutlineItem[];
  topKeywords: KeywordMetric[];
}

export interface DocumentChunk {
  id: string;
  chunkIndex: number;
  startPage: number;
  endPage: number;
  pageNumbers: number[];
  text: string;
  wordCount: number;
  charCount: number;
}

export interface ChunkingOptions {
  maxChunkWords?: number;
  overlapWords?: number;
  preserveParagraphs?: boolean;
}

export type AiToolProcessingState =
  | "idle"
  | "uploading"
  | "validating"
  | "reading"
  | "extracting"
  | "ready"
  | "thinking"
  | "processing"
  | "generating"
  | "success"
  | "error"
  | "provider_not_configured";
