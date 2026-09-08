import { AlertCircle, CheckCircle2, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToolState = "idle" | "loading" | "error" | "success";

export function ProgressIndicator({ value, label }: { value: number; label?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          {label ?? "Processing your files"}
        </span>
        <span className="tabular-nums text-muted-foreground">{Math.round(value)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-destructive" />
      <div>
        <p className="font-semibold text-destructive">Something went wrong</p>
        <p className="mt-0.5 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export function SuccessMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-4 text-sm">
      <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-success" />
      <div>
        <p className="font-semibold text-success">Ready</p>
        <p className="mt-0.5 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export function ProcessingButton({
  label,
  disabled,
  loading,
  hint,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {label}
      </button>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DownloadButton({ fileName, onClick }: { fileName: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary"
    >
      <Download className="h-4 w-4" />
      Download {fileName}
    </button>
  );
}
