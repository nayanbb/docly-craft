/**
 * Universal Image Conversion Engine for Docly.
 * Handles JPG <-> PNG <-> WEBP conversions using HTML5 Canvas.
 */

export type TargetImageFormat = "jpg" | "png" | "webp";

export function getMimeType(format: TargetImageFormat): string {
  switch (format) {
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
  }
}

/**
 * Loads a File or Blob into an HTMLImageElement safely.
 */
export async function loadImage(source: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = typeof source === "string" ? source : URL.createObjectURL(source);

    img.onload = () => {
      if (typeof source !== "string") {
        URL.revokeObjectURL(url);
      }
      resolve(img);
    };

    img.onerror = () => {
      if (typeof source !== "string") {
        URL.revokeObjectURL(url);
      }
      reject(new Error("Failed to load image. The file may be corrupt or an unsupported format."));
    };

    img.src = url;
  });
}

/**
 * Converts an image file to the target format.
 */
export async function convertImage(
  file: File,
  targetFormat: TargetImageFormat,
  quality: number = 0.92,
): Promise<{ blob: Blob; filename: string }> {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not initialize canvas context for image conversion.");
  }

  // When converting to JPG, fill a solid white background to avoid black transparency
  if (targetFormat === "jpg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);

  const mime = getMimeType(targetFormat);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to generate converted image file."));
      },
      mime,
      quality,
    );
  });

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const filename = `${baseName}.${targetFormat}`;

  return { blob, filename };
}
