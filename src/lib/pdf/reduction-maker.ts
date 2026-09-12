import { PDFDocument } from "pdf-lib";

export interface SheetLayout {
  sheetNumber: number;
  frontPages: number[];
  backPages: number[];
}

export interface ReductionPlanSummary {
  totalPdfPages: number;
  sheetCount: number;
  basePages: number;
  remainder: number;
  minPagesPerSheet: number;
  maxPagesPerSheet: number;
  sheets: SheetLayout[];
}

export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

/**
 * Calculates the dynamic page distribution across the selected physical sheets.
 * Follows the balanced distribution formula:
 *   basePages = floor(P / S)
 *   remainder = P % S
 * First remainder sheets receive basePages + 1 pages.
 * Remaining sheets receive basePages pages.
 *
 * Each sheet is then split into FRONT (ceil(k/2)) and BACK (floor(k/2)).
 */
export function calculateReductionPlan(
  totalPdfPages: number,
  sheetCount: number,
): ReductionPlanSummary {
  if (sheetCount <= 0) {
    throw new Error("Number of physical sheets must be positive.");
  }
  if (totalPdfPages <= 0) {
    throw new Error("PDF page count must be positive.");
  }

  const basePages = Math.floor(totalPdfPages / sheetCount);
  const remainder = totalPdfPages % sheetCount;

  const sheets: SheetLayout[] = [];
  let currentPage = 1;

  for (let s = 1; s <= sheetCount; s++) {
    const pageCountForSheet = s <= remainder ? basePages + 1 : basePages;
    const sheetPages: number[] = [];

    for (let p = 0; p < pageCountForSheet; p++) {
      if (currentPage <= totalPdfPages) {
        sheetPages.push(currentPage++);
      }
    }

    const frontCount = Math.ceil(sheetPages.length / 2);
    const frontPages = sheetPages.slice(0, frontCount);
    const backPages = sheetPages.slice(frontCount);

    sheets.push({
      sheetNumber: s,
      frontPages,
      backPages,
    });
  }

  const minPagesPerSheet = basePages;
  const maxPagesPerSheet = remainder > 0 ? basePages + 1 : basePages;

  return {
    totalPdfPages,
    sheetCount,
    basePages,
    remainder,
    minPagesPerSheet,
    maxPagesPerSheet,
    sheets,
  };
}

/**
 * Automatically chooses an optimal grid (columns x rows) for placing
 * the given count of pages on a single physical side.
 */
export function getGridForCount(
  count: number,
  isLandscapePaper = false,
): { cols: number; rows: number } {
  if (count <= 0) return { cols: 1, rows: 1 };
  if (count === 1) return { cols: 1, rows: 1 };
  if (count === 2) return isLandscapePaper ? { cols: 2, rows: 1 } : { cols: 2, rows: 1 };
  if (count === 3) return { cols: 3, rows: 1 };
  if (count === 4) return { cols: 2, rows: 2 };
  if (count <= 6) return isLandscapePaper ? { cols: 3, rows: 2 } : { cols: 2, rows: 3 };
  if (count <= 8) return isLandscapePaper ? { cols: 4, rows: 2 } : { cols: 2, rows: 4 };
  if (count <= 9) return { cols: 3, rows: 3 };
  if (count <= 12) return isLandscapePaper ? { cols: 4, rows: 3 } : { cols: 3, rows: 4 };
  return { cols: 4, rows: 4 };
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
  sheetCount: number;
  outputPageCount: number;
}

/**
 * Creates a reduced PDF arranging all original pages across the selected physical sheets
 * for double-sided (duplex) printing.
 *
 * Physical Front/Back ordering:
 * Sheet 1: Output Page 1 (Front), Output Page 2 (Back)
 * Sheet 2: Output Page 3 (Front), Output Page 4 (Back)
 * ...
 * Sheet S: Output Page 2S-1 (Front), Output Page 2S (Back)
 */
export async function createReducedPdf(
  file: File | ArrayBuffer,
  sheetCount: number,
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

  const plan = calculateReductionPlan(totalPdfPages, sheetCount);

  onProgress?.(25);

  const destDoc = await PDFDocument.create();
  const srcPages = srcDoc.getPages();
  const embeddedPages = await destDoc.embedPages(srcPages);

  onProgress?.(45);

  const margin = 18;
  const gap = 8;
  const stepPerSheet = 45 / sheetCount;

  for (let s = 0; s < plan.sheets.length; s++) {
    const sheet = plan.sheets[s]!;

    // 1. FRONT SIDE (Odd output page)
    const frontPage = destDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    renderSide(frontPage, sheet.frontPages, embeddedPages, A4_WIDTH, A4_HEIGHT, margin, gap);

    // 2. BACK SIDE (Even output page)
    const backPage = destDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    renderSide(backPage, sheet.backPages, embeddedPages, A4_WIDTH, A4_HEIGHT, margin, gap);

    onProgress?.(Math.round(45 + (s + 1) * stepPerSheet));
  }

  onProgress?.(95);

  const pdfBytes = await destDoc.save();

  // Internal validation check before returning
  await validateReducedPdf(pdfBytes, sheetCount, totalPdfPages);

  onProgress?.(100);

  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });

  return {
    blob,
    totalPdfPages,
    sheetCount,
    outputPageCount: sheetCount * 2,
  };
}

/**
 * Validates that the generated PDF conforms to all requirements:
 * - Output page count is exactly 2 * sheetCount
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
 * Renders a list of original pages onto a physical sheet side.
 */
function renderSide(
  destPage: any,
  pageNumbers: number[],
  embeddedPages: any[],
  pageWidth: number,
  pageHeight: number,
  margin: number,
  gap: number,
) {
  if (pageNumbers.length === 0) {
    // Keep page blank as required for unused positions/sides
    return;
  }

  const grid = getGridForCount(pageNumbers.length);
  const availW = pageWidth - 2 * margin - (grid.cols - 1) * gap;
  const availH = pageHeight - 2 * margin - (grid.rows - 1) * gap;
  const cellW = availW / grid.cols;
  const cellH = availH / grid.rows;

  pageNumbers.forEach((pageNum, idx) => {
    const embedded = embeddedPages[pageNum - 1];
    if (!embedded) return;

    const col = idx % grid.cols;
    const row = Math.floor(idx / grid.cols);

    const cellX = margin + col * (cellW + gap);
    // PDF coordinate system origin is bottom-left
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
