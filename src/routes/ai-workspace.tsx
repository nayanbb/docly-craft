import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Brain,
  MessageSquareText,
  NotebookPen,
  FileQuestion,
  Languages,
  Bot,
  FileCheck2,
  FilePlus2,
  Sparkles,
  FileText,
  RotateCcw,
  Clock,
  BookOpen,
} from "lucide-react";
import { FileUploader } from "@/components/files/FileUploader";
import { ProgressIndicator, ErrorMessage } from "@/components/files/ToolStates";
import { validatePdfFile } from "@/lib/files/validation";
import { extractDocumentText } from "@/lib/ai/document/extract-text";
import type { ExtractedDocument, AiToolProcessingState } from "@/lib/ai/document/document-types";
import { useAiProviderStatus } from "@/lib/ai/providers";

// AI Tool Workspaces
import { AiSummaryTool } from "@/components/tool/ai/AiSummaryTool";
import { ChatWithPdfTool } from "@/components/tool/ai/ChatWithPdfTool";
import { PdfToNotesTool } from "@/components/tool/ai/PdfToNotesTool";
import { PdfToQuestionsTool } from "@/components/tool/ai/PdfToQuestionsTool";
import { TranslatePdfTool } from "@/components/tool/ai/TranslatePdfTool";
import { DocumentAssistantTool } from "@/components/tool/ai/DocumentAssistantTool";
import { ResumeAnalyzerTool } from "@/components/tool/ai/ResumeAnalyzerTool";
import { DocumentGeneratorTool } from "@/components/tool/ai/DocumentGeneratorTool";

export const Route = createFileRoute("/ai-workspace")({
  head: () => ({
    meta: [
      { title: "AI Document Workspace — All-in-One AI Studio | Docly" },
      {
        name: "description",
        content:
          "Unified Docly AI Studio. Upload any document once to summarize, chat, generate notes, create quizzes, translate, and analyze with Google Gemini.",
      },
    ],
  }),
  component: AiWorkspacePage,
});

type WorkspaceTab =
  | "summary"
  | "chat"
  | "notes"
  | "quiz"
  | "translate"
  | "assistant"
  | "resume"
  | "generator";

const TABS: Array<{ id: WorkspaceTab; label: string; icon: typeof Brain; desc: string }> = [
  { id: "summary", label: "Summary", icon: Brain, desc: "Executive overview & key takeaways" },
  { id: "chat", label: "Chat with PDF", icon: MessageSquareText, desc: "Ask questions with page citations" },
  { id: "notes", label: "Study Notes", icon: NotebookPen, desc: "Structured Cornell & outline notes" },
  { id: "quiz", label: "Quiz & Questions", icon: FileQuestion, desc: "Practice MCQs and study questions" },
  { id: "translate", label: "Translate", icon: Languages, desc: "Multi-language document translation" },
  { id: "assistant", label: "Assistant", icon: Bot, desc: "Proofread, rewrite, and audit" },
  { id: "resume", label: "Resume Review", icon: FileCheck2, desc: "ATS scoring & career feedback" },
  { id: "generator", label: "Doc Generator", icon: FilePlus2, desc: "Generate structured documents" },
];

function AiWorkspacePage() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("summary");
  const [document, setDocument] = useState<ExtractedDocument | null>(null);
  const [state, setState] = useState<AiToolProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState<string | undefined>(undefined);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const { configured, providerName } = useAiProviderStatus();

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setState("uploading");
    setProgress(10);
    setProgressLabel("Uploading document...");
    setErrorDetail(null);

    const check = await validatePdfFile(file);
    if (!check.valid) {
      setErrorDetail(check.error || "The selected file is not a valid PDF document.");
      setState("error");
      return;
    }

    setState("extracting");
    setProgress(30);
    setProgressLabel("Extracting text and structure...");

    try {
      const extracted = await extractDocumentText(file, file.name, (pct, status) => {
        setProgress(pct);
        setProgressLabel(status);
      });

      setDocument(extracted);
      setState("ready");
    } catch (err) {
      console.error("Extraction failed:", err);
      setErrorDetail(
        err instanceof Error
          ? err.message
          : "Failed to extract text from PDF. Please verify that the PDF is readable.",
      );
      setState("error");
    }
  };

  const handleReset = () => {
    setDocument(null);
    setState("idle");
    setProgress(0);
    setProgressLabel(undefined);
    setErrorDetail(null);
  };

  return (
    <div className="container-page py-8 sm:py-12 space-y-8">
      {/* Workspace Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Docly AI Studio
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface border border-border px-2.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
              Powered by {providerName || "Google Gemini"}
            </span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            AI Document Workspace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your document once to access summary, grounded chat, study notes, quiz generator, and translation.
          </p>
        </div>

        {document && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-xs hover:border-primary/40 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
              Change Document
            </button>
          </div>
        )}
      </header>

      {/* Document Metadata Bar (when loaded) */}
      {document && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground font-mono truncate max-w-xs sm:max-w-md">
                {document.filename}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span>{document.totalPages} {document.totalPages === 1 ? "page" : "pages"}</span>
                <span>•</span>
                <span>{document.totalWords.toLocaleString()} words</span>
                {document.estimatedReadingMinutes && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      ~{document.estimatedReadingMinutes} min read
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload State (if no document loaded and not in generator mode) */}
      {!document && activeTab !== "generator" && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-base font-bold text-foreground">Upload Document to Begin</h2>
              <p className="text-xs text-muted-foreground">
                Supports any PDF document up to 50 pages for interactive analysis.
              </p>
            </div>

            <FileUploader
              formats={["PDF"]}
              multiple={false}
              onFiles={handleFiles}
              disabled={state === "uploading" || state === "validating" || state === "extracting"}
            />

            {(state === "uploading" || state === "validating" || state === "extracting") && (
              <ProgressIndicator value={progress} label={progressLabel} />
            )}

            {state === "error" && (
              <ErrorMessage
                message={errorDetail || "Failed to load document. Please verify the file and try again."}
              />
            )}
          </div>

          {/* Quick jump to Document Generator */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Don't have a document to upload?{" "}
              <button
                type="button"
                onClick={() => setActiveTab("generator")}
                className="font-semibold text-primary underline underline-offset-4 hover:opacity-80"
              >
                Use AI Document Generator to draft one from scratch →
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Active Studio View */}
      {(document || activeTab === "generator") && (
        <div className="space-y-6">
          {/* Studio Navigation Tabs */}
          <nav
            aria-label="Studio Modules"
            className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-border scrollbar-none"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-surface text-muted-foreground hover:bg-card hover:text-foreground border border-border"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Tab Workspaces */}
          <div className="mt-4">
            {activeTab === "summary" && document && (
              <AiSummaryTool document={document} onReset={handleReset} />
            )}

            {activeTab === "chat" && document && (
              <ChatWithPdfTool document={document} onReset={handleReset} />
            )}

            {activeTab === "notes" && document && (
              <PdfToNotesTool document={document} onReset={handleReset} />
            )}

            {activeTab === "quiz" && document && (
              <PdfToQuestionsTool document={document} onReset={handleReset} />
            )}

            {activeTab === "translate" && document && (
              <TranslatePdfTool document={document} onReset={handleReset} />
            )}

            {activeTab === "assistant" && document && (
              <DocumentAssistantTool document={document} onReset={handleReset} />
            )}

            {activeTab === "resume" && document && (
              <ResumeAnalyzerTool document={document} onReset={handleReset} />
            )}

            {activeTab === "generator" && <DocumentGeneratorTool />}
          </div>
        </div>
      )}
    </div>
  );
}
