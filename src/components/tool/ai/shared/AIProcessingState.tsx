import { Loader2 } from "lucide-react";

interface AIProcessingStateProps {
  stage?: string;
  detail?: string;
  className?: string;
}

/**
 * Shared Truthful AI Processing State.
 * Displays truthful indeterminate progress with clear stage descriptions.
 * Never displays fabricated progress percentages.
 */
export function AIProcessingState({
  stage = "Analyzing document...",
  detail = "Running strict document grounding. Your document remains private.",
  className = "",
}: AIProcessingStateProps) {
  return (
    <div
      className={`rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center space-y-3 animate-in fade-in duration-300 ${className}`}
    >
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-foreground tracking-tight">{stage}</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          {detail}
        </p>
      </div>
      <div className="w-48 h-1 bg-muted/60 rounded-full mx-auto overflow-hidden">
        <div className="h-full bg-primary rounded-full animate-pulse w-2/3 mx-auto" />
      </div>
    </div>
  );
}
