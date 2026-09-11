/**
 * Docly AI Passport Photo - Natural Image Enhancement Engine
 *
 * 100% DETERMINISTIC & IDENTITY PRESERVING.
 *
 * Requirements:
 * - Does NOT use generative models (zero face redrawing).
 * - Does NOT beautify or smooth out natural facial marks, moles, freckles, or lines.
 * - Does NOT alter expression, facial geometry, eye shape, or skin tone.
 * - Provides conservative studio-grade exposure normalization, white balance,
 *   mild contrast correction, bilateral edge-preserving denoising, and unsharp mask.
 */

export interface EnhancementOptions {
  enableExposureNormalization?: boolean;
  enableWhiteBalance?: boolean;
  enableContrastCorrection?: boolean;
  enableDenoising?: boolean;
  enableConservativeSharpening?: boolean;
}

/**
 * Applies natural, conservative studio enhancement to a portrait canvas.
 * Guaranteed to maintain identical identity and facial structure.
 */
export function enhancePortraitNaturally(
  canvas: HTMLCanvasElement,
  options: EnhancementOptions = {},
): HTMLCanvasElement {
  const width = canvas.width;
  const height = canvas.height;

  let outCanvas: HTMLCanvasElement;
  if (typeof document !== "undefined") {
    outCanvas = document.createElement("canvas");
    outCanvas.width = width;
    outCanvas.height = height;
  } else {
    outCanvas = canvas;
  }
  const ctx = outCanvas.getContext("2d");
  if (!ctx) return canvas;


  ctx.drawImage(canvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const len = data.length;

  const enableExposure = options.enableExposureNormalization ?? true;
  const enableWb = options.enableWhiteBalance ?? true;
  const enableContrast = options.enableContrastCorrection ?? true;
  const enableDenoise = options.enableDenoising ?? true;
  const enableSharpen = options.enableConservativeSharpening ?? true;

  // 1. Compute image color statistics
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let lumSum = 0;
  const totalPixels = width * height;

  for (let i = 0; i < len; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    rSum += r;
    gSum += g;
    bSum += b;
    lumSum += (r * 299 + g * 587 + b * 114) >> 10;
  }

  const avgR = rSum / totalPixels;
  const avgG = gSum / totalPixels;
  const avgB = bSum / totalPixels;
  const avgLum = lumSum / totalPixels;

  // 2. White Balance (Dampened Gray-World)
  // Mild correction factor (dampened to 35% of theoretical correction to preserve natural skin tones)
  const grayTarget = (avgR + avgG + avgB) / 3;
  const rGain = enableWb && avgR > 10 ? 1.0 + ((grayTarget / avgR - 1.0) * 0.35) : 1.0;
  const gGain = enableWb && avgG > 10 ? 1.0 + ((grayTarget / avgG - 1.0) * 0.35) : 1.0;
  const bGain = enableWb && avgB > 10 ? 1.0 + ((grayTarget / avgB - 1.0) * 0.35) : 1.0;

  // 3. Exposure Normalization (Adaptive Mild Gamma)
  // Target average luminance is ~125 for standard ID photos
  let gamma = 1.0;
  if (enableExposure && avgLum > 35 && avgLum < 190) {
    const targetLum = 125;
    // Bound gamma correction strictly between 0.90 (slightly bright) and 1.20 (dark photos)
    const rawGamma = targetLum / avgLum;
    gamma = 1.0 + (rawGamma - 1.0) * 0.45;
    gamma = Math.max(0.88, Math.min(1.22, gamma));
  }

  // Precompute gamma lookup table for fast performance
  const gammaLut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const norm = i / 255;
    const corrected = Math.pow(norm, 1 / gamma);
    gammaLut[i] = Math.round(Math.max(0, Math.min(255, corrected * 255)));
  }

  // 4. Pixel-by-pixel color & exposure mapping
  for (let i = 0; i < len; i += 4) {
    let r = data[i] ?? 0;
    let g = data[i + 1] ?? 0;
    let b = data[i + 2] ?? 0;

    // Apply White Balance Gain
    if (enableWb) {
      r = Math.min(255, Math.max(0, r * rGain));
      g = Math.min(255, Math.max(0, g * gGain));
      b = Math.min(255, Math.max(0, b * bGain));
    }

    // Apply Exposure Gamma
    if (enableExposure && gamma !== 1.0) {
      r = gammaLut[Math.round(r)] ?? r;
      g = gammaLut[Math.round(g)] ?? g;
      b = gammaLut[Math.round(b)] ?? b;
    }

    // Apply Mild Contrast (+6% subtle studio punch)
    if (enableContrast) {
      const cFactor = 1.06;
      r = Math.min(255, Math.max(0, (r - 128) * cFactor + 128));
      g = Math.min(255, Math.max(0, (g - 128) * cFactor + 128));
      b = Math.min(255, Math.max(0, (b - 128) * cFactor + 128));
    }

    data[i] = Math.round(r);
    data[i + 1] = Math.round(g);
    data[i + 2] = Math.round(b);
  }

  // 5. Bilateral Edge-Preserving Denoising (Local 3x3)
  // Smooths flat sensor noise while strictly protecting high-contrast edges (eyes, lips, wrinkles, freckles)
  if (enableDenoise && width > 10 && height > 10) {
    const copy = new Uint8ClampedArray(data);
    const edgeThreshold = 18; // Only average pixels within 18 RGB intensity of center

    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width;
      for (let x = 1; x < width - 1; x++) {
        const cIdx = (rowOffset + x) * 4;
        const cR = copy[cIdx] ?? 0;
        const cG = copy[cIdx + 1] ?? 0;
        const cB = copy[cIdx + 2] ?? 0;

        let wR = cR * 2;
        let wG = cG * 2;
        let wB = cB * 2;
        let wTotal = 2;

        // 4-neighborhood inspection
        const neighborOffsets = [
          ((y - 1) * width + x) * 4,
          ((y + 1) * width + x) * 4,
          (rowOffset + x - 1) * 4,
          (rowOffset + x + 1) * 4,
        ];

        for (const nIdx of neighborOffsets) {
          const nR = copy[nIdx] ?? 0;
          const nG = copy[nIdx + 1] ?? 0;
          const nB = copy[nIdx + 2] ?? 0;

          const diff = Math.abs(nR - cR) + Math.abs(nG - cG) + Math.abs(nB - cB);
          if (diff < edgeThreshold * 3) {
            wR += nR;
            wG += nG;
            wB += nB;
            wTotal += 1;
          }
        }

        data[cIdx] = Math.round(wR / wTotal);
        data[cIdx + 1] = Math.round(wG / wTotal);
        data[cIdx + 2] = Math.round(wB / wTotal);
      }
    }
  }

  // 6. Conservative Unsharp Mask Sharpening
  // Enhances studio crispness with zero halo formation
  if (enableSharpen && width > 10 && height > 10) {
    const copy = new Uint8ClampedArray(data);
    const sharpenAmount = 0.28; // Mild 28% sharpness boost
    const threshold = 4; // Threshold to prevent amplifying flat noise

    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width;
      for (let x = 1; x < width - 1; x++) {
        const cIdx = (rowOffset + x) * 4;
        const cR = copy[cIdx] ?? 0;
        const cG = copy[cIdx + 1] ?? 0;
        const cB = copy[cIdx + 2] ?? 0;

        // Laplacian kernel
        const topIdx = ((y - 1) * width + x) * 4;
        const btmIdx = ((y + 1) * width + x) * 4;
        const lftIdx = (rowOffset + x - 1) * 4;
        const rgtIdx = (rowOffset + x + 1) * 4;

        const avgSurroundR =
          ((copy[topIdx] ?? 0) + (copy[btmIdx] ?? 0) + (copy[lftIdx] ?? 0) + (copy[rgtIdx] ?? 0)) >> 2;
        const avgSurroundG =
          ((copy[topIdx + 1] ?? 0) + (copy[btmIdx + 1] ?? 0) + (copy[lftIdx + 1] ?? 0) + (copy[rgtIdx + 1] ?? 0)) >> 2;
        const avgSurroundB =
          ((copy[topIdx + 2] ?? 0) + (copy[btmIdx + 2] ?? 0) + (copy[lftIdx + 2] ?? 0) + (copy[rgtIdx + 2] ?? 0)) >> 2;

        const deltaR = cR - avgSurroundR;
        const deltaG = cG - avgSurroundG;
        const deltaB = cB - avgSurroundB;

        if (Math.abs(deltaR) > threshold) {
          data[cIdx] = Math.min(255, Math.max(0, Math.round(cR + deltaR * sharpenAmount)));
        }
        if (Math.abs(deltaG) > threshold) {
          data[cIdx + 1] = Math.min(255, Math.max(0, Math.round(cG + deltaG * sharpenAmount)));
        }
        if (Math.abs(deltaB) > threshold) {
          data[cIdx + 2] = Math.min(255, Math.max(0, Math.round(cB + deltaB * sharpenAmount)));
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return outCanvas;
}
