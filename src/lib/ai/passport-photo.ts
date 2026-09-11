import { loadImage } from "../image/convert";
import {
  detectFaceAndUpperBody,
  hasSufficientUpperBody,
  type FaceDetectionResult,
} from "./face-detection";

export interface PassportPreset {
  id: string;
  name: string;
  country: string;
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  notes: string;
}

export const PASSPORT_PRESETS: PassportPreset[] = [
  {
    id: "uk-eu",
    name: "UK & Schengen Visa / EU",
    country: "UK / Europe",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    notes: "35 x 45 mm @ 300 DPI. Plain light grey, blue or white background.",
  },
  {
    id: "us",
    name: "US Passport & Visa",
    country: "United States",
    widthMm: 51,
    heightMm: 51,
    widthPx: 600,
    heightPx: 600,
    notes: "2 x 2 inches (51 x 51 mm) @ 300 DPI. Plain white or off-white background.",
  },
  {
    id: "india",
    name: "India Passport",
    country: "India",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    notes: "35 x 45 mm @ 300 DPI. Plain light background (white preferred).",
  },
  {
    id: "canada",
    name: "Canada Passport",
    country: "Canada",
    widthMm: 50,
    heightMm: 70,
    widthPx: 590,
    heightPx: 826,
    notes: "50 x 70 mm @ 300 DPI. Pure white or light-colored background.",
  },
  {
    id: "id-photo",
    name: "Standard ID / Driver's License",
    country: "International",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    notes: "Standard ID 35 x 45 mm @ 300 DPI. Clean solid background.",
  },
];

export interface PassportPhotoConfig {
  presetId: string;
  backgroundColor: string; // e.g. "#ffffff", "#dbeafe", "#f3f4f6", "#2563eb"
  generatePrintSheet?: boolean; // 4x6 inch printable grid
}

export interface PassportPhotoOutput {
  singleBlob: Blob;
  singleFilename: string;
  singleDataUrl: string;
  sheetBlob?: Blob | undefined;
  sheetFilename?: string | undefined;
  sheetDataUrl?: string | undefined;
  preset: PassportPreset;
  beforeDataUrl?: string | undefined;
}

export interface FramingCropRect {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
}

/**
 * Loads an image Blob into an HTMLImageElement safely.
 */
function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load processed image."));
    };
    img.src = url;
  });
}

/**
 * Converts a Blob to a Base64 Data URL for stable inline preview.
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
 * Converts a canvas to a JPEG/PNG Blob.
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = "image/jpeg",
  quality: number = 0.95,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to generate image blob from canvas."));
      },
      type,
      quality,
    );
  });
}

/**
 * Calculates the exact portrait framing rectangle on the ORIGINAL image.
 *
 * Requirements:
 * 1. Anchored around the detected face bounding box.
 * 2. Extends upward enough for complete hair + standard headroom (~9%).
 * 3. Extends downward to include neck, shoulders, and upper chest (~65% headHeight below chin).
 * 4. Extends horizontally to include both shoulders (~2.4x - 2.8x face width).
 * 5. Exactly matches the target aspect ratio of the passport preset.
 * 6. Never stretches or distorts original pixels.
 * 7. Fails gracefully if upper-body information is insufficient.
 */
