import { FileSearch } from "lucide-react";
import type { SelectedFile } from "@/components/files/FileList";

export function FilePreview({ files }: { files: SelectedFile[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Preview</h3>
      {files.length === 0 ? (
        <div className="mt-3 grid place-items-center rounded-lg border border-dashed border-input bg-surface py-10 text-center">
          <FileSearch className="h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Add files above to see a preview.</p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex aspect-[3/4] flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-border bg-surface p-2 text-center"
            >
              {file.previewUrl ? (
                <img
                  src={file.previewUrl}
                  alt={file.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <>
                  <span className="text-xs font-semibold uppercase text-primary">
                    {file.name.split(".").pop()}
                  </span>
                  <span className="line-clamp-2 text-[0.7rem] text-muted-foreground">
                    {file.name}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
