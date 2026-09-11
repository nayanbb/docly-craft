import type { CropArea } from "@/lib/image/crop";

interface ImageCropOptionsProps {
  crop: CropArea;
  onChange: (crop: CropArea) => void;
  originalWidth?: number | undefined;
  originalHeight?: number | undefined;
}

export function ImageCropOptions({
  crop,
  onChange,
  originalWidth,
  originalHeight,
}: ImageCropOptionsProps) {
  const setPreset = (ratio: number | "free") => {
    if (!originalWidth || !originalHeight) return;
    if (ratio === "free") {
      onChange({ x: 0, y: 0, width: originalWidth, height: originalHeight });
      return;
    }

    let w = originalWidth;
    let h = Math.round(originalWidth / ratio);
    if (h > originalHeight) {
      h = originalHeight;
      w = Math.round(originalHeight * ratio);
    }
    const x = Math.round((originalWidth - w) / 2);
    const y = Math.round((originalHeight - h) / 2);

    onChange({ x, y, width: w, height: h });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Crop Frame</h3>
        {originalWidth && originalHeight && (
          <span className="text-xs text-muted-foreground">
            Image: {originalWidth} × {originalHeight} px
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPreset("free")}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground"
        >
          Full / Reset
        </button>
        <button
          type="button"
          onClick={() => setPreset(1)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground"
        >
          1:1 Square
        </button>
        <button
          type="button"
          onClick={() => setPreset(4 / 3)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground"
        >
          4:3 Classic
        </button>
        <button
          type="button"
          onClick={() => setPreset(16 / 9)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground"
        >
          16:9 Widescreen
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">X Offset (px)</label>
          <input
            type="number"
            min="0"
            value={crop.x}
            onChange={(e) =>
              onChange({ ...crop, x: Math.max(0, parseInt(e.target.value, 10) || 0) })
            }
            className="w-full rounded-lg border border-input bg-surface px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">Y Offset (px)</label>
          <input
            type="number"
            min="0"
            value={crop.y}
            onChange={(e) =>
              onChange({ ...crop, y: Math.max(0, parseInt(e.target.value, 10) || 0) })
            }
            className="w-full rounded-lg border border-input bg-surface px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">Width (px)</label>
          <input
            type="number"
            min="10"
            value={crop.width}
            onChange={(e) =>
              onChange({ ...crop, width: Math.max(10, parseInt(e.target.value, 10) || 10) })
            }
            className="w-full rounded-lg border border-input bg-surface px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">Height (px)</label>
          <input
            type="number"
            min="10"
            value={crop.height}
            onChange={(e) =>
              onChange({ ...crop, height: Math.max(10, parseInt(e.target.value, 10) || 10) })
            }
            className="w-full rounded-lg border border-input bg-surface px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
