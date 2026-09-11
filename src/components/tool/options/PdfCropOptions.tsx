import type { CropMargins } from "@/lib/pdf/crop";

interface PdfCropOptionsProps {
  margins: CropMargins;
  onChange: (margins: CropMargins) => void;
}

export function PdfCropOptions({ margins, onChange }: PdfCropOptionsProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Crop Margins (Points)</h3>
        <span className="text-xs text-muted-foreground">72 pt = 1 inch</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">Top (pt)</label>
          <input
            type="number"
            min="0"
            max="150"
            value={margins.top}
            onChange={(e) =>
              onChange({ ...margins, top: Math.max(0, parseInt(e.target.value, 10) || 0) })
            }
            className="w-full rounded-lg border border-input bg-surface px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">Bottom (pt)</label>
          <input
            type="number"
            min="0"
            max="150"
            value={margins.bottom}
            onChange={(e) =>
              onChange({ ...margins, bottom: Math.max(0, parseInt(e.target.value, 10) || 0) })
            }
            className="w-full rounded-lg border border-input bg-surface px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">Left (pt)</label>
          <input
            type="number"
            min="0"
            max="150"
            value={margins.left}
            onChange={(e) =>
              onChange({ ...margins, left: Math.max(0, parseInt(e.target.value, 10) || 0) })
            }
            className="w-full rounded-lg border border-input bg-surface px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">Right (pt)</label>
          <input
            type="number"
            min="0"
            max="150"
            value={margins.right}
            onChange={(e) =>
              onChange({ ...margins, right: Math.max(0, parseInt(e.target.value, 10) || 0) })
            }
            className="w-full rounded-lg border border-input bg-surface px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Adjusting margins trims excess whitespace around the edges of every page in the document.
      </p>
    </div>
  );
}
