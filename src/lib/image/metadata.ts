import { loadImage } from "./convert";

/**
 * Strips all EXIF, GPS location, camera model, and creation metadata from an image.
 */
export async function removeImageMetadata(file: File): Promise<{ blob: Blob; filename: string }> {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not initialize canvas context to clean metadata.");
  }

  const isJpeg =
    file.type === "image/jpeg" ||
    file.name.toLowerCase().endsWith(".jpg") ||
    file.name.toLowerCase().endsWith(".jpeg");
  const isWebp = file.type === "image/webp" || file.name.toLowerCase().endsWith(".webp");

  if (isJpeg) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);

  const mime = isJpeg ? "image/jpeg" : isWebp ? "image/webp" : "image/png";
  const ext = isJpeg ? "jpg" : isWebp ? "webp" : "png";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to export clean image."));
      },
      mime,
      0.95,
    );
  });

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const filename = `${baseName}-clean.${ext}`;

  return { blob, filename };
}
