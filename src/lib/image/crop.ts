import { loadImage } from "./convert";

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Crops an image to the designated bounding area.
 */
export async function cropImage(
  file: File,
  area: CropArea,
  quality: number = 0.92,
): Promise<{ blob: Blob; filename: string }> {
  const img = await loadImage(file);
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  // Clamp within bounds
  const x = Math.max(0, Math.min(srcW - 1, area.x));
  const y = Math.max(0, Math.min(srcH - 1, area.y));
  const width = Math.max(1, Math.min(srcW - x, area.width));
  const height = Math.max(1, Math.min(srcH - y, area.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not initialize canvas context for cropping.");
  }

  const isJpeg = file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg");
  if (isJpeg) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, x, y, width, height, 0, 0, canvas.width, canvas.height);

  const mime = isJpeg ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to crop image."));
      },
      mime,
      quality,
    );
  });

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const ext = isJpeg ? "jpg" : "png";
  const filename = `${baseName}-cropped.${ext}`;

  return { blob, filename };
}
