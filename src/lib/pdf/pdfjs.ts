// Polyfill for Uint8Array.prototype.toHex if not supported in runtime
if (typeof (Uint8Array.prototype as any).toHex !== "function") {
  (Uint8Array.prototype as any).toHex = function () {
    return Array.from(this)
      .map((b: any) => b.toString(16).padStart(2, "0"))
      .join("");
  };
}
if (typeof (ArrayBuffer.prototype as any).toHex !== "function") {
  (ArrayBuffer.prototype as any).toHex = function () {
    return Array.from(new Uint8Array(this))
      .map((b: any) => b.toString(16).padStart(2, "0"))
      .join("");
  };
}

import * as pdfjsLib from "pdfjs-dist";

// Initialize worker for browser environments
if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  } catch {
    // CDN fallback if bundling resolution varies
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
}

export interface PdfPageThumbnail {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Loads a PDF document from an ArrayBuffer or File using PDF.js.
 */
export async function loadPdfJsDoc(source: ArrayBuffer | Uint8Array, password?: string) {
  let data: Uint8Array;
  if (source instanceof Uint8Array) {
    data = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  } else {
    data = new Uint8Array(source);
  }

  const loadingTask = pdfjsLib.getDocument({
    data,
    ...(password ? { password } : {}),
  });
  return loadingTask.promise;
}

/**
 * Renders a specific page of a PDF document to a data URL (PNG) thumbnail.
 */
export async function renderPageThumbnail(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale: number = 0.5,
): Promise<PdfPageThumbnail> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create 2D canvas context for PDF rendering.");
  }

  // White background
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Render using standard Canvas
  const renderContext = {
    canvasContext: context,
    viewport,
  };

  // pdfjs-dist render return has promise
  await page.render(renderContext as unknown as Parameters<typeof page.render>[0]).promise;

  return {
    pageNumber,
    dataUrl: canvas.toDataURL("image/png"),
    width: viewport.width,
    height: viewport.height,
  };
}

/**
 * Renders all page thumbnails for a given PDF file or buffer.
 */
export async function renderAllThumbnails(
  source: File | ArrayBuffer,
  scale: number = 0.4,
  onProgress?: (current: number, total: number) => void,
): Promise<PdfPageThumbnail[]> {
  const buffer = source instanceof File ? await source.arrayBuffer() : source;
  const doc = await loadPdfJsDoc(buffer);
  const total = doc.numPages;
  const thumbnails: PdfPageThumbnail[] = [];

  for (let i = 1; i <= total; i++) {
    const thumb = await renderPageThumbnail(doc, i, scale);
    thumbnails.push(thumb);
    onProgress?.(i, total);
  }

  return thumbnails;
}

/**
 * Extracts all selectable text from a PDF document.
 */
export async function extractPdfText(
  source: File | ArrayBuffer,
  onProgress?: (current: number, total: number) => void,
): Promise<{ text: string; pages: Array<{ pageNumber: number; text: string }> }> {
  const buffer = source instanceof File ? await source.arrayBuffer() : source;
  const doc = await loadPdfJsDoc(buffer);
  const total = doc.numPages;
  const pages: Array<{ pageNumber: number; text: string }> = [];

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");

    pages.push({ pageNumber: i, text: pageText });
    onProgress?.(i, total);
  }

  const fullText = pages.map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`).join("\n\n");
  return { text: fullText, pages };
}
