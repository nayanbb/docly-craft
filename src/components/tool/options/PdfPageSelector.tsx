import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Trash2, Loader2 } from "lucide-react";
import { renderAllThumbnails, type PdfPageThumbnail } from "@/lib/pdf/pdfjs";

interface PdfPageSelectorProps {
  file: File;
  mode: "remove" | "extract" | "reorder";
  selectedPages: number[];
  onChangeSelected: (pages: number[]) => void;
  order: number[];
  onChangeOrder: (order: number[]) => void;
}

export function PdfPageSelector({
  file,
  mode,
  selectedPages,
  onChangeSelected,
  order,
  onChangeOrder,
}: PdfPageSelectorProps) {
  const [thumbnails, setThumbnails] = useState<PdfPageThumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const [renderProgress, setRenderProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRenderProgress(0);

    renderAllThumbnails(file, 0.4, (current, total) => {
      if (!cancelled) {
        setRenderProgress(Math.round((current / total) * 100));
      }
    })
      .then((thumbs) => {
        if (!cancelled) {
          setThumbnails(thumbs);
          const initialOrder = thumbs.map((t) => t.pageNumber);
          onChangeOrder(initialOrder);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to render PDF thumbnails:", err);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePage = (pageNumber: number) => {
    if (selectedPages.includes(pageNumber)) {
      onChangeSelected(selectedPages.filter((p) => p !== pageNumber));
    } else {
      onChangeSelected([...selectedPages, pageNumber].sort((a, b) => a - b));
    }
  };

  const movePage = (index: number, direction: "left" | "right") => {
    const targetIdx = direction === "left" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= order.length) return;

    const newOrder = [...order];
    const currentItem = newOrder[index];
    const targetItem = newOrder[targetIdx];
    if (currentItem === undefined || targetItem === undefined) return;

    newOrder[index] = targetItem;
    newOrder[targetIdx] = currentItem;
    onChangeOrder(newOrder);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Rendering page thumbnails ({renderProgress}%)...
        </div>
        <div className="h-1.5 w-full max-w-xs mx-auto overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${renderProgress}%` }}
          />
        </div>
      </div>
    );
  }

  if (thumbnails.length === 0) {
    return null;
  }

  // Map thumbnail by page number for reorder mode
  const thumbMap = new Map(thumbnails.map((t) => [t.pageNumber, t]));

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {mode === "remove" && "Select pages to remove"}
            {mode === "extract" && "Select pages to extract"}
            {mode === "reorder" && "Rearrange document page order"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {mode === "remove" &&
              `${selectedPages.length} page(s) marked for deletion. Click pages to select/deselect.`}
            {mode === "extract" &&
              `${selectedPages.length} page(s) selected for extraction into new PDF.`}
            {mode === "reorder" &&
              "Use arrows to adjust the position of individual pages in the sequence."}
          </p>
        </div>

        {mode !== "reorder" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChangeSelected(thumbnails.map((t) => t.pageNumber))}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Select All
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              onClick={() => onChangeSelected([])}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {mode === "reorder"
          ? order.map((pageNumber, idx) => {
              const thumb = thumbMap.get(pageNumber);
              if (!thumb) return null;
              return (
                <div
                  key={`order-${idx}-${pageNumber}`}
                  className="group relative flex flex-col items-center rounded-xl border border-border bg-surface p-2.5 transition-shadow hover:shadow-md"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-border/80 bg-white">
                    <img
                      src={thumb.dataUrl}
                      alt={`Page ${pageNumber}`}
                      className="h-full w-full object-contain"
                    />
                    <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[0.65rem] font-bold text-white">
                      Page {pageNumber}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between w-full px-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => movePage(idx, "left")}
                      aria-label="Move left"
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-[0.7rem] font-semibold text-muted-foreground">
                      Pos {idx + 1}
                    </span>
                    <button
                      type="button"
                      disabled={idx === order.length - 1}
                      onClick={() => movePage(idx, "right")}
                      aria-label="Move right"
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          : thumbnails.map((thumb) => {
              const isSelected = selectedPages.includes(thumb.pageNumber);
              return (
                <button
                  type="button"
                  key={thumb.pageNumber}
                  onClick={() => togglePage(thumb.pageNumber)}
                  className={`group relative flex flex-col items-center rounded-xl border p-2.5 text-left transition-all ${
                    isSelected
                      ? mode === "remove"
                        ? "border-destructive bg-destructive/5 ring-2 ring-destructive/40"
                        : "border-primary bg-primary/5 ring-2 ring-primary/40"
                      : "border-border bg-surface hover:border-primary/40"
                  }`}
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-border/80 bg-white">
                    <img
                      src={thumb.dataUrl}
                      alt={`Page ${thumb.pageNumber}`}
                      className="h-full w-full object-contain"
                    />
                    <div className="absolute top-1.5 right-1.5">
                      {isSelected ? (
                        mode === "remove" ? (
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-destructive text-white">
                            <Trash2 className="h-3 w-3" />
                          </span>
                        ) : (
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-white">
                            <Check className="h-3 w-3" />
                          </span>
                        )
                      ) : (
                        <span className="grid h-5 w-5 place-items-center rounded-full border border-border bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </div>
                  <span className="mt-2 text-xs font-semibold text-foreground">
                    Page {thumb.pageNumber}
                  </span>
                </button>
              );
            })}
      </div>
    </div>
  );
}
