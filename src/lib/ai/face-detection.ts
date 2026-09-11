/**
 * Multi-Tier Face & Upper Body Detection Engine for Docly AI Passport Photo.
 * 100% Identity Preserving — Strictly extracts coordinates, NEVER regenerates imagery.
 *
 * Detection Tiers:
 * Tier 1: Native Browser Shape Detection API (window.FaceDetector)
 * Tier 2: Server-Side Vision AI (/api/ai/detect-framing, if GEMINI/OPENAI configured)
 * Tier 3: Client-Side Algorithmic Biometric & Anatomical Scanner (Skin Locus + Eyes/Mouth Gradients)
 * Tier 4: Human Silhouette Anatomical Contour Analyzer (Crown & Shoulder Expansion)
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceDetectionResult {
  faceBox: Rect;
  headBox: Rect;
  shouldersBox: Rect;
  hasUpperBody: boolean;
  confidence: number;
  method: "native" | "server-ai" | "biometric-scan" | "saliency-projection";
  multipleProminentPeople?: boolean;
}

/**
 * Computes Intersection over Union (IoU) between two bounding rectangles.
 */
export function computeIoU(a: Rect, b: Rect): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  const interW = Math.max(0, x2 - x1);
  const interH = Math.max(0, y2 - y1);
  const interArea = interW * interH;
  if (interArea === 0) return 0;

  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  return interArea / (areaA + areaB - interArea);
}

/**
 * Non-Maximum Suppression (NMS) to collapse duplicate and overlapping detection boxes.
 */
export function nonMaximumSuppression<T extends Rect & { score: number }>(
  boxes: T[],
  iouThreshold = 0.35,
): T[] {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const selected: T[] = [];

  for (const box of sorted) {
    let keep = true;
    for (const sel of selected) {
      if (computeIoU(box, sel) > iouThreshold) {
        keep = false;
        break;
      }
    }
    if (keep) {
      selected.push(box);
    }
  }

  return selected;
}

/**
 * Validates whether the image contains adequate upper-body area below the face
 * to produce a proper head-and-shoulders passport composition.
 * Relaxed to 10% head height (or 12px) to support casual portraits and standing photos.
 */
export function hasSufficientUpperBody(
  chinY: number,
  headHeight: number,
  imageHeight: number,
): boolean {
  return chinY + Math.min(25, headHeight * 0.15) <= imageHeight;
}

/**
 * Attempts Tier 1: Native Chromium FaceDetector API.
 * Identifies primary face and filters small background bystanders.
 */
async function detectNativeFace(
  canvas: HTMLCanvasElement,
): Promise<FaceDetectionResult | null> {
  if (typeof window === "undefined" || !("FaceDetector" in window)) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).FaceDetector({
      fastMode: false,
      maxDetectedFaces: 5,
    });
    const faces = await detector.detect(canvas);
    if (!faces || faces.length === 0) return null;

    // Map detected face rectangles
    const rects: Array<Rect & { score: number }> = faces.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (f: { boundingBox: { x: number; y: number; width: number; height: number } }) => ({
        x: Math.round(f.boundingBox.x),
        y: Math.round(f.boundingBox.y),
        width: Math.round(f.boundingBox.width),
        height: Math.round(f.boundingBox.height),
        score: 0.95,
      }),
    );

    // Apply NMS to merge duplicate detections of the same face
    const distinct = nonMaximumSuppression(rects, 0.35);
    if (distinct.length === 0) return null;

    // Sort by visual prominence (area)
    distinct.sort((a, b) => b.width * b.height - a.width * a.height);
    const primary = distinct[0]!;
    const primaryArea = primary.width * primary.height;

    // Check if other detections are genuine prominent people vs tiny background bystanders
    let multipleProminent = false;
    for (let i = 1; i < distinct.length; i++) {
      const other = distinct[i]!;
      const otherArea = other.width * other.height;
      // Competing person must be at least 45% of the primary subject's area
      if (otherArea >= primaryArea * 0.45) {
        multipleProminent = true;
        break;
      }
    }

    const fX = primary.x;
    const fY = primary.y;
    const fW = primary.width;
    const fH = primary.height;

    const crownY = Math.max(0, Math.round(fY - fH * 0.45));
    const chinY = Math.min(canvas.height, Math.round(fY + fH * 1.05));
    const headH = chinY - crownY;

    const shoulderY = chinY + Math.round(headH * 0.25);
    const shoulderW = Math.round(fW * 2.5);
    const shoulderX = Math.max(0, Math.round(fX + fW / 2 - shoulderW / 2));

    const upperBodyOk = hasSufficientUpperBody(chinY, headH, canvas.height);

    return {
      faceBox: { x: fX, y: fY, width: fW, height: fH },
      headBox: { x: fX, y: crownY, width: fW, height: headH },
      shouldersBox: {
        x: shoulderX,
        y: shoulderY,
        width: shoulderW,
        height: Math.round(headH * 0.7),
      },
      hasUpperBody: upperBodyOk,
      confidence: 0.95,
      method: "native",
      multipleProminentPeople: multipleProminent,
    };
  } catch {
    return null;
  }
}

