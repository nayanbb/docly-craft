import { useState } from "react";
import type { Tool } from "@/lib/tools";
import { FileUploader } from "@/components/files/FileUploader";
import { ProgressIndicator, ErrorMessage } from "@/components/files/ToolStates";
import { validatePdfFile } from "@/lib/files/validation";
import { extractDocumentText } from "@/lib/ai/document/extract-text";
import type { ExtractedDocument, AiToolProcessingState } from "@/lib/ai/document/document-types";
import { AiSummaryTool } from "@/components/tool/ai/AiSummaryTool";
import { ChatWithPdfTool } from "@/components/tool/ai/ChatWithPdfTool";
import { PdfToNotesTool } from "@/components/tool/ai/PdfToNotesTool";
import { PdfToQuestionsTool } from "@/components/tool/ai/PdfToQuestionsTool";
import { TranslatePdfTool } from "@/components/tool/ai/TranslatePdfTool";
import { ResumeAnalyzerTool } from "@/components/tool/ai/ResumeAnalyzerTool";
import { DocumentAssistantTool } from "@/components/tool/ai/DocumentAssistantTool";
import { DocumentGeneratorTool } from "@/components/tool/ai/DocumentGeneratorTool";

interface AiToolContainerProps {
  tool: Tool;
}

export function AiToolContainer({ tool }: AiToolContainerProps) {
  const [state, setState] = useState<AiToolProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState<string | undefined>(undefined);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [document, setDocument] = useState<ExtractedDocument | null>(null);

  // Document Generator is prompt-driven and doesn't require uploading an existing PDF
  if (tool.id === "ai-document-generator" || tool.id === "document-generator") {
    return <DocumentGeneratorTool />;
  }

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setState("uploading");
    setProgress(5);
    setProgressLabel("Uploading PDF file...");
    setErrorDetail(null);

    setState("validating");
    setProgress(15);
    setProgressLabel("Validating PDF structure & size...");

    const check = await validatePdfFile(file);
    if (!check.valid) {
      setErrorDetail(check.error || "The selected file is not a valid PDF document.");
      setState("error");
      return;
    }

    setState("extracting");
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
    <div className="space-y-6">
      {/* Upload Stage */}
      {(!document || state === "idle") && (
        <div className="space-y-4">
          <FileUploader
            formats={tool.formats}
            multiple={false}
            onFiles={handleFiles}
            disabled={
              state === "uploading" ||
              state === "validating" ||
              state === "reading" ||
              state === "extracting"
            }
          />
        </div>
      )}

      {/* Progress Indicator for uploading / validating / reading / extracting / processing */}
      {(state === "uploading" ||
        state === "validating" ||
        state === "reading" ||
        state === "extracting" ||
        state === "processing" ||
        state === "generating") && <ProgressIndicator value={progress} label={progressLabel} />}

      {/* Error state */}
      {state === "error" && (
        <div className="space-y-4">
          <ErrorMessage
            message={
              errorDetail ||
              "We couldn't extract text from this PDF document. Please verify the file and try again."
            }
          />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold text-foreground hover:border-primary/40 transition-colors"
            >
              Try Another PDF
            </button>
          </div>
        </div>
      )}

      {/* Interactive Tool Workspaces */}
      {document &&
        (state === "ready" || state === "success" || state === "provider_not_configured") && (
          <>
            {(tool.id === "ai-pdf-summary" || tool.id === "ai-pdf-summarizer") && (
              <AiSummaryTool document={document} onReset={handleReset} />
            )}

            {tool.id === "chat-with-pdf" && (
              <ChatWithPdfTool document={document} onReset={handleReset} />
            )}

            {tool.id === "pdf-to-notes" && (
              <PdfToNotesTool document={document} onReset={handleReset} />
            )}

            {tool.id === "pdf-to-questions" && (
              <PdfToQuestionsTool document={document} onReset={handleReset} />
            )}

            {(tool.id === "translate-pdf" || tool.id === "pdf-translator") && (
              <TranslatePdfTool document={document} onReset={handleReset} />
            )}

            {tool.id === "resume-analyzer" && (
              <ResumeAnalyzerTool document={document} onReset={handleReset} />
            )}

            {(tool.id === "document-assistant" || tool.id === "ai-document-assistant") && (
              <DocumentAssistantTool document={document} onReset={handleReset} />
            )}
          </>
        )}
    </div>
  );
}
