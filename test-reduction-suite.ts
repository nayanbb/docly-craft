import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  calculateReductionPlan,
  createReducedPdf,
  validateReducedPdf,
} from "./src/lib/pdf/reduction-maker";

/**
 * Creates an in-memory test PDF with P distinct pages.
 */
async function generateSamplePdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([595.28, 841.89]); // Standard A4
    page.drawText(`Page ${i}`, {
      x: 60,
      y: 760,
      size: 24,
      font,
      color: rgb(0.1, 0.25, 0.6),
    });
    page.drawRectangle({
      x: 30,
      y: 30,
      width: 535.28,
      height: 781.89,
      borderColor: rgb(0.8, 0.8, 0.85),
      borderWidth: 1,
    });
    page.drawText(`Original Content Body for Page ${i}`, {
      x: 60,
      y: 710,
      size: 14,
      font,
      color: rgb(0.25, 0.25, 0.25),
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
  console.log("===============================================================================");
  console.log("REDUCTION MAKER — VERIFIED DUPLEX PRINT LOGIC TEST SUITE");
  console.log("===============================================================================\n");

  let passedCount = 0;

  for (const tc of REQUIRED_TEST_CASES) {
    const { pages, sheets } = tc;

    // 1. Calculate reduction plan
    const plan = calculateReductionPlan(pages, sheets);

    // 2. Verify all source pages appear exactly once in sequential order
    const collectedPages: number[] = [];
    let blankSides = 0;

    for (const s of plan.sheets) {
      if (s.frontPages.length === 0) blankSides++;
      if (s.backPages.length === 0) blankSides++;
      collectedPages.push(...s.frontPages);
      collectedPages.push(...s.backPages);
    }

    // Check count
    if (collectedPages.length !== pages) {
      throw new Error(`Total collected pages (${collectedPages.length}) !== input pages (${pages})`);
    }

    // Check sequential & no duplicates
    for (let i = 0; i < pages; i++) {
      if (collectedPages[i] !== i + 1) {
        throw new Error(
          `Sequential order violated! At index ${i}, expected Page ${i + 1}, but got Page ${collectedPages[i]}`,
        );
      }
    }

    // Check no unnecessary blank pages:
    // When pages >= sheets * 2: blankSides must be 0
    // When pages < sheets * 2: blankSides is at most (pages % 2 === 1 ? 1 : 0)
    const maxExpectedBlankSides = pages >= sheets * 2 ? 0 : pages % 2 === 1 ? 1 : 0;
    if (blankSides > maxExpectedBlankSides) {
      throw new Error(
        `Unnecessary blank sides detected! Found ${blankSides}, expected at most ${maxExpectedBlankSides}`,
      );
    }

    // 3. Generate REAL PDF via createReducedPdf
    const sampleBytes = await generateSamplePdf(pages);
    const result = await createReducedPdf(sampleBytes.buffer as ArrayBuffer, sheets);

    // 4. Verify generated PDF structure
    const outputBuffer = await result.blob.arrayBuffer();
    const loadedDoc = await PDFDocument.load(outputBuffer);
    const actualOutputPages = loadedDoc.getPageCount();

    if (actualOutputPages !== plan.totalPrintableSides) {
      throw new Error(
        `Output page mismatch! Expected ${plan.totalPrintableSides}, got ${actualOutputPages}`,
      );
    }

    // 5. Verify through validateReducedPdf
    const valResult = await validateReducedPdf(
      new Uint8Array(outputBuffer),
      plan.actualSheetCount,
      pages,
    );
    if (!valResult.valid) {
      throw new Error("validateReducedPdf returned invalid");
    }

    // 6. Summary printout
    console.log(`[TEST] ${pages} source pages → Target: ${sheets} sheets:`);
    console.log(`   • Output PDF pages (sides): ${actualOutputPages}`);
    console.log(`   • Physical sheets used: ${plan.actualSheetCount}`);
    console.log(
      `   • Pages per printable side: ${plan.minPagesPerSide === plan.maxPagesPerSide ? plan.minPagesPerSide : `${plan.minPagesPerSide}–${plan.maxPagesPerSide}`}`,
    );
    console.log(`   • Blank sides: ${blankSides} (unavoidable: ${maxExpectedBlankSides})`);
    console.log(`   • Duplex order: Sheet 1 (F: ${plan.sheets[0]?.frontPages.join(", ") || "blank"}, B: ${plan.sheets[0]?.backPages.join(", ") || "blank"}) ...`);
    console.log(`   • PDF validity: %PDF header verified, ${outputBuffer.byteLength} bytes`);
    console.log(`   ✓ PASS\n`);

    passedCount++;
  }

  console.log("===============================================================================");
  console.log(`SUMMARY: ALL ${passedCount} / ${REQUIRED_TEST_CASES.length} TEST CASES PASSED SUCCESSFULLY!`);
  console.log("===============================================================================");
}

runTestSuite().catch((err) => {
  console.error("\nTEST FAILED:", err);
  process.exit(1);
});
