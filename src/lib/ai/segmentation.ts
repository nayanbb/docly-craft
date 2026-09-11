/**
 * Docly Vision AI - Subject Segmentation & Background Engine
 *
 * Implements client-side neural segmentation using @imgly/background-removal (ISNet)
 * with robust client-side fallback matting.
 *
 * Supports:
 * 1. Pure transparent PNG subject cutout (Remove Background - AI-2)
 * 2. Background Replacement with solid color, gradient, or custom background image (AI-3)
 *
 * Strictly preserves the user's original foreground pixels without generative distortion.
 */

export interface ReplaceBackgroundOptions {
  type: "color" | "gradient" | "image";
  color?: string; // hex color e.g. "#FFFFFF", "#3B82F6", etc.
  gradient?: {
    from: string;
    to: string;
    direction?: "to-bottom" | "to-right" | "to-bottom-right" | "radial";
  };
  backgroundImage?: File | Blob | string; // Custom uploaded background
  outputFormat?: "image/png" | "image/jpeg" | "image/webp";
  quality?: number; // 0.1 to 1.0
}

export interface SegmentationResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  transparentBlob?: Blob;
  transparentDataUrl?: string;
}

/**
 * Loads an image from File, Blob, HTMLCanvasElement, or HTMLImageElement into an HTMLImageElement.
 */
export async function resolveImageElement(
  source: File | Blob | HTMLImageElement | HTMLCanvasElement | string,
): Promise<HTMLImageElement> {
  if (source instanceof HTMLImageElement) {
    if (source.complete && source.naturalWidth > 0) return source;
    return new Promise((resolve, reject) => {
      source.onload = () => resolve(source);
      source.onerror = reject;
    });
  }

  let srcUrl: string;
  let shouldRevoke = false;

  if (source instanceof HTMLCanvasElement) {
    srcUrl = source.toDataURL("image/png");
  } else if (source instanceof Blob) {
    srcUrl = URL.createObjectURL(source);
    shouldRevoke = true;
  } else if (typeof source === "string") {
    srcUrl = source;
  } else {
    throw new Error("Invalid image source provided for segmentation.");
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (shouldRevoke) URL.revokeObjectURL(srcUrl);
      resolve(img);
    };
    img.onerror = () => {
      if (shouldRevoke) URL.revokeObjectURL(srcUrl);
      reject(new Error("Failed to load image for background processing."));
    };
    img.src = srcUrl;
  });
}

/**
 * Converts a Blob to a Base64 data URL.
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Converts a canvas to a Blob.
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = "image/png",
  quality: number = 0.95,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to export image from canvas."));
      },
      type,
      quality,
    );
  });
}

/**
 * Client-side edge/color matting fallback when neural segmentation is loading or fails.
 */
export function fallbackMatting(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const width = canvas.width;
  const height = canvas.height;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) return canvas;

  outCtx.drawImage(canvas, 0, 0);
  const imgData = outCtx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Sample perimeter for background colors
  const bgSamples: Array<[number, number, number]> = [];
  const cornerDepth = Math.min(40, Math.floor(width * 0.08));

  for (let y = 0; y < cornerDepth; y++) {
    for (let x = 0; x < width; x += 4) {
      if (x < cornerDepth || x > width - cornerDepth || y < 10) {
        const idx = (y * width + x) * 4;
        bgSamples.push([data[idx] ?? 255, data[idx + 1] ?? 255, data[idx + 2] ?? 255]);
      }
    }
  }

  const avgBg = bgSamples
    .reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0])
    .map((v) => v / Math.max(1, bgSamples.length));

  const threshold = 40;
  const feather = 20;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx] ?? 0;
      const g = data[idx + 1] ?? 0;
      const b = data[idx + 2] ?? 0;

      const dist = Math.sqrt(
        Math.pow(r - (avgBg[0] ?? 255), 2) +
          Math.pow(g - (avgBg[1] ?? 255), 2) +
          Math.pow(b - (avgBg[2] ?? 255), 2),
      );

      if (dist < threshold) {
        data[idx + 3] = 0;
      } else if (dist < threshold + feather) {
        const t = (dist - threshold) / feather;
        data[idx + 3] = Math.round(t * 255);
      }
    }
  }

  outCtx.putImageData(imgData, 0, 0);
  return outCanvas;
}

/**
 * Removes the background from an image source, producing a crisp transparent PNG.
 *
 * 1. Uses @imgly/background-removal neural segmentation.
 * 2. Falls back smoothly to perimeter matting if WebAssembly fails.
 * 3. Never rescales or distorts the user's foreground subject.
 */
