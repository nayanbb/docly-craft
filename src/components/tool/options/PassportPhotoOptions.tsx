import { useState } from "react";
import { AlertTriangle, Check, IdCard, Pipette, Printer, ShieldCheck } from "lucide-react";
import { PASSPORT_PRESETS, type PassportPhotoConfig } from "@/lib/ai/passport-photo";

interface PassportPhotoOptionsProps {
  config: PassportPhotoConfig;
  onChange: (config: PassportPhotoConfig) => void;
}

const PRESET_COLORS = [
  { label: "White", value: "#ffffff", border: "border-zinc-300 dark:border-zinc-700" },
  { label: "Off-White", value: "#f8fafc", border: "border-zinc-300 dark:border-zinc-700" },
  { label: "Light Blue", value: "#dcebfa", border: "border-sky-300 dark:border-sky-700" },
  { label: "Blue", value: "#2563eb", border: "border-blue-400 dark:border-blue-600" },
  { label: "Light Grey", value: "#e2e8f0", border: "border-zinc-400 dark:border-zinc-600" },
];

export function PassportPhotoOptions({ config, onChange }: PassportPhotoOptionsProps) {
  const selectedPreset =
    PASSPORT_PRESETS.find((p) => p.id === config.presetId) ?? PASSPORT_PRESETS[0]!;

  const [hexInput, setHexInput] = useState(config.backgroundColor || "#ffffff");

  const handleColorChange = (newColor: string) => {
    setHexInput(newColor);
    onChange({ ...config, backgroundColor: newColor });
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      onChange({ ...config, backgroundColor: val });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <IdCard className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Automatic Passport Photo Settings
          </h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-3 w-3" />
          100% Identity Preserved (Non-Generative)
        </span>
      </div>

      {/* Advisory Callout */}
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="font-semibold">Official Advisory:</strong> Photo requirements vary by
          country and issuing authority. Verify the required dimensions and specifications before
          submission.
        </p>
      </div>

      {/* Preset Format Selection */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-foreground">Passport Photo Preset</label>
        <select
          value={config.presetId}
          onChange={(e) => onChange({ ...config, presetId: e.target.value })}
          className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        >
          {PASSPORT_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.widthMm}×{p.heightMm} mm ({p.widthPx}×{p.heightPx} px @ 300 DPI)
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{selectedPreset.notes}</p>
      </div>

      {/* Background Color Customization */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-foreground">Background Color</label>
          <span className="text-[0.7rem] text-muted-foreground">
            Automatically replaces complex original backgrounds
          </span>
        </div>

        {/* Preset Color Swatches */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {PRESET_COLORS.map((bg) => {
            const isSelected = config.backgroundColor?.toLowerCase() === bg.value.toLowerCase();
            return (
              <button
                key={bg.value}
                type="button"
                onClick={() => handleColorChange(bg.value)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full border ${bg.border} shrink-0 relative flex items-center justify-center`}
                  style={{ backgroundColor: bg.value }}
                >
                  {isSelected && (
                    <Check
                      className={`h-2.5 w-2.5 ${
                        bg.value === "#ffffff" ||
                        bg.value === "#f8fafc" ||
                        bg.value === "#dcebfa" ||
                        bg.value === "#e2e8f0"
                          ? "text-zinc-900"
                          : "text-white"
                      }`}
                      strokeWidth={3}
                    />
                  )}
                </span>
                <span className="truncate">{bg.label}</span>
              </button>
            );
          })}
        </div>

        {/* Color Picker and Hex Input */}
        <div className="flex items-center gap-2 pt-1">
          <div className="relative flex items-center">
            <input
              type="color"
              id="passport-color-picker"
              value={config.backgroundColor || "#ffffff"}
              onChange={(e) => handleColorChange(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded-lg border border-input bg-surface p-0.5"
            />
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-input bg-surface px-2.5 py-1 text-xs">
            <Pipette className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground font-mono">HEX</span>
            <input
              type="text"
              value={hexInput}
              onChange={handleHexInputChange}
              placeholder="#FFFFFF"
              maxLength={7}
              className="w-20 bg-transparent font-mono text-xs text-foreground focus:outline-none uppercase"
            />
          </div>

          <span className="text-[0.7rem] text-muted-foreground">Custom background color</span>
        </div>
      </div>

      {/* 4x6 Printable Sheet Toggle */}
      <label className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-border bg-surface p-3 text-xs font-medium text-foreground transition-colors hover:border-primary/40">
        <input
          type="checkbox"
          checked={config.generatePrintSheet ?? true}
          onChange={(e) => onChange({ ...config, generatePrintSheet: e.target.checked })}
          className="rounded border-input text-primary focus:ring-primary"
        />
        <Printer className="h-4 w-4 text-primary shrink-0" />
        <div>
          <span className="block font-semibold">Generate 4×6" Printable Photo Sheet</span>
          <span className="block text-[0.7rem] text-muted-foreground mt-0.5">
            Arranges multiple passport photos with thin cutting guidelines for standard 10×15 cm
            photo center prints.
          </span>
        </div>
      </label>
    </div>
  );
}
