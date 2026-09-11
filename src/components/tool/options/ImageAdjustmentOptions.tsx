import { Sun, Contrast, Palette } from "lucide-react";
import type { FilterOptions } from "@/lib/image/filters";

interface ImageAdjustmentOptionsProps {
  options: FilterOptions;
  onChange: (options: FilterOptions) => void;
  isBrightnessOnly?: boolean;
  isContrastOnly?: boolean;
  isGrayscaleOnly?: boolean;
}

export function ImageAdjustmentOptions({
  options,
  onChange,
  isBrightnessOnly,
  isContrastOnly,
  isGrayscaleOnly,
}: ImageAdjustmentOptionsProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">
        {isBrightnessOnly
          ? "Brightness Adjustment"
          : isContrastOnly
            ? "Contrast Adjustment"
            : isGrayscaleOnly
              ? "Grayscale Filter"
              : "Image Adjustments"}
      </h3>

      {!isContrastOnly && !isGrayscaleOnly && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-foreground">
            <span className="flex items-center gap-1.5">
              <Sun className="h-3.5 w-3.5 text-primary" />
              Brightness
            </span>
            <span className="tabular-nums text-muted-foreground">
              {(options.brightness ?? 0) > 0
                ? `+${options.brightness}`
                : `${options.brightness ?? 0}`}
              %
            </span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            step="5"
            value={options.brightness ?? 0}
            onChange={(e) => onChange({ ...options, brightness: parseInt(e.target.value, 10) })}
            className="w-full accent-primary"
          />
        </div>
      )}

      {!isBrightnessOnly && !isGrayscaleOnly && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-foreground">
            <span className="flex items-center gap-1.5">
              <Contrast className="h-3.5 w-3.5 text-primary" />
              Contrast
            </span>
            <span className="tabular-nums text-muted-foreground">
              {(options.contrast ?? 0) > 0 ? `+${options.contrast}` : `${options.contrast ?? 0}`}%
            </span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            step="5"
            value={options.contrast ?? 0}
            onChange={(e) => onChange({ ...options, contrast: parseInt(e.target.value, 10) })}
            className="w-full accent-primary"
          />
        </div>
      )}

      {!isBrightnessOnly && !isContrastOnly && (
        <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs font-medium text-foreground">
          <input
            type="checkbox"
            checked={options.grayscale ?? false}
            onChange={(e) => onChange({ ...options, grayscale: e.target.checked })}
            className="rounded border-input text-primary focus:ring-primary"
          />
          <span className="flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5 text-primary" />
            Convert to high-contrast monochrome grayscale
          </span>
        </label>
      )}
    </div>
  );
}
