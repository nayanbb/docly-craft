import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  calculateReductionPlan,
  createReducedPdf,
  validateReducedPdf,
  type ReductionSize,
  A4_WIDTH,
  A4_HEIGHT,
} from "./src/lib/pdf/reduction-maker";

/**
 * Creates an in-memory test PDF with P distinct pages.
 */
async function generateSamplePdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
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
  size: ReductionSize;
}

const MANDATORY_TEST_CASES: TestCase[] = [
  // 9 per side
  { pages: 18, size: 9 },
  { pages: 36, size: 9 },
  { pages: 72, size: 9 },
  // 12 per side
  { pages: 24, size: 12 },
  { pages: 48, size: 12 },
  { pages: 96, size: 12 },
  // 16 per side
  { pages: 32, size: 16 },
  { pages: 64, size: 16 },
  { pages: 128, size: 16 },
  // Edge cases & uneven sheets
  { pages: 1, size: 9 },
  { pages: 5, size: 9 },
  { pages: 20, size: 9 },
  { pages: 10, size: 12 },
  { pages: 25, size: 12 },
  { pages: 36, size: 12 },
  { pages: 33, size: 16 },
  { pages: 36, size: 16 },
  { pages: 50, size: 16 },
];

async function runTestSuite() {
  console.log("===============================================================================");
  console.log("REDUCTION MAKER — FINAL VERIFIED N-UP DUPLEX PRINT LOGIC TEST SUITE");
  console.log("===============================================================================\n");

  let passedCount = 0;

  for (const tc of MANDATORY_TEST_CASES) {
    const { pages, size } = tc;

    // 1. Calculate reduction plan
    const plan = calculateReductionPlan(pages, size);
    const capacityPerSheet = size * 2;
    const expectedSheets = Math.ceil(pages / capacityPerSheet);
    const expectedOutputPages = expectedSheets * 2;

    if (plan.physicalSheetCount !== expectedSheets) {
      throw new Error(
        `Physical sheet mismatch for P=${pages}, N=${size}: got ${plan.physicalSheetCount}, expected ${expectedSheets}`,
      );
    }
    if (plan.outputPdfPageCount !== expectedOutputPages) {
      throw new Error(
        `Output page mismatch for P=${pages}, N=${size}: got ${plan.outputPdfPageCount}, expected ${expectedOutputPages}`,
      );
    }

    // 2. Verify all source pages appear exactly once in correct front/back odd/even positions
    const seenPages = new Set<number>();
    let blankBoxes = 0;

    plan.sheets.forEach((sheet, sIdx) => {
      const sheetStart = sIdx * capacityPerSheet;

      // Front boxes
      sheet.front.boxes.forEach((p, bIdx) => {
        const expectedP = sheetStart + 1 + bIdx * 2;
        if (p !== null) {
          if (p !== expectedP) {
            throw new Error(`Front box mismatch: at sheet ${sIdx + 1} box ${bIdx}, got ${p}, expected ${expectedP}`);
          }
          if (seenPages.has(p)) {
            throw new Error(`Duplicate page detected: ${p}`);
          }
          seenPages.add(p);
        } else {
          // Expected to be null only if expectedP > pages
          if (expectedP <= pages) {
            throw new Error(`Missing page! Page ${expectedP} should be in sheet ${sIdx + 1} front box ${bIdx}`);
          }
          blankBoxes++;
        }
      });

      // Back boxes
      sheet.back.boxes.forEach((p, bIdx) => {
        const expectedP = sheetStart + 2 + bIdx * 2;
        if (p !== null) {
          if (p !== expectedP) {
            throw new Error(`Back box mismatch: at sheet ${sIdx + 1} box ${bIdx}, got ${p}, expected ${expectedP}`);
          }
          if (seenPages.has(p)) {
            throw new Error(`Duplicate page detected: ${p}`);
          }
          seenPages.add(p);
        } else {
          // Expected to be null only if expectedP > pages
          if (expectedP <= pages) {
            throw new Error(`Missing page! Page ${expectedP} should be in sheet ${sIdx + 1} back box ${bIdx}`);
          }
          blankBoxes++;
        }
      });
    });

    // Check all pages 1..pages accounted for
    if (seenPages.size !== pages) {
      throw new Error(`Accounted pages count (${seenPages.size}) !== input pages (${pages})`);
    }

    // 3. Generate REAL PDF via createReducedPdf
    const sampleBytes = await generateSamplePdf(pages);
    const result = await createReducedPdf(sampleBytes.buffer as ArrayBuffer, size);

    if (result.outputPageCount !== expectedOutputPages) {
      throw new Error(`Result output page count (${result.outputPageCount}) !== expected (${expectedOutputPages})`);
    }

    // 4. Verify generated PDF structure
    const outputBuffer = await result.blob.arrayBuffer();
    const loadedDoc = await PDFDocument.load(outputBuffer);
    const actualOutputPages = loadedDoc.getPageCount();

    if (actualOutputPages !== expectedOutputPages) {
      throw new Error(`Reloaded PDF has ${actualOutputPages} pages, expected ${expectedOutputPages}`);
    }

    // Verify A4 dimensions on all generated pages
    for (let pIdx = 0; pIdx < actualOutputPages; pIdx++) {
      const p = loadedDoc.getPage(pIdx);
      const { width, height } = p.getSize();
      if (Math.abs(width - A4_WIDTH) > 0.01 || Math.abs(height - A4_HEIGHT) > 0.01) {
        throw new Error(`Page ${pIdx + 1} has dimensions ${width}x${height}, expected A4 (${A4_WIDTH}x${A4_HEIGHT})`);
      }
    }

    // 5. Verify through validateReducedPdf
    const valResult = await validateReducedPdf(
      new Uint8Array(outputBuffer),
      plan.physicalSheetCount,
      pages,
    );
    if (!valResult.valid) {
      throw new Error("validateReducedPdf returned invalid");
    }

    // 6. Summary printout
    console.log(`[TEST] ${pages} source pages | ${size} per side:`);
    console.log(`   • Physical sheets required: ${plan.physicalSheetCount}`);
    console.log(`   • Output PDF pages: ${actualOutputPages} (Duplex pairs: ${actualOutputPages / 2})`);
    console.log(`   • Blank grid boxes: ${blankBoxes}`);
    console.log(`   • Sheet 1 Front: [${plan.sheets[0]?.front.boxes.filter(Boolean).join(", ")}]`);
    console.log(`   • Sheet 1 Back:  [${plan.sheets[0]?.back.boxes.filter(Boolean).join(", ")}]`);
    console.log(`   • PDF valid & verified: ${outputBuffer.byteLength} bytes`);
    console.log(`   ✓ PASS\n`);

    passedCount++;
  }

  console.log("===============================================================================");
  console.log(`SUMMARY: ALL ${passedCount} / ${MANDATORY_TEST_CASES.length} TEST CASES PASSED SUCCESSFULLY!`);
  console.log("===============================================================================");
}

runTestSuite().catch((err) => {
  console.error("\nTEST FAILED:", err);
  process.exit(1);
});
