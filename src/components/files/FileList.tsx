import { FileText, X } from "lucide-react";
import { formatBytes } from "@/lib/format";

export interface SelectedFile {
  id: string;
  name: string;
  size: number;
  previewUrl?: string;
}

export function FileList({
  files,
  onRemove,
}: {
  files: SelectedFile[];
  onRemove: (id: string) => void;
}) {
  if (!files.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Selected files</h3>
        <span className="text-xs text-muted-foreground">{files.length} file(s)</span>
      </div>
      <ul className="divide-y divide-border">
        {files.map((file) => (
          <li key={file.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface text-primary">
              {file.previewUrl ? (
                <img src={file.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{file.name}</span>
              <span className="block text-xs text-muted-foreground">{formatBytes(file.size)}</span>
            </span>
            <button
              type="button"
              onClick={() => onRemove(file.id)}
              aria-label={`Remove ${file.name}`}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
