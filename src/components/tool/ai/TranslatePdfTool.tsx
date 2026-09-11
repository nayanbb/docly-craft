import { useState } from "react";
import {
  Languages,
  Copy,
  Download,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import type { ExtractedDocument } from "@/lib/ai/document/document-types";
import { useAiProviderStatus, type TranslateResult } from "@/lib/ai/providers";
import {
  SUPPORTED_LANGUAGES,
  detectDocumentScript,
  translateDocument,
  formatTranslationAsText,
} from "@/lib/ai/translate";
import { downloadBlob } from "@/lib/files/download";
import { AiToolHeader } from "@/components/tool/ai/AiToolHeader";
import { ProviderNotice } from "@/components/tool/ai/ProviderNotice";

interface TranslatePdfToolProps {
  document: ExtractedDocument;
  onReset: () => void;
}

export function TranslatePdfTool({ document, onReset }: TranslatePdfToolProps) {
  const [targetLang, setTargetLang] = useState("es");
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [activePageNum, setActivePageNum] = useState(1);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const detectedScript = detectDocumentScript(document.fullText);
  const { configured: providerReady } = useAiProviderStatus();

  const handleTranslate = async () => {
    setIsTranslating(true);
    setError(null);
    try {
      const res = await translateDocument(document, targetLang);
      setResult(res);
      setActivePageNum(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to translate document.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text = formatTranslationAsText(result, document.filename);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const text = formatTranslationAsText(result, document.filename);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const name = `${document.filename.replace(/\.[^/.]+$/, "")}-${targetLang}-translated.txt`;
    downloadBlob(blob, name);
  };

  const currentPageOriginal =
    document.pages.find((p) => p.pageNumber === activePageNum)?.text || "(No text on this page)";
  const currentPageTranslated = result?.pages.find((p) => p.pageNumber === activePageNum)?.text;

  return (
    <div className="space-y-6">
      <AiToolHeader document={document} />

      {!providerReady && !result && (
        <ProviderNotice
          featureName="translation"
          customMessage="Docly has extracted your document pages and detected the script. Choose a target language below. Translating PDF content into another language requires connecting a translation or AI provider backend."
        />
      )}

      {/* Language Selection & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Detected Script:</span>
            <span className="rounded-lg bg-surface border border-border px-2.5 py-1 font-medium text-foreground">
              {detectedScript}
            </span>
          </div>

          <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:inline" />

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Languages className="h-4 w-4 text-primary" />
              Target Language:
            </label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="rounded-xl border border-input bg-surface px-3 py-1.5 text-xs text-foreground focus:outline-none"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} ({lang.nativeName})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {providerReady && (
            <button
              type="button"
              onClick={handleTranslate}
              disabled={isTranslating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {isTranslating ? "Translating Pages..." : "Translate Document"}
            </button>
          )}

          {result && (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/40"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/40"
              >
                <Download className="h-3.5 w-3.5" />
                Download TXT
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Page Navigation & Side-by-Side Comparison */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Page-by-Page Document View</span>
          </div>

          {/* Page Selector Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-md py-1">
            {document.pages.map((p) => (
              <button
                key={p.pageNumber}
                type="button"
                onClick={() => setActivePageNum(p.pageNumber)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  activePageNum === p.pageNumber
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Page {p.pageNumber}
              </button>
            ))}
          </div>
        </div>

        {/* Side-by-side Text Panes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Original Text */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Original Text (Page {activePageNum})
            </span>
            <div className="min-h-[280px] max-h-[420px] overflow-y-auto rounded-xl border border-border bg-surface p-4 text-xs font-mono text-foreground leading-relaxed whitespace-pre-wrap">
              {currentPageOriginal}
            </div>
          </div>

          {/* Translated Text */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Translated Text {result ? `(${result.targetLanguage.toUpperCase()})` : ""}
            </span>
            <div className="min-h-[280px] max-h-[420px] overflow-y-auto rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs font-mono text-foreground leading-relaxed whitespace-pre-wrap">
              {result && currentPageTranslated ? (
                currentPageTranslated
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-6">
                  <Languages className="h-8 w-8 text-primary/40 mb-2" />
                  <p className="font-semibold text-foreground text-xs">
                    Translation not generated yet
                  </p>
                  <p className="text-[0.7rem] max-w-xs mt-1">
                    Connect an AI provider backend to translate this document into your chosen
                    language.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
