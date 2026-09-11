import { PDFDocument } from "pdf-lib";

/**
 * Attempts to repair and reconstruct a malformed or corrupted PDF document.
 */
export async function repairPdf(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ blob: Blob; pageCount: number; status: string }> {
  onProgress?.(20);

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new Error(`Could not read "${file.name}". The file may be physically corrupted.`);
  }

  onProgress?.(50);

  let doc: PDFDocument;
  try {
    // Attempt lenient load to recover syntax flaws
    doc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `This PDF has severe structural damage that could not be automatically reconstructed (${msg}). Please verify the source file.`,
    );
  }

  const pageCount = doc.getPageCount();
  if (pageCount === 0) {
    throw new Error("The repaired document contains 0 recoverable pages.");
  }

  onProgress?.(80);

  // Re-save with fresh xref tables and reconstructed trailer dictionaries
  const bytes = await doc.save({ useObjectStreams: false });
  onProgress?.(100);

  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });

  return {
    blob,
    pageCount,
    status: `Successfully validated and reconstructed PDF structure (${pageCount} pages recovered).`,
  };
}