export function calculatePassportFraming(
  imgWidth: number,
  imgHeight: number,
  detection: FaceDetectionResult,
  preset: PassportPreset,
): FramingCropRect {
  const fBox = detection.faceBox;
  const faceCenterX = fBox.x + fBox.width / 2;
  const chinY = fBox.y + fBox.height;
  const crownY = detection.headBox.y;
  const headH = Math.max(35, chinY - crownY);

  // Validate sufficient upper body
  if (!hasSufficientUpperBody(chinY, headH, imgHeight)) {
    throw new Error(
      "Your photo does not contain enough suitable upper-body area for a passport-style crop. Please upload a clearer photo.",
    );
  }

  const targetAspect = preset.widthPx / preset.heightPx;

  // In international biometric passports, head height occupies ~54% of photo height
  const targetHeadRatio = 0.54;
  const targetHeadroomRatio = 0.095; // ~9.5% headroom above hair crown

  let cropHeight = headH / targetHeadRatio;
  let cropWidth = cropHeight * targetAspect;

  // Ideal crop vertical positioning
  let cropTop = crownY - cropHeight * targetHeadroomRatio;
  let cropBottom = cropTop + cropHeight;

  // Boundary checks & adjustments
  // 1. If cropTop < 0, shift down within available image bounds
  if (cropTop < 0) {
    const shift = -cropTop;
    cropTop = 0;
    cropBottom += shift;
  }

  // 2. If cropBottom exceeds image height, check if we still have adequate upper body
  if (cropBottom > imgHeight) {
    // Check if chin + 35% headH is visible
    const minRequiredBottom = chinY + headH * 0.35;
    if (minRequiredBottom > imgHeight) {
      throw new Error(
        "Your photo does not contain enough suitable upper-body area for a passport-style crop. Please upload a clearer photo.",
      );
    }
    // Anchor bottom at image boundary and adjust crop height & width
    cropBottom = imgHeight;
    cropHeight = Math.min(imgHeight, cropBottom - cropTop);
    cropWidth = cropHeight * targetAspect;
  }

  // 3. Horizontal positioning: center on face
  let cropLeft = faceCenterX - cropWidth / 2;
  let cropRight = cropLeft + cropWidth;

  if (cropLeft < 0) {
    const shift = -cropLeft;
    cropLeft = 0;
    cropRight = Math.min(imgWidth, cropRight + shift);
    cropWidth = cropRight - cropLeft;
    cropHeight = cropWidth / targetAspect;
  } else if (cropRight > imgWidth) {
    const shift = cropRight - imgWidth;
    cropRight = imgWidth;
    cropLeft = Math.max(0, cropLeft - shift);
    cropWidth = cropRight - cropLeft;
    cropHeight = cropWidth / targetAspect;
  }

  // Final sanity validation: ensure head is not truncated
  if (cropWidth < headH || cropHeight < headH * 1.3) {
    throw new Error(
      "The detected subject is too close to the image edge. Please upload a photo with centered framing.",
    );
  }

  return {
    cropX: Math.max(0, Math.round(cropLeft)),
    cropY: Math.max(0, Math.round(cropTop)),
    cropWidth: Math.round(cropWidth),
    cropHeight: Math.round(cropHeight),
  };
}

/**
 * Crops the high-resolution original image strictly to the calculated
 * head-and-shoulders framing rectangle.
 */
export function cropOriginalImageToPortrait(
  origCanvas: HTMLCanvasElement,
  framing: FramingCropRect,
): HTMLCanvasElement {
  const cropped = document.createElement("canvas");
  cropped.width = framing.cropWidth;
  cropped.height = framing.cropHeight;
  const ctx = cropped.getContext("2d");
  if (!ctx) {
    throw new Error("Could not initialize canvas context for portrait crop.");
  }

  ctx.drawImage(
    origCanvas,
    framing.cropX,
    framing.cropY,
    framing.cropWidth,
    framing.cropHeight,
    0,
    0,
    framing.cropWidth,
    framing.cropHeight,
  );

  return cropped;
}

/**
 * Fallback client-side edge/color matting when neural WASM is unavailable.
 */
