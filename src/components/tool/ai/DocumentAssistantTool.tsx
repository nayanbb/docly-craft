import { useState } from "react";
import type { ExtractedDocument } from "@/lib/ai/document/document-types";
import { getAIProvider } from "@/lib/ai/providers";
import type { DocumentAssistantResult } from "@/lib/ai/providers/types";
import {
  Sparkles,
  CheckCircle2,
  ListTodo,
  FileSearch,
  Wand2,
  Copy,
  Check,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

interface DocumentAssistantToolProps {
  document: ExtractedDocument;
  onReset: () => void;
}

const ACTIONS = [
  {
    id: "proofread",
    label: "Proofread & Fix Grammar",
    desc: "Correct typos, punctuation, and grammatical mistakes with clear rationale.",
    icon: CheckCircle2,
  },
  {
    id: "polish",
    label: "Executive Polish & Rewrite",
    desc: "Elevate tone and conciseness for boardroom and professional presentations.",
    icon: Wand2,
  },
  {
    id: "simplify",
    label: "Simplify to Plain English",
    desc: "Untangle dense technical or legal jargon into crisp, accessible prose.",
    icon: BookOpen,
  },
  {
    id: "action_items",
    label: "Extract Action Items & Tasks",
    desc: "Isolate deadlines, assigned owners, deliverables, and next steps.",
    icon: ListTodo,
  },
  {
    id: "compliance_check",
    label: "Risk & Compliance Audit",
    desc: "Scan for ambiguous clauses, missing protections, and potential liability risks.",
    icon: FileSearch,
  },
] as const;

export function DocumentAssistantTool({ document, onReset }: DocumentAssistantToolProps) {
  const [activeAction, setActiveAction] = useState<string>("proofread");
  const [customInstruction, setCustomInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DocumentAssistantResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExecute = async (actionId?: string) => {
    const action = actionId || activeAction;
    setLoading(true);
    try {
      const provider = getAIProvider();
      const res = await provider.assistDocument(document, {
        action: action as any,
        customInstruction: customInstruction.trim() || undefined,
      });
      setResult(res);
      toast.success("Document analyzed successfully!");
    } catch (err) {
      console.error("Document assistant error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to execute assistant task.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.result);
    setCopied(true);
    toast.success("Result copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">AI Document Assistant</h3>
              <p className="text-xs text-muted-foreground">
                Loaded: <span className="font-mono text-foreground">{document.filename}</span> (
                {document.totalPages} {document.totalPages === 1 ? "page" : "pages"})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Upload Another
            </button>
          </div>
        </div>

        {/* Action Selectors */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">Choose Editorial Action</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {ACTIONS.map((act) => {
              const isSelected = activeAction === act.id;
              const Icon = act.icon;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => {
                    setActiveAction(act.id);
                  }}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5 text-foreground"
                      : "border-border hover:border-primary/40 bg-background text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-xs font-semibold text-foreground">{act.label}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground line-clamp-2">{act.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom optional prompt */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Add specific instructions (e.g. Focus on liability clause or keep under 250 words)..."
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={() => handleExecute()}
            disabled={loading}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            {loading ? "Processing..." : "Run Assistant"}
          </button>
        </div>
      </div>

      {/* Results View */}
      {result && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground capitalize">
                {result.action.replace("_", " ")} Output
              </h4>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy Output"}
            </button>
          </div>

          <div className="rounded-xl border border-border bg-background p-6 font-sans text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-[500px] overflow-y-auto">
            {result.result}
          </div>

          {result.keyFindings && result.keyFindings.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              <h5 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Key Takeaways
              </h5>
              <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                {result.keyFindings.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
