import type {
  PageNumberFormat,
  PageNumberOptions,
  PageNumberPosition,
} from "@/lib/pdf/page-numbers";

interface PdfPageNumberOptionsProps {
  options: PageNumberOptions;
  onChange: (options: PageNumberOptions) => void;
}

export function PdfPageNumberOptions({ options, onChange }: PdfPageNumberOptionsProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Page Numbering Settings</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foreground">Position</label>
          <select
            value={options.position ?? "bottom-center"}
            onChange={(e) =>
              onChange({ ...options, position: e.target.value as PageNumberPosition })
            }
            className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="bottom-center">Bottom Center</option>
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="top-center">Top Center</option>
            <option value="top-right">Top Right</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foreground">Format</label>
          <select
            value={options.format ?? "page-x-of-y"}
            onChange={(e) => onChange({ ...options, format: e.target.value as PageNumberFormat })}
            className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="page-x-of-y">Page 1 of 10</option>
            <option value="x-slash-y">1 / 10</option>
            <option value="x-only">1</option>
            <option value="dash-x-dash">- 1 -</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foreground">Starting Number</label>
          <input
            type="number"
            min="1"
            value={options.startingNumber ?? 1}
            onChange={(e) =>
              onChange({
                ...options,
                startingNumber: Math.max(1, parseInt(e.target.value, 10) || 1),
              })
            }
            className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
