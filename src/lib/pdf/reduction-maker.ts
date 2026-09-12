import { PDFDocument } from "pdf-lib";

export type ReductionSize = 9 | 12 | 16;

export interface SheetSideLayout {
  /**
   * Array of length N (9, 12, or 16).
   * Each entry is a 1-based source page number, or null if the box is blank.
   */
  boxes: (number | null)[];
}

export interface SheetLayout {
  sheetNumber: number;
  front: SheetSideLayout;
  back: SheetSideLayout;
}

export interface ReductionPlanSummary {
  totalPdfPages: number;
  reductionSize: ReductionSize; // 9, 12, or 16 boxes per side
  pagesPerPhysicalSheet: number; // 2 * reductionSize (18, 24, or 32)
  physicalSheetCount: number; // ceil(P / (2 * N))
  outputPdfPageCount: number; // physicalSheetCount * 2
  sheets: SheetLayout[];
}

export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

/**
 * Returns grid dimensions (columns x rows) for a given reduction size N (9, 12, 16).
 */
export function getGridForReductionSize(size: ReductionSize): { cols: number; rows: number } {
  switch (size) {
    case 9:
      return { cols: 3, rows: 3 };
    case 12:
      return { cols: 4, rows: 3 };
    case 16:
      return { cols: 4, rows: 4 };
    default:
      return { cols: 3, rows: 3 };
  }
}

/**
 * Calculates the N-Up Duplex Reduction layout:
 * - N is the number of reduced original-page boxes per side of one A4 sheet (9, 12, 16).
 * - Capacity per physical sheet is 2 * N.
 * - physicalSheets = ceil(totalPdfPages / (2 * N)).
 * - outputPdfPages = physicalSheets * 2.
 * - For sheet index s (0-based):
 *     sheetStart = s * (2 * N)
 *     Front box b (0 .. N-1): sheetStart + 1 + b * 2 (if <= totalPdfPages, else null)
 *     Back box b  (0 .. N-1): sheetStart + 2 + b * 2 (if <= totalPdfPages, else null)
 */
export function calculateReductionPlan(
  totalPdfPages: number,
  reductionSize: ReductionSize,
): ReductionPlanSummary {
  if (reductionSize <= 0) {
    throw new Error("Reduction size must be positive.");
  }
  if (totalPdfPages <= 0) {
    throw new Error("PDF page count must be positive.");
  }

  const pagesPerPhysicalSheet = reductionSize * 2;
  const physicalSheetCount = Math.ceil(totalPdfPages / pagesPerPhysicalSheet);
  const outputPdfPageCount = physicalSheetCount * 2;

  const sheets: SheetLayout[] = [];

  for (let s = 0; s < physicalSheetCount; s++) {
    const sheetStart = s * pagesPerPhysicalSheet;

    const frontBoxes: (number | null)[] = [];
    const backBoxes: (number | null)[] = [];

    for (let b = 0; b < reductionSize; b++) {
      const frontPageNum = sheetStart + 1 + b * 2;
      const backPageNum = sheetStart + 2 + b * 2;

      frontBoxes.push(frontPageNum <= totalPdfPages ? frontPageNum : null);
      backBoxes.push(backPageNum <= totalPdfPages ? backPageNum : null);
    }

    sheets.push({
      sheetNumber: s + 1,
      front: { boxes: frontBoxes },
      back: { boxes: backBoxes },
    });
  }

  return {
    totalPdfPages,
    reductionSize,
    pagesPerPhysicalSheet,
    physicalSheetCount,
    outputPdfPageCount,
    sheets,
  };
}

/**
 * Inspects a PDF file and returns its total page count.
 */
export async function getPdfPageCount(file: File | ArrayBuffer): Promise<number> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    if (msg.includes("encrypt") || msg.includes("password") || msg.includes("decrypt")) {
      throw new Error("This PDF is password-protected. Please unlock it first.");
    }
    throw new Error("Failed to parse PDF file. Ensure it is a valid document.");
  }

  if (doc.isEncrypted) {
    throw new Error("This PDF is password-protected. Please unlock it first.");
  }

  const count = doc.getPageCount();
  if (count === 0) {
    throw new Error("The selected PDF contains no pages.");
  }
  return count;
}

export interface ReductionResult {
  blob: Blob;
  totalPdfPages: number;
  reductionSize: ReductionSize;
  physicalSheetCount: number;
  outputPageCount: number;
}

/**
 * Creates the final reduced PDF ready for duplex printing.
 * Output PDF structure:
 * - Output Page 1 = Sheet 1 FRONT
 * - Output Page 2 = Sheet 1 BACK
 * - Output Page 3 = Sheet 2 FRONT
 * - Output Page 4 = Sheet 2 BACK
 * ...
 * Total output pages = physicalSheetCount * 2.
 */
