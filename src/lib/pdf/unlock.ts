import { PDFDocument } from "pdf-lib";

export interface UnlockPdfResult {
  blob: Blob;
  pageCount: number;
}

/**
 * Authorized PDF Unlocker.
 * Authenticates with the user-provided password and permanently decrypts the PDF,
 * stripping encryption metadata and security handlers.
 * Never attempts password guessing or brute force.
 */
export async function unlockPdf(
  file: File,
  password: string,
  onProgress?: (percent: number) => void,
): Promise<UnlockPdfResult> {
  const trimmedPassword = (password ?? "").trim();
  if (!trimmedPassword) {
    throw new Error("Please enter the document password to unlock this PDF.");
  }

  onProgress?.(15);

  const form = new FormData();
  form.append("file", file);
  form.append("password", trimmedPassword);

  onProgress?.(35);

  const endpoint =
    typeof window !== "undefined"
      ? "/api/pdf/unlock"
      : `${process.env["DOCLY_API_BASE"] || "http://localhost:3000"}/api/pdf/unlock`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      body: form,
    });
  } catch {
    throw new Error("Unable to unlock this PDF. Please try again with a valid PDF and password.");
  }

  onProgress?.(70);

  if (res.status === 401) {
    throw new Error("Incorrect PDF password. Please enter the correct password.");
  }

  if (!res.ok) {
    const errorPayload = (await res.json().catch(() => null)) as { error?: string } | null;
    const msg =
      errorPayload?.error ||
      "Unable to unlock this PDF. Please try again with a valid PDF and password.";
    throw new Error(msg);
  }

  const arrayBuffer = await res.arrayBuffer();

  onProgress?.(85);

  // Programmatic verification: confirm output opens without any password and encryption dictionary is absent
  let pageCount = 1;
  try {
    const verifiedDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
    pageCount = verifiedDoc.getPageCount();
  } catch {
    throw new Error("Unable to unlock this PDF. Please try again with a valid PDF and password.");
  }

  onProgress?.(100);

  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  return { blob, pageCount };
}
