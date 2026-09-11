import { useMemo, useRef, useState, type DragEvent } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Sparkles, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { FILE_SIZE_LIMITS, getMaxFileSizeBytes, getMaxFileSizeMb } from "@/lib/monetization/config";
import { useSubscription } from "@/lib/monetization/subscription";
import { useAuth } from "@/lib/supabase/auth-context";

interface FileUploaderProps {
  formats: string[];
  multiple?: boolean | undefined;
  onFiles: (files: File[]) => void;
  disabled?: boolean | undefined;
}

const MAX_FILE_SIZE_BYTES = FILE_SIZE_LIMITS.freeMaxBytes; // 50 MB Free default

const formatDefinitions: Record<string, { extensions: string[]; mimeTypes: string[] }> = {
  PDF: {
    extensions: [".pdf"],
    mimeTypes: ["application/pdf"],
  },
  JPG: {
    extensions: [".jpg", ".jpeg"],
    mimeTypes: ["image/jpeg"],
  },
  JPEG: {
    extensions: [".jpg", ".jpeg"],
    mimeTypes: ["image/jpeg"],
  },
  PNG: {
    extensions: [".png"],
    mimeTypes: ["image/png"],
  },
  WEBP: {
    extensions: [".webp"],
    mimeTypes: ["image/webp"],
  },
  WORD: {
    extensions: [".doc", ".docx"],
    mimeTypes: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
  DOC: {
    extensions: [".doc"],
    mimeTypes: ["application/msword"],
  },
  DOCX: {
    extensions: [".docx"],
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
  EXCEL: {
    extensions: [".xls", ".xlsx"],
    mimeTypes: [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },
  XLS: {
    extensions: [".xls"],
    mimeTypes: ["application/vnd.ms-excel"],
  },
  XLSX: {
    extensions: [".xlsx"],
    mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  },
  POWERPOINT: {
    extensions: [".ppt", ".pptx"],
    mimeTypes: [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  },
  PPT: {
    extensions: [".ppt"],
    mimeTypes: ["application/vnd.ms-powerpoint"],
  },
  PPTX: {
    extensions: [".pptx"],
    mimeTypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  },
};

export function FileUploader({ formats, multiple = false, onFiles, disabled }: FileUploaderProps) {
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const [dragging, setDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileSizeExceededFile, setFileSizeExceededFile] = useState<{
    name: string;
    size: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { acceptAttribute, allowedExtensions, allowedMimeTypes } = useMemo(() => {
    const extensions = new Set<string>();
    const mimeTypes = new Set<string>();

    for (const fmt of formats) {
      const def = formatDefinitions[fmt.toUpperCase()];
      if (def) {
        def.extensions.forEach((ext) => extensions.add(ext.toLowerCase()));
        def.mimeTypes.forEach((mime) => mimeTypes.add(mime.toLowerCase()));
      } else {
        extensions.add(`.${fmt.toLowerCase()}`);
      }
    }

    const acceptParts = [...extensions, ...mimeTypes];
    return {
      acceptAttribute: acceptParts.join(","),
      allowedExtensions: extensions,
      allowedMimeTypes: mimeTypes,
    };
  }, [formats]);

  const validateFiles = (rawFiles: File[]): File[] => {
    if (!rawFiles || rawFiles.length === 0) {
      return [];
    }

    const validFiles: File[] = [];
    const errors: string[] = [];
    const maxBytes = getMaxFileSizeBytes(isPro);
    const maxMb = getMaxFileSizeMb(isPro);
    setFileSizeExceededFile(null);

    for (const file of rawFiles) {
      if (!file || typeof file.size !== "number") continue;

      // 1. File size check (50 MB Free / 250 MB Pro)
      if (file.size > maxBytes) {
        if (!isPro) {
          setFileSizeExceededFile({ name: file.name, size: file.size });
        } else {
          errors.push(
            `"${file.name}" exceeds the technical maximum of ${maxMb} MB (${formatBytes(file.size)}).`,
          );
        }
        continue;
      }

      // 2. Format validation by extension and MIME type
      const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
      const mime = (file.type || "").toLowerCase();

      const hasValidExt = allowedExtensions.has(ext);
      const hasValidMime = mime ? allowedMimeTypes.has(mime) : false;

      if (!hasValidExt && !hasValidMime) {
        errors.push(
          `"${file.name}" is not a supported format. Allowed formats: ${formats.join(", ")}.`,
        );
        continue;
      }

      validFiles.push(file);
    }

    if (errors.length > 0) {
      setErrorMessage(errors.join(" "));
    } else {
      setErrorMessage(null);
    }

    return validFiles;
  };

  const handleFiles = (incoming: File[]) => {
    try {
      const valid = validateFiles(incoming);
      if (valid.length > 0) {
        onFiles(multiple ? valid : valid.slice(0, 1));
      }
    } catch (err) {
      console.error("File processing error:", err);
      setErrorMessage("An error occurred while reading the files. Please try again.");
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length) handleFiles(files);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors sm:p-12",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:border-primary/50",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <span className="grid h-16 w-16 place-items-center rounded-2xl border border-border bg-surface text-primary">
          <UploadCloud className="h-8 w-8" />
        </span>

        <p className="mt-4 text-base font-semibold text-foreground">
          Drag &amp; drop your files here
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          or select files from your device to get started
        </p>

        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            inputRef.current?.click();
          }}
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
          accept={acceptAttribute}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) handleFiles(files);
            e.target.value = "";
          }}
        />
      </div>

      {fileSizeExceededFile && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-primary/40 bg-card p-6 shadow-card text-center space-y-3 animate-in fade-in duration-200"
        >
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">
              Your file is larger than the 50 MB Free limit.
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              "{fileSizeExceededFile.name}" ({formatBytes(fileSizeExceededFile.size)}) exceeds the
              50 MB Free plan allowance. Upgrade to Docly Pro to process larger files up to 250 MB.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={user ? "/pricing" : "/login"}
              search={
                user ? { upgrade: "pro" } : { redirect: "/pricing?upgrade=pro", reason: "upgrade" }
              }
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-95 transition-opacity"
            >
              <Sparkles className="h-4 w-4" />
              Upgrade to Pro
            </Link>
            <button
              type="button"
              onClick={() => setFileSizeExceededFile(null)}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-destructive">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss error"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
