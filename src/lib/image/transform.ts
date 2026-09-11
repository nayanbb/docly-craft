import { loadImage } from "./convert";

export type TransformRotation = 90 | 180 | 270;
export type TransformFlip = "horizontal" | "vertical" | "none";

/**
 * Applies rotation and/or flipping to an image file.
 */
export async function transformImage(
  file: File,
  rotation: number = 0,
  flip: TransformFlip = "none",
  quality: number = 0.92,
): Promise<{ blob: Blob; filename: string }> {
  const img = await loadImage(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const normalizedRotation = ((rotation % 360) + 360) % 360;
  const isSwap = normalizedRotation === 90 || normalizedRotation === 270;

  const canvas = document.createElement("canvas");
  canvas.width = isSwap ? h : w;
  canvas.height = isSwap ? w : h;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not initialize canvas context for transform.");
  }

  const isJpeg = file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg");
  if (isJpeg) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Move origin to canvas center
  ctx.translate(canvas.width / 2, canvas.height / 2);

  // Apply rotation
  if (normalizedRotation !== 0) {
    ctx.rotate((normalizedRotation * Math.PI) / 180);
  }

  // Apply flip
  const scaleX = flip === "horizontal" ? -1 : 1;
  const scaleY = flip === "vertical" ? -1 : 1;
  if (scaleX !== 1 || scaleY !== 1) {
    ctx.scale(scaleX, scaleY);
  }

  // Draw centered
  ctx.drawImage(img, -w / 2, -h / 2);

  const mime = isJpeg ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to transform image."));
      },
      mime,
      quality,
    );
  });

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const ext = isJpeg ? "jpg" : "png";
  const label = flip !== "none" ? `flipped-${flip}` : `rotated-${normalizedRotation}deg`;
  const filename = `${baseName}-${label}.${ext}`;

  return { blob, filename };
}
