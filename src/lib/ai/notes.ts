import type { ExtractedDocument } from "@/lib/ai/document/document-types";
import { getActiveAIProvider, type NotesOptions, type NotesResult } from "@/lib/ai/providers";

/**
 * Generates structured study notes using the active AI provider.
 */
export async function generateDocumentNotes(
  doc: ExtractedDocument,
  options?: NotesOptions,
): Promise<NotesResult> {
  const provider = getActiveAIProvider();
  return provider.generateNotes(doc, options);
}

/**
 * Builds a genuine local draft structure of notes from extracted document outline and paragraphs.
 * Useful for providing instant local structure without inventing fake generative output.
 */
export function buildLocalOutlineNotes(doc: ExtractedDocument): NotesResult {
  const sections = doc.outline.map((item) => ({
    heading: item.title,
    bulletPoints: [item.snippet],
    keyFacts: [`Appears on Page ${item.pageNumber}`],
  }));

  const concepts = doc.topKeywords.slice(0, 5).map((kw) => ({
    term: kw.word.charAt(0).toUpperCase() + kw.word.slice(1),
    definition: `Frequently referenced topic (${kw.count} occurrences in document)`,
  }));

  return {
    title: `Notes: ${doc.filename}`,
    summary: `Extracted structure containing ${doc.totalPages} pages, ${doc.totalWords.toLocaleString()} words, and ${doc.outline.length} identified sections.`,
    sections:
      sections.length > 0
        ? sections
        : [
            {
              heading: "Document Overview",
              bulletPoints: [
                `Total pages: ${doc.totalPages}`,
                `Total word count: ${doc.totalWords.toLocaleString()}`,
                `Estimated reading duration: ~${doc.estimatedReadingMinutes} minutes`,
              ],
            },
          ],
    rawMarkdown: "",
  };
}

/**
 * Formats a NotesResult into an exportable study sheet.
 */
export function formatNotesAsText(notes: NotesResult, filename: string): string {
  const lines: string[] = [];
  lines.push(`================================================================`);
  lines.push(`DOCLY STUDY NOTES`);
  lines.push(`Source Document: ${filename}`);
  lines.push(`Title: ${notes.title}`);
  lines.push(`Date: ${new Date().toLocaleString()}`);
  lines.push(`================================================================\n`);

  if (notes.summary) {
    lines.push(`[SUMMARY]`);
    lines.push(notes.summary.trim());
    lines.push("");
  }

  for (const section of notes.sections) {
    lines.push(`----------------------------------------------------------------`);
    lines.push(`## ${section.heading}`);
    lines.push(`----------------------------------------------------------------`);

    if (section.bulletPoints && section.bulletPoints.length > 0) {
      for (const pt of section.bulletPoints) {
        lines.push(`  • ${pt}`);
      }
      lines.push("");
    }

    if (section.concepts && section.concepts.length > 0) {
      lines.push(`  Key Concepts & Terminology:`);
      for (const concept of section.concepts) {
        lines.push(`    - ${concept.term}: ${concept.definition}`);
      }
      lines.push("");
    }

    if (section.keyFacts && section.keyFacts.length > 0) {
      lines.push(`  Key Facts:`);
      for (const fact of section.keyFacts) {
        lines.push(`    ✓ ${fact}`);
      }
      lines.push("");
    }
  }

  lines.push(`================================================================`);
  lines.push(`Structured study notes created with Docly.`);
  lines.push(`================================================================`);

  return lines.join("\n");
}
