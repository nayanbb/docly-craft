import { FileText, Clock, BookOpen, Hash, ShieldCheck } from "lucide-react";
import type { ExtractedDocument } from "@/lib/ai/document/document-types";

interface AiToolHeaderProps {
  document: ExtractedDocument;
}

export function AiToolHeader({ document }: AiToolHeaderProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate max-w-sm sm:max-w-md">
              {document.filename}
            </h2>
            <p className="text-[0.75rem] text-muted-foreground">
              {document.isScanned ? "Extracted via OCR Engine" : "Extracted via Client-Side Parser"}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Secure Processing • No Storage</span>
        </div>
      </div>

      {/* Document Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
            <BookOpen className="h-3.5 w-3.5" />
            <span className="text-[0.7rem] font-medium uppercase tracking-wider">Pages</span>
          </div>
          <span className="text-base font-extrabold text-foreground">{document.totalPages}</span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
            <Hash className="h-3.5 w-3.5" />
            <span className="text-[0.7rem] font-medium uppercase tracking-wider">Words</span>
          </div>
          <span className="text-base font-extrabold text-foreground">
            {document.totalWords.toLocaleString()}
          </span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[0.7rem] font-medium uppercase tracking-wider">Reading Time</span>
          </div>
          <span className="text-base font-extrabold text-foreground">
            ~{document.estimatedReadingMinutes} min
          </span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
            <FileText className="h-3.5 w-3.5" />
            <span className="text-[0.7rem] font-medium uppercase tracking-wider">Characters</span>
          </div>
          <span className="text-base font-extrabold text-foreground">
            {document.totalCharacters.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Top Keywords Badge Strip */}
      {document.topKeywords && document.topKeywords.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[0.7rem] font-medium text-muted-foreground mr-1">Key Topics:</span>
          {document.topKeywords.map((kw, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-lg border border-border bg-surface px-2 py-0.5 text-[0.75rem] font-medium text-foreground"
            >
              #{kw.word}
              <span className="ml-1 text-[0.65rem] text-muted-foreground">({kw.count})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
