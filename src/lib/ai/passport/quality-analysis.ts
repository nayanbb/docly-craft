/**
 * Docly AI Passport Photo - Image Quality Analysis Engine
 *
 * Deterministic quality assessment executed locally on the client/canvas.
 * Analyzes:
 * 1. Image Resolution (minimum dimensions)
 * 2. Blur / Sharpness (Laplacian variance on grayscale luminance)
 * 3. Exposure & Contrast (luminance distribution, underexposure, overexposure)
 * 4. Multiple People Check (detects multiple prominent face candidates)
 * 5. Edge Proximity (ensures face is not cut off by frame boundaries)
 *
 * Fails safely with clear user guidance if image quality is insufficient,
 * never hallucinating missing facial details.
 */

export interface PhotoQualityReport {
  isAcceptable: boolean;
  rejectionReason?: string;
  resolution: {
    width: number;
    height: number;
    isAdequate: boolean;
  };
  blur: {
    variance: number;
    isSharp: boolean;
  };
  exposure: {
    meanLuminance: number;
    stdDev: number;
    isUnderExposed: boolean;
    isOverExposed: boolean;
    contrastRatio: number;
  };
  multiplePeopleDetected: boolean;
  faceCount: number;
  edgeProximity: {
    isTooCloseToEdge: boolean;
    clippedEdges: Array<"top" | "bottom" | "left" | "right">;
  };
}

/**
 * Computes the Laplacian variance of a grayscale image grid to measure image sharpness/blur.
 * High variance = sharp edges; Low variance = blurry / out-of-focus image.
 */
export function computeLaplacianVariance(
  gray: Uint8Array,
  width: number,
  height: number,
): number {
  if (width < 3 || height < 3) return 0;

  // Discrete Laplacian kernel:
  // [  0,  1,  0 ]
  // [  1, -4,  1 ]
  // [  0,  1,  0 ]
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 2) {
    const rowOffset = y * width;
    const prevRow = (y - 1) * width;
    const nextRow = (y + 1) * width;

    for (let x = 1; x < width - 1; x += 2) {
      const center = gray[rowOffset + x] ?? 0;
      const top = gray[prevRow + x] ?? 0;
      const bottom = gray[nextRow + x] ?? 0;
      const left = gray[rowOffset + x - 1] ?? 0;
      const right = gray[rowOffset + x + 1] ?? 0;

      const lap = top + bottom + left + right - 4 * center;
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return Math.max(0, variance);
}

/**
 * Scans an image canvas for multiple prominent face candidates.
 * Uses skin chrominance cluster analysis and spatial isolation.
 */
export function countProminentFaces(
  skinMap: Uint8Array,
  sampleW: number,
  sampleH: number,
): number {
  const minClusterArea = 220;
  const visited = new Uint8Array(sampleW * sampleH);
  const faceCenters: Array<{ x: number; y: number; count: number }> = [];

  const searchLimitH = Math.round(sampleH * 0.75);

  for (let y = 10; y < searchLimitH; y += 4) {
    for (let x = 10; x < sampleW - 10; x += 4) {
      const idx = y * sampleW + x;
      if (skinMap[idx] === 1 && visited[idx] === 0) {
        let clusterCount = 0;
        let sumX = 0;
        let sumY = 0;

        const queue: Array<[number, number]> = [[x, y]];
        visited[idx] = 1;

        while (queue.length > 0) {
          const [cx, cy] = queue.pop()!;
          clusterCount++;
          sumX += cx;
          sumY += cy;

          const neighbors: Array<[number, number]> = [
            [cx + 2, cy],
            [cx - 2, cy],
            [cx, cy + 2],
            [cx, cy - 2],
          ];

          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < sampleW && ny >= 0 && ny < searchLimitH) {
              const nIdx = ny * sampleW + nx;
              if (skinMap[nIdx] === 1 && visited[nIdx] === 0) {
                visited[nIdx] = 1;
                queue.push([nx, ny]);
              }
            }
          }
        }

        if (clusterCount >= minClusterArea) {
          faceCenters.push({
            x: Math.round(sumX / clusterCount),
            y: Math.round(sumY / clusterCount),
            count: clusterCount,
          });
        }
      }
    }
  }

  // Count distinct faces that are separated by distance (> 65px on 360px sample grid)
  const distinctFaces: Array<{ x: number; y: number }> = [];
  for (const c of faceCenters) {
    const isCloseToExisting = distinctFaces.some(
      (df) => Math.hypot(df.x - c.x, df.y - c.y) < 65,
    );
    if (!isCloseToExisting) {
      distinctFaces.push({ x: c.x, y: c.y });
    }
  }

  return Math.max(1, distinctFaces.length);
}

/**
 * Comprehensive image quality pre-analysis for Passport Photos.
 */
