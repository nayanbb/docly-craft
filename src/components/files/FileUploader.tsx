import { useRef, useState, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  formats: string[];
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function FileUploader({ formats, multiple = false, onFiles, disabled }: FileUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "rounded-2xl border-2 border-dashed border-input bg-surface px-6 py-10 text-center transition-colors sm:py-14",
        dragging && "border-primary bg-accent/60",
        disabled && "opacity-60",
      )}
    >
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card text-primary">
        <UploadCloud className="h-7 w-7" strokeWidth={1.7} />
      </span>
      <h2 className="mt-5 text-lg font-semibold text-foreground sm:text-xl">
        Drag &amp; drop your files here
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        or select files from your device to get started
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none"
      >
        Choose Files
      </button>

      <p className="mt-4 text-xs text-muted-foreground">
        Supported formats: {formats.join(", ")} · Max 50 MB per file on the free plan
        {multiple ? " · Multiple files allowed" : ""}
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
