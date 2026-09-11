import type { DocumentChunk } from "./DocumentChunker";
import type { ScoredChunk } from "./VectorRetriever";
import type { ExtractedDocument } from "./DocumentMetadata";

export interface ContextBuilderOptions {
  maxCharacters?: number;
  includeMetadataHeader?: boolean;
}

/**
 * Builds structured, bounded context for LLM prompts with clear page boundaries and anti-injection protections.
 */
export class ContextBuilder {
  /**
   * Assembles retrieved chunks into a prompt-ready context block.
   */
  static buildFromChunks(
    chunks: (DocumentChunk | ScoredChunk)[],
    docMetadata?: Partial<ExtractedDocument>,
    options: ContextBuilderOptions = {},
  ): { contextText: string; citedPages: number[] } {
    const maxChars = options.maxCharacters ?? 15000;
    const includeHeader = options.includeMetadataHeader ?? true;

    // Normalize chunks
    const rawChunks: DocumentChunk[] = chunks.map((c) => ("chunk" in c ? c.chunk : c));

    // Sort chunks by pageNumber and index to ensure chronological reading order
    const sortedChunks = [...rawChunks].sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
      return a.index - b.index;
    });

    // Remove duplicates
    const seenIds = new Set<string>();
    const uniqueChunks: DocumentChunk[] = [];
    for (const c of sortedChunks) {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        uniqueChunks.push(c);
      }
    }

    const citedPagesSet = new Set<number>();
    const contextParts: string[] = [];
    let currentLength = 0;

    if (includeHeader && docMetadata) {
      const header = [
        `[DOCUMENT METADATA]`,
        docMetadata.filename ? `Filename: ${docMetadata.filename}` : null,
        docMetadata.totalPages ? `Total Pages: ${docMetadata.totalPages}` : null,
        docMetadata.totalWords ? `Total Words: ${docMetadata.totalWords}` : null,
        `--------------------`,
      ]
        .filter(Boolean)
        .join("\n");

      contextParts.push(header);
      currentLength += header.length + 2;
    }

    for (const chunk of uniqueChunks) {
      const pageHeader = `--- [Page ${chunk.pageNumber}] ---`;
      const chunkBlock = `${pageHeader}\n${chunk.text}`;

      if (currentLength + chunkBlock.length + 2 > maxChars && contextParts.length > 0) {
        break;
      }

      contextParts.push(chunkBlock);
      citedPagesSet.add(chunk.pageNumber);
      currentLength += chunkBlock.length + 2;
    }

    return {
      contextText: contextParts.join("\n\n"),
      citedPages: Array.from(citedPagesSet).sort((a, b) => a - b),
    };
  }

  /**
   * Wraps document context in isolated tags to prevent prompt injection.
   */
  static wrapDocumentData(contextText: string): string {
    return `<DOCUMENT_DATA>\n${contextText}\n</DOCUMENT_DATA>`;
  }
}
