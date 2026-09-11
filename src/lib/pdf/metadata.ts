import { PDFDocument, PDFName } from "pdf-lib";

export interface RemovedMetadataInfo {
  title?: string;
  author?: string;
  creator?: string;
  producer?: string;
  subject?: string;
  keywords?: string[];
}

/**
 * Strips all metadata fields and XMP streams from a PDF document.
 */
export async function removePdfMetadata(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ blob: Blob; removedFields: string[] }> {
  const buffer = await file.arrayBuffer();
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: false });

  onProgress?.(30);

  const removed: string[] = [];

  if (doc.getTitle()) {
    removed.push("Title");
    doc.setTitle("");
  }
  if (doc.getAuthor()) {
    removed.push("Author");
    doc.setAuthor("");
  }
  if (doc.getSubject()) {
    removed.push("Subject");
    doc.setSubject("");
  }
  if (doc.getKeywords()) {
    removed.push("Keywords");
    doc.setKeywords([]);
  }
  if (doc.getProducer()) {
    removed.push("Producer");
    doc.setProducer("");
  }
  if (doc.getCreator()) {
    removed.push("Creator");
    doc.setCreator("");
  }
  if (doc.getCreationDate()) {
    removed.push("Creation Date");
    doc.setCreationDate(new Date(0));
  }
  if (doc.getModificationDate()) {
    removed.push("Modification Date");
    doc.setModificationDate(new Date(0));
  }

  // Remove XMP Metadata stream from the document catalog if present
  try {
    const catalog = doc.catalog;
    const metadataKey = PDFName.of("Metadata");
    if (catalog.has(metadataKey)) {
      catalog.delete(metadataKey);
      removed.push("XMP XML Stream");
    }
  } catch {
    // Ignore if not present
  }

  onProgress?.(70);

  const bytes = await doc.save();
  onProgress?.(100);

  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  return {
    blob,
    removedFields: removed.length > 0 ? removed : ["All standard metadata headers"],
  };
}
