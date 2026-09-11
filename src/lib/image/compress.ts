import { loadImage } from "./convert";

export interface ImageCompressionResult {
  blob: Blob;
  originalSize: number;
  newSize: number;
  savedBytes: number;
  percentageChange: number;
  isReduced: boolean;
  explanation: string;
  filename: string;
}

/**
 * Compresses an image with user-specified quality and truthful byte reporting.
 */
export async function compressImage(
  file: File,
  quality: number = 0.75, // 0.1 to 0.95
): Promise<ImageCompressionResult> {
  const originalSize = file.size;
  const img = await loadImage(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not initialize canvas context for compression.");
  }

  const isPng = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
  const isWebp = file.type === "image/webp" || file.name.toLowerCase().endsWith(".webp");

  // Output format: WEBP if input is WEBP or if user wants highest compression, otherwise JPEG
  const targetMime = isWebp ? "image/webp" : isPng ? "image/webp" : "image/jpeg";
  const ext = targetMime === "image/webp" ? "webp" : "jpg";

  if (targetMime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }

  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to compress image."));
      },
      targetMime,
      quality,
    );
  });

  const newSize = blob.size;
  const savedBytes = originalSize - newSize;
  const percentageChange = Math.round(((originalSize - newSize) / originalSize) * 100);
  const isReduced = newSize < originalSize;

  let explanation = "";
  if (isReduced) {
    explanation = `Compressed by ${percentageChange}% (${(savedBytes / 1024).toFixed(1)} KB saved).`;
  } else {
    explanation = `The output file (${(newSize / 1024).toFixed(1)} KB) is not smaller than the original (${(originalSize / 1024).toFixed(1)} KB). The original image is already heavily compressed.`;
  }

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const filename = `${baseName}-compressed.${ext}`;

  return {
    blob,
    originalSize,
    newSize,
    savedBytes,
    percentageChange,
    isReduced,
    explanation,
    filename,
  };
}
