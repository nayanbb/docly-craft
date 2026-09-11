import type { ExtractedDocument } from "@/lib/ai/document/document-types";
import { getActiveAIProvider, type SummaryOptions, type SummaryResult } from "@/lib/ai/providers";

/**
 * Generates an AI summary for an extracted document using the active provider.
 */
export async function generateDocumentSummary(
  doc: ExtractedDocument,
  options?: SummaryOptions,
): Promise<SummaryResult> {
  const provider = getActiveAIProvider();
  return provider.summarize(doc, options);
}

/**
 * Formats a SummaryResult into a clean text document suitable for download or export.
 */
export function formatSummaryAsText(summary: SummaryResult, filename: string): string {
  const lines: string[] = [];
  lines.push(`================================================================`);
  lines.push(`DOCLY AI DOCUMENT SUMMARY`);
  lines.push(`Document: ${filename}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push(`================================================================\n`);

  lines.push(`--- OVERVIEW ---`);
  lines.push(summary.overview.trim());
  lines.push("");

  if (summary.keyPoints.length > 0) {
    lines.push(`--- KEY POINTS ---`);
    for (const pt of summary.keyPoints) {
      lines.push(`• ${pt.trim()}`);
    }
    lines.push("");
  }

  if (summary.importantDetails.length > 0) {
    lines.push(`--- IMPORTANT DETAILS ---`);
    for (const det of summary.importantDetails) {
      lines.push(`• ${det.trim()}`);
    }
    lines.push("");
  }

  if (summary.conclusion) {
    lines.push(`--- CONCLUSION & TAKEAWAYS ---`);
    lines.push(summary.conclusion.trim());
    lines.push("");
  }

  lines.push(`================================================================`);
  lines.push(`Processed locally and securely with Docly.`);
  lines.push(`================================================================`);

  return lines.join("\n");
}
