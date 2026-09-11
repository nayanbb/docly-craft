import type { ResizeOptions } from "@/lib/image/resize";

interface ImageResizeOptionsProps {
  options: ResizeOptions;
  onChange: (options: ResizeOptions) => void;
  originalWidth?: number | undefined;
  originalHeight?: number | undefined;
}

export function ImageResizeOptions({
  options,
  onChange,
  originalWidth,
  originalHeight,
}: ImageResizeOptionsProps) {
  const setPercentage = (pct: number) => {
    if (originalWidth && originalHeight) {
      const factor = pct / 100;
      onChange({
        width: Math.round(originalWidth * factor),
        height: Math.round(originalHeight * factor),
        scalePercent: pct,
        preserveAspectRatio: true,
      });
    } else {
      onChange({ ...options, scalePercent: pct });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Resize Dimensions</h3>
        {originalWidth && originalHeight && (
          <span className="text-xs text-muted-foreground font-medium">
            Original: {originalWidth} × {originalHeight} px
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {[25, 50, 75, 150, 200].map((pct) => (
          <button
            key={pct}
            type="button"
            onClick={() => setPercentage(pct)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {pct}%
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foreground">Width (px)</label>
          <input
            type="number"
            min="1"
            value={options.width ?? ""}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (isNaN(val) || val <= 0) {
                onChange({
                  ...options,
                  width: undefined,
                  scalePercent: undefined,
                });
              } else if (options.preserveAspectRatio && originalWidth && originalHeight) {
                const proportionalH = Math.max(
                  1,
                  Math.round((val / originalWidth) * originalHeight),
                );
                onChange({
                  ...options,
                  width: val,
                  height: proportionalH,
                  scalePercent: undefined,
                });
              } else {
                onChange({
                  ...options,
                  width: val,
                  scalePercent: undefined,
                });
              }
            }}
            placeholder="e.g. 1920"
            className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foreground">Height (px)</label>
          <input
            type="number"
            min="1"
            value={options.height ?? ""}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (isNaN(val) || val <= 0) {
                onChange({
                  ...options,
                  height: undefined,
                  scalePercent: undefined,
                });
              } else if (options.preserveAspectRatio && originalWidth && originalHeight) {
                const proportionalW = Math.max(
                  1,
                  Math.round((val / originalHeight) * originalWidth),
                );
                onChange({
                  ...options,
                  width: proportionalW,
                  height: val,
                  scalePercent: undefined,
                });
              } else {
                onChange({
                  ...options,
                  height: val,
                  scalePercent: undefined,
                });
              }
            }}
            placeholder="e.g. 1080"
            className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
        <input
          type="checkbox"
          checked={options.preserveAspectRatio ?? true}
          onChange={(e) => onChange({ ...options, preserveAspectRatio: e.target.checked })}
          className="rounded border-input text-primary focus:ring-primary"
        />
        Preserve aspect ratio
      </label>
    </div>
  );
}
