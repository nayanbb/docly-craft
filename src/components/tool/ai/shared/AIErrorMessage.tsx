import { AlertTriangle, RefreshCw } from "lucide-react";

interface AIErrorMessageProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Shared Safe AI Error Message.
 * Informs the user safely without exposing API keys, stack traces, or internal paths.
 */
export function AIErrorMessage({
  message = "Failed to process AI request. Please check your document and try again.",
  onRetry,
  className = "",
}: AIErrorMessageProps) {
  return (
    <div
      className={`rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-center space-y-3 animate-in fade-in duration-200 ${className}`}
    >
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-foreground">Processing Error</h4>
        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          {message}
        </p>
      </div>
      {onRetry && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:border-primary/40 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