export async function createReducedPdf(
  file: File | ArrayBuffer,
  reductionSize: ReductionSize,
  onProgress?: (percent: number) => void,
): Promise<ReductionResult> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;

  onProgress?.(10);

  let srcDoc: PDFDocument;
  try {
    srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    if (msg.includes("encrypt") || msg.includes("password") || msg.includes("decrypt")) {
      throw new Error("The PDF is password-protected. Please unlock it first.");
    }
    throw new Error("Failed to read the PDF. Please check the file and try again.");
  }

  if (srcDoc.isEncrypted) {
    throw new Error("The PDF is password-protected. Please unlock it first.");
  }

  const totalPdfPages = srcDoc.getPageCount();
  if (totalPdfPages === 0) {
    throw new Error("The document does not contain any pages.");
  }

  const plan = calculateReductionPlan(totalPdfPages, reductionSize);

  onProgress?.(25);

  const destDoc = await PDFDocument.create();
  const srcPages = srcDoc.getPages();
  const embeddedPages = await destDoc.embedPages(srcPages);

  onProgress?.(45);

  const margin = 18;
  const gap = 8;
  const grid = getGridForReductionSize(reductionSize);

  const stepPerSheet = 45 / plan.physicalSheetCount;

  for (let s = 0; s < plan.physicalSheetCount; s++) {
    const sheet = plan.sheets[s]!;

    // 1. FRONT SIDE (Odd output page: Sheet s+1 FRONT)
    const frontPage = destDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    renderSideGrid(
      frontPage,
      sheet.front.boxes,
      embeddedPages,
      grid.cols,
      grid.rows,
      A4_WIDTH,
      A4_HEIGHT,
      margin,
      gap,
    );

    // 2. BACK SIDE (Even output page: Sheet s+1 BACK)
    const backPage = destDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    renderSideGrid(
      backPage,
      sheet.back.boxes,
      embeddedPages,
      grid.cols,
      grid.rows,
      A4_WIDTH,
      A4_HEIGHT,
      margin,
      gap,
    );

    onProgress?.(Math.round(45 + (s + 1) * stepPerSheet));
  }

  onProgress?.(95);

  const pdfBytes = await destDoc.save();

  // Internal validation check before returning
  await validateReducedPdf(pdfBytes, plan.physicalSheetCount, totalPdfPages);

  onProgress?.(100);

  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });

  return {
    blob,
    totalPdfPages,
    reductionSize,
    physicalSheetCount: plan.physicalSheetCount,
    outputPageCount: plan.outputPdfPageCount,
  };
}

/**
 * Validates that the generated PDF conforms to all requirements:
 * - Output page count is exactly 2 * physicalSheetCount
 * - Output PDF loads successfully and is valid
 */
export async function validateReducedPdf(
  bytes: Uint8Array,
  expectedSheetCount: number,
  expectedSourcePages: number,
): Promise<{ valid: boolean; pageCount: number }> {
  const loaded = await PDFDocument.load(bytes);
  const pageCount = loaded.getPageCount();
  const expectedPageCount = expectedSheetCount * 2;

  if (pageCount !== expectedPageCount) {
    throw new Error(
      `Validation error: Output PDF contains ${pageCount} pages, but expected ${expectedPageCount} pages (${expectedSheetCount} physical sheets).`,
    );
  }

  if (expectedSourcePages <= 0) {
    throw new Error("Validation error: Source page count must be greater than zero.");
  }

  return { valid: true, pageCount };
}

/**
 * Renders the N grid boxes on one A4 side.
 * Each box b (0 .. N-1) contains either a source page number or null (blank box).
 */
function renderSideGrid(
  destPage: any,
  boxes: (number | null)[],
  embeddedPages: any[],
  cols: number,
  rows: number,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  gap: number,
) {
  const availW = pageWidth - 2 * margin - (cols - 1) * gap;
  const availH = pageHeight - 2 * margin - (rows - 1) * gap;
  const cellW = availW / cols;
  const cellH = availH / rows;

  boxes.forEach((pageNum, b) => {
    if (pageNum === null) {
      // Blank box: unused cell remains blank
      return;
    }

    const embedded = embeddedPages[pageNum - 1];
    if (!embedded) return;

    const col = b % cols;
    const row = Math.floor(b / cols);

    const cellX = margin + col * (cellW + gap);
    // PDF coordinate system: origin (0, 0) is at bottom-left
    const cellY = pageHeight - margin - (row + 1) * cellH - row * gap;

    // Preserve original aspect ratio without distortion
    const scale = Math.min(cellW / embedded.width, cellH / embedded.height);
    const scaledW = embedded.width * scale;
    const scaledH = embedded.height * scale;

    // Center original page within its allocated cell
    const x = cellX + (cellW - scaledW) / 2;
    const y = cellY + (cellH - scaledH) / 2;

    destPage.drawPage(embedded, {
      x,
      y,
      width: scaledW,
      height: scaledH,
    });
  });
}
