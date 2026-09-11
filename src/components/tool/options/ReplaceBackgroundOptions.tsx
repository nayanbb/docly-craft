import { useState } from "react";
import type { ReplaceBackgroundOptions as Config } from "@/lib/ai/segmentation";
import { Sparkles, Palette, Layers, Image as ImageIcon } from "lucide-react";

interface ReplaceBackgroundOptionsProps {
  config: Config;
  onChange: (config: Config) => void;
}

const COLOR_PRESETS = [
  { label: "White", value: "#FFFFFF" },
  { label: "Studio Grey", value: "#F1F5F9" },
  { label: "Slate", value: "#E2E8F0" },
  { label: "Docly Blue", value: "#3B82F6" },
  { label: "Dark Navy", value: "#0F172A" },
  { label: "Soft Mint", value: "#D1FAE5" },
  { label: "Sunset Amber", value: "#FEF3C7" },
  { label: "Lavender", value: "#EDE9FE" },
];

const GRADIENT_PRESETS = [
  {
    name: "Docly Modern",
    from: "#3B82F6",
    to: "#1D4ED8",
    direction: "to-bottom" as const,
  },
  {
    name: "Cyber Purple",
    from: "#8B5CF6",
    to: "#4C1D95",
    direction: "to-bottom-right" as const,
  },
  {
    name: "Emerald Glow",
    from: "#10B981",
    to: "#047857",
    direction: "to-bottom" as const,
  },
  {
    name: "Sunset Warmth",
    from: "#F59E0B",
    to: "#EF4444",
    direction: "to-bottom-right" as const,
  },
  {
    name: "Studio Radial",
    from: "#F8FAFC",
    to: "#CBD5E1",
    direction: "radial" as const,
  },
  {
    name: "Dark Studio",
    from: "#334155",
    to: "#0F172A",
    direction: "to-bottom" as const,
  },
];

export function ReplaceBackgroundOptions({ config, onChange }: ReplaceBackgroundOptionsProps) {
  const [activeTab, setActiveTab] = useState<"color" | "gradient" | "image">(config.type || "color");

  const handleTypeChange = (type: "color" | "gradient" | "image") => {
    setActiveTab(type);
    if (type === "color") {
      onChange({
        ...config,
        type: "color",
        color: config.color || "#FFFFFF",
      });
    } else if (type === "gradient") {
      onChange({
        ...config,
        type: "gradient",
        gradient: config.gradient || GRADIENT_PRESETS[0],
      });
    } else {
      onChange({
        ...config,
        type: "image",
      });
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Background Replacement Settings</h3>
        </div>
        <span className="text-xs text-muted-foreground font-mono">Vision AI Matting</span>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/60 p-1">
        <button
          type="button"
          onClick={() => handleTypeChange("color")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
            activeTab === "color"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Palette className="h-3.5 w-3.5" />
          Solid Color
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange("gradient")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
            activeTab === "gradient"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Gradient
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange("image")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
            activeTab === "image"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Custom Image
        </button>
      </div>

      {/* Color Tab */}
      {activeTab === "color" && (
        <div className="space-y-3">
          <label className="text-xs font-medium text-muted-foreground">Select Solid Color</label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {COLOR_PRESETS.map((c) => {
              const isSelected = (config.color || "#FFFFFF").toUpperCase() === c.value.toUpperCase();
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => onChange({ ...config, type: "color", color: c.value })}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition-all ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                      : "border-border hover:border-primary/40 bg-background"
                  }`}
                >
                  <span
                    className="h-6 w-6 rounded-full border border-black/10 shadow-inner"
                    style={{ backgroundColor: c.value }}
                  />
                  <span className="text-[10px] text-muted-foreground line-clamp-1">{c.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <span className="text-xs text-muted-foreground">Custom Color:</span>
            <input
              type="color"
              value={config.color || "#FFFFFF"}
              onChange={(e) => onChange({ ...config, type: "color", color: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
            />
            <span className="font-mono text-xs text-foreground uppercase">
              {config.color || "#FFFFFF"}
            </span>
          </div>
        </div>
      )}

      {/* Gradient Tab */}
      {activeTab === "gradient" && (
        <div className="space-y-3">
          <label className="text-xs font-medium text-muted-foreground">Select Studio Gradient</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {GRADIENT_PRESETS.map((g) => {
              const isSelected =
                config.gradient?.from === g.from && config.gradient?.to === g.to;
              const bgStyle =
                g.direction === "radial"
                  ? `radial-gradient(circle, ${g.from}, ${g.to})`
                  : `linear-gradient(to bottom, ${g.from}, ${g.to})`;

              return (
                <button
                  key={g.name}
                  type="button"
                  onClick={() => onChange({ ...config, type: "gradient", gradient: g })}
                  className={`group flex items-center gap-2.5 rounded-xl border p-2 text-left transition-all ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                      : "border-border hover:border-primary/40 bg-background"
                  }`}
                >
                  <span
                    className="h-8 w-8 rounded-lg shadow-sm shrink-0"
                    style={{ background: bgStyle }}
                  />
                  <span className="text-xs font-medium text-foreground">{g.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Image Tab */}
      {activeTab === "image" && (
        <div className="space-y-3">
          <label className="text-xs font-medium text-muted-foreground">
            Upload Custom Background
          </label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/jpg"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onChange({ ...config, type: "image", backgroundImage: file });
              }
            }}
            className="block w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
          />
          <p className="text-[11px] text-muted-foreground">
            Upload an office background, landscape, or custom wallpaper. The subject will be
            composited cleanly in front.
          </p>
        </div>
      )}
    </div>
  );
}
