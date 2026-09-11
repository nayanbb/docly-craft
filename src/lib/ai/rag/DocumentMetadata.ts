export interface DocumentMetadata {
  filename: string;
  totalPages: number;
  totalWords: number;
  totalCharacters: number;
  hasExtractableText: boolean;
  detectedScripts: string[];
  title?: string;
  author?: string;
  creationDate?: string;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  wordCount: number;
  charCount: number;
}

export interface ExtractedDocument extends DocumentMetadata {
  pages: ExtractedPage[];
  fullText: string;
}
