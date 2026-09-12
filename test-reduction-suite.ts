import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  calculateReductionPlan,
  createReducedPdf,
  getGridForCount,
  validateReducedPdf,
} from "./src/lib/pdf/reduction-maker";

/**
 * Creates an in-memory sample PDF with N distinct pages.
 */
async function generateSamplePdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([595.28, 841.89]); // A4
    page.drawText(`Document Page ${i} of ${pageCount}`, {
      x: 60,
      y: 760,
      size: 22,
      font,
      color: rgb(0.12, 0.25, 0.55),
    });
    page.drawRectangle({
      x: 40,
      y: 40,
      width: 515.28,
      height: 761.89,
      borderColor: rgb(0.75, 0.75, 0.8),
      borderWidth: 1.5,
    });
    page.drawText(`Content identifier: P#${i}`, {
      x: 60,
      y: 700,
      size: 14,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  return await doc.save();
}

interface TestCase {
  pages: number;
  sheets: 9 | 12 | 16;
}

const REQUIRED_TEST_CASES: TestCase[] = [
  { pages: 18, sheets: 9 },
  { pages: 36, sheets: 9 },
  { pages: 36, sheets: 12 },
  { pages: 36, sheets: 16 },
  { pages: 20, sheets: 9 },
  { pages: 20, sheets: 12 },
  { pages: 20, sheets: 16 },
  { pages: 5, sheets: 9 },
  { pages: 1, sheets: 9 },
  { pages: 32, sheets: 16 },
  { pages: 48, sheets: 12 },
  { pages: 72, sheets: 9 },
];

async function runTestSuite() {
  console.log("=================================================");
  console.log("REDUCTION MAKER COMPREHENSIVE TEST SUITE");
  console.log("=================================================\n");

  let passedCount = 0;

  for (const tc of REQUIRED_TEST_CASES) {
    const { pages, sheets } = tc;
    process.stdout.write(`Testing ${pages} pages → ${sheets} sheets: `);

    // 1. Verify Algorithmic Distribution Plan
    const plan = calculateReductionPlan(pages, sheets);
    if (plan.sheets.length !== sheets) {
      throw new Error(`Plan generated ${plan.sheets.length} sheets, expected ${sheets}`);
    }

    // Verify all pages are uniquely present from 1 to `pages`
    const collectedPages: number[] = [];
    let blankSides = 0;
    for (const sheet of plan.sheets) {
      if (sheet.frontPages.length === 0) blankSides++;
      if (sheet.backPages.length === 0) blankSides++;
      collectedPages.push(...sheet.frontPages);
      collectedPages.push(...sheet.backPages);
    }

    if (collectedPages.length !== pages) {
      throw new Error(`Total pages collected (${collectedPages.length}) !== input pages (${pages})`);
    }

    const sortedPages = [...collectedPages].sort((a, b) => a - b);
    for (let i = 0; i < pages; i++) {
      if (sortedPages[i] !== i + 1) {
        throw new Error(`Missing or duplicate page! Expected ${i + 1}, found ${sortedPages[i]}`);
      }
    }

    // 2. Generate Real PDF through `createReducedPdf`
    const sampleBytes = await generateSamplePdf(pages);
    const result = await createReducedPdf(sampleBytes.buffer as ArrayBuffer, sheets);

    if (result.outputPageCount !== sheets * 2) {
      throw new Error(
        `Output page count (${result.outputPageCount}) !== 2 * sheets (${sheets * 2})`,
      );
    }

    // 3. Inspect generated PDF Blob
    const outputBuffer = await result.blob.arrayBuffer();
    const loadedDestDoc = await PDFDocument.load(outputBuffer);
    const actualPageCount = loadedDestDoc.getPageCount();

    if (actualPageCount !== sheets * 2) {
      throw new Error(
        `Reloaded PDF has ${actualPageCount} pages, expected ${sheets * 2} pages`,
      );
    }

    // 4. Validate through validateReducedPdf
    const valResult = await validateReducedPdf(
      new Uint8Array(outputBuffer),
      sheets,
      pages,
    );
    if (!valResult.valid) {
      throw new Error("Validation function returned false");
    }

    // Output stats
    console.log(
      `✓ PASS (Output: ${actualPageCount} pages [${sheets} physical sheets, duplex], Blob size: ${outputBuffer.byteLength} B, Blank sides: ${blankSides})`,
    );
    passedCount++;
  }

  console.log("\n=================================================");
  console.log(`ALL ${passedCount} / ${REQUIRED_TEST_CASES.length} TEST CASES PASSED SUCCESSFULLY!`);
  console.log("=================================================");
}

runTestSuite().catch((err) => {
  console.error("\nTEST SUITE FAILED:", err);
  process.exit(1);
});