export function analyzePhotoQuality(
  canvas: HTMLCanvasElement,
): PhotoQualityReport {
  const width = canvas.width;
  const height = canvas.height;

  // 1. Resolution Check
  const minDimension = 220;
  const isResolutionAdequate = width >= minDimension && height >= minDimension;

  // 2. Grayscale & Luminance Map (downscaled to sample grid for rapid, uniform processing)
  const sampleW = 360;
  const scale = width / sampleW;
  const sampleH = Math.max(1, Math.round(height / scale));

  let aCanvas: HTMLCanvasElement;
  if (typeof document !== "undefined") {
    aCanvas = document.createElement("canvas");
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    aCanvas = canvas as any;
  }
  aCanvas.width = sampleW;
  aCanvas.height = sampleH;
  const aCtx = aCanvas.getContext("2d");
  if (!aCtx) {
    throw new Error("Could not initialize canvas context for quality analysis.");
  }
  aCtx.drawImage(canvas, 0, 0, sampleW, sampleH);

  const imgData = aCtx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;

  const gray = new Uint8Array(sampleW * sampleH);
  const skinMap = new Uint8Array(sampleW * sampleH);

  let lumSum = 0;
  let lumSqSum = 0;
  const totalPixels = sampleW * sampleH;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = data[idx] ?? 0;
    const g = data[idx + 1] ?? 0;
    const b = data[idx + 2] ?? 0;

    const lum = (r * 299 + g * 587 + b * 114) >> 10;
    gray[i] = lum;
    lumSum += lum;
    lumSqSum += lum * lum;

    // YCbCr skin detection
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && r > g && g > b) {
      skinMap[i] = 1;
    }
  }

  // Exposure statistics
  const meanLuminance = lumSum / totalPixels;
  const lumVariance = lumSqSum / totalPixels - meanLuminance * meanLuminance;
  const stdDev = Math.sqrt(Math.max(0, lumVariance));
  const contrastRatio = stdDev / (meanLuminance || 1);

  // Severe under/overexposure
  const isUnderExposed = meanLuminance < 32;
  const isOverExposed = meanLuminance > 242 && stdDev < 18;

  // 3. Sharpness / Blur Detection via Laplacian variance
  const blurVariance = computeLaplacianVariance(gray, sampleW, sampleH);
  const isSharp = blurVariance >= 35;

  // 4. Multiple People Check
  const faceCount = countProminentFaces(skinMap, sampleW, sampleH);
  const multiplePeopleDetected = faceCount > 1;

  // 5. Edge Proximity
  const clippedEdges: Array<"top" | "bottom" | "left" | "right"> = [];
  const edgeMarginX = Math.max(3, Math.round(sampleW * 0.02));
  const edgeMarginY = Math.max(3, Math.round(sampleH * 0.02));

  let leftEdgeSkin = 0;
  let rightEdgeSkin = 0;
  let topEdgeSkin = 0;

  for (let y = 0; y < Math.round(sampleH * 0.5); y++) {
    for (let x = 0; x < edgeMarginX; x++) {
      if (skinMap[y * sampleW + x] === 1) leftEdgeSkin++;
      if (skinMap[y * sampleW + (sampleW - 1 - x)] === 1) rightEdgeSkin++;
    }
  }
  for (let y = 0; y < edgeMarginY; y++) {
    for (let x = Math.round(sampleW * 0.25); x < Math.round(sampleW * 0.75); x++) {
      if (skinMap[y * sampleW + x] === 1) topEdgeSkin++;
    }
  }

  if (leftEdgeSkin > 35) clippedEdges.push("left");
  if (rightEdgeSkin > 35) clippedEdges.push("right");
  if (topEdgeSkin > 30) clippedEdges.push("top");

  const isTooCloseToEdge = clippedEdges.length > 0;

  // Assemble Decision
  let isAcceptable = true;
  let rejectionReason: string | undefined;

  if (!isResolutionAdequate) {
    isAcceptable = false;
    rejectionReason =
      "The photo quality is too low to safely create a natural passport photo. Please upload a clearer photo.";
  } else if (!isSharp && blurVariance < 20) {
    isAcceptable = false;
    rejectionReason =
      "The photo quality is too low to safely create a natural passport photo. Please upload a clearer photo.";
  } else if (isUnderExposed || isOverExposed) {
    isAcceptable = false;
    rejectionReason =
      "The photo quality is too low to safely create a natural passport photo. Please upload a clearer photo.";
  } else if (multiplePeopleDetected) {
    isAcceptable = false;
    rejectionReason =
      "Multiple people detected. Please upload a photo containing only the person you want to use.";
  } else if (isTooCloseToEdge && (clippedEdges.includes("left") || clippedEdges.includes("right"))) {
    isAcceptable = false;
    rejectionReason =
      "The detected subject is too close to the image edge. Please upload a photo with centered framing.";
  }

  return {
    isAcceptable,
    rejectionReason,
    resolution: {
      width,
      height,
      isAdequate: isResolutionAdequate,
    },
    blur: {
      variance: blurVariance,
      isSharp,
    },
    exposure: {
      meanLuminance,
      stdDev,
      isUnderExposed,
      isOverExposed,
      contrastRatio,
    },
    multiplePeopleDetected,
    faceCount,
    edgeProximity: {
      isTooCloseToEdge,
      clippedEdges,
    },
  };
}
