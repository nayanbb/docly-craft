import { Sparkles, Shield, Info } from "lucide-react";

interface ProviderNoticeProps {
  featureName: string;
  customMessage?: string;
}

export function ProviderNotice({ featureName, customMessage }: ProviderNoticeProps) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary mt-0.5">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground">AI Provider is not configured yet</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {customMessage ||
              `Docly has extracted your document text, outline, and metrics locally in your browser. Generative ${featureName} requires a configured AI provider backend.`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-1 text-[0.75rem] text-muted-foreground border-t border-primary/10">
        <span className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-emerald-500" />
          Zero client-side secrets
        </span>
        <span className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-primary" />
          Ready for secure backend integration
        </span>
      </div>
    </div>
  );
}
