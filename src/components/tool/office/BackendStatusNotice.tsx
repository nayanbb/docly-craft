import { Server, ShieldCheck, Info, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import type { ConversionBackendStatus, OfficeConversionOperation } from "@/lib/office/types";

interface BackendStatusNoticeProps {
  status: ConversionBackendStatus | null;
  toolName: string;
  operation?: OfficeConversionOperation;
}

export function BackendStatusNotice({ status, toolName, operation }: BackendStatusNoticeProps) {
  const isConfigured = status?.configured ?? false;
  const isOperationSupported =
    isConfigured && operation ? status?.supportedOperations.includes(operation) : isConfigured;

  const isReverseOperation =
    operation === "pdf-to-word" ||
    operation === "pdf-to-excel" ||
    operation === "pdf-to-powerpoint";

  // 1. Engine is configured and supports this operation
  if (isConfigured && isOperationSupported) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="text-xs font-semibold text-foreground">
              Conversion Engine Active:{" "}
              <span className="capitalize font-bold text-emerald-600 dark:text-emerald-400">
                {status?.provider === "self-hosted"
                  ? "Docly Self-Hosted Engine"
                  : status?.provider === "local-office"
                    ? "Microsoft Office Desktop Engine"
                    : "Docly Conversion Engine"}
              </span>
            </span>
          </div>
          <span className="text-[0.7rem] text-muted-foreground hidden sm:inline">
            High-fidelity document reconstruction active
          </span>
        </div>
      </div>
    );
  }

  // 2. Service Notice / Backend Unavailable
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xs">
      <div className="flex items-start gap-3.5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary mt-0.5">
          <Server className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">
              Document conversion is temporarily unavailable
            </h3>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[0.65rem] font-semibold text-amber-600 dark:text-amber-400">
              Temporarily Unavailable
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Document conversion is temporarily unavailable. Please try again later.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border text-[0.75rem] text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Document safety preserved &mdash; no dummy or fake files</span>
        </div>
        <div className="flex items-center gap-1.5 text-primary font-medium">
          <Info className="h-3.5 w-3.5" />
          <span>Zero fake conversions or renamed files</span>
        </div>
      </div>
    </div>
  );
}
