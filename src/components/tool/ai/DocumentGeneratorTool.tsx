import { useState } from "react";
import { getAIProvider } from "@/lib/ai/providers";
import type { DocumentGenerationResult } from "@/lib/ai/providers/types";
import {
  FileText,
  Sparkles,
  Copy,
  Check,
  Download,
  RotateCcw,
  BookOpen,
  Briefcase,
  Shield,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/files/download";

const TEMPLATES = [
  { id: "nda", label: "Non-Disclosure Agreement (NDA)", icon: Shield, defaultTone: "legal" },
  { id: "agreement", label: "Service Agreement / Contract", icon: Briefcase, defaultTone: "legal" },
  { id: "proposal", label: "Business Proposal", icon: FileText, defaultTone: "professional" },
  { id: "cover-letter", label: "Job Cover Letter", icon: FileCheck, defaultTone: "professional" },
  { id: "meeting-minutes", label: "Meeting Minutes & Summary", icon: BookOpen, defaultTone: "professional" },
  { id: "study-guide", label: "Study Guide / Syllabus", icon: BookOpen, defaultTone: "academic" },
  { id: "letter", label: "Formal Letter / Notice", icon: FileText, defaultTone: "formal" },
  { id: "custom", label: "Custom Document", icon: Sparkles, defaultTone: "professional" },
] as const;

export function DocumentGeneratorTool() {
  const [docType, setDocType] = useState<string>("proposal");
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [tone, setTone] = useState<"professional" | "formal" | "casual" | "academic" | "legal">("professional");
  const [targetAudience, setTargetAudience] = useState("");
  const [keyPointsText, setKeyPointsText] = useState("");
  const [includeSignatures, setIncludeSignatures] = useState(true);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DocumentGenerationResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Please provide a topic or purpose for the document.");
      return;
    }

    setLoading(true);
    try {
      const provider = getAIProvider();
      const points = keyPointsText
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean);

      const res = await provider.generateDocument({
        type: docType as any,
        topic: topic.trim(),
        title: title.trim() || undefined,
        tone,
        targetAudience: targetAudience.trim() || undefined,
        keyPoints: points.length > 0 ? points : undefined,
        includeSignatures,
      });

      setResult(res);
      toast.success("Document generated successfully!");
    } catch (err) {
      console.error("Document generation error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate document.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.markdown);
    setCopied(true);
    toast.success("Document copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result.markdown], { type: "text/markdown;charset=utf-8" });
    const filename = `${(result.title || "generated-document")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}.md`;
    downloadBlob(blob, filename);
    toast.success(`Downloaded ${filename}`);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Form */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">AI Document Generator</h3>
              <p className="text-xs text-muted-foreground">
                Draft professional contracts, proposals, NDAs, and formal correspondence in seconds.
              </p>
            </div>
          </div>
        </div>

        {/* Template Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">Select Document Template</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TEMPLATES.map((tmpl) => {
              const isSelected = docType === tmpl.id;
              const Icon = tmpl.icon;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => {
                    setDocType(tmpl.id);
                    setTone(tmpl.defaultTone as any);
                  }}
                  className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5 text-foreground"
                      : "border-border hover:border-primary/40 bg-background text-muted-foreground"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-xs font-semibold line-clamp-1">{tmpl.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Document Topic or Purpose <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Website Design & Maintenance Agreement between Studio X and Client Y"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Document Title (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Master Services Agreement"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Tone of Voice</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as any)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="professional">Professional</option>
              <option value="legal">Strict Legal / Formal</option>
              <option value="formal">Formal</option>
              <option value="academic">Academic</option>
              <option value="casual">Friendly / Direct</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Target Audience</label>
            <input
              type="text"
              placeholder="e.g. Corporate Client, Hiring Manager, Board of Directors"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Key Clauses, Terms or Bullet Points (One per line)
          </label>
          <textarea
            rows={3}
            placeholder="e.g.&#10;• Scope: 5 landing pages and responsive design&#10;• Timeline: 4 weeks with weekly milestones&#10;• Payment: 50% upfront, 50% upon deployment"
            value={keyPointsText}
            onChange={(e) => setKeyPointsText(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="signatures"
            checked={includeSignatures}
            onChange={(e) => setIncludeSignatures(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary h-4 w-4"
          />
          <label htmlFor="signatures" className="text-xs text-foreground cursor-pointer">
            Include formal signature and date execution blocks at the end
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            {loading ? "Drafting Document..." : "Generate Document"}
          </button>
        </div>
      </div>

      {/* Generated Result Workspace */}
      {result && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h4 className="text-base font-bold text-foreground">{result.title}</h4>
              <p className="text-xs text-muted-foreground">
                {result.wordCount} words • ~{Math.max(1, Math.round(result.wordCount / 200))} min read
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download Markdown (.md)
              </button>
            </div>
          </div>

          {/* Document Content View */}
          <div className="rounded-xl border border-border bg-background p-6 font-sans text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-[500px] overflow-y-auto">
            {result.markdown}
          </div>
        </div>
      )}
    </div>
  );
}
