import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";

async function createAiTestPdf() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: Overview & Section 1
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
  page1.drawText("Docly Advanced AI Architecture Report", {
    x: 50,
    y: 780,
    size: 20,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.2),
  });

  page1.drawText("Section 1: Executive Summary & Overview", {
    x: 50,
    y: 730,
    size: 14,
    font: boldFont,
    color: rgb(0.2, 0.3, 0.7),
  });

  const p1Lines = [
    "Docly provides a state of the art document manipulation and processing platform.",
    "The platform prioritizes local, client-side execution to ensure maximum user privacy.",
    "No document contents are stored permanently or leaked to unauthorized third parties.",
    "With Phase 4, Docly introduces Advanced AI tools for summarization, intelligent Q&A,",
    "Cornell notes generation, practice exam creation, and cross-language translation.",
    "",
    "1. Key Capabilities of Docly:",
    "  - High fidelity text extraction preserving page boundaries and layout.",
    "  - Semantic text chunking that tracks source page references across all operations.",
    "  - Provider agnostic architecture supporting secure backend endpoints.",
    "  - Interactive quizzes with instant explanation reveals and scoring.",
    "",
    "Modern document workflows require fast, dependable analysis without sacrificing",
    "data security. Client-side processing allows documents to remain on device.",
  ];

  let y = 700;
  for (const line of p1Lines) {
    page1.drawText(line, { x: 50, y, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
    y -= 18;
  }

  // Page 2: Section 2 - Technical Details
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  page2.drawText("Section 2: Architecture & Implementation Details", {
    x: 50,
    y: 780,
    size: 14,
    font: boldFont,
    color: rgb(0.2, 0.3, 0.7),
  });

  const p2Lines = [
    "2. Technical Specifications & Chunking Logic:",
    "Documents are parsed into discrete chunks of approximately 500 words with a 60-word overlap.",
    "This avoids truncating essential paragraphs midway while ensuring high context coherence.",
    "Every chunk retains exact source page metadata (e.g. Page 1, Page 2) for citation auditing.",
    "",
    "Key Terminology Definitions:",
    "  - Chunking: The process of splitting text into overlapping segments with page tracking.",
    "  - Citations: Verifiable links indicating the exact source page of an answer or fact.",
    "  - Provider Abstraction: An interface isolating UI components from specific AI vendor APIs.",
    "  - Cornell System: A two-column note-taking method organizing cues, notes, and summary.",
    "",
    "3. Security and Privacy Invariants:",
    "No API secrets or access tokens are ever bundled in client-side code or browser storage.",
    "When a provider is unconfigured, the system reports status transparently without faking output.",
  ];

  y = 740;
  for (const line of p2Lines) {
    page2.drawText(line, { x: 50, y, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
    y -= 18;
  }

  // Page 3: Section 3 - Conclusions & Recommendations
  const page3 = pdfDoc.addPage([595.28, 841.89]);
  page3.drawText("Section 3: Conclusions & Recommendations", {
    x: 50,
    y: 780,
    size: 14,
    font: boldFont,
    color: rgb(0.2, 0.3, 0.7),
  });

  const p3Lines = [
    "4. Final Conclusions and Action Items:",
    "In conclusion, Docly's Phase 4 architecture successfully delivers a robust AI foundation.",
    "All document parsing and structural analysis happen locally in the browser.",
    "Practice questions, summaries, and notes can be exported as clean text files.",
    "",
    "Recommended Next Steps:",
    "  - Verify text extraction accuracy across diverse PDF page counts.",
    "  - Ensure download and copy operations cleanly handle large documents.",
    "  - Test responsive design across desktop and mobile screen viewports.",
  ];

  y = 740;
  for (const line of p3Lines) {
    page3.drawText(line, { x: 50, y, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
    y -= 18;
  }

  const pdfBytes = await pdfDoc.save();
  const outPath = path.resolve("test-fixtures", "ai-sample.pdf");
  fs.writeFileSync(outPath, pdfBytes);
  console.log("Successfully wrote ai-sample.pdf to", outPath);
}

createAiTestPdf().catch(console.error);
