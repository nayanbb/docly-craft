import { useState } from "react";
import {
  Brain,
  Check,
  Copy,
  Download,
  ListOrdered,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { ExtractedDocument } from "@/lib/ai/document/document-types";
import { useAiProviderStatus, type SummaryResult } from "@/lib/ai/providers";
import { generateDocumentSummary, formatSummaryAsText } from "@/lib/ai/summary";
import { downloadBlob } from "@/lib/files/download";
import { AiToolHeader } from "@/components/tool/ai/AiToolHeader";
import { ProviderNotice } from "@/components/tool/ai/ProviderNotice";

interface AiSummaryToolProps {
  document: ExtractedDocument;
  onReset: () => void;
}

export function AiSummaryTool({ document, onReset }: AiSummaryToolProps) {
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFullText, setShowFullText] = useState(false);
  const [showOutline, setShowOutline] = useState(true);

  const { configured: providerReady } = useAiProviderStatus();

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await generateDocumentSummary(document);
      setSummary(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate summary.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!summary) return;
    const text = formatSummaryAsText(summary, document.filename);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!summary) return;
    const text = formatSummaryAsText(summary, document.filename);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const name = document.filename.replace(/\.[^/.]+$/, "") + "-summary.txt";
    downloadBlob(blob, name);
  };

  return (
    <div className="space-y-6">
      <AiToolHeader document={document} />

      {!providerReady && !summary && (
        <ProviderNotice
          featureName="summarization"
          customMessage="Docly has extracted your document pages, outline, and reading statistics locally. To generate an AI executive summary, connect a secure AI provider backend."
        />
      )}

      {/* Generation Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {summary ? "Summary Generated" : "Document Summary"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {providerReady && !summary && (
            <button
              type="button"
              onClick={handleGenerateSummary}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? "Analyzing & Generating..." : "Generate AI Summary"}
            </button>
          )}

          {summary && (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/40"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/40"
              >
                <Download className="h-3.5 w-3.5" />
                Download TXT
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Upload New PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Structured Summary Result */}
      {summary && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
          {/* Overview */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Overview</h3>
            <p className="text-sm text-foreground leading-relaxed bg-surface p-4 rounded-xl border border-border">
              {summary.overview}
            </p>
          </div>

          {/* Key Points */}
          {summary.keyPoints.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                Key Points
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {summary.keyPoints.map((pt, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 rounded-xl border border-border bg-surface p-3 text-xs"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-primary/10 text-[0.65rem] font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="text-foreground leading-relaxed">{pt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Important Details */}
          {summary.importantDetails.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                Important Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {summary.importantDetails.map((det, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-surface p-3.5 text-xs text-foreground leading-relaxed"
                  >
                    • {det}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conclusion */}
          {summary.conclusion && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                Conclusion & Takeaway
              </h3>
              <p className="text-sm text-foreground leading-relaxed bg-primary/5 p-4 rounded-xl border border-primary/20">
                {summary.conclusion}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Extracted Document Structure & Sections (always available locally) */}
      {document.outline.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Document Structure & Outline ({document.outline.length} Sections)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowOutline(!showOutline)}
              className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1"
            >
              {showOutline ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>

          {showOutline && (
            <div className="space-y-2 pt-2">
              {document.outline.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border bg-surface p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{item.title}</span>
                    <span className="text-[0.7rem] text-primary font-medium">
                      Page {item.pageNumber}
                    </span>
                  </div>
                  <p className="text-muted-foreground line-clamp-2">{item.snippet}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Extracted Raw Text Drawer */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            Extracted Document Text ({document.pages.length} Pages)
          </span>
          <button
            type="button"
            onClick={() => setShowFullText(!showFullText)}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            {showFullText ? "Hide Extracted Text" : "View Extracted Text"}
            {showFullText ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {showFullText && (
          <div className="max-h-80 overflow-y-auto rounded-xl border border-border bg-surface p-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {document.fullText}
          </div>
        )}
      </div>
    </div>
  );
}
