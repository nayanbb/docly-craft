import { useState } from "react";
import { Check, Copy, Download, FileText } from "lucide-react";
import { downloadBlob } from "@/lib/files/download";
import type { OcrResult } from "@/lib/ai/ocr";

interface OcrViewOptionsProps {
  language: string;
  onChangeLanguage: (lang: string) => void;
  result?: OcrResult | undefined;
}

export function OcrViewOptions({ language, onChangeLanguage, result }: OcrViewOptionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!result?.text) return;
    navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!result?.text) return;
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, "docly-extracted-text.txt");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">OCR Engine Settings</h3>
        <div className="flex items-center gap-2">
          <label htmlFor="ocr-lang" className="text-xs text-muted-foreground font-medium">
            Language:
          </label>
          <select
            id="ocr-lang"
            value={language}
            onChange={(e) => onChangeLanguage(e.target.value)}
            className="rounded-lg border border-input bg-surface px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            <option value="eng">English (eng)</option>
            <option value="fra">French (fra)</option>
            <option value="deu">German (deu)</option>
            <option value="spa">Spanish (spa)</option>
            <option value="ita">Italian (ita)</option>
            <option value="por">Portuguese (por)</option>
          </select>
        </div>
      </div>

      {result && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Extracted Text ({result.wordCount} words · {result.confidence}% confidence)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-primary hover:border-primary/40"
              >
                <Download className="h-3 w-3" />
                Download .txt
              </button>
            </div>
          </div>

          <textarea
            readOnly
            rows={8}
            value={result.text}
            className="w-full rounded-lg border border-input bg-surface p-3 font-mono text-xs text-foreground focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
