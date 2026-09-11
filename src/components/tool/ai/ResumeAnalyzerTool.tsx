import { useState, useEffect } from "react";
import type { ExtractedDocument } from "@/lib/ai/document/document-types";
import { getAIProvider } from "@/lib/ai/providers";
import type { ResumeAnalysisResult } from "@/lib/ai/providers/types";
import {
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Award,
  Copy,
  Check,
  RotateCcw,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";

interface ResumeAnalyzerToolProps {
  document: ExtractedDocument;
  onReset: () => void;
}

export function ResumeAnalyzerTool({ document, onReset }: ResumeAnalyzerToolProps) {
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResumeAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "ats" | "strengths" | "suggestions">(
    "overview",
  );
  const [copied, setCopied] = useState(false);

  // Auto-analyze on first mount or when requested
  const runAnalysis = async () => {
    setLoading(true);
    try {
      const provider = getAIProvider();
      const allText = document.pages.map((p) => p.text).join("\n\n");
      const res = await provider.analyzeResume(allText, {
        jobDescription: jobDescription.trim() || undefined,
        targetRole: targetRole.trim() || undefined,
      });
      setResult(res);
      toast.success("Resume analysis complete!");
    } catch (err) {
      console.error("Resume analysis error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to analyze resume.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = () => {
    if (!result) return;
    const text = `RESUME ANALYSIS REPORT (${document.filename})
Score: ${result.overallScore}/100 | ATS Score: ${result.atsCompatibilityScore}/100

SUMMARY:
${result.executiveSummary}

KEY STRENGTHS:
${result.strengths.map((s) => `• ${s}`).join("\n")}

AREAS FOR IMPROVEMENT:
${result.weaknesses.map((w) => `• ${w}`).join("\n")}

ATS FEEDBACK:
${result.atsFeedback.map((f) => `• ${f}`).join("\n")}

RECOMMENDATIONS:
${result.suggestedImprovements.map((i) => `• ${i}`).join("\n")}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Analysis report copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Job Match Input */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">AI Resume & CV Analyzer</h3>
              <p className="text-xs text-muted-foreground">
                Document: <span className="font-mono text-foreground">{document.filename}</span> (
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
            {result && (
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy Report"}
              </button>
            )}
          </div>
        </div>

        {/* Optional Target Role & Job Match */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Target Role (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Senior Frontend Engineer, Product Manager"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Job Description snippet (Optional match check)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste key responsibilities or requirements..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={runAnalysis}
                disabled={loading}
                className="shrink-0 rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
              >
                {loading ? "Analyzing..." : "Re-Score"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-3">
          <Sparkles className="h-8 w-8 text-primary animate-spin mx-auto" />
          <h4 className="text-sm font-semibold text-foreground">Evaluating Resume against ATS standards...</h4>
          <p className="text-xs text-muted-foreground">
            Scoring structure, keywords, quantitative impact, and formatting clarity.
          </p>
        </div>
      )}

      {/* Results Workspace */}
      {!loading && result && (
        <div className="space-y-6">
          {/* Score Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Overall Score
                </span>
                <Award className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-foreground font-mono">
                  {result.overallScore}
                </span>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, result.overallScore))}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  ATS Readiness
                </span>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
                  {result.atsCompatibilityScore}
                </span>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, result.atsCompatibilityScore))}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Identified Skills
                </span>
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-foreground font-mono">
                  {result.detectedSkills.length}
                </span>
                <span className="text-xs text-muted-foreground">keywords indexed</span>
              </div>
              <div className="flex flex-wrap gap-1 max-h-12 overflow-hidden">
                {result.detectedSkills.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
                {result.detectedSkills.length > 4 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{result.detectedSkills.length - 4} more
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                activeTab === "overview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Executive Summary
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ats")}
              className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                activeTab === "ats"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              ATS Audit & Keywords
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("strengths")}
              className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                activeTab === "strengths"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Strengths & Weaknesses
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("suggestions")}
              className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                activeTab === "suggestions"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Actionable Fixes ({result.suggestedImprovements.length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            {activeTab === "overview" && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Executive Summary</h4>
                  <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
                    {result.executiveSummary}
                  </p>
                </div>
                <div className="border-t border-border pt-4">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                    Detected Core Competencies
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.detectedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "ats" && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Applicant Tracking System (ATS) Analysis
                </h4>
                <div className="space-y-2">
                  {result.atsFeedback.map((fb, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 rounded-xl border border-border bg-background p-3 text-xs text-foreground"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{fb}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "strengths" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Strong Highlights
                  </h4>
                  <div className="space-y-2">
                    {result.strengths.map((str, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-foreground"
                      >
                        {str}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" /> Areas for Improvement
                  </h4>
                  <div className="space-y-2">
                    {result.weaknesses.map((w, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-foreground"
                      >
                        {w}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "suggestions" && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Step-by-Step Recommendations to Boost Impact
                </h4>
                <div className="space-y-2.5">
                  {result.suggestedImprovements.map((imp, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-xl border border-border bg-background p-3.5"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                        {idx + 1}
                      </span>
                      <p className="text-xs text-foreground leading-relaxed">{imp}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
