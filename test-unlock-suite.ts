import { PDFDocument, rgb } from "pdf-lib";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt";

async function createTestPdf(pagesCount: number = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pagesCount; i++) {
    const page = doc.addPage([595.28, 841.89]); // A4
    page.drawText(`Page ${i + 1} Content - Docly Confidential Document`, {
      x: 50,
      y: 750,
      size: 16,
      color: rgb(0.1, 0.2, 0.4),
    });
  }
  return await doc.save();
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function runUnlockTests() {
  console.log("================================================================================");
  console.log("DOCLY UNLOCK PDF TEST SUITE — REAL PASSWORD REMOVAL VERIFICATION");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  // --------------------------------------------------------------------------------
  // TEST CASE A: Password-protected PDF + correct password
  // --------------------------------------------------------------------------------
  try {
    console.log("Test Case A: Password-protected PDF + correct password");
    const rawPdf = await createTestPdf(1);
    const password = "DoclySecretPassword123";
    const encryptedBytes = await encryptPDF(rawPdf, password);

    // Verify it is genuinely encrypted first
    let isEncryptedInitially = false;
    try {
      await PDFDocument.load(encryptedBytes, { ignoreEncryption: false });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("encrypted")) {
        isEncryptedInitially = true;
      }
    }
    if (!isEncryptedInitially) throw new Error("Pre-check failed: input was not encrypted.");

    const form = new FormData();
    form.append(
      "file",
      new Blob([encryptedBytes], { type: "application/pdf" }),
      "confidential.pdf",
    );
    form.append("password", password);

    const res = await fetch("http://localhost:3000/api/pdf/unlock", {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(`Expected HTTP 200, got ${res.status}: ${JSON.stringify(err)}`);
    }

    const unlockedBytes = new Uint8Array(await res.arrayBuffer());

    // 1. Programmatic verification: opens WITHOUT password using ignoreEncryption: false
    const verifiedDoc = await PDFDocument.load(unlockedBytes, { ignoreEncryption: false });
    const pageCount = verifiedDoc.getPageCount();

    // 2. Structural verification: verify /Encrypt is absent in the unlocked output
    const rawText = Buffer.from(unlockedBytes).toString("latin1");
    const hasEncrypt = rawText.includes("/Encrypt ");

    if (hasEncrypt) {
      throw new Error("Output PDF still contains /Encrypt dictionary! Decryption was not real.");
    }
    if (pageCount !== 1) {
      throw new Error(`Expected 1 page, got ${pageCount}`);
    }

    console.log("  [PASS] Successfully unlocked encrypted PDF.");
    console.log("  [PASS] Verified document opens with ignoreEncryption: false.");
    console.log("  [PASS] Verified /Encrypt dictionary completely eliminated.");
    passed++;
  } catch (err: unknown) {
    console.error("  [FAIL] Test Case A failed:", getErrorMessage(err));
    failed++;
  }

  // --------------------------------------------------------------------------------
  // TEST CASE B: Password-protected PDF + incorrect password
  // --------------------------------------------------------------------------------
  try {
    console.log("\nTest Case B: Password-protected PDF + incorrect password");
    const rawPdf = await createTestPdf(1);
    const password = "CorrectPassword_XYZ";
    const encryptedBytes = await encryptPDF(rawPdf, password);

    const form = new FormData();
    form.append("file", new Blob([encryptedBytes], { type: "application/pdf" }), "protected.pdf");
    form.append("password", "WRONG_PASSWORD_ABC");

    const res = await fetch("http://localhost:3000/api/pdf/unlock", {
      method: "POST",
      body: form,
    });

    if (res.status !== 401) {
      throw new Error(`Expected HTTP 401 for incorrect password, got ${res.status}`);
    }

    const payload = (await res.json()) as { error?: string };
    const expectedMsg = "Incorrect PDF password. Please enter the correct password.";

    if (payload.error !== expectedMsg) {
      throw new Error(`Expected error message '${expectedMsg}', got '${payload.error}'`);
    }

    console.log("  [PASS] HTTP 401 rejected on wrong password.");
    console.log(`  [PASS] Exact error message returned: "${payload.error}"`);
    passed++;
  } catch (err: unknown) {
    console.error("  [FAIL] Test Case B failed:", getErrorMessage(err));
    failed++;
  }

  // --------------------------------------------------------------------------------
  // TEST CASE C: Already-unlocked PDF
  // --------------------------------------------------------------------------------
  try {
    console.log("\nTest Case C: Already-unlocked PDF");
    const rawPdf = await createTestPdf(2);

    const form = new FormData();
    form.append("file", new Blob([rawPdf], { type: "application/pdf" }), "clean.pdf");
    form.append("password", "anypassword");

    const res = await fetch("http://localhost:3000/api/pdf/unlock", {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      throw new Error(`Expected HTTP 200 for already-unlocked PDF, got ${res.status}`);
    }

    const unlockedBytes = new Uint8Array(await res.arrayBuffer());
    const verifiedDoc = await PDFDocument.load(unlockedBytes, { ignoreEncryption: false });

    if (verifiedDoc.getPageCount() !== 2) {
      throw new Error(`Expected 2 pages, got ${verifiedDoc.getPageCount()}`);
    }

    console.log("  [PASS] Handled gracefully without error.");
    console.log(`  [PASS] Output valid unencrypted PDF with ${verifiedDoc.getPageCount()} pages.`);
    passed++;
  } catch (err: unknown) {
    console.error("  [FAIL] Test Case C failed:", getErrorMessage(err));
    failed++;
  }

  // --------------------------------------------------------------------------------
  // TEST CASE D: Corrupted / non-PDF file
  // --------------------------------------------------------------------------------
  try {
    console.log("\nTest Case D: Corrupted / non-PDF file");
    const garbageBytes = Buffer.from("Not a real PDF file! Just random characters.");

    const form = new FormData();
    form.append("file", new Blob([garbageBytes], { type: "text/plain" }), "corrupt.pdf");
    form.append("password", "somepass");

    const res = await fetch("http://localhost:3000/api/pdf/unlock", {
      method: "POST",
      body: form,
    });

    if (res.status !== 400) {
      throw new Error(`Expected HTTP 400 for corrupt/non-PDF file, got ${res.status}`);
    }

    const payload = (await res.json()) as { error?: string };
    const expectedMsg =
      "Unable to unlock this PDF. Please try again with a valid PDF and password.";

    if (payload.error !== expectedMsg) {
      throw new Error(`Expected error message '${expectedMsg}', got '${payload.error}'`);
    }

    console.log("  [PASS] HTTP 400 safely rejected corrupted payload.");
    console.log(`  [PASS] Clean user-friendly message returned: "${payload.error}"`);
    passed++;
  } catch (err: unknown) {
    console.error("  [FAIL] Test Case D failed:", getErrorMessage(err));
    failed++;
  }

  // --------------------------------------------------------------------------------
  // TEST CASE E: PDF with multiple pages
  // --------------------------------------------------------------------------------
  try {
    console.log("\nTest Case E: PDF with multiple pages");
    const multiPdf = await createTestPdf(4);
    const password = "MultiPageDocPassword99";
    const encryptedMulti = await encryptPDF(multiPdf, password);

    const form = new FormData();
    form.append("file", new Blob([encryptedMulti], { type: "application/pdf" }), "multipage.pdf");
    form.append("password", password);

    const res = await fetch("http://localhost:3000/api/pdf/unlock", {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      throw new Error(`Expected HTTP 200, got ${res.status}`);
    }

    const unlockedBytes = new Uint8Array(await res.arrayBuffer());
    const verifiedDoc = await PDFDocument.load(unlockedBytes, { ignoreEncryption: false });

    if (verifiedDoc.getPageCount() !== 4) {
      throw new Error(`Expected 4 pages, got ${verifiedDoc.getPageCount()}`);
    }

    for (let i = 0; i < 4; i++) {
      const page = verifiedDoc.getPage(i);
      const size = page.getSize();
      if (Math.round(size.width) !== 595 || Math.round(size.height) !== 842) {
        throw new Error(`Page ${i + 1} dimensions distorted: ${size.width}x${size.height}`);
      }
    }

    console.log("  [PASS] All 4 pages intact.");
    console.log("  [PASS] Page dimensions, aspect ratio, and geometry preserved accurately.");
    passed++;
  } catch (err: unknown) {
    console.error("  [FAIL] Test Case E failed:", getErrorMessage(err));
    failed++;
  }

  // --------------------------------------------------------------------------------
  // TEST CASE F: Security and information disclosure checks
  // --------------------------------------------------------------------------------
  try {
    console.log("\nTest Case F: Security and Information Disclosure checks");
    const garbageBytes = Buffer.from("%PDF-corrupted-header-garbage-stream");
    const form = new FormData();
    form.append("file", new Blob([garbageBytes], { type: "application/pdf" }), "leak_test.pdf");
    form.append("password", "super_secret_user_password_9999");

    const res = await fetch("http://localhost:3000/api/pdf/unlock", {
      method: "POST",
      body: form,
    });

    const bodyText = await res.text();
    const forbiddenPatterns = [
      "gotenberg",
      "cloudconvert",
      "pypdf",
      "fastapi",
      "traceback",
      "super_secret_user_password_9999",
      "C:\\",
      "/home/",
      "/usr/",
      "localhost:8001",
    ];

    for (const pattern of forbiddenPatterns) {
      if (bodyText.toLowerCase().includes(pattern.toLowerCase())) {
        throw new Error(
          `Response leaked sensitive/internal information: '${pattern}' in '${bodyText}'`,
        );
      }
    }

    console.log("  [PASS] Zero internal engine names, file paths, or secrets leaked.");
    passed++;
  } catch (err: unknown) {
    console.error("  [FAIL] Test Case F failed:", getErrorMessage(err));
    failed++;
  }

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runUnlockTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
