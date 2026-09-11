/**
 * Docly AI Passport Photo - Intelligent Background Engine
 *
 * Responsibilities:
 * 1. Automatic Background Recommendation (analyzes subject clothing & hair contrast).
 * 2. Perimeter Edge Decontamination / Defringing (removes halos and color bleeding).
 * 3. Studio Background Compositing (uniform, professional solid backgrounds).
 */

import type { FaceDetectionResult } from "../face-detection";

export interface BackgroundRecommendation {
  recommendedColor: string; // e.g. "#ffffff" or "#dcebfa"
  label: "White" | "Light Blue" | "Light Gray";
  reason: string;
}

/**
 * Intelligently recommends a background color based on clothing and hair luminance.
 * Avoids camouflage (e.g., white shirt against white background).
 */
export function recommendPassportBackground(
  canvas: HTMLCanvasElement,
  detection: FaceDetectionResult,
): BackgroundRecommendation {
  const width = canvas.width;
  const height = canvas.height;

  let ctx: CanvasRenderingContext2D | null = null;
  if (typeof document !== "undefined") {
    const sCanvas = document.createElement("canvas");
    sCanvas.width = width;
    sCanvas.height = height;
    ctx = sCanvas.getContext("2d");
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx = (canvas as any).getContext?.("2d");
  }

  if (!ctx) {
    return {
      recommendedColor: "#ffffff",
      label: "White",
      reason: "Standard official passport background.",
    };
  }

  ctx.drawImage(canvas, 0, 0);

  // Sample clothing area (bottom 40% of shouldersBox)
  const sBox = detection.shouldersBox;
  const sampleX = Math.max(0, Math.min(width - 10, sBox.x + Math.round(sBox.width * 0.2)));
  const sampleW = Math.max(5, Math.min(width - sampleX, Math.round(sBox.width * 0.6)));
  const sampleY = Math.max(0, Math.min(height - 10, sBox.y + Math.round(sBox.height * 0.4)));
  const sampleH = Math.max(5, Math.min(height - sampleY, Math.round(sBox.height * 0.5)));

  let imgData: ImageData;
  try {
    imgData = ctx.getImageData(sampleX, sampleY, sampleW, sampleH);
  } catch {
    return {
      recommendedColor: "#ffffff",
      label: "White",
      reason: "Standard official passport background.",
    };
  }

  const data = imgData.data;
  let lumSum = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const lum = (r * 299 + g * 587 + b * 114) >> 10;
    lumSum += lum;
    count++;
  }

  const avgLum = count > 0 ? lumSum / count : 128;

  // If subject is wearing a very light/white shirt (luminance > 205),
  // recommend Light Blue to provide clear clothing definition and edge contrast.
  if (avgLum > 205) {
    return {
      recommendedColor: "#dcebfa",
      label: "Light Blue",
      reason: "Recommended to provide optimal contrast against light or white clothing.",
    };
  }

  // If subject is wearing mid-light clothing (~180-205), recommend Light Gray
  if (avgLum > 185) {
    return {
      recommendedColor: "#e2e8f0",
      label: "Light Gray",
      reason: "Recommended to provide clean distinction with light-toned attire.",
    };
  }

  // Default standard passport background
  return {
    recommendedColor: "#ffffff",
    label: "White",
    reason: "Standard international passport background (optimal contrast with dark attire).",
  };
}

/**
 * Decontaminates perimeter edge fringe from the original background (color spill).
 * Ensures smooth, natural boundary between the hair/clothing and the new passport background.
 */
export function decontaminateEdgeFringe(
  subjectCanvas: HTMLCanvasElement,
  targetBgHex: string,
): HTMLCanvasElement {
  const width = subjectCanvas.width;
  const height = subjectCanvas.height;

  let outCanvas: HTMLCanvasElement;
  if (typeof document !== "undefined") {
    outCanvas = document.createElement("canvas");
    outCanvas.width = width;
    outCanvas.height = height;
  } else {
    outCanvas = subjectCanvas;
  }
  const ctx = outCanvas.getContext("2d");
  if (!ctx) return subjectCanvas;


  ctx.drawImage(subjectCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Parse target background RGB
  const cleanHex = targetBgHex.replace("#", "");
  const targetR = parseInt(cleanHex.substring(0, 2), 16) || 255;
  const targetG = parseInt(cleanHex.substring(2, 4), 16) || 255;
  const targetB = parseInt(cleanHex.substring(4, 6), 16) || 255;

  // Scan semi-transparent transition pixels (alpha in 15..240)
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] ?? 0;
    if (a > 15 && a < 235) {
      // Semi-transparent edge: neutralize dark or colored halo spill
      const alphaRatio = a / 255;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;

      // Blend subtle target background color into edge to eliminate previous color spill
      const blend = (1.0 - alphaRatio) * 0.4;
      data[i] = Math.round(r * (1 - blend) + targetR * blend);
      data[i + 1] = Math.round(g * (1 - blend) + targetG * blend);
      data[i + 2] = Math.round(b * (1 - blend) + targetB * blend);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return outCanvas;
}
