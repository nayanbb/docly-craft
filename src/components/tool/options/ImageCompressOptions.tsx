interface ImageCompressOptionsProps {
  quality: number;
  onChangeQuality: (q: number) => void;
}

export function ImageCompressOptions({ quality, onChangeQuality }: ImageCompressOptionsProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Compression Level</h3>
        <span className="text-xs font-semibold tabular-nums text-primary">
          Quality: {Math.round(quality * 100)}%
        </span>
      </div>

      <input
        type="range"
        min="0.2"
        max="0.95"
        step="0.05"
        value={quality}
        onChange={(e) => onChangeQuality(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />

      <div className="flex justify-between text-[0.7rem] text-muted-foreground">
        <span>Smaller Size (20%)</span>
        <span>Balanced (70%)</span>
        <span>Higher Quality (95%)</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Balances image file size with visual clarity. After processing, exact byte metrics and
        percentage reduction will be displayed truthfully.
      </p>
    </div>
  );
}