export async function removeImageBackground(
  source: File | Blob | HTMLImageElement | HTMLCanvasElement,
  onProgress?: (percent: number) => void,
): Promise<SegmentationResult> {
  onProgress?.(10);

  // Convert source to Blob for imgly
  let inputBlob: Blob;
  let originalWidth = 0;
  let originalHeight = 0;

  if (source instanceof Blob) {
    inputBlob = source;
    const img = await resolveImageElement(source);
    originalWidth = img.naturalWidth || img.width;
    originalHeight = img.naturalHeight || img.height;
  } else if (source instanceof HTMLCanvasElement) {
    originalWidth = source.width;
    originalHeight = source.height;
    inputBlob = await canvasToBlob(source, "image/png");
  } else if (source instanceof HTMLImageElement) {
    originalWidth = source.naturalWidth || source.width;
    originalHeight = source.naturalHeight || source.height;
    const canvas = document.createElement("canvas");
    canvas.width = originalWidth;
    canvas.height = originalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable.");
    ctx.drawImage(source, 0, 0);
    inputBlob = await canvasToBlob(canvas, "image/png");
  } else {
    throw new Error("Unsupported image source.");
  }

  onProgress?.(25);

  let cutoutBlob: Blob;
  try {
    const { removeBackground } = await import("@imgly/background-removal");
    cutoutBlob = await removeBackground(inputBlob, {
      model: "isnet_quint8",
      output: { format: "image/png" },
      progress: (_key, cur, tot) => {
        if (tot > 0) {
          const ratio = Math.min(1, cur / tot);
          onProgress?.(Math.round(25 + ratio * 65));
        }
      },
    });
  } catch (err) {
    console.warn("Neural background removal unavailable, using perimeter matting fallback:", err);
    onProgress?.(50);
    const img = await resolveImageElement(inputBlob);
    const canvas = document.createElement("canvas");
    canvas.width = originalWidth;
    canvas.height = originalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context failed.");
    ctx.drawImage(img, 0, 0);
    const matted = fallbackMatting(canvas);
    cutoutBlob = await canvasToBlob(matted, "image/png");
  }

  onProgress?.(95);
  const dataUrl = await blobToDataUrl(cutoutBlob);
  onProgress?.(100);

  return {
    blob: cutoutBlob,
    dataUrl,
    width: originalWidth,
    height: originalHeight,
    transparentBlob: cutoutBlob,
    transparentDataUrl: dataUrl,
  };
}

/**
 * Replaces the background of an image with a solid color, gradient, or custom background image.
 */
export async function replaceImageBackground(
  source: File | Blob | HTMLImageElement | HTMLCanvasElement,
  options: ReplaceBackgroundOptions,
  onProgress?: (percent: number) => void,
): Promise<SegmentationResult> {
  // Step 1: Remove background to extract transparent cutout
  onProgress?.(5);
  const cutout = await removeImageBackground(source, (p) => {
    onProgress?.(Math.round(p * 0.7));
  });

  onProgress?.(75);
  const cutoutImg = await resolveImageElement(cutout.blob);
  const width = cutout.width;
  const height = cutout.height;

  // Step 2: Create composition canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize 2D canvas context.");

  // Step 3: Draw requested background
  if (options.type === "color") {
    const bgColor = options.color || "#FFFFFF";
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
  } else if (options.type === "gradient") {
    const from = options.gradient?.from || "#3B82F6";
    const to = options.gradient?.to || "#1E40AF";
    const direction = options.gradient?.direction || "to-bottom";

    let gradient: CanvasGradient;
    if (direction === "to-right") {
      gradient = ctx.createLinearGradient(0, 0, width, 0);
    } else if (direction === "to-bottom-right") {
      gradient = ctx.createLinearGradient(0, 0, width, height);
    } else if (direction === "radial") {
      gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        10,
        width / 2,
        height / 2,
        Math.max(width, height) / 1.5,
      );
    } else {
      // to-bottom
      gradient = ctx.createLinearGradient(0, 0, 0, height);
    }

    gradient.addColorStop(0, from);
    gradient.addColorStop(1, to);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  } else if (options.type === "image" && options.backgroundImage) {
    try {
      const bgImg = await resolveImageElement(options.backgroundImage);
      // Draw background image scaled and centered (cover mode)
      const bgAspect = (bgImg.naturalWidth || bgImg.width) / (bgImg.naturalHeight || bgImg.height);
      const canvasAspect = width / height;

      let drawW = width;
      let drawH = height;
      let drawX = 0;
      let drawY = 0;

      if (bgAspect > canvasAspect) {
        drawW = height * bgAspect;
        drawX = (width - drawW) / 2;
      } else {
        drawH = width / bgAspect;
        drawY = (height - drawH) / 2;
      }

      ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);
    } catch (err) {
      console.warn("Failed to draw custom background image, falling back to white:", err);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    // Default white
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
  }

  onProgress?.(85);

  // Step 4: Draw original foreground cutout over the new background
  ctx.drawImage(cutoutImg, 0, 0, width, height);

  onProgress?.(95);

  const outputFormat = options.outputFormat || (options.type === "color" && options.color === "transparent" ? "image/png" : "image/jpeg");
  const quality = options.quality ?? 0.95;

  const resultBlob = await canvasToBlob(canvas, outputFormat, quality);
  const resultDataUrl = await blobToDataUrl(resultBlob);

  onProgress?.(100);

  return {
    blob: resultBlob,
    dataUrl: resultDataUrl,
    width,
    height,
    transparentBlob: cutout.blob,
    transparentDataUrl: cutout.dataUrl,
  };
}
