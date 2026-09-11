import type { DocumentChunk } from "./DocumentChunker";

export interface ScoredChunk {
  chunk: DocumentChunk;
  score: number;
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he",
  "in", "is", "it", "its", "of", "on", "that", "the", "to", "was", "were",
  "will", "with", "this", "these", "those", "have", "had", "what", "which",
  "who", "when", "where", "why", "how", "all", "any", "both", "each", "few",
  "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "than", "too", "very", "can", "just", "should", "now"
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/**
 * High-performance in-memory BM25 Retriever for local document context retrieval.
 */
export class VectorRetriever {
  private chunks: DocumentChunk[];
  private chunkTokens: string[][];
  private docLengths: number[];
  private avgDocLength: number;
  private idf: Map<string, number>;
  private k1: number = 1.2;
  private b: number = 0.75;

  constructor(chunks: DocumentChunk[]) {
    this.chunks = chunks;
    this.chunkTokens = chunks.map((c) => tokenize(c.text));
    this.docLengths = this.chunkTokens.map((t) => t.length);

    const totalLength = this.docLengths.reduce((acc, len) => acc + len, 0);
    this.avgDocLength = chunks.length > 0 ? totalLength / chunks.length : 1;
    this.idf = new Map();

    this.calculateIdf();
  }

  private calculateIdf(): void {
    const N = this.chunks.length;
    if (N === 0) return;

    const docFreq = new Map<string, number>();
    for (const tokens of this.chunkTokens) {
      const uniqueTokens = new Set(tokens);
      for (const token of uniqueTokens) {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      }
    }

    for (const [term, freq] of docFreq.entries()) {
      // Standard BM25 Robertson-Spärck Jones IDF formula with smoothing
      const idfValue = Math.log((N - freq + 0.5) / (freq + 0.5) + 1);
      this.idf.set(term, Math.max(0.1, idfValue));
    }
  }

  /**
   * Searches the indexed chunks and returns the top-K chunks by BM25 relevance score.
   */
  search(query: string, topK: number = 5): ScoredChunk[] {
    if (this.chunks.length === 0 || !query.trim()) {
      return [];
    }

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      // If query only contains stop words or punctuation, return first K chunks
      return this.chunks.slice(0, topK).map((chunk) => ({ chunk, score: 0.1 }));
    }

    const scores: ScoredChunk[] = [];
    const lowerQuery = query.toLowerCase();

    for (let i = 0; i < this.chunks.length; i++) {
      const tokens = this.chunkTokens[i];
      const docLen = this.docLengths[i];
      let score = 0;

      // Frequency map for this chunk
      const termFreq = new Map<string, number>();
      for (const t of tokens) {
        termFreq.set(t, (termFreq.get(t) || 0) + 1);
      }

      for (const qToken of queryTokens) {
        const tf = termFreq.get(qToken) || 0;
        if (tf > 0) {
          const idfScore = this.idf.get(qToken) || 0.1;
          const numerator = tf * (this.k1 + 1);
          const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength));
          score += idfScore * (numerator / denominator);
        }
      }

      // Exact phrase match bonus
      if (lowerQuery.length > 5 && this.chunks[i].text.toLowerCase().includes(lowerQuery)) {
        score += 2.5;
      }

      if (score > 0) {
        scores.push({ chunk: this.chunks[i], score });
      }
    }

    scores.sort((a, b) => b.score - a.score);

    // If no chunks scored > 0, return the first few chunks as baseline context
    if (scores.length === 0) {
      return this.chunks.slice(0, topK).map((chunk) => ({ chunk, score: 0.05 }));
    }

    return scores.slice(0, topK);
  }
}
