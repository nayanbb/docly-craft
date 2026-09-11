import { loadImage } from "./convert";

export interface ResizeOptions {
  width?: number | undefined;
  height?: number | undefined;
  scalePercent?: number | undefined;
  preserveAspectRatio?: boolean | undefined;
}

/**
 * Resizes an image file using high-quality Canvas bicubic resampling.
 */
export async function resizeImage(
  file: File,
  options: ResizeOptions,
  quality: number = 0.92,
): Promise<{ blob: Blob; width: number; height: number; filename: string }> {
  const img = await loadImage(file);
  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;

  let targetWidth = originalWidth;
  let targetHeight = originalHeight;

  if (options.scalePercent && options.scalePercent > 0) {
    const factor = options.scalePercent / 100;
    targetWidth = Math.max(1, Math.round(originalWidth * factor));
    targetHeight = Math.max(1, Math.round(originalHeight * factor));
  } else if (options.width && options.height) {
    if (options.preserveAspectRatio) {
      const ratio = originalWidth / originalHeight;
      if (options.width / options.height > ratio) {
        targetHeight = options.height;
        targetWidth = Math.round(options.height * ratio);
      } else {
        targetWidth = options.width;
        targetHeight = Math.round(options.width / ratio);
      }
    } else {
      targetWidth = options.width;
      targetHeight = options.height;
    }
  } else if (options.width) {
    targetWidth = options.width;
    targetHeight = Math.round((options.width / originalWidth) * originalHeight);
  } else if (options.height) {
    targetHeight = options.height;
    targetWidth = Math.round((options.height / originalHeight) * originalWidth);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not initialize canvas context for resizing.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Preserve transparency for PNG/WEBP, fill white for JPEG
  const isJpeg =
    file.type === "image/jpeg" ||
    file.name.toLowerCase().endsWith(".jpg") ||
    file.name.toLowerCase().endsWith(".jpeg");
  if (isJpeg) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const mime = file.type || (isJpeg ? "image/jpeg" : "image/png");
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to render resized image."));
      },
      mime,
      quality,
    );
  });

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const ext = isJpeg ? "jpg" : "png";
  const filename = `${baseName}-${targetWidth}x${targetHeight}.${ext}`;

  return { blob, width: targetWidth, height: targetHeight, filename };
}
