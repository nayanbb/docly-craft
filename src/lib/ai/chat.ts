import type { ExtractedDocument } from "@/lib/ai/document/document-types";
import { chunkDocument } from "@/lib/ai/document/chunk-text";
import { getActiveAIProvider, type ChatAnswer, type ChatMessage } from "@/lib/ai/providers";

export interface RelevantChunkResult {
  chunkId: string;
  startPage: number;
  endPage: number;
  pageNumbers: number[];
  text: string;
  relevanceScore: number;
  snippet: string;
}

/**
 * Searches and ranks document chunks based on user query terms.
 * Used for RAG context selection and local page citation highlighting.
 */
export function searchRelevantChunks(
  doc: ExtractedDocument,
  query: string,
  topK: number = 4,
): RelevantChunkResult[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (terms.length === 0) return [];

  const chunks = chunkDocument(doc, { maxChunkWords: 350, overlapWords: 40 });
  const scoredChunks: RelevantChunkResult[] = [];

  for (const chunk of chunks) {
    const lowerText = chunk.text.toLowerCase();
    let score = 0;

    for (const term of terms) {
      const occurrences = lowerText.split(term).length - 1;
      if (occurrences > 0) {
        score += occurrences * (term.length > 5 ? 2 : 1);
      }
    }

    if (score > 0) {
      // Find snippet position
      const firstFound = terms.find((t) => lowerText.includes(t)) ?? terms[0] ?? "";
      const idx = lowerText.indexOf(firstFound);
      const start = Math.max(0, idx - 50);
      const end = Math.min(chunk.text.length, idx + 150);
      const snippet = (start > 0 ? "..." : "") + chunk.text.slice(start, end).trim() + "...";

      scoredChunks.push({
        chunkId: chunk.id,
        startPage: chunk.startPage,
        endPage: chunk.endPage,
        pageNumbers: chunk.pageNumbers,
        text: chunk.text,
        relevanceScore: score,
        snippet,
      });
    }
  }

  return scoredChunks.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, topK);
}

/**
 * Generates document-aware suggested questions based on genuine extracted outline and keywords.
 */
export function generateSuggestedQuestions(doc: ExtractedDocument): string[] {
  const suggestions: string[] = [];

  // If outline items exist, base questions on major sections
  if (doc.outline && doc.outline.length > 0) {
    const firstOutline = doc.outline[0]?.title.replace(/^[0-9.:\s]+/, "").trim();
    if (firstOutline) {
      suggestions.push(`What does the document state about ${firstOutline}?`);
    }
    if (doc.outline.length > 1) {
      const secondOutline = doc.outline[1]?.title.replace(/^[0-9.:\s]+/, "").trim();
      if (secondOutline) {
        suggestions.push(`Summarize the key takeaways of ${secondOutline}.`);
      }
    }
  }

  // If keywords exist, suggest keyword synthesis
  if (doc.topKeywords && doc.topKeywords.length >= 2) {
    const kw1 = doc.topKeywords[0]?.word;
    const kw2 = doc.topKeywords[1]?.word;
    if (kw1 && kw2) {
      suggestions.push(`How are ${kw1} and ${kw2} related in this document?`);
    }
  }

  // Standard high-yield questions
  suggestions.push("What is the primary conclusion or purpose of this document?");
  suggestions.push("List the main actionable recommendations or findings.");

  return suggestions.slice(0, 4);
}

/**
 * Queries the document via the active AI provider with page reference support.
 */
export async function askDocumentQuestion(
  doc: ExtractedDocument,
  query: string,
  history?: ChatMessage[],
): Promise<ChatAnswer> {
  const provider = getActiveAIProvider();
  return provider.chat(doc, query, history);
}
