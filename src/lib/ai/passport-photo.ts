import { loadImage } from "../image/convert";
import {
  detectFaceAndUpperBody,
  hasSufficientUpperBody,
  type FaceDetectionResult,
} from "./face-detection";
import {
  analyzePhotoQuality,
  type PhotoQualityReport,
  enhancePortraitNaturally,
  recommendPassportBackground,
  type BackgroundRecommendation,
  decontaminateEdgeFringe,
  validatePassportOutput,
  type PassportValidationResult,
} from "./passport";

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
  backgroundColor?: string; // e.g. "#ffffff", "#dcebfa", "#f3f4f6", "#2563eb"
  generatePrintSheet?: boolean; // 4x6 inch printable grid
  enableEnhancement?: boolean; // Conservative natural enhancement
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
  qualityReport?: PhotoQualityReport | undefined;
  validation?: PassportValidationResult | undefined;
  recommendation?: BackgroundRecommendation | undefined;
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
/**
 * Calculates dynamic Best-Fit passport framing rectangle (Head + Neck + Shoulders).
 *
 * Requirements:
 * 1. Centers the face horizontally where possible.
 * 2. Dynamically shifts crop window when subject is off-center or near an edge.
 * 3. Never fails simply because subject is off-center or near an edge.
 * 4. Automatically calculates headroom (~8%-12%) and head-to-frame ratio (~50%-60%).
 * 5. Exactly matches the target aspect ratio of the passport preset.
 * 6. Never stretches or distorts original pixels.
 * 7. Fails gracefully only if source image lacks sufficient face/head pixels.
 */