function fallbackMatting(canvas: HTMLCanvasElement): HTMLCanvasElement {
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

  // Sample top corners and top border for background color
  const bgSamples: Array<[number, number, number]> = [];
  const cornerDepth = Math.min(30, Math.floor(width * 0.1));

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

  const threshold = 42;
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
 * Removes the background specifically from the cropped head-and-shoulders portrait.
 * Operates on the closely-framed portrait canvas using neural segmentation (@imgly/background-removal).
 */
export async function segmentPortraitSubject(
  croppedCanvas: HTMLCanvasElement,
  onProgress?: (percent: number) => void,
): Promise<HTMLCanvasElement> {
  onProgress?.(50);

  try {
    const croppedBlob = await canvasToBlob(croppedCanvas, "image/png");
    const croppedFile = new File([croppedBlob], "portrait-crop.png", { type: "image/png" });

    const { removeBackground } = await import("@imgly/background-removal");
    const removedBlob = await removeBackground(croppedFile, {
      model: "isnet_quint8",
      output: { format: "image/png" },
      progress: (_key, cur, tot) => {
        if (tot > 0) {
          const pct = Math.round(50 + (cur / tot) * 30);
          onProgress?.(Math.min(80, pct));
        }
      },
    });

    onProgress?.(80);

    const isolatedImg = await loadImageFromBlob(removedBlob);
    const isolatedCanvas = document.createElement("canvas");
    isolatedCanvas.width = croppedCanvas.width;
    isolatedCanvas.height = croppedCanvas.height;
    const isoCtx = isolatedCanvas.getContext("2d");
    if (!isoCtx) throw new Error("Could not initialize canvas context for segmentation.");

    isoCtx.drawImage(isolatedImg, 0, 0, croppedCanvas.width, croppedCanvas.height);
    return isolatedCanvas;
  } catch (err) {
    if (err instanceof Error && err.message.includes("Your photo does not")) {
      throw err;
    }
    console.warn("Neural matting fallback activated:", err);
    return fallbackMatting(croppedCanvas);
  }
}

/**
 * Composites the isolated original subject onto a clean solid background
 * and resizes to the exact final biometric passport preset dimensions.
 *
 * ABSOLUTE IDENTITY PRESERVATION:
 * Original subject pixels from croppedCanvas are preserved directly.
 * Zero diffusion, zero facial reconstruction, zero beautify filters.
 */
export function compositePassportPhoto(
  croppedCanvas: HTMLCanvasElement,
  segmentedCanvas: HTMLCanvasElement,
  preset: PassportPreset,
  backgroundColorHex: string,
): HTMLCanvasElement {
  const destW = preset.widthPx;
  const destH = preset.heightPx;

  const destCanvas = document.createElement("canvas");
  destCanvas.width = destW;
  destCanvas.height = destH;
  const ctx = destCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not initialize destination canvas context.");
  }

  // 1. Fill entire canvas with user's selected solid background color
  const targetBg = backgroundColorHex.trim() || "#ffffff";
  ctx.fillStyle = targetBg;
  ctx.fillRect(0, 0, destW, destH);

  // 2. Prepare high-precision masked composition using original pixels
  const maskedSubjectCanvas = document.createElement("canvas");
  maskedSubjectCanvas.width = croppedCanvas.width;
  maskedSubjectCanvas.height = croppedCanvas.height;
  const mCtx = maskedSubjectCanvas.getContext("2d");
  if (!mCtx) {
    throw new Error("Could not initialize masking canvas context.");
  }

  // Draw original pixels
  mCtx.drawImage(croppedCanvas, 0, 0);
  // Apply alpha mask from segmentation (destination-in retains original RGB where segmented is opaque)
  mCtx.globalCompositeOperation = "destination-in";
  mCtx.drawImage(segmentedCanvas, 0, 0);

  // 3. Render the cleanly masked original subject onto the solid background
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(maskedSubjectCanvas, 0, 0, destW, destH);

  return destCanvas;
}

/**
 * Builds a printable 4x6 inch (1800 x 1200 px @ 300 DPI) sheet with multiple
 * passport photos arranged with consistent spacing and dashed cutting guidelines.
 */
export function createPrintableSheet(
  singleCanvas: HTMLCanvasElement,
  preset: PassportPreset,
): HTMLCanvasElement {
  const sheet = document.createElement("canvas");
  sheet.width = 1800; // 6 inches @ 300 DPI
  sheet.height = 1200; // 4 inches @ 300 DPI

  const ctx = sheet.getContext("2d");
  if (!ctx) return singleCanvas;

  // Solid white paper
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sheet.width, sheet.height);

  const photoW = preset.widthPx;
  const photoH = preset.heightPx;

  const gap = 24;
  const marginX = 40;
  const marginY = 40;
  const availableW = sheet.width - marginX * 2;
  const availableH = sheet.height - marginY * 2 - 35;

  let cols = Math.max(1, Math.floor((availableW + gap) / (photoW + gap)));
  let rows = Math.max(1, Math.floor((availableH + gap) / (photoH + gap)));

  if (cols < 2 && availableW >= photoW * 2) cols = 2;
  if (rows < 2 && availableH >= photoH * 2) rows = 2;

  const totalGridW = cols * photoW + (cols - 1) * gap;
  const totalGridH = rows * photoH + (rows - 1) * gap;
  const startX = Math.max(20, Math.floor((sheet.width - totalGridW) / 2));
  const startY = Math.max(20, Math.floor((sheet.height - 35 - totalGridH) / 2));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * (photoW + gap);
      const y = startY + r * (photoH + gap);

      ctx.drawImage(singleCanvas, x, y, photoW, photoH);

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#a1a1aa";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 1, y - 1, photoW + 2, photoH + 2);
      ctx.restore();
    }
  }

  ctx.font = "bold 14px sans-serif";
  ctx.fillStyle = "#52525b";
  ctx.textAlign = "center";
  ctx.fillText(
    `Docly Biometric Photo Sheet — ${preset.name} (${preset.widthMm}×${preset.heightMm} mm) — Print on standard 4×6" (10×15 cm) paper at 100% scale (Do not fit/shrink to page)`,
    sheet.width / 2,
    sheet.height - 18,
  );

  return sheet;
}

