import { useState } from "react";

interface PdfSplitOptionsProps {
  mode: "ranges" | "all";
  onChangeMode: (mode: "ranges" | "all") => void;
  rangeString: string;
  onChangeRange: (ranges: string) => void;
  totalPageCount?: number | undefined;
}

export function PdfSplitOptions({
  mode,
  onChangeMode,
  rangeString,
  onChangeRange,
  totalPageCount,
}: PdfSplitOptionsProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Split Options</h3>
        {totalPageCount !== undefined && (
          <span className="text-xs text-muted-foreground font-medium">
            Document has {totalPageCount} page{totalPageCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChangeMode("ranges")}
          className={`rounded-lg border px-3.5 py-2.5 text-xs font-semibold transition-colors ${
            mode === "ranges"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-surface text-muted-foreground hover:text-foreground"
          }`}
        >
          Custom Page Ranges
        </button>
        <button
          type="button"
          onClick={() => onChangeMode("all")}
          className={`rounded-lg border px-3.5 py-2.5 text-xs font-semibold transition-colors ${
            mode === "all"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-surface text-muted-foreground hover:text-foreground"
          }`}
        >
          Extract Every Page
        </button>
      </div>

      {mode === "ranges" && (
        <div className="space-y-1.5">
          <label htmlFor="split-ranges" className="block text-xs font-medium text-foreground">
            Page Ranges (comma separated)
          </label>
          <input
            id="split-ranges"
            type="text"
            value={rangeString}
            onChange={(e) => onChangeRange(e.target.value)}
            placeholder="e.g. 1-3, 5, 7-9"
            className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="text-[0.75rem] text-muted-foreground">
            Example: <span className="font-mono">1-2, 4, 6-8</span> creates separate files for pages
            1-2, page 4, and pages 6-8.
          </p>
        </div>
      )}

      {mode === "all" && (
        <p className="text-xs text-muted-foreground">
          Each page will be extracted into a separate single-page PDF and bundled as a ZIP archive
          for easy download.
        </p>
      )}
    </div>
  );
}