export function calculatePassportFraming(
  imgWidth: number,
  imgHeight: number,
  detection: FaceDetectionResult,
  preset: PassportPreset,
): FramingCropRect {
  const fBox = detection.faceBox;
  const faceCenterX = fBox.x + fBox.width / 2;
  const crownY = Math.max(0, detection.headBox.y);
  const chinY = Math.min(imgHeight, fBox.y + fBox.height);
  const headH = Math.max(25, chinY - crownY);

  // Validate sufficient upper body
  if (!hasSufficientUpperBody(chinY, headH, imgHeight)) {
    throw new Error(
      "Your photo does not contain enough suitable upper-body area for a passport-style crop. Please upload a clearer photo.",
    );
  }

  const targetAspect = preset.widthPx / preset.heightPx;

  // Biometric head-to-frame ratio: head height occupies ~54% of photo height
  const targetHeadRatio = 0.54;
  const targetHeadroomRatio = 0.095; // ~9.5% headroom above hair crown

  let cropHeight = headH / targetHeadRatio;
  let cropWidth = cropHeight * targetAspect;

  // Adapt if ideal crop height exceeds available image height
  if (cropHeight > imgHeight) {
    cropHeight = Math.min(imgHeight, Math.max(headH * 1.12, imgHeight));
    cropWidth = cropHeight * targetAspect;
  }

  // Adapt if ideal crop width exceeds available image width
  if (cropWidth > imgWidth) {
    cropWidth = imgWidth;
    cropHeight = cropWidth / targetAspect;
  }

  // Vertical positioning: headroom above crown
  let cropTop = crownY - cropHeight * targetHeadroomRatio;
  let cropBottom = cropTop + cropHeight;

  if (cropTop < 0) {
    cropTop = 0;
    cropBottom = cropTop + cropHeight;
  }

  if (cropBottom > imgHeight) {
    cropBottom = imgHeight;
    cropTop = Math.max(0, cropBottom - cropHeight);
    // If anchored to bottom, ensure crown remains within crop
    if (cropTop > crownY) {
      cropTop = Math.max(0, crownY - Math.round(cropHeight * 0.04));
      cropBottom = Math.min(imgHeight, cropTop + cropHeight);
    }
  }

  // Horizontal positioning: centered on face, with edge-aware window shifting
  let cropLeft = faceCenterX - cropWidth / 2;
  let cropRight = cropLeft + cropWidth;

  if (cropLeft < 0) {
    // Subject near left edge: shift window right to use available valid pixels
    cropLeft = 0;
    cropRight = Math.min(imgWidth, cropWidth);
  } else if (cropRight > imgWidth) {
    // Subject near right edge: shift window left to use available valid pixels
    cropRight = imgWidth;
    cropLeft = Math.max(0, imgWidth - cropWidth);
  }

  // Enforce exact preset aspect ratio without distortion
  let finalWidth = cropRight - cropLeft;
  let finalHeight = finalWidth / targetAspect;

  if (finalHeight > imgHeight) {
    finalHeight = imgHeight;
    finalWidth = finalHeight * targetAspect;
    cropLeft = Math.max(0, Math.min(imgWidth - finalWidth, faceCenterX - finalWidth / 2));
    cropTop = Math.max(0, Math.min(imgHeight - finalHeight, crownY - finalHeight * targetHeadroomRatio));
  } else {
    // Center the adjusted height on head
    const verticalDiff = finalHeight - (cropBottom - cropTop);
    if (verticalDiff > 0) {
      cropTop = Math.max(0, cropTop - verticalDiff / 2);
    }
  }

  // Validate that the face is actually within the crop
  const finalRight = cropLeft + finalWidth;
  const isFaceInside =
    fBox.x + fBox.width * 0.5 >= cropLeft &&
    fBox.x + fBox.width * 0.5 <= finalRight &&
    finalWidth >= fBox.width * 0.75;

  if (!isFaceInside) {
    throw new Error(
      "The photo does not contain enough space around the face for a natural passport crop. Please upload a photo with more of the head and shoulders visible.",
    );
  }

  return {
    cropX: Math.max(0, Math.round(cropLeft)),
    cropY: Math.max(0, Math.round(cropTop)),
    cropWidth: Math.max(20, Math.round(finalWidth)),
    cropHeight: Math.max(20, Math.round(finalHeight)),
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
      publicPath: "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/",
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

  // 3. Decontaminate perimeter edge fringe to eliminate background spill
  const cleanedMasked = decontaminateEdgeFringe(maskedSubjectCanvas, targetBg);

  // 4. Render the cleanly masked original subject onto the solid background
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cleanedMasked, 0, 0, destW, destH);

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
  let sheet: HTMLCanvasElement;
  if (typeof document !== "undefined") {
    sheet = document.createElement("canvas");
    sheet.width = 1800; // 6 inches @ 300 DPI
    sheet.height = 1200; // 4 inches @ 300 DPI
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sheet = { ...singleCanvas, width: 1800, height: 1200 } as any;
  }

  const ctx = sheet.getContext?.("2d");
  if (!ctx) return sheet;


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
 * 2. Analyze Photo Quality (resolution, blur, exposure, bounds, multiple people).
 * 3. Multi-Tier Face & Upper Body Detection (Native / Server-AI / Biometric / Silhouette).
 * 4. Calculate Best-Fit Head + Shoulders Passport Framing.
 * 5. Crop ORIGINAL IMAGE strictly to framing rectangle.
 * 6. Segment background specifically on the cropped portrait.
 * 7. Conservative Natural Image Enhancement (exposure, white balance, denoising, sharpening).
 * 8. Automatic Background Recommendation & Edge Decontamination.
 * 9. Composite subject onto clean solid background and resize to preset.
 * 10. Quality & Face Preservation Check (cross-correlation with original face).
 * 11. Export single passport image + optional 4x6" printable sheet.
 */
export async function generatePassportPhoto(
  file: File,
  config: PassportPhotoConfig,
  onProgress?: (percent: number, label?: string) => void,
): Promise<PassportPhotoOutput> {
  onProgress?.(8, "Analyzing photo...");

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

  // 2. Comprehensive Image Quality Analysis
  const qualityReport = analyzePhotoQuality(origCanvas);
  if (!qualityReport.isAcceptable && qualityReport.rejectionReason) {
    throw new Error(qualityReport.rejectionReason);
  }

  onProgress?.(18, "Detecting primary person...");

  // 3. Multi-tier face and upper body detection
  const detection = await detectFaceAndUpperBody(origCanvas);

  // Check if multiple prominent people exist (tiny background bystanders are already filtered)
  if (detection.multipleProminentPeople) {
    throw new Error(
      "Multiple people detected. Please upload a photo containing only the person you want to use.",
    );
  }

  onProgress?.(32, "Finding face and shoulders...");

  onProgress?.(44, "Calculating best framing...");

  // 4. Calculate Best-Fit portrait framing rectangle (head + shoulders + upper chest)
  const framing = calculatePassportFraming(
    origCanvas.width,
    origCanvas.height,
    detection,
    preset,
  );

  // 5. Crop ORIGINAL IMAGE using calculated framing rectangle
  const croppedPortrait = cropOriginalImageToPortrait(origCanvas, framing);

  onProgress?.(55, "Removing background...");

  // 6. Segment background strictly on the cropped portrait
  const segmentedPortrait = await segmentPortraitSubject(croppedPortrait, (pct) =>
    onProgress?.(Math.round(55 + pct * 0.15), "Removing background..."),
  );

  onProgress?.(72, "Enhancing image...");

  // 7. Conservative Natural Image Enhancement (Exposure, White Balance, Bilateral Denoising, Unsharp Mask)
  // Strictly preserves 100% of facial features, lines, and identity
  const enhancedPortrait =
    config.enableEnhancement !== false
      ? enhancePortraitNaturally(croppedPortrait)
      : croppedPortrait;

  // 8. Background Recommendation & Selection
  const recommendation = recommendPassportBackground(origCanvas, detection);
  const targetBgColor = config.backgroundColor || recommendation.recommendedColor || "#ffffff";

  onProgress?.(84, "Creating passport frame...");

  // 9. Composite enhanced subject onto solid background and resize to preset
  const finalCanvas = compositePassportPhoto(
    enhancedPortrait,
    segmentedPortrait,
    preset,
    targetBgColor,
  );

  onProgress?.(92, "Checking final quality...");

  // 10. Quality & Face Preservation Validation
  const validation = validatePassportOutput(
    croppedPortrait,
    finalCanvas,
    preset,
    detection,
    framing,
  );

  if (!validation.valid && validation.error) {
    throw new Error(validation.error);
  }

  // 11. Export single passport photo JPEG
  const singleBlob = await canvasToBlob(finalCanvas, "image/jpeg", 0.96);
  const singleDataUrl = await blobToDataUrl(singleBlob);
  const beforeDataUrl = await blobToDataUrl(file);
  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const singleFilename = `${baseName}-${preset.id}-passport.jpg`;

  // 12. Optional printable 4x6" sheet
  let sheetBlob: Blob | undefined;
  let sheetFilename: string | undefined;
  let sheetDataUrl: string | undefined;

  if (config.generatePrintSheet) {
    const sheetCanvas = createPrintableSheet(finalCanvas, preset);
    sheetBlob = await canvasToBlob(sheetCanvas, "image/jpeg", 0.96);
    sheetFilename = `${baseName}-${preset.id}-sheet-4x6.jpg`;
    sheetDataUrl = await blobToDataUrl(sheetBlob);
  }

  onProgress?.(100, "Ready");

  return {
    singleBlob,
    singleFilename,
    singleDataUrl,
    sheetBlob,
    sheetFilename,
    sheetDataUrl,
    preset,
    beforeDataUrl,
    qualityReport,
    validation,
    recommendation,
  };
}

