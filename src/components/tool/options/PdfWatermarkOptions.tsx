import type { WatermarkOptions } from "@/lib/pdf/watermark";

interface PdfWatermarkOptionsProps {
  options: WatermarkOptions;
  onChange: (options: WatermarkOptions) => void;
}

export function PdfWatermarkOptions({ options, onChange }: PdfWatermarkOptionsProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Watermark Settings</h3>

      <div className="space-y-1.5">
        <label htmlFor="watermark-text" className="block text-xs font-medium text-foreground">
          Watermark Text
        </label>
        <input
          id="watermark-text"
          type="text"
          value={options.text}
          onChange={(e) => onChange({ ...options, text: e.target.value })}
          placeholder="e.g. CONFIDENTIAL, DRAFT, INTERNAL USE"
          className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foreground">
            Opacity ({Math.round((options.opacity ?? 0.25) * 100)}%)
          </label>
          <input
            type="range"
            min="0.1"
            max="0.8"
            step="0.05"
            value={options.opacity ?? 0.25}
            onChange={(e) => onChange({ ...options, opacity: parseFloat(e.target.value) })}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foreground">Color</label>
          <select
            value={options.color ?? "gray"}
            onChange={(e) =>
              onChange({ ...options, color: e.target.value as WatermarkOptions["color"] })
            }
            className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="gray">Subtle Gray</option>
            <option value="red">Warning Red</option>
            <option value="blue">Official Blue</option>
            <option value="black">Bold Black</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foreground">Rotation</label>
          <select
            value={options.rotation ?? 45}
            onChange={(e) => onChange({ ...options, rotation: parseInt(e.target.value, 10) })}
            className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value={45}>45° Diagonal</option>
            <option value={0}>0° Horizontal</option>
            <option value={-45}>-45° Inverted Diagonal</option>
          </select>
        </div>
      </div>
    </div>
  );
}
