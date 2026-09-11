import { PDFDocument } from "pdf-lib";

export interface SplitResultFile {
  name: string;
  blob: Blob;
  pageCount: number;
}

/**
 * Parses a page range string like "1-3, 5, 7-9" into an array of 0-indexed page numbers.
 */
export function parsePageRanges(rangeString: string, maxPages: number): number[][] {
  const cleaned = rangeString.trim();
  if (!cleaned) {
    throw new Error("Please specify at least one page or page range to split.");
  }

  const parts = cleaned
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const groups: number[][] = [];

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-").map((s) => s.trim());
      const start = parseInt(startStr ?? "", 10);
      const end = parseInt(endStr ?? "", 10);

      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        throw new Error(`Invalid page range: "${part}". Must be e.g. 1-3.`);
      }
      if (end > maxPages) {
        throw new Error(`Page range "${part}" exceeds the document total of ${maxPages} pages.`);
      }

      const indices: number[] = [];
      for (let i = start; i <= end; i++) {
        indices.push(i - 1);
      }
      groups.push(indices);
    } else {
      const page = parseInt(part, 10);
      if (isNaN(page) || page < 1) {
        throw new Error(`Invalid page number: "${part}".`);
      }
      if (page > maxPages) {
        throw new Error(`Page ${page} exceeds the document total of ${maxPages} pages.`);
      }
      groups.push([page - 1]);
    }
  }

  if (groups.length === 0) {
    throw new Error("No valid page ranges found.");
  }

  return groups;
}

/**
 * Splits a PDF document according to range groups.
 */
export async function splitPdfByRanges(
  file: File,
  rangeGroups: number[][],
  baseName: string = "docly-split",
  onProgress?: (percent: number) => void,
): Promise<SplitResultFile[]> {
  const buffer = await file.arrayBuffer();
  const sourceDoc = await PDFDocument.load(buffer, { ignoreEncryption: false });

  const results: SplitResultFile[] = [];
  const totalGroups = rangeGroups.length;

  for (let g = 0; g < totalGroups; g++) {
    const indices = rangeGroups[g];
    if (!indices || indices.length === 0) continue;

    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(sourceDoc, indices);
    copied.forEach((p) => newDoc.addPage(p));

    const bytes = await newDoc.save();
    const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });

    const groupLabel = indices.length === 1 ? `page-${indices[0]! + 1}` : `part-${g + 1}`;
    results.push({
      name: `${baseName}-${groupLabel}.pdf`,
      blob,
      pageCount: indices.length,
    });

    onProgress?.(Math.round(((g + 1) / totalGroups) * 100));
  }

  return results;
}

/**
 * Splits every page of a PDF document into an individual single-page PDF.
 */
export async function splitAllPages(
  file: File,
  baseName: string = "docly-page",
  onProgress?: (percent: number) => void,
): Promise<SplitResultFile[]> {
  const buffer = await file.arrayBuffer();
  const sourceDoc = await PDFDocument.load(buffer, { ignoreEncryption: false });
  const total = sourceDoc.getPageCount();

  const groups = Array.from({ length: total }, (_, i) => [i]);
  return splitPdfByRanges(file, groups, baseName, onProgress);
}
