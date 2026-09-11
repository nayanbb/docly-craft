import { useState } from "react";
import { Download, Check, Copy, FileText } from "lucide-react";
import { downloadBlob } from "@/lib/files/download";
import { toast } from "sonner";

interface AIDownloadButtonProps {
  content: string;
  defaultFilename?: string;
  className?: string;
}

/**
 * Shared AI Export & Download Component.
 * Supports download as Text / Markdown and instant clipboard copy.
 */
export function AIDownloadButton({
  content,
  defaultFilename = "docly-ai-result.md",
  className = "",
}: AIDownloadButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    downloadBlob(blob, defaultFilename);
    toast.success("Document downloaded!");
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:border-primary/40 transition-colors cursor-pointer shadow-2xs"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>

      <button
        type="button"
        onClick={handleDownload}
        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-2xs"
      >
        <Download className="h-3.5 w-3.5" />
        Download Markdown
      </button>
    </div>
  );
}