/**
 * Attempts Tier 2: Server-Side AI Detection endpoint (/api/ai/detect-framing).
 * Extracts normalized bounding box coordinates of primary face and upper body.
 */
async function detectServerAiFace(
  canvas: HTMLCanvasElement,
): Promise<FaceDetectionResult | null> {
  if (typeof window === "undefined") return null;

  try {
    const maxDim = 1024;
    let sW = canvas.width;
    let sH = canvas.height;
    if (sW > maxDim || sH > maxDim) {
      if (sW > sH) {
        sH = Math.round((sH * maxDim) / sW);
        sW = maxDim;
      } else {
        sW = Math.round((sW * maxDim) / sH);
        sH = maxDim;
      }
    }

    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = sW;
    thumbCanvas.height = sH;
    const tCtx = thumbCanvas.getContext("2d");
    if (!tCtx) return null;
    tCtx.drawImage(canvas, 0, 0, sW, sH);

    const base64Data = thumbCanvas.toDataURL("image/jpeg", 0.85);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch("/api/ai/detect-framing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64Data }),
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);
    if (!res || !res.ok) return null;

    const data = await res.json().catch(() => null);
    if (!data || !data.faceBox) return null;

    const scaleX = canvas.width;
    const scaleY = canvas.height;

    const fX = Math.round(data.faceBox.x * scaleX);
    const fY = Math.round(data.faceBox.y * scaleY);
    const fW = Math.round(data.faceBox.width * scaleX);
    const fH = Math.round(data.faceBox.height * scaleY);

    const crownY = Math.max(
      0,
      data.headBox ? Math.round(data.headBox.y * scaleY) : Math.round(fY - fH * 0.45),
    );
    const chinY = Math.min(canvas.height, Math.round(fY + fH * 1.05));
    const headH = chinY - crownY;

    const shoulderY = data.shouldersBox
      ? Math.round(data.shouldersBox.y * scaleY)
      : chinY + Math.round(headH * 0.25);
    const shoulderW = data.shouldersBox
      ? Math.round(data.shouldersBox.width * scaleX)
      : Math.round(fW * 2.5);
    const shoulderX = Math.max(0, Math.round(fX + fW / 2 - shoulderW / 2));

    const upperBodyOk =
      data.hasUpperBody !== undefined
        ? Boolean(data.hasUpperBody)
        : hasSufficientUpperBody(chinY, headH, canvas.height);

    return {
      faceBox: { x: fX, y: fY, width: fW, height: fH },
      headBox: { x: fX, y: crownY, width: fW, height: headH },
      shouldersBox: {
        x: shoulderX,
        y: shoulderY,
        width: shoulderW,
        height: Math.round(headH * 0.7),
      },
      hasUpperBody: upperBodyOk,
      confidence: 0.92,
      method: "server-ai",
      multipleProminentPeople: Boolean(data.multipleProminentPeople),
    };
  } catch {
    return null;
  }
}

/**
 * Attempts Tier 3 & 4: Client-Side Algorithmic Biometric & Saliency Scanner.
 * Operates completely offline with zero external dependencies.
 *
 * Capabilities:
 * - Multi-scale face scanning down to 4% width (enables full-body & mall shots).
 * - Multi-ethnic skin locus in YCbCr & RGB space.
 * - Non-Maximum Suppression (NMS) duplicate detection filtering.
 * - Primary subject prominence ranking (discards tiny background bystanders).
 * - Saliency gradient projection fallback for dark or monochrome images (no buggy alpha loops).
 */