/**
 * Main AI Passport Photo Processing Pipeline.
 *
 * FULLY AUTOMATIC & IDENTITY PRESERVING:
 * 1. Load Original Image (original source of truth).
 * 2. Validate Image Dimensions & Format.
 * 3. Multi-Tier Face & Upper Body Detection (Native / Server-AI / Biometric / Silhouette).
 * 4. Calculate Head + Shoulders Portrait Framing Rectangle.
 * 5. Verify Upper Body information is sufficient.
 * 6. Crop ORIGINAL IMAGE strictly to framing rectangle.
 * 7. Segment background specifically on the cropped portrait.
 * 8. Composite original subject pixels onto user-selected solid background.
 * 9. Resize to biometric passport preset dimensions.
 * 10. Export single passport image + optional 4x6" printable sheet.
 */
export async function generatePassportPhoto(
  file: File,
  config: PassportPhotoConfig,
  onProgress?: (percent: number, label?: string) => void,
): Promise<PassportPhotoOutput> {
  onProgress?.(10, "Detecting subject...");

  const preset = PASSPORT_PRESETS.find((p) => p.id === config.presetId) ?? PASSPORT_PRESETS[0]!;

  // 1. Load original image
  const img = await loadImage(file);
  const origCanvas = document.createElement("canvas");
  origCanvas.width = img.naturalWidth;
  origCanvas.height = img.naturalHeight;
  const oCtx = origCanvas.getContext("2d");
  if (!oCtx) {
    throw new Error("Could not initialize canvas context for original image.");
  }
  oCtx.drawImage(img, 0, 0);

  // 2. Validate image dimensions
  if (img.naturalWidth < 150 || img.naturalHeight < 150) {
    throw new Error(
      "Image resolution is too low. Please upload a photo with at least 300x300 pixels.",
    );
  }

  onProgress?.(25, "Detecting subject...");

  // 3. Multi-tier face and upper body detection
  const detection = await detectFaceAndUpperBody(origCanvas);

  onProgress?.(38, "Preparing passport framing...");

  // 4. Calculate portrait framing rectangle (head + shoulders + upper chest)
  const framing = calculatePassportFraming(
    origCanvas.width,
    origCanvas.height,
    detection,
    preset,
  );

  onProgress?.(45, "Preparing passport framing...");

  // 5. Crop ORIGINAL IMAGE using calculated framing rectangle
  const croppedPortrait = cropOriginalImageToPortrait(origCanvas, framing);

  onProgress?.(55, "Removing background...");

  // 6. Segment background strictly on the cropped portrait
  const segmentedPortrait = await segmentPortraitSubject(croppedPortrait, (pct) =>
    onProgress?.(pct, "Removing background..."),
  );

  onProgress?.(85, "Creating final photo...");

  // 7. Composite original subject onto solid background and resize to preset
  const finalCanvas = compositePassportPhoto(
    croppedPortrait,
    segmentedPortrait,
    preset,
    config.backgroundColor || "#ffffff",
  );

  onProgress?.(92, "Creating final photo...");

  // 8. Export single passport photo JPEG
  const singleBlob = await canvasToBlob(finalCanvas, "image/jpeg", 0.96);
  const singleDataUrl = await blobToDataUrl(singleBlob);
  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const singleFilename = `${baseName}-${preset.id}-passport.jpg`;

  // 9. Optional printable 4x6" sheet
  let sheetBlob: Blob | undefined;
  let sheetFilename: string | undefined;
  let sheetDataUrl: string | undefined;

  if (config.generatePrintSheet) {
    const sheetCanvas = createPrintableSheet(finalCanvas, preset);
    sheetBlob = await canvasToBlob(sheetCanvas, "image/jpeg", 0.96);
    sheetFilename = `${baseName}-${preset.id}-sheet-4x6.jpg`;
    sheetDataUrl = await blobToDataUrl(sheetBlob);
  }

  onProgress?.(100);

  return {
    singleBlob,
    singleFilename,
    singleDataUrl,
    sheetBlob,
    sheetFilename,
    sheetDataUrl,
    preset,
  };
}
