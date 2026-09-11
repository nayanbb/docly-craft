import { useState } from "react";
import {
  NotebookPen,
  Copy,
  Download,
  Check,
  RotateCcw,
  Sparkles,
  BookMarked,
  Lightbulb,
} from "lucide-react";
import type { ExtractedDocument } from "@/lib/ai/document/document-types";
import { useAiProviderStatus, type NotesOptions, type NotesResult } from "@/lib/ai/providers";
import { generateDocumentNotes, buildLocalOutlineNotes, formatNotesAsText } from "@/lib/ai/notes";
import { downloadBlob } from "@/lib/files/download";
import { AiToolHeader } from "@/components/tool/ai/AiToolHeader";
import { ProviderNotice } from "@/components/tool/ai/ProviderNotice";

interface PdfToNotesToolProps {
  document: ExtractedDocument;
  onReset: () => void;
}

export function PdfToNotesTool({ document, onReset }: PdfToNotesToolProps) {
  const { configured: providerReady } = useAiProviderStatus();
  const [style, setStyle] = useState<NonNullable<NotesOptions["style"]>>("cornell");
  const [notes, setNotes] = useState<NotesResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await generateDocumentNotes(document, { style });
      setNotes(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate notes.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!notes) return;
    const text = formatNotesAsText(notes, document.filename);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!notes) return;
    const text = formatNotesAsText(notes, document.filename);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const name = document.filename.replace(/\.[^/.]+$/, "") + "-notes.txt";
    downloadBlob(blob, name);
  };

  return (
    <div className="space-y-6">
      <AiToolHeader document={document} />

      {!providerReady && (
        <ProviderNotice
          featureName="notes generation"
          customMessage="Docly has mapped your document sections, key concepts, and structure into a study outline below. Connect a secure AI provider backend to generate comprehensive Cornell notes with advanced synthesis."
        />
      )}

      {/* Configuration & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <NotebookPen className="h-4 w-4 text-primary" />
            Note Format:
          </label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as NonNullable<NotesOptions["style"]>)}
            className="rounded-xl border border-input bg-surface px-3 py-1.5 text-xs text-foreground focus:outline-none"
          >
            <option value="cornell">Cornell Study System</option>
            <option value="outline">Bullet Point Outline</option>
            <option value="concept">Concept & Terminology Focus</option>
            <option value="brief">Executive Study Brief</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {providerReady && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? "Formatting Notes..." : "Generate AI Notes"}
            </button>
          )}

          {notes && (
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

      {/* Notes Display */}
      {notes && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
          {/* Note Title & Summary */}
          <div className="border-b border-border pb-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">{notes.title}</h2>
            </div>
            {notes.summary && (
              <p className="text-xs text-muted-foreground leading-relaxed">{notes.summary}</p>
            )}
          </div>

          {/* Sections List */}
          <div className="space-y-6">
            {notes.sections.map((section, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-surface p-5 space-y-3.5">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded bg-primary/10 text-xs font-bold text-primary">
                    {idx + 1}
                  </span>
                  {section.heading}
                </h3>

                {/* Bullets */}
                {section.bulletPoints && section.bulletPoints.length > 0 && (
                  <ul className="space-y-1.5 pl-6 list-disc text-xs text-foreground/90 leading-relaxed">
                    {section.bulletPoints.map((pt, pIdx) => (
                      <li key={pIdx}>{pt}</li>
                    ))}
                  </ul>
                )}

                {/* Concepts / Definitions */}
                {section.concepts && section.concepts.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                    <span className="text-[0.7rem] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" />
                      Key Terms & Concepts
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {section.concepts.map((concept, cIdx) => (
                        <div
                          key={cIdx}
                          className="rounded-lg border border-border bg-card p-2.5 text-xs"
                        >
                          <span className="font-semibold text-foreground block">
                            {concept.term}
                          </span>
                          <span className="text-muted-foreground text-[0.7rem]">
                            {concept.definition}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Facts */}
                {section.keyFacts && section.keyFacts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {section.keyFacts.map((fact, fIdx) => (
                      <span
                        key={fIdx}
                        className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-[0.7rem] font-medium text-muted-foreground"
                      >
                        ✓ {fact}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