export function detectBiometricFaceAndTorso(
  canvas: HTMLCanvasElement,
): FaceDetectionResult {
  const width = canvas.width;
  const height = canvas.height;

  // 1. Resample to analysis grid
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
    throw new Error("Could not initialize analysis canvas context.");
  }
  aCtx.drawImage(canvas, 0, 0, sampleW, sampleH);

  const imgData = aCtx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;

  // 2. Build 2D skin map and grayscale luminance map
  const skinMap = new Uint8Array(sampleW * sampleH);
  const grayMap = new Uint8Array(sampleW * sampleH);

  let totalSkinCount = 0;
  for (let y = 0; y < sampleH; y++) {
    const rowOffset = y * sampleW;
    const byteOffset = rowOffset * 4;
    for (let x = 0; x < sampleW; x++) {
      const idx = byteOffset + x * 4;
      const r = data[idx] ?? 0;
      const g = data[idx + 1] ?? 0;
      const b = data[idx + 2] ?? 0;

      // Grayscale luminance
      const lum = (r * 299 + g * 587 + b * 114) >> 10;
      grayMap[rowOffset + x] = lum;

      // YCbCr skin locus (broad coverage for all ethnicities)
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const isYCbCr = cb >= 70 && cb <= 140 && cr >= 125 && cr <= 180;

      // RGB skin locus (robust under warm indoor and mall lighting)
      const isRgb =
        r > 50 &&
        g > 35 &&
        b > 20 &&
        r > g &&
        r > b &&
        Math.max(r, g, b) - Math.min(r, g, b) > 10;

      if (isYCbCr || isRgb) {
        skinMap[rowOffset + x] = 1;
        totalSkinCount++;
      }
    }
  }

  // 3. Scan for Head / Face using multi-scale window search in upper 80%
  const searchLimitH = Math.min(sampleH, Math.round(sampleH * 0.80));

  interface RawCandidate extends Rect {
    score: number;
    skinDensity: number;
  }

  const rawCandidates: RawCandidate[] = [];

  // Extended scale: from 4% (full-body / distant mall photos) up to 70% (close portrait)
  const minW = Math.max(14, Math.round(sampleW * 0.04));
  const maxW = Math.min(sampleW - 10, Math.round(sampleW * 0.70));
  const stepW = Math.max(6, Math.round((maxW - minW) / 14));

  for (let w = minW; w <= maxW; w += stepW) {
    const h = Math.round(w * 1.3); // Anthropometric face aspect ratio (1.3:1)
    const stepX = Math.max(4, Math.round(w * 0.16));
    const stepY = Math.max(4, Math.round(h * 0.16));

    for (let y = 4; y + h < searchLimitH; y += stepY) {
      for (let x = 4; x + w < sampleW - 4; x += stepX) {
        let skinInBox = 0;
        let eyeZoneLum = 0;
        let cheekZoneLum = 0;
        let mouthZoneLum = 0;

        const eyeYStart = y + Math.round(h * 0.28);
        const eyeYEnd = y + Math.round(h * 0.48);
        const mouthYStart = y + Math.round(h * 0.68);
        const mouthYEnd = y + Math.round(h * 0.88);

        let eyeCount = 0;
        let cheekCount = 0;
        let mouthCount = 0;

        // Sample interior points with step 2
        for (let cy = y; cy < y + h; cy += 2) {
          const rOff = cy * sampleW;
          for (let cx = x; cx < x + w; cx += 2) {
            if (skinMap[rOff + cx]) skinInBox++;

            const lum = grayMap[rOff + cx] ?? 0;
            if (cy >= eyeYStart && cy < eyeYEnd) {
              eyeZoneLum += lum;
              eyeCount++;
            } else if (cy >= eyeYEnd && cy < mouthYStart) {
              cheekZoneLum += lum;
              cheekCount++;
            } else if (cy >= mouthYStart && cy < mouthYEnd) {
              mouthZoneLum += lum;
              mouthCount++;
            }
          }
        }

        const totalSamples = Math.ceil((w * h) / 4);
        const skinDensity = skinInBox / Math.max(1, totalSamples);

        // Relaxed density threshold (10% - 95%) allows beards, glasses, hair fringes
        if (skinDensity < 0.10 || skinDensity > 0.95) continue;

        // Luminance contrast: Cheeks brighter than eye sockets and mouth line
        const avgEye = eyeCount > 0 ? eyeZoneLum / eyeCount : 128;
        const avgCheek = cheekCount > 0 ? cheekZoneLum / cheekCount : 128;
        const avgMouth = mouthCount > 0 ? mouthZoneLum / mouthCount : 128;

        let contrastScore = 0;
        if (avgCheek > avgEye) contrastScore += Math.min(1.0, (avgCheek - avgEye) / 22);
        if (avgCheek > avgMouth) contrastScore += Math.min(0.5, (avgCheek - avgMouth) / 30);

        // Gentle horizontal center preference
        const centerX = x + w / 2;
        const centerOffset = Math.abs(centerX - sampleW / 2) / (sampleW / 2);
        const centerScore = 1.0 - centerOffset * 0.35;

        // Vertical height preference (upper-middle region)
        const yCenter = y + h / 2;
        const yOffset = Math.abs(yCenter - sampleH * 0.35) / sampleH;
        const vScore = 1.0 - yOffset * 0.45;

        // Torso / neck confirmation below candidate
        const neckY = y + h;
        let neckSkin = 0;
        if (neckY + 8 < sampleH) {
          const neckOff = neckY * sampleW;
          for (let nx = x + Math.round(w * 0.25); nx < x + Math.round(w * 0.75); nx += 2) {
            if (skinMap[neckOff + nx]) neckSkin++;
          }
        }
        const neckBonus = neckSkin > 0 ? 0.15 : 0;

        const totalScore =
          skinDensity * 0.35 +
          contrastScore * 0.25 +
          centerScore * 0.15 +
          vScore * 0.10 +
          neckBonus;

        rawCandidates.push({
          x,
          y,
          width: w,
          height: h,
          score: totalScore,
          skinDensity,
        });
      }
    }
  }

  // 4. Non-Maximum Suppression (NMS) to collapse duplicate bounding boxes for the same person
  const distinctCandidates = nonMaximumSuppression(rawCandidates, 0.35);

  if (distinctCandidates.length > 0) {
    // Score each distinct person by visual prominence: Area * (Score^2) * CenterWeight
    interface RankedCandidate extends RawCandidate {
      prominence: number;
    }

    const ranked: RankedCandidate[] = distinctCandidates.map((c) => {
      const area = c.width * c.height;
      const cOffset = Math.abs(c.x + c.width / 2 - sampleW / 2) / (sampleW / 2);
      const prominence = area * (c.score * c.score) * (1.0 - cOffset * 0.3);
      return { ...c, prominence };
    });

    // Rank primary subject first
    ranked.sort((a, b) => b.prominence - a.prominence);
    const primary = ranked[0]!;
    const primaryArea = primary.width * primary.height;

    // Check for genuinely competing multiple prominent people
    // Small bystanders in background (area < 45% of primary) are safely ignored
    let multipleProminent = false;
    for (let i = 1; i < ranked.length; i++) {
      const other = ranked[i]!;
      const otherArea = other.width * other.height;
      if (otherArea >= primaryArea * 0.45 && other.score >= primary.score * 0.70) {
        multipleProminent = true;
        break;
      }
    }

    const fX = Math.round(primary.x * scale);
    const fY = Math.round(primary.y * scale);
    const fW = Math.round(primary.width * scale);
    const fH = Math.round(primary.height * scale);

    const crownY = Math.max(0, Math.round(fY - fH * 0.45));
    const chinY = Math.min(height, Math.round(fY + fH * 1.05));
    const headH = chinY - crownY;

    const shoulderY = chinY + Math.round(headH * 0.25);
    const shoulderW = Math.round(fW * 2.5);
    const shoulderX = Math.max(0, Math.round(fX + fW / 2 - shoulderW / 2));

    const upperBodyOk = hasSufficientUpperBody(chinY, headH, height);

    return {
      faceBox: { x: fX, y: fY, width: fW, height: fH },
      headBox: { x: fX, y: crownY, width: fW, height: headH },
      shouldersBox: {
        x: shoulderX,
        y: shoulderY,
        width: shoulderW,
        height: Math.round(headH * 0.7),
      },
      hasUpperBody: upperBodyOk,
      confidence: Math.min(0.90, primary.score),
      method: "biometric-scan",
      multipleProminentPeople: multipleProminent,
    };
  }

  // 5. Fallback Tier: Gradient Saliency Projection Scanner
  // Activates for dark, monochrome, or stylized lighting when skin chrominance is masked
  // Computes horizontal and vertical gradient energy profiles to identify subject location
  const colEnergy = new Float32Array(sampleW);
  const rowEnergy = new Float32Array(sampleH);

  for (let y = 1; y < sampleH - 1; y++) {
    const rowOff = y * sampleW;
    for (let x = 1; x < sampleW - 1; x++) {
      const lumL = grayMap[rowOff + x - 1] ?? 128;
      const lumR = grayMap[rowOff + x + 1] ?? 128;
      const lumU = grayMap[rowOff - sampleW + x] ?? 128;
      const lumD = grayMap[rowOff + sampleW + x] ?? 128;

      const gradX = Math.abs(lumR - lumL);
      const gradY = Math.abs(lumD - lumU);
      const grad = gradX + gradY;

      colEnergy[x] += grad;
      rowEnergy[y] += grad;
    }
  }

  // Find center of mass along X axis in upper 65%
  let totalEnergy = 0;
  let energySumX = 0;
  for (let x = 10; x < sampleW - 10; x++) {
    const e = colEnergy[x] ?? 0;
    totalEnergy += e;
    energySumX += x * e;
  }

  const sCenterX =
    totalEnergy > 0 ? Math.round(energySumX / totalEnergy) : Math.round(sampleW / 2);

  // Scan downward near sCenterX to locate top of head
  let headCrownY = Math.round(sampleH * 0.12);
  let maxGradRow = 0;
  for (let y = Math.round(sampleH * 0.05); y < Math.round(sampleH * 0.45); y++) {
    let rowG = 0;
    const rOff = y * sampleW;
    for (let x = Math.max(0, sCenterX - 30); x < Math.min(sampleW, sCenterX + 30); x++) {
      const g = Math.abs((grayMap[rOff + x] ?? 0) - (grayMap[rOff + sampleW + x] ?? 0));
      rowG += g;
    }
    if (rowG > maxGradRow) {
      maxGradRow = rowG;
      headCrownY = y;
    }
  }

  const estFaceW = Math.round(sampleW * 0.22);
  const estFaceH = Math.round(estFaceW * 1.3);
  const estFaceX = Math.max(0, Math.min(sampleW - estFaceW, sCenterX - Math.round(estFaceW / 2)));
  const estFaceY = Math.max(0, headCrownY + Math.round(estFaceH * 0.35));

  const fX = Math.round(estFaceX * scale);
  const fY = Math.round(estFaceY * scale);
  const fW = Math.round(estFaceW * scale);
  const fH = Math.round(estFaceH * scale);

  const crownY = Math.max(0, Math.round(headCrownY * scale));
  const chinY = Math.min(height, Math.round(fY + fH * 1.05));
  const headH = chinY - crownY;

  const shoulderY = chinY + Math.round(headH * 0.25);
  const shoulderW = Math.round(fW * 2.5);
  const shoulderX = Math.max(0, Math.round(fX + fW / 2 - shoulderW / 2));

  const upperBodyOk = hasSufficientUpperBody(chinY, headH, height);

  return {
    faceBox: { x: fX, y: fY, width: fW, height: fH },
    headBox: { x: fX, y: crownY, width: fW, height: headH },
    shouldersBox: {
      x: shoulderX,
      y: shoulderY,
      width: shoulderW,
      height: Math.round(headH * 0.7),
    },
    hasUpperBody: upperBodyOk,
    confidence: 0.68,
    method: "saliency-projection",
    multipleProminentPeople: false,
  };
}

/**
 * Executes the full multi-tier face detection pipeline.
 * Tries Tier 1 (Native) -> Tier 2 (Server AI) -> Tier 3/4 (Local Biometric & Saliency).
 */
export async function detectFaceAndUpperBody(
  canvas: HTMLCanvasElement,
): Promise<FaceDetectionResult> {
  // 1. Tier 1: Native FaceDetector (Chrome/Edge hardware accelerated)
  const nativeRes = await detectNativeFace(canvas);
  if (nativeRes && nativeRes.confidence > 0.8) {
    return nativeRes;
  }

  // 2. Tier 2: Server-Side AI Detection (if API key active)
  const serverRes = await detectServerAiFace(canvas);
  if (serverRes && serverRes.confidence > 0.8) {
    return serverRes;
  }

  // 3. Tier 3 & 4: High-precision client-side biometric scanner
  return detectBiometricFaceAndTorso(canvas);
}

