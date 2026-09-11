import { loadImage } from "./convert";

export interface FilterOptions {
  brightness?: number; // -100 to 100, default 0
  contrast?: number; // -100 to 100, default 0
  grayscale?: boolean; // default false
}

/**
 * Applies brightness, contrast, and grayscale filters to an image.
 */
export async function applyImageFilters(
  file: File,
  options: FilterOptions,
  quality: number = 0.92,
): Promise<{ blob: Blob; filename: string }> {
  const img = await loadImage(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not initialize canvas context for filters.");
  }

  const brightness = options.brightness ?? 0;
  const contrast = options.contrast ?? 0;
  const isGrayscale = options.grayscale ?? false;

  // Convert percentages into CSS filter syntax
  // CSS brightness(100%) = normal. Range: 0% to 200%
  const bVal = 100 + brightness;
  // CSS contrast(100%) = normal. Range: 0% to 200%
  const cVal = 100 + contrast;
  const gVal = isGrayscale ? 100 : 0;

  const isJpeg = file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg");
  if (isJpeg) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }

  ctx.filter = `brightness(${bVal}%) contrast(${cVal}%) grayscale(${gVal}%)`;
  ctx.drawImage(img, 0, 0);

  // If grayscale requested, enforce exact luminance mapping to guarantee monochrome
  if (isGrayscale) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const mime = isJpeg ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to process filtered image."));
      },
      mime,
      quality,
    );
  });

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const ext = isJpeg ? "jpg" : "png";
  let tag = "adjusted";
  if (isGrayscale) tag = "grayscale";
  else if (brightness !== 0) tag = `brightness-${brightness > 0 ? "+" : ""}${brightness}`;
  else if (contrast !== 0) tag = `contrast-${contrast > 0 ? "+" : ""}${contrast}`;

  const filename = `${baseName}-${tag}.${ext}`;
  return { blob, filename };
}
