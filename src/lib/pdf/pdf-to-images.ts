import { loadPdfJsDoc } from "./pdfjs";

export interface ConvertedPageImage {
  pageNumber: number;
  name: string;
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Converts all pages of a PDF into high-quality JPG or PNG images.
 */
export async function convertPdfToImages(
  file: File,
  format: "jpg" | "png",
  quality: number = 0.92,
  scale: number = 1.5,
  onProgress?: (current: number, total: number) => void,
): Promise<ConvertedPageImage[]> {
  const buffer = await file.arrayBuffer();
  const doc = await loadPdfJsDoc(buffer);
  const total = doc.numPages;
  const results: ConvertedPageImage[] = [];

  const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
  const ext = format === "jpg" ? "jpg" : "png";
  const baseName = file.name.replace(/\.[^/.]+$/, "");

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not initialize canvas context for page rendering.");
    }

    // Fill white background for JPEG flattening
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: ctx,
      viewport,
    };

    await page.render(renderContext as unknown as Parameters<typeof page.render>[0]).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error(`Failed to render page ${i} to image.`));
        },
        mimeType,
        quality,
      );
    });

    results.push({
      pageNumber: i,
      name: `${baseName}-page-${i}.${ext}`,
      blob,
      dataUrl: canvas.toDataURL(mimeType, quality),
      width: canvas.width,
      height: canvas.height,
    });

    onProgress?.(i, total);
  }

  return results;
}
