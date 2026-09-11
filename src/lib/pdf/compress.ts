import { PDFDocument } from "pdf-lib";

export interface CompressionResult {
  blob: Blob;
  originalSize: number;
  newSize: number;
  savedBytes: number;
  percentageChange: number;
  isReduced: boolean;
  explanation: string;
}

/**
 * Optimizes and compresses a PDF using client-side object stream compression.
 */
export async function compressPdf(
  file: File,
  levelOrProgress?: string | ((percent: number) => void),
  maybeProgress?: (percent: number) => void,
): Promise<CompressionResult & { size: number }> {
  const onProgress = typeof levelOrProgress === "function" ? levelOrProgress : maybeProgress;
  const originalSize = file.size;
  onProgress?.(20);

  const buffer = await file.arrayBuffer();
  const doc = await PDFDocument.load(buffer, {
    ignoreEncryption: false,
    updateMetadata: false,
  });

  onProgress?.(50);

  // Save with object streams enabled to combine and deflate PDF indirect objects
  const bytes = await doc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  onProgress?.(90);

  const newSize = bytes.length;
  const savedBytes = originalSize - newSize;
  const percentageChange = Math.round(((originalSize - newSize) / originalSize) * 100);
  const isReduced = newSize < originalSize;

  let explanation = "";
  if (isReduced) {
    explanation = `Reduced file size by ${percentageChange}% (${(savedBytes / 1024).toFixed(1)} KB saved) using object stream compression.`;
  } else {
    explanation = `This PDF is already highly compressed and optimized. Structural re-saving did not yield additional reduction.`;
  }

  onProgress?.(100);

  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });

  const result = {
    blob,
    size: blob.size,
    originalSize,
    newSize,
    savedBytes,
    percentageChange,
    isReduced,
    explanation,
  };

  return result as any;
}
