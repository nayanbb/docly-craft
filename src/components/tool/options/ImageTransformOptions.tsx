import { RotateCw, FlipHorizontal, FlipVertical } from "lucide-react";
import type { TransformFlip } from "@/lib/image/transform";

interface ImageTransformOptionsProps {
  rotation: number;
  onChangeRotation: (deg: number) => void;
  flip: TransformFlip;
  onChangeFlip: (flip: TransformFlip) => void;
  isRotateOnly?: boolean;
  isFlipOnly?: boolean;
}

export function ImageTransformOptions({
  rotation,
  onChangeRotation,
  flip,
  onChangeFlip,
  isRotateOnly,
  isFlipOnly,
}: ImageTransformOptionsProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">
        {isFlipOnly ? "Mirror & Flip" : isRotateOnly ? "Rotation" : "Orientation & Flip"}
      </h3>

      {!isFlipOnly && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-foreground">Rotate Angle</span>
          <div className="grid grid-cols-4 gap-2">
            {[0, 90, 180, 270].map((deg) => (
              <button
                key={deg}
                type="button"
                onClick={() => onChangeRotation(deg)}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  rotation === deg
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                <RotateCw className="h-3 w-3" />
                {deg}°
              </button>
            ))}
          </div>
        </div>
      )}

      {!isRotateOnly && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-foreground">Mirror Direction</span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onChangeFlip("none")}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                flip === "none"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => onChangeFlip("horizontal")}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                flip === "horizontal"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              <FlipHorizontal className="h-3.5 w-3.5" />
              Horizontal
            </button>
            <button
              type="button"
              onClick={() => onChangeFlip("vertical")}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                flip === "vertical"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              <FlipVertical className="h-3.5 w-3.5" />
              Vertical
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
