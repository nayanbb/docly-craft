import { ReactNode } from "react";
import { AIDownloadButton } from "./AIDownloadButton";

interface AIResultPanelProps {
  title?: string;
  badge?: string;
  content: string;
  defaultFilename?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Shared AI Result Panel.
 * Formats structured output with title, badges, markdown presentation, and export options.
 */
export function AIResultPanel({
  title = "AI Analysis Result",
  badge,
  content,
  defaultFilename = "docly-ai-output.md",
  actions,
  children,
  className = "",
}: AIResultPanelProps) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4 animate-in fade-in duration-300 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-foreground tracking-tight">{title}</h3>
          {badge && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-primary">
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {actions}
          <AIDownloadButton content={content} defaultFilename={defaultFilename} />
        </div>
      </div>

      {children}

      <div className="rounded-xl border border-border/60 bg-surface/60 p-4 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap select-text max-h-[500px] overflow-y-auto">
        {content}
      </div>
    </div>
  );
}
