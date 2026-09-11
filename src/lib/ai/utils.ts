import type { ExtractedOutlineItem, KeywordMetric } from "@/lib/ai/document/document-types";

const COMMON_STOP_WORDS = new Set([
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "also",
  "and",
  "any",
  "are",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "can",
  "could",
  "did",
  "does",
  "doing",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "has",
  "have",
  "having",
  "here",
  "how",
  "into",
  "its",
  "just",
  "more",
  "most",
  "only",
  "other",
  "our",
  "out",
  "over",
  "same",
  "should",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "until",
  "very",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "will",
  "with",
  "would",
]);

/**
 * Calculates genuine word count from raw text.
 */
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Estimates reading time in minutes based on 200 words per minute.
 */
export function estimateReadingTimeMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 200));
}

/**
 * Extracts top keywords from document text, excluding common stopwords.
 */
export function extractTopKeywords(text: string, limit: number = 8): KeywordMetric[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !COMMON_STOP_WORDS.has(w) && !/^\d+$/.test(w));

  const frequency: Record<string, number> = {};
  for (const word of words) {
    frequency[word] = (frequency[word] ?? 0) + 1;
  }

  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

/**
 * Extracts candidate outline sections (headings, numbered clauses, capitalized lines)
 * preserving page location.
 */
export function extractDocumentOutline(
  pages: Array<{ pageNumber: number; text: string }>,
  limit: number = 10,
): ExtractedOutlineItem[] {
  const outline: ExtractedOutlineItem[] = [];

  for (const page of pages) {
    const lines = page.text
      .split(/(?:\r?\n|(?<=[.!?])\s+(?=[0-9]+[.)]\s+[A-Z]))/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const isHeadingPattern =
        line.length <= 120 &&
        line.length >= 3 &&
        (/^[0-9]+[.)]\s/.test(line) ||
          /^[0-9]+(\.[0-9]+)*\s+[A-Z]/.test(line) ||
          /^[A-Z\s0-9:_-]{4,}$/.test(line) ||
          /^(Chapter|Section|Part|Article|Module)\s+[0-9IVXLCDM]+/i.test(line) ||
          line.endsWith(":"));

      if (isHeadingPattern) {
        // Collect following lines as a snippet
        const snippetLines = lines
          .slice(i + 1, i + 3)
          .join(" ")
          .slice(0, 140);
        outline.push({
          title: line,
          snippet: snippetLines || line,
          pageNumber: page.pageNumber,
        });

        if (outline.length >= limit) {
          return outline;
        }
      }
    }
  }

  return outline;
}

/**
 * Finds matching snippets across document pages for a user search query.
 */
export function searchDocumentPages(
  query: string,
  pages: Array<{ pageNumber: number; text: string }>,
  maxResults: number = 5,
): Array<{ pageNumber: number; snippet: string; matchCount: number }> {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return [];

  const queryTerms = cleanQuery.split(/\s+/).filter((term) => term.length > 2);
  if (queryTerms.length === 0) return [];

  const results: Array<{ pageNumber: number; snippet: string; matchCount: number }> = [];

  for (const page of pages) {
    const lowerText = page.text.toLowerCase();
    let matchCount = 0;

    for (const term of queryTerms) {
      const occurrences = lowerText.split(term).length - 1;
      matchCount += occurrences;
    }

    if (matchCount > 0) {
      // Find the best snippet position
      const firstFoundTerm =
        queryTerms.find((term) => lowerText.includes(term)) ?? queryTerms[0] ?? "";
      const matchIndex = lowerText.indexOf(firstFoundTerm);
      const start = Math.max(0, matchIndex - 60);
      const end = Math.min(page.text.length, matchIndex + 140);

      const snippet = (start > 0 ? "..." : "") + page.text.slice(start, end).trim() + "...";

      results.push({
        pageNumber: page.pageNumber,
        snippet,
        matchCount,
      });
    }
  }

  return results.sort((a, b) => b.matchCount - a.matchCount).slice(0, maxResults);
}
