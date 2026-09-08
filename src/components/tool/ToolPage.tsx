import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { Tool } from "@/lib/tools";
import { FileUploader } from "@/components/files/FileUploader";
import { FileList, type SelectedFile } from "@/components/files/FileList";
import { FilePreview } from "@/components/files/FilePreview";
import {
  DownloadButton,
  ErrorMessage,
  ProcessingButton,
  ProgressIndicator,
  SuccessMessage,
  type ToolState,
} from "@/components/files/ToolStates";

const groupLabel: Record<Tool["group"], { label: string; to: "/pdf-tools" | "/image-tools" | "/ai-tools" }> =
  {
    pdf: { label: "PDF Tools", to: "/pdf-tools" },
    image: { label: "Image Tools", to: "/image-tools" },
    ai: { label: "AI Tools", to: "/ai-tools" },
  };

export function ToolPage({ tool }: { tool: Tool }) {
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [state, setState] = useState<ToolState>("idle");
  const [progress, setProgress] = useState(0);
  const Icon = tool.icon;
  const parent = groupLabel[tool.group];

  const addFiles = (incoming: File[]) => {
    const mapped = incoming.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      size: file.size,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setFiles((prev) => (tool.multiple ? [...prev, ...mapped] : mapped.slice(0, 1)));
    setState("idle");
    setProgress(0);
  };

  return (
    <div className="container-page py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to={parent.to} className="transition-colors hover:text-primary">
          {parent.label}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{tool.name}</span>
      </nav>

      <header className="mt-6 flex flex-col items-center text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-surface text-primary">
          <Icon className="h-7 w-7" strokeWidth={1.8} />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{tool.name}</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
          {tool.description}
        </p>
      </header>

      <div className="mx-auto mt-8 max-w-3xl space-y-5">
        <FileUploader formats={tool.formats} multiple={tool.multiple} onFiles={addFiles} />

        <FileList files={files} onRemove={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))} />

        <FilePreview files={files} />

        {state === "loading" && <ProgressIndicator value={progress} />}
        {state === "error" && (
          <ErrorMessage message="We couldn't process these files. Check the format and try again." />
        )}
        {state === "success" && (
          <>
            <SuccessMessage message="Your file has been processed and is ready to download." />
            <div className="flex justify-center">
              <DownloadButton fileName={`docly-${tool.id}.zip`} onClick={() => setState("idle")} />
            </div>
          </>
        )}

        <div className="pt-1">
          <ProcessingButton
            label={`${tool.actionLabel ?? tool.name} — Coming soon`}
            disabled
            hint="Processing goes live in the next release. You can already try the full workflow above."
          />
        </div>

        <div className="grid gap-3 pt-4 sm:grid-cols-3">
          {[
            { icon: Zap, title: "Fast by default", copy: "Most operations finish in a few seconds." },
            { icon: ShieldCheck, title: "Private", copy: "Files are removed automatically after processing." },
            { icon: Sparkles, title: "Consistent output", copy: "Predictable quality across every tool." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-card p-4">
              <item.icon className="h-4.5 w-4.5 text-primary" />
              <p className="mt-2 text-sm font-semibold">{item.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
