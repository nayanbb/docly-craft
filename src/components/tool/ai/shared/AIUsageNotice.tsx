import { ShieldCheck, Cpu } from "lucide-react";

interface AIUsageNoticeProps {
  providerName?: string;
  isGrounded?: boolean;
  className?: string;
}

/**
 * Shared AI Privacy & Grounding Notice.
 * Transparently assures the user regarding in-memory processing and strict document grounding.
 */
export function AIUsageNotice({
  providerName = "Docly AI Engine",
  isGrounded = true,
  className = "",
}: AIUsageNoticeProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground ${className}`}
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
        <span>
          <strong className="text-foreground font-semibold">Private by design:</strong> Files are processed in memory and never permanently stored.
        </span>
      </div>

      <div className="flex items-center gap-2 text-[0.7rem] font-medium text-muted-foreground shrink-0">
        <Cpu className="h-3.5 w-3.5 text-primary" />
        <span>{providerName}</span>
        {isGrounded && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary font-semibold">
            Strict PDF Grounding
          </span>
        )}
      </div>
    </div>
  );
}
