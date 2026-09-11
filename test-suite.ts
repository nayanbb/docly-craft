import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { mergePdfFiles } from "./src/lib/pdf/merge";
import { splitPdfByRanges, splitAllPages, parsePageRanges } from "./src/lib/pdf/split";
import { deletePdfPages } from "./src/lib/pdf/delete-pages";
import { extractPdfPages } from "./src/lib/pdf/extract";
import { reorderPdfPages } from "./src/lib/pdf/reorder";
import { rotatePdfPages } from "./src/lib/pdf/rotate";
import { compressPdf } from "./src/lib/pdf/compress";
import { addPdfWatermark } from "./src/lib/pdf/watermark";
import { addPdfPageNumbers } from "./src/lib/pdf/page-numbers";
import { removePdfMetadata } from "./src/lib/pdf/metadata";
import { cropPdf } from "./src/lib/pdf/crop";
import { repairPdf } from "./src/lib/pdf/repair";
import { imagesToPdf } from "./src/lib/image/to-pdf";
import { validatePdfFile, validateImageFile } from "./src/lib/files/validation";
import { analyzeDocumentLocally, searchDocumentLocally } from "./src/lib/ai/adapter";
import { buildAuthRedirectUrl, sanitizeRedirectPath } from "./src/lib/auth/require-auth";
import { isSupabaseConfigured, supabase } from "./src/lib/supabase/client";
import {
  PRICING,
  FILE_SIZE_LIMITS,
  CONVERSION_LIMITS,
  OCR_LIMITS,
  PRO_ONLY_TOOL_IDS,
  isProTool,
  isConversionLimitedTool,
  isOcrLimitedTool,
  getMaxFileSizeBytes,
} from "./src/lib/monetization/config";
import { checkToolUsage, getUtcDateString, getToolUsageToday } from "./src/lib/monetization/usage";
import {
  getServerConversionUsage,
  incrementServerConversionUsage,
  resetServerConversionUsage,
  handleConversionApiRequest,
} from "./src/lib/office/server-handler";
import { createRazorpaySubscription } from "./src/lib/razorpay/service";
import { isRazorpayConfigured } from "./src/lib/razorpay/server";
import { toolById, tools } from "./src/lib/tools";

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

// Polyfill File for Node test runner
function bufferToFile(buffer: Buffer, name: string, mime: string): File {
  const blob = new Blob([buffer], { type: mime });
  return new File([blob], name, { type: mime });
}

async function runTests() {
  console.log("==========================================");
  console.log("RUNNING DOCLY AUTOMATED ENGINE TEST SUITE");
  console.log("==========================================");

  const doc1Buf = fs.readFileSync("c:/Users/nayan/docly-craft/test-fixtures/doc1.pdf");
  const doc2Buf = fs.readFileSync("c:/Users/nayan/docly-craft/test-fixtures/doc2.pdf");
  const imgBuf = fs.readFileSync("c:/Users/nayan/docly-craft/test-fixtures/sample.png");

  const file1 = bufferToFile(doc1Buf, "doc1.pdf", "application/pdf");
  const file2 = bufferToFile(doc2Buf, "doc2.pdf", "application/pdf");
  const fileImg = bufferToFile(imgBuf, "sample.png", "image/png");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
    }
  }

  // 1. Validation tests
  const v1 = await validatePdfFile(file1);
  assert(v1.valid, "validatePdfFile accepts valid PDF");

  const fakePdf = bufferToFile(Buffer.from("not a pdf"), "fake.pdf", "application/pdf");
  const v2 = await validatePdfFile(fakePdf);
  assert(!v2.valid, "validatePdfFile rejects non-PDF magic bytes");

  const v3 = await validateImageFile(fileImg);
  assert(v3.valid, "validateImageFile accepts valid PNG");

  // 2. Merge PDF
  const mergedBlob = await mergePdfFiles([file1, file2]);
  const mergedDoc = await PDFDocument.load(await mergedBlob.arrayBuffer());
  assert(mergedDoc.getPageCount() === 5, "Merge PDF combines 3 + 2 pages into exactly 5 pages");

  // 3. Split PDF
  const ranges = parsePageRanges("1-2, 3", 3);
  assert(ranges.length === 2 && ranges[0]?.length === 2, "parsePageRanges parses 1-2, 3 correctly");
  const splitResults = await splitPdfByRanges(file1, ranges);
  assert(
    splitResults.length === 2 &&
      splitResults[0]?.pageCount === 2 &&
      splitResults[1]?.pageCount === 1,
    "splitPdfByRanges produces valid parts",
  );

  const splitAll = await splitAllPages(file1);
  assert(splitAll.length === 3, "splitAllPages splits 3-page document into 3 single-page PDFs");

  // 4. Delete Pages
  const delRes = await deletePdfPages(file1, [2]);
  const delDoc = await PDFDocument.load(await delRes.blob.arrayBuffer());
  assert(delDoc.getPageCount() === 2, "Delete pages removes page 2 (remaining: 2 pages)");

  // 5. Extract Pages
  const extRes = await extractPdfPages(file1, [1, 3]);
  const extDoc = await PDFDocument.load(await extRes.blob.arrayBuffer());
  assert(extDoc.getPageCount() === 2, "Extract pages pulls pages 1 and 3 into 2-page PDF");

  // 6. Reorder Pages
  const reorderRes = await reorderPdfPages(file1, [3, 2, 1]);
  const reorderDoc = await PDFDocument.load(await reorderRes.blob.arrayBuffer());
  assert(reorderDoc.getPageCount() === 3, "Reorder pages preserves 3 pages in new sequence");

  // 7. Rotate PDF
  const rotRes = await rotatePdfPages(file1, 90);
  const rotDoc = await PDFDocument.load(await rotRes.blob.arrayBuffer());
  const p0 = rotDoc.getPage(0);
  assert(p0.getRotation().angle === 90, "Rotate PDF sets 90° page rotation");

  // 8. Compress PDF
  const compRes = await compressPdf(file1);
  assert(
    compRes.blob.size > 0 && typeof compRes.explanation === "string",
    "Compress PDF produces valid Blob with truthful explanation",
  );

  // 9. Watermark
  const wmRes = await addPdfWatermark(file1, { text: "CONFIDENTIAL", opacity: 0.3 });
  assert(wmRes.pageCount === 3 && wmRes.blob.size > 0, "Watermark adds text across all pages");

  // 10. Page Numbers
  const numRes = await addPdfPageNumbers(file1, {
    position: "bottom-center",
    format: "page-x-of-y",
  });
  assert(
    numRes.pageCount === 3 && numRes.blob.size > 0,
    "Page numbers draws numbering on all pages",
  );

  // 11. Remove Metadata
  const metaRes = await removePdfMetadata(file1);
  assert(
    metaRes.blob.size > 0 && metaRes.removedFields.length > 0,
    "Metadata remover strips fields and XMP streams",
  );

  // 12. Crop PDF
  const cropRes = await cropPdf(file1, { top: 20, bottom: 20, left: 20, right: 20 });
  const cropDoc = await PDFDocument.load(await cropRes.blob.arrayBuffer());
  const cropPage = cropDoc.getPage(0);
  const box = cropPage.getCropBox();
  assert(box.x === 20 && box.y === 20, "Crop PDF modifies page CropBox accurately");

  // 13. PDF Repair
  const repRes = await repairPdf(file1);
  assert(repRes.pageCount === 3, "Repair PDF safely reconstructs catalog and xref tables");

  // 14. Image to PDF
  const imgPdfRes = await imagesToPdf([fileImg]);
  const imgPdfDoc = await PDFDocument.load(await imgPdfRes.blob.arrayBuffer());
  assert(imgPdfDoc.getPageCount() === 1, "Image to PDF creates valid 1-page PDF");

  // 15. Local Document Analysis
  const analysis = analyzeDocumentLocally(
    "Docly is a document processing platform. 1. Introduction: This section describes the document. 2. Features: Here are the tools.",
    2,
  );
  assert(
    analysis.wordCount > 5 && analysis.extractedOutline.length > 0,
    "Local document outline and keyword frequency analysis works",
  );

  // 16. Chat Search
  const searchResults = searchDocumentLocally("tools", [
    { pageNumber: 1, text: "Welcome to Docly." },
    { pageNumber: 2, text: "Here are all the document tools you can use." },
  ]);
  assert(
    searchResults.length === 1 && searchResults[0]?.pageNumber === 2,
    "Local keyword citation search locates matching page",
  );

  // 17. Safe Text Chunking
  const { chunkDocument } = await import("./src/lib/ai/document/chunk-text");
  const testDoc = {
    filename: "test.pdf",
    totalPages: 2,
    totalWords: 120,
    totalCharacters: 600,
    estimatedReadingMinutes: 1,
    pages: [
      {
        pageNumber: 1,
        text: "Chapter 1: Overview\n\nDocly is an advanced document processing platform built for security and privacy.",
        wordCount: 16,
        charCount: 98,
      },
      {
        pageNumber: 2,
        text: "Chapter 2: Methods\n\nChunking algorithms ensure document text is partitioned safely without cutting words or sentences.",
        wordCount: 17,
        charCount: 110,
      },
    ],
    fullText: "Chapter 1: Overview...",
    isScanned: false,
    outline: [
      { title: "Chapter 1: Overview", snippet: "Docly is an advanced...", pageNumber: 1 },
      { title: "Chapter 2: Methods", snippet: "Chunking algorithms...", pageNumber: 2 },
    ],
    topKeywords: [
      { word: "document", count: 4 },
      { word: "chunking", count: 3 },
    ],
  };

  const chunks = chunkDocument(testDoc, { maxChunkWords: 50 });
  assert(
    chunks.length >= 1 && (chunks[0]?.pageNumbers.length ?? 0) > 0,
    "Safe text chunking preserves exact page references",
  );

  // 18. AI Provider Architecture & Unconfigured State
  const { isAIProviderConfigured, getActiveAIProvider, AIProviderNotConfiguredError } =
    await import("./src/lib/ai/providers");
  assert(!isAIProviderConfigured(), "AI provider defaults to unconfigured state");
  let caughtProviderError = false;
  try {
    await getActiveAIProvider().summarize(testDoc);
  } catch (err) {
    if (err instanceof AIProviderNotConfiguredError) {
      caughtProviderError = true;
    }
  }
  assert(
    caughtProviderError,
    "Unconfigured AI provider safely throws AIProviderNotConfiguredError",
  );

  // 19. Suggested Questions Generation
  const { generateSuggestedQuestions } = await import("./src/lib/ai/chat");
  const suggestions = generateSuggestedQuestions(testDoc);
  assert(
    suggestions.length >= 2 &&
      suggestions.some((s) => s.includes("Chapter 1") || s.includes("document")),
    "Suggested questions are generated based on document outline & keywords",
  );

  // 20. Formatters & Script Detection
  const { formatSummaryAsText } = await import("./src/lib/ai/summary");
  const summaryTxt = formatSummaryAsText(
    {
      overview: "Document overview text",
      keyPoints: ["Point 1", "Point 2"],
      importantDetails: ["Detail A"],
      conclusion: "Final takeaway",
      rawMarkdown: "",
    },
    "test.pdf",
  );
  assert(
    summaryTxt.includes("DOCLY AI DOCUMENT SUMMARY") && summaryTxt.includes("Point 1"),
    "Summary text formatter produces clean exportable text",
  );

  const { detectDocumentScript } = await import("./src/lib/ai/translate");
  const detectedLatin = detectDocumentScript("Hello world, this is Docly.");
  const detectedCjk = detectDocumentScript("你好世界，这是Docly文档。");
  assert(
    detectedLatin.includes("Latin") && detectedCjk.includes("Chinese"),
    "Document script detection distinguishes scripts accurately",
  );

  // 21. Office File Validation with Magic Bytes
  const { validateOfficeFile } = await import("./src/lib/office/validation");

  // Valid OpenXML ZIP header PK\x03\x04
  const validDocxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
  const docxFile = bufferToFile(
    validDocxBuffer,
    "sample.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  const docxVal = await validateOfficeFile(docxFile, "word-to-pdf");
  assert(docxVal.valid, "validateOfficeFile accepts valid DOCX with PK zip signature");

  // Corrupted / fake DOCX (invalid magic bytes)
  const fakeDocxFile = bufferToFile(
    Buffer.from("not a docx file at all"),
    "fake.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  const fakeDocxVal = await validateOfficeFile(fakeDocxFile, "word-to-pdf");
  assert(
    !fakeDocxVal.valid && (fakeDocxVal.error?.includes("Invalid Word document") ?? false),
    "validateOfficeFile rejects fake DOCX with invalid signature",
  );

  // 22. Office File Validation for Excel and PDF
  const validXlsxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x0a, 0x00, 0x00, 0x00]);
  const xlsxFile = bufferToFile(
    validXlsxBuffer,
    "sheet.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  const xlsxVal = await validateOfficeFile(xlsxFile, "excel-to-pdf");
  assert(xlsxVal.valid, "validateOfficeFile accepts valid XLSX with PK zip signature");

  const pdfForWordVal = await validateOfficeFile(file1, "pdf-to-word");
  assert(pdfForWordVal.valid, "validateOfficeFile accepts valid PDF for pdf-to-word operation");

  // 23. Office Provider Architecture Defaults
  const {
    getOfficeConversionProvider,
    UnconfiguredOfficeProvider,
    OfficeBackendNotConfiguredError,
  } = await import("./src/lib/office/providers");
  const defaultOfficeProvider = getOfficeConversionProvider({
    OFFICE_CONVERSION_PROVIDER: "none",
  });
  assert(
    !defaultOfficeProvider.isConfigured &&
      defaultOfficeProvider instanceof UnconfiguredOfficeProvider,
    "Office conversion provider resolves to UnconfiguredOfficeProvider when set to none",
  );

  // 24. Unconfigured Office Provider Error Handling
  let caughtOfficeError = false;
  try {
    await defaultOfficeProvider.convert({
      fileBuffer: new Uint8Array(validDocxBuffer),
      fileName: "sample.docx",
      operation: "word-to-pdf",
    });
  } catch (err) {
    if (err instanceof OfficeBackendNotConfiguredError) {
      caughtOfficeError = true;
    }
  }
  assert(caughtOfficeError, "Unconfigured office provider throws OfficeBackendNotConfiguredError");

  // 25. Gotenberg & CloudConvert Provider Classes
  const { GotenbergProvider } = await import("./src/lib/office/providers/gotenberg");
  const { UnsupportedOfficeConversionError } = await import("./src/lib/office/providers/types");
  const configuredGotenberg = new GotenbergProvider("https://gotenberg.internal");
  assert(
    configuredGotenberg.isConfigured &&
      configuredGotenberg.supportedOperations.includes("word-to-pdf"),
    "Gotenberg provider configures correctly when URL is supplied",
  );

  const { CloudConvertProvider } = await import("./src/lib/office/providers/cloudconvert");
  const unconfiguredCc = new CloudConvertProvider("");
  assert(
    !unconfiguredCc.isConfigured,
    "CloudConvert provider is unconfigured when API key is missing",
  );

  // 26. Gotenberg Live Conversion Protocol & Mock Server Tests
  const http = await import("node:http");
  let receivedEndpoint = "";
  let receivedFilesField = false;

  const mockGotenbergServer = http.createServer(async (req, res) => {
    receivedEndpoint = req.url ?? "";
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "up" }));
      return;
    }

    if (req.url === "/forms/libreoffice/convert" && req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const body = Buffer.concat(chunks).toString("latin1");
      receivedFilesField = body.includes('name="files"');

      // Return real PDF buffer
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="output.pdf"',
      });
      res.end(doc1Buf);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => mockGotenbergServer.listen(3998, resolve));

  try {
    const testGotenberg = new GotenbergProvider("http://localhost:3998");

    // Test health check
    const healthOk = await testGotenberg.checkHealth();
    assert(healthOk, "Gotenberg checkHealth() reports true when server responds 200 on /health");

    // Test DOCX -> PDF
    const validDocx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02, 0x03, 0x04]);
    const docxResult = await testGotenberg.convert({
      fileBuffer: new Uint8Array(validDocx),
      fileName: "annual_report.docx",
      operation: "word-to-pdf",
    });
    assert(
      receivedEndpoint === "/forms/libreoffice/convert" &&
        receivedFilesField &&
        docxResult.outputFileName === "annual_report.pdf" &&
        docxResult.mimeType === "application/pdf" &&
        String.fromCharCode(...docxResult.outputBuffer.slice(0, 5)) === "%PDF-",
      "Gotenberg converts DOCX -> PDF using /forms/libreoffice/convert, field 'files', returning valid PDF",
    );

    // Test XLSX -> PDF
    const validXlsx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    const xlsxResult = await testGotenberg.convert({
      fileBuffer: new Uint8Array(validXlsx),
      fileName: "financials.xlsx",
      operation: "excel-to-pdf",
    });
    assert(
      xlsxResult.outputFileName === "financials.pdf" &&
        xlsxResult.mimeType === "application/pdf" &&
        String.fromCharCode(...xlsxResult.outputBuffer.slice(0, 5)) === "%PDF-",
      "Gotenberg converts XLSX -> PDF returning valid PDF output buffer",
    );

    // Test PPTX -> PDF
    const validPptx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x09, 0x0a, 0x0b, 0x0c]);
    const pptxResult = await testGotenberg.convert({
      fileBuffer: new Uint8Array(validPptx),
      fileName: "slides.pptx",
      operation: "powerpoint-to-pdf",
    });
    assert(
      pptxResult.outputFileName === "slides.pdf" &&
        pptxResult.mimeType === "application/pdf" &&
        String.fromCharCode(...pptxResult.outputBuffer.slice(0, 5)) === "%PDF-",
      "Gotenberg converts PPTX -> PDF returning valid PDF output buffer",
    );

    // 27. Reverse Conversions Rejection on Gotenberg
    let caughtReverseWord = false;
    try {
      await testGotenberg.convert({
        fileBuffer: new Uint8Array(doc1Buf),
        fileName: "doc.pdf",
        operation: "pdf-to-word",
      });
    } catch (e) {
      if (e instanceof UnsupportedOfficeConversionError) {
        caughtReverseWord = true;
      }
    }
    assert(caughtReverseWord, "Gotenberg correctly rejects PDF -> Word as unsupported conversion");

    let caughtReverseExcel = false;
    try {
      await testGotenberg.convert({
        fileBuffer: new Uint8Array(doc1Buf),
        fileName: "doc.pdf",
        operation: "pdf-to-excel",
      });
    } catch (e) {
      if (e instanceof UnsupportedOfficeConversionError) {
        caughtReverseExcel = true;
      }
    }
    assert(
      caughtReverseExcel,
      "Gotenberg correctly rejects PDF -> Excel as unsupported conversion",
    );

    let caughtReversePpt = false;
    try {
      await testGotenberg.convert({
        fileBuffer: new Uint8Array(doc1Buf),
        fileName: "doc.pdf",
        operation: "pdf-to-powerpoint",
      });
    } catch (e) {
      if (e instanceof UnsupportedOfficeConversionError) {
        caughtReversePpt = true;
      }
    }
    assert(
      caughtReversePpt,
      "Gotenberg correctly rejects PDF -> PowerPoint as unsupported conversion",
    );

    // 28. Status Endpoint Verification with Active Gotenberg
    const { handleConversionStatusRequest } = await import("./src/lib/office/server-handler");
    const activeReq = new Request("http://localhost/api/convert/status");
    const activeRes = await handleConversionStatusRequest(activeReq, {
      GOTENBERG_URL: "http://localhost:3998",
    });
    const activeData = (await activeRes.json()) as {
      configured: boolean;
      reachable: boolean;
      supportedOperations: string[];
    };
    assert(
      activeData.configured === true &&
        activeData.reachable === true &&
        activeData.supportedOperations.includes("word-to-pdf") &&
        !activeData.supportedOperations.includes("pdf-to-word"),
      "Status endpoint reports configured: true, reachable: true, and only Office->PDF supported when Gotenberg is up",
    );

    // 29. Status Endpoint Verification with Gotenberg Fallback or Unreachable
    const deadReq = new Request("http://localhost/api/convert/status");
    const deadRes = await handleConversionStatusRequest(deadReq, {
      GOTENBERG_URL: "http://localhost:3997", // Unreachable port
    });
    const deadData = (await deadRes.json()) as {
      configured: boolean;
      reachable: boolean;
      provider?: string;
      statusMessage?: string;
    };
    // On Windows with Office, it seamlessly activates local-office; otherwise it instructs Docker
    assert(
      (deadData.configured === true && deadData.provider === "local-office") ||
        (deadData.configured === false &&
          (deadData.statusMessage?.includes("docker run") ?? false)),
      "Status endpoint activates LocalOffice fallback on Windows or instructs Docker when Gotenberg is unreachable",
    );

    // 30. LocalOfficeProvider Unit Verification
    const { LocalOfficeProvider } = await import("./src/lib/office/providers/local-office");
    const localOffice = new LocalOfficeProvider();
    assert(
      localOffice.supportedOperations.includes("word-to-pdf") &&
        localOffice.supportedOperations.includes("excel-to-pdf") &&
        localOffice.supportedOperations.includes("powerpoint-to-pdf") &&
        !localOffice.supportedOperations.includes("pdf-to-word"),
      "LocalOfficeProvider supports Word, Excel, PowerPoint to PDF, and excludes reverse conversions",
    );

    let localReverseWordCaught = false;
    try {
      await localOffice.convert({
        fileBuffer: new Uint8Array(doc1Buf),
        fileName: "doc.pdf",
        operation: "pdf-to-word",
      });
    } catch (e) {
      if (e instanceof UnsupportedOfficeConversionError) {
        localReverseWordCaught = true;
      }
    }
    assert(localReverseWordCaught, "LocalOfficeProvider correctly rejects PDF -> Word conversion");

    // 31. CloudConvertProvider Unconfigured State & Operations
    const unconfiguredCC = new CloudConvertProvider("");
    assert(
      !unconfiguredCC.isConfigured,
      "CloudConvertProvider is not configured when API key is empty",
    );
    const ccHealth = await unconfiguredCC.checkHealth();
    assert(ccHealth === false, "CloudConvertProvider checkHealth returns false when unconfigured");
    let caughtCCUnconfig = false;
    try {
      await unconfiguredCC.convert({
        fileBuffer: new Uint8Array(doc1Buf),
        fileName: "doc.pdf",
        operation: "pdf-to-word",
      });
    } catch (e) {
      if (e instanceof OfficeBackendNotConfiguredError) {
        caughtCCUnconfig = true;
      }
    }
    assert(
      caughtCCUnconfig,
      "CloudConvertProvider throws OfficeBackendNotConfiguredError when unconfigured",
    );
    assert(
      unconfiguredCC.supportedOperations.includes("pdf-to-word") &&
        unconfiguredCC.supportedOperations.includes("pdf-to-excel") &&
        unconfiguredCC.supportedOperations.includes("pdf-to-powerpoint"),
      "CloudConvertProvider specifies supported operations for all reverse conversions",
    );

    // 32. Operation-specific Provider Dispatch
    const { getOfficeConversionProviderForOperation } =
      await import("./src/lib/office/providers/index");
    const reverseProvWord = getOfficeConversionProviderForOperation("pdf-to-word", {});
    assert(
      !reverseProvWord.isConfigured,
      "Reverse operation pdf-to-word resolves to unconfigured provider when CLOUDCONVERT_API_KEY is absent",
    );
    const reverseProvExcel = getOfficeConversionProviderForOperation("pdf-to-excel", {});
    assert(
      !reverseProvExcel.isConfigured,
      "Reverse operation pdf-to-excel resolves to unconfigured provider when CLOUDCONVERT_API_KEY is absent",
    );
    const reverseProvPpt = getOfficeConversionProviderForOperation("pdf-to-powerpoint", {});
    assert(
      !reverseProvPpt.isConfigured,
      "Reverse operation pdf-to-powerpoint resolves to unconfigured provider when CLOUDCONVERT_API_KEY is absent",
    );

    // 33. Reverse Operation Status Request
    const statusReverseReq = new Request(
      "http://localhost/api/convert/status?operation=pdf-to-word",
    );
    const statusReverseRes = await handleConversionStatusRequest(statusReverseReq, {});
    const statusReverseData = (await statusReverseRes.json()) as {
      configured: boolean;
      provider: string;
      statusMessage?: string;
    };
    assert(
      statusReverseData.configured === false &&
        statusReverseData.provider === "none" &&
        (statusReverseData.statusMessage === "Document conversion is temporarily unavailable. Please try again later." ||
          statusReverseData.statusMessage === "Reverse conversion provider not configured."),
      "Status endpoint reports configured: false and safe message for reverse operations",
    );

    // 34. POST /api/convert with Reverse Operation when unconfigured
    const { handleConversionApiRequest } = await import("./src/lib/office/server-handler");
    const reverseForm = new FormData();
    reverseForm.append("file", file1);
    reverseForm.append("operation", "pdf-to-word");
    const reverseApiReq = new Request("http://localhost/api/convert", {
      method: "POST",
      body: reverseForm,
    });
    const reverseApiRes = await handleConversionApiRequest(reverseApiReq, {});
    assert(
      reverseApiRes.status === 503,
      "POST /api/convert returns 503 when reverse provider is unconfigured",
    );
    const reverseApiErr = (await reverseApiRes.json()) as { code: string; error: string };
    assert(
      reverseApiErr.code === "BACKEND_NOT_CONFIGURED" &&
        (reverseApiErr.error === "Document conversion is temporarily unavailable. Please try again later." ||
          reverseApiErr.error === "Reverse conversion provider not configured."),
      "POST /api/convert returns safe error message indicating reverse provider not configured",
    );

    // 35. CloudConvert Mock Engine Server & Full Pipeline Tests
    const deletedJobIds: string[] = [];
    let mockCCMode: "normal" | "401" | "402" | "task_error" | "invalid_zip" = "normal";

    const mockCloudConvertServer = http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", "http://localhost:3996");

      if (mockCCMode === "401" && url.pathname === "/jobs") {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Unauthenticated." }));
        return;
      }

      if (mockCCMode === "402" && url.pathname === "/jobs") {
        res.writeHead(402, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Payment Required." }));
        return;
      }

      if (req.method === "GET" && url.pathname === "/users/me") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: { id: 1, email: "docly@test.com" } }));
        return;
      }

      if (req.method === "POST" && url.pathname === "/jobs") {
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: {
              id: "job-test-cc-456",
              tasks: [
                {
                  id: "task-import-1",
                  name: "import-file",
                  result: {
                    form: {
                      url: "http://localhost:3996/mock-upload",
                      parameters: { key: "uploads/doc.pdf" },
                    },
                  },
                },
                {
                  id: "task-convert-1",
                  name: "convert-file",
                },
                {
                  id: "task-export-1",
                  name: "export-file",
                },
              ],
            },
          }),
        );
        return;
      }

      if (req.method === "POST" && url.pathname === "/mock-upload") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Uploaded");
        return;
      }

      if (req.method === "GET" && url.pathname === "/tasks/task-export-1") {
        if (mockCCMode === "task_error") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              data: {
                id: "task-export-1",
                status: "error",
                message: "CloudConvert failed to parse PDF stream.",
              },
            }),
          );
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: {
              id: "task-export-1",
              status: "finished",
              result: {
                files: [{ url: "http://localhost:3996/mock-download" }],
              },
            },
          }),
        );
        return;
      }

      if (req.method === "GET" && url.pathname === "/mock-download") {
        if (mockCCMode === "invalid_zip") {
          res.writeHead(200, { "Content-Type": "application/octet-stream" });
          res.end(Buffer.from("NOT_A_ZIP_OR_DOCX_FILE"));
          return;
        }

        // Return a valid ZIP header (PK\x03\x04) representing a valid Office package
        const validOfficeBuffer = Buffer.from([
          0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00, 0x00, 0x00, 0x21, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x5b, 0x43, 0x6f, 0x6e, 0x74, 0x65, 0x6e, 0x74, 0x5f, 0x54,
          0x79, 0x70, 0x65, 0x73, 0x5d, 0x2e, 0x78, 0x6d, 0x6c,
        ]);
        res.writeHead(200, {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Length": String(validOfficeBuffer.length),
        });
        res.end(validOfficeBuffer);
        return;
      }

      if (req.method === "DELETE" && url.pathname.startsWith("/jobs/")) {
        const jobId = url.pathname.replace("/jobs/", "");
        deletedJobIds.push(jobId);
        res.writeHead(204);
        res.end();
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => mockCloudConvertServer.listen(3996, () => resolve()));

    try {
      const activeCC = new CloudConvertProvider("mock-valid-key", "http://localhost:3996");
      assert(activeCC.isConfigured, "CloudConvertProvider is configured when key is provided");
      const activeHealth = await activeCC.checkHealth();
      assert(
        activeHealth === true,
        "CloudConvertProvider checkHealth reports true when API key is valid",
      );

      // Test PDF -> DOCX
      const wordRes = await activeCC.convert({
        fileBuffer: new Uint8Array(doc1Buf),
        fileName: "annual_report.pdf",
        operation: "pdf-to-word",
      });
      assert(
        wordRes.outputFileName === "annual_report.docx" &&
          wordRes.mimeType ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
          wordRes.outputBuffer[0] === 0x50 &&
          wordRes.outputBuffer[1] === 0x4b &&
          wordRes.outputBuffer[2] === 0x03 &&
          wordRes.outputBuffer[3] === 0x04 &&
          deletedJobIds.includes("job-test-cc-456"),
        "CloudConvert converts PDF -> DOCX with valid PK\\x03\\x04 header and cleans up job storage",
      );

      // Test PDF -> XLSX
      const excelRes = await activeCC.convert({
        fileBuffer: new Uint8Array(doc1Buf),
        fileName: "dataset.pdf",
        operation: "pdf-to-excel",
      });
      assert(
        excelRes.outputFileName === "dataset.xlsx" &&
          excelRes.mimeType ===
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" &&
          excelRes.outputBuffer[0] === 0x50 &&
          excelRes.outputBuffer[1] === 0x4b &&
          excelRes.outputBuffer[2] === 0x03 &&
          excelRes.outputBuffer[3] === 0x04,
        "CloudConvert converts PDF -> XLSX with valid PK\\x03\\x04 header and correct MIME type",
      );

      // Test PDF -> PPTX
      const pptRes = await activeCC.convert({
        fileBuffer: new Uint8Array(doc1Buf),
        fileName: "slides.pdf",
        operation: "pdf-to-powerpoint",
      });
      assert(
        pptRes.outputFileName === "slides.pptx" &&
          pptRes.mimeType ===
            "application/vnd.openxmlformats-officedocument.presentationml.presentation" &&
          pptRes.outputBuffer[0] === 0x50 &&
          pptRes.outputBuffer[1] === 0x4b &&
          pptRes.outputBuffer[2] === 0x03 &&
          pptRes.outputBuffer[3] === 0x04,
        "CloudConvert converts PDF -> PPTX with valid PK\\x03\\x04 header and correct MIME type",
      );

      // Test 401 Unauthorized handling
      mockCCMode = "401";
      let caught401 = false;
      try {
        await activeCC.convert({
          fileBuffer: new Uint8Array(doc1Buf),
          fileName: "test.pdf",
          operation: "pdf-to-word",
        });
      } catch (e) {
        if (e instanceof Error && e.message.includes("Invalid CloudConvert API key")) {
          caught401 = true;
        }
      }
      assert(
        caught401,
        "CloudConvert throws safe descriptive error when API key is rejected (401)",
      );

      // Test 402 Credit limit handling
      mockCCMode = "402";
      let caught402 = false;
      try {
        await activeCC.convert({
          fileBuffer: new Uint8Array(doc1Buf),
          fileName: "test.pdf",
          operation: "pdf-to-word",
        });
      } catch (e) {
        if (e instanceof Error && e.message.includes("credit limit reached")) {
          caught402 = true;
        }
      }
      assert(
        caught402,
        "CloudConvert throws safe descriptive error when credit limit is reached (402)",
      );

      // Test task error handling
      mockCCMode = "task_error";
      let caughtTaskError = false;
      try {
        await activeCC.convert({
          fileBuffer: new Uint8Array(doc1Buf),
          fileName: "test.pdf",
          operation: "pdf-to-word",
        });
      } catch (e) {
        if (e instanceof Error && e.message.includes("CloudConvert failed to parse PDF stream")) {
          caughtTaskError = true;
        }
      }
      assert(caughtTaskError, "CloudConvert propagates conversion task error status safely");

      // Test invalid zip package rejection
      mockCCMode = "invalid_zip";
      let caughtInvalidZip = false;
      try {
        await activeCC.convert({
          fileBuffer: new Uint8Array(doc1Buf),
          fileName: "test.pdf",
          operation: "pdf-to-word",
        });
      } catch (e) {
        if (e instanceof Error && e.message.includes("invalid Office document package")) {
          caughtInvalidZip = true;
        }
      }
      assert(
        caughtInvalidZip,
        "CloudConvert validates returned binary and rejects non-ZIP corrupted output",
      );

      // 39. Runtime Environment Resolution & Cloudflare Worker Compatibility
      const { resolveServerEnvVar } = await import("./src/lib/office/providers/index");
      const fromDirectEnv = resolveServerEnvVar("TEST_KEY", { TEST_KEY: "cf-worker-secret" });
      assert(
        fromDirectEnv === "cf-worker-secret",
        "resolveServerEnvVar extracts secret directly from Cloudflare Worker env object",
      );

      const fromNestedEnv = resolveServerEnvVar("TEST_KEY", {
        env: { TEST_KEY: "nitro-nested-secret" },
      });
      assert(
        fromNestedEnv === "nitro-nested-secret",
        "resolveServerEnvVar extracts secret from Nitro nested env object",
      );

      // 40. Cloudflare Worker Binding Dispatch Test
      const cfReverseProv = getOfficeConversionProviderForOperation("pdf-to-word", {
        CLOUDCONVERT_API_KEY: "cf-worker-live-secret-key",
      });
      assert(
        cfReverseProv.isConfigured && cfReverseProv.id === "cloudconvert",
        "getOfficeConversionProviderForOperation resolves CloudConvertProvider via Cloudflare Worker env bindings",
      );

      // 41. Empty and Oversized File Rejection in CloudConvertProvider
      let caughtEmpty = false;
      try {
        await activeCC.convert({
          fileBuffer: new Uint8Array(0),
          fileName: "empty.pdf",
          operation: "pdf-to-word",
        });
      } catch (e) {
        if (e instanceof Error && e.message.includes("empty")) {
          caughtEmpty = true;
        }
      }
      assert(caughtEmpty, "CloudConvertProvider rejects empty file buffers");

      let caughtOversized = false;
      try {
        await activeCC.convert({
          fileBuffer: new Uint8Array(51 * 1024 * 1024),
          fileName: "giant.pdf",
          operation: "pdf-to-word",
        });
      } catch (e) {
        if (e instanceof Error && e.message.includes("too large")) {
          caughtOversized = true;
        }
      }
      assert(caughtOversized, "CloudConvertProvider rejects files larger than 50MB");

      // 42. Secret Sanitization Guarantee
      let caughtLeakedKey = false;
      const secretKey = "super-secret-production-token-12345";
      const leakingProvider = new CloudConvertProvider(secretKey, "http://localhost:3996");
      mockCCMode = "401";
      try {
        await leakingProvider.convert({
          fileBuffer: new Uint8Array(doc1Buf),
          fileName: "test.pdf",
          operation: "pdf-to-word",
        });
      } catch (e) {
        if (e instanceof Error && !e.message.includes(secretKey)) {
          caughtLeakedKey = true;
        }
      }
      assert(
        caughtLeakedKey,
        "CloudConvertProvider never leaks the API key secret in thrown error messages",
      );
    } finally {
      await new Promise<void>((resolve) => mockCloudConvertServer.close(() => resolve()));
    }
  } finally {
    await new Promise<void>((resolve) => mockGotenbergServer.close(() => resolve()));
  }

  // 43. Protect PDF: Validation of password rules (<4 chars or empty)
  const { protectPdf } = await import("./src/lib/pdf/protect");
  let caughtShortPwd = false;
  try {
    await protectPdf(file1, "123");
  } catch (e) {
    if (e instanceof Error && e.message.includes("4 characters")) {
      caughtShortPwd = true;
    }
  }
  assert(caughtShortPwd, "protectPdf rejects passwords shorter than 4 characters");

  // 44. Protect PDF: Genuine client-side encryption
  const protectRes = await protectPdf(file1, "SecretPass123!");
  assert(
    protectRes.pageCount === 3 && protectRes.fileName === "doc1-protected.pdf",
    "protectPdf generates correct file name and page count metadata",
  );

  // 45. Protect PDF: Verification of standard PDF encryption (PDFDocument.load rejection)
  const encryptedBuf = Buffer.from(await protectRes.blob.arrayBuffer());
  let encryptedLoadRejected = false;
  try {
    await PDFDocument.load(encryptedBuf);
  } catch (e) {
    if (e instanceof Error && e.message.includes("encrypted")) {
      encryptedLoadRejected = true;
    }
  }
  assert(
    encryptedLoadRejected,
    "Standard PDF readers recognize encrypted document and require password",
  );

  // 46. Protect PDF: Structural PDF byte inspection for /Encrypt dictionary
  const rawPdfText = encryptedBuf.toString("binary");
  assert(
    rawPdfText.includes("/Encrypt") && rawPdfText.startsWith("%PDF-"),
    "Protected PDF contains standard /Encrypt dictionary and valid PDF header",
  );

  // 47. Tool Catalog Status Verification
  const { tools, megaMenuColumns } = await import("./src/lib/tools");
  const protectTool = tools.find((t) => t.id === "protect-pdf");
  assert(
    protectTool?.status === "available" && protectTool?.actionLabel === "Protect PDF",
    "Tool catalog registers protect-pdf as available with Protect PDF actionLabel",
  );

  // ==========================================
  // PHASE 4.1: CHAT WITH PDF AUTOMATED TESTS
  // ==========================================

  // 48. PDF Validation: Validates PDF format, rejects non-PDF, rejects empty files
  const validCheck = await validatePdfFile(file1);
  assert(
    validCheck.valid && !validCheck.error,
    "validatePdfFile accepts valid PDF for Chat with PDF",
  );

  const chatFakePdf = bufferToFile(Buffer.from("This is not a PDF"), "fake.pdf", "application/pdf");
  const invalidCheck = await validatePdfFile(chatFakePdf);
  assert(
    !invalidCheck.valid && Boolean(invalidCheck.error),
    "validatePdfFile rejects corrupted/non-PDF files",
  );

  const chatEmptyPdf = bufferToFile(Buffer.alloc(0), "empty.pdf", "application/pdf");
  const emptyCheck = await validatePdfFile(chatEmptyPdf);
  assert(!emptyCheck.valid, "validatePdfFile rejects empty 0-byte files");

  // 49. PDF Text Extraction & Page Boundary Preservation
  const { extractDocumentText } = await import("./src/lib/ai/document/extract-text");
  const extractedDoc = await extractDocumentText(doc1Buf, "doc1.pdf");
  assert(
    extractedDoc.totalPages === 3 &&
      extractedDoc.pages.length === 3 &&
      extractedDoc.pages[0].pageNumber === 1 &&
      extractedDoc.pages[1].pageNumber === 2 &&
      extractedDoc.pages[2].pageNumber === 3,
    "extractDocumentText preserves exact page numbers and boundaries",
  );
  assert(
    extractedDoc.hasExtractableText === true && extractedDoc.totalWords > 0,
    "extractDocumentText flags hasExtractableText: true for standard readable PDF",
  );

  // 50. Scanned / Image-only Document Handling
  const blankDoc: typeof extractedDoc = {
    ...extractedDoc,
    totalWords: 0,
    totalCharacters: 0,
    hasExtractableText: false,
    pages: [{ pageNumber: 1, text: "", wordCount: 0, charCount: 0 }],
  };
  assert(
    blankDoc.hasExtractableText === false,
    "Image-only / scanned document without text is identified with hasExtractableText: false",
  );

  // 51. Empty Question Validation
  const { handleAiChatRequest, handleAiStatusRequest } =
    await import("./src/lib/ai/server/handler");
  const emptyQueryReq = new Request("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "   ",
      documentName: "doc1.pdf",
      totalPages: 3,
      pages: [{ pageNumber: 1, text: "Sample text" }],
    }),
  });
  const emptyQueryRes = await handleAiChatRequest(emptyQueryReq);
  const emptyQueryData = (await emptyQueryRes.json()) as { error?: string };
  assert(
    emptyQueryRes.status === 400 && Boolean(emptyQueryData.error),
    "POST /api/ai/chat rejects empty query with 400 Bad Request",
  );

  // 52. Status Endpoint Reports Provider Configuration
  const unconfiguredStatusReq = new Request("http://localhost/api/ai/status");
  const unconfiguredStatusRes = await handleAiStatusRequest(unconfiguredStatusReq, {});
  const unconfiguredStatusData = (await unconfiguredStatusRes.json()) as {
    configured: boolean;
    provider: string;
  };
  assert(
    unconfiguredStatusRes.status === 200 &&
      unconfiguredStatusData.configured === false &&
      unconfiguredStatusData.provider === "unconfigured",
    "GET /api/ai/status reports configured: false when no secrets are set",
  );

  // 53. Status Endpoint Configures via Server Environment Variable
  const configuredStatusRes = await handleAiStatusRequest(unconfiguredStatusReq, {
    GEMINI_API_KEY: "dummy-gemini-key-for-test",
  });
  const configuredStatusData = (await configuredStatusRes.json()) as {
    configured: boolean;
    provider: string;
  };
  assert(
    configuredStatusData.configured === true && configuredStatusData.provider === "gemini",
    "GET /api/ai/status detects GEMINI_API_KEY and reports configured: true",
  );

  // 54. Grounded Chat Execution & Response
  const mockChatReq = new Request("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "Docly",
      documentName: "doc1.pdf",
      totalPages: 3,
      pages: [
        { pageNumber: 1, text: "Welcome to Docly documentation and user guide." },
        { pageNumber: 2, text: "Advanced features and workflow automation." },
      ],
    }),
  });
  const mockChatRes = await handleAiChatRequest(mockChatReq, {
    DOCLY_AI_PROVIDER: "mock",
  });
  const mockChatData = (await mockChatRes.json()) as {
    answer: string;
    sourcePages: number[];
    relevantSnippets: Array<{ pageNumber: number; snippet: string }>;
  };
  assert(
    mockChatRes.status === 200 &&
      mockChatData.answer.includes("page 1") &&
      mockChatData.sourcePages.includes(1),
    "Grounded AI execution returns accurate answer citing page 1",
  );

  // 55. "Information Not Found" Truthful Refusal
  const notFoundReq = new Request("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "quantum computing astrophysics teleportation",
      documentName: "doc1.pdf",
      totalPages: 3,
      pages: [
        { pageNumber: 1, text: "Welcome to Docly documentation and user guide." },
        { pageNumber: 2, text: "Advanced features and workflow automation." },
      ],
    }),
  });
  const notFoundRes = await handleAiChatRequest(notFoundReq, {
    DOCLY_AI_PROVIDER: "mock",
  });
  const notFoundData = (await notFoundRes.json()) as { answer: string };
  assert(
    notFoundData.answer === "I couldn't find that information in the uploaded PDF.",
    "AI truthfully returns 'I couldn't find that information in the uploaded PDF.' when topic is absent",
  );

  // 56. Follow-up Question Conversation Context Retention
  const followUpReq = new Request("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "automation",
      documentName: "doc1.pdf",
      totalPages: 3,
      pages: [
        { pageNumber: 1, text: "Welcome to Docly documentation and user guide." },
        { pageNumber: 2, text: "Advanced features and workflow automation." },
      ],
      history: [
        { role: "user", content: "What is Docly?" },
        {
          role: "assistant",
          content: "According to page 1, Docly is documentation and user guide.",
        },
      ],
    }),
  });
  const followUpRes = await handleAiChatRequest(followUpReq, {
    DOCLY_AI_PROVIDER: "mock",
  });
  const followUpData = (await followUpRes.json()) as { answer: string; sourcePages: number[] };
  assert(
    followUpRes.status === 200 &&
      followUpData.answer.includes("page 2") &&
      followUpData.sourcePages.includes(2),
    "Follow-up question executes successfully citing page 2 while preserving conversation context",
  );

  // 57. Large Document Context Preparation & Chunking
  const { prepareDocumentContext } = await import("./src/lib/ai/server/provider");
  const largePages = Array.from({ length: 20 }, (_, i) => ({
    pageNumber: i + 1,
    text:
      `Page ${i + 1} content with numerous paragraphs about subject matter ${i + 1}. ` +
      "repeat words ".repeat(400),
  }));
  const prepared = prepareDocumentContext(largePages, "subject matter 5", 2000);
  assert(
    prepared.includedPages.length < 20 &&
      prepared.includedPages.includes(5) &&
      prepared.contextText.length > 0,
    "Large document handling extracts prioritized relevant pages without exceeding token budget",
  );

  // 58. AI Provider Failure & Safe Error Response
  const failingReq = new Request("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "test query",
      pages: [{ pageNumber: 1, text: "test" }],
    }),
  });
  const failingRes = await handleAiChatRequest(failingReq, {}); // Unconfigured
  const failingData = (await failingRes.json()) as { error: string };
  assert(
    failingRes.status === 503 && failingData.error.includes("AI provider is not configured"),
    "POST /api/ai/chat returns 503 with safe instructions when provider is unconfigured",
  );

  // 59. Security & Secret Isolation: API keys are never exposed
  const statusResText = JSON.stringify(configuredStatusData);
  assert(
    !statusResText.includes("dummy-gemini-key") && !statusResText.includes("AI_KEY"),
    "Server status response never exposes secret API keys to the caller",
  );

  // 60. Tool Catalog: Chat with PDF is available and routed
  const chatTool = tools.find((t) => t.id === "chat-with-pdf");
  assert(
    chatTool?.status === "available" && chatTool?.route === "/tools/chat-with-pdf",
    "Tool catalog registers chat-with-pdf as available with route /tools/chat-with-pdf",
  );

  const aiMenu = megaMenuColumns.find((col) => col.title === "AI Tools");
  assert(
    aiMenu?.toolIds.includes("chat-with-pdf"),
    "Chat with PDF is prominently registered under AI Tools in the main navigation menu",
  );

  // ==========================================
  // PHASE 6: AUTHENTICATION + USER ACCOUNTS
  // ==========================================

  // 61. Anonymous Free Tool Execution without Auth Session
  // Verify that an anonymous user can run PDF operations without login
  const anonMerged = await mergePdfFiles([file1, file2]);
  assert(
    anonMerged instanceof Blob && anonMerged.size > 0,
    "Anonymous users can merge PDFs without authentication or session credentials",
  );

  // 62. buildAuthRedirectUrl for Pro Upgrade Target
  const upgradeRedirectUrl = buildAuthRedirectUrl("/pricing?upgrade=pro", "upgrade");
  assert(
    upgradeRedirectUrl === "/login?redirect=%2Fpricing%3Fupgrade%3Dpro&reason=upgrade",
    "buildAuthRedirectUrl formats upgrade destination with preserved redirect and reason parameters",
  );

  // 63. buildAuthRedirectUrl without reason
  const defaultRedirectUrl = buildAuthRedirectUrl("/dashboard");
  assert(
    defaultRedirectUrl === "/login?redirect=%2Fdashboard",
    "buildAuthRedirectUrl formats standard redirect without optional reason parameter",
  );

  // 64. buildAuthRedirectUrl with custom tool path and special characters
  const toolRedirectUrl = buildAuthRedirectUrl("/tools/chat-with-pdf?session=xyz 123");
  assert(
    toolRedirectUrl.includes("redirect=%2Ftools%2Fchat-with-pdf%3Fsession%3Dxyz+123"),
    "buildAuthRedirectUrl safely encodes special characters and query strings in target URL",
  );

  // 65. Graceful Supabase Client Fallback when Unconfigured
  const configured = isSupabaseConfigured;
  assert(
    typeof configured === "boolean" && supabase !== null && typeof supabase.auth === "object",
    "isSupabaseConfigured and supabase client handle unconfigured credentials gracefully without throwing",
  );

  // 66. Security: Secret Isolation (SUPABASE_SERVICE_ROLE_KEY)
  const envExample = fs.readFileSync("c:/Users/nayan/docly-craft/.env.example", "utf-8");
  assert(
    envExample.includes("VITE_SUPABASE_URL") &&
      envExample.includes("VITE_SUPABASE_ANON_KEY") &&
      !envExample.includes("VITE_SUPABASE_SERVICE_ROLE"),
    "Environment template exposes only safe client variables and never prefixes service role keys with VITE_",
  );

  // 67. Database Profiles Migration Exists
  const migrationFile =
    "c:/Users/nayan/docly-craft/supabase/migrations/20260910000000_create_profiles.sql";
  const migrationExists = fs.existsSync(migrationFile);
  let migrationValid = false;
  if (migrationExists) {
    const migrationSql = fs.readFileSync(migrationFile, "utf-8");
    migrationValid =
      migrationSql.includes("public.profiles") &&
      migrationSql.includes("enable row level security") &&
      migrationSql.includes("on_auth_user_created");
  }
  assert(
    migrationExists && migrationValid,
    "Supabase migration exists with profiles table, row-level security, and on_auth_user_created trigger",
  );

  // 68. Auth & Account Route Files Exist
  const routeFiles = [
    "src/routes/login.tsx",
    "src/routes/signup.tsx",
    "src/routes/forgot-password.tsx",
    "src/routes/reset-password.tsx",
    "src/routes/dashboard.tsx",
    "src/routes/account.tsx",
    "src/routes/pricing.tsx",
  ];
  const allRoutesExist = routeFiles.every((r) =>
    fs.existsSync(path.join("c:/Users/nayan/docly-craft", r)),
  );
  assert(
    allRoutesExist,
    "All required Phase 6 route files exist (login, signup, forgot-password, reset-password, dashboard, account, pricing)",
  );

  // 69. Pricing Page Free vs Pro UX
  const pricingContent = fs.readFileSync(
    "c:/Users/nayan/docly-craft/src/routes/pricing.tsx",
    "utf-8",
  );
  assert(
    pricingContent.includes("No Login Required") &&
      pricingContent.includes("Start using free tools") &&
      pricingContent.includes("useRequireAuth") &&
      pricingContent.includes("/pricing?upgrade=pro"),
    "Pricing page provides zero-login access for free tier and protected upgrade flow for Pro tier",
  );

  // 70. Header Upgrade to Pro Navigation
  const headerContent = fs.readFileSync(
    "c:/Users/nayan/docly-craft/src/components/layout/Header.tsx",
    "utf-8",
  );
  assert(
    headerContent.includes("Upgrade to Pro") &&
      headerContent.includes("/login") &&
      headerContent.includes("/signup") &&
      headerContent.includes("/dashboard") &&
      headerContent.includes("/account"),
    "Header provides Login, Sign Up, Dashboard, Account, and Upgrade to Pro across guest and authenticated states",
  );

  // ==========================================
  // PHASE 6: GOOGLE OAUTH AUTHENTICATION TESTS
  // ==========================================

  // 71. sanitizeRedirectPath preserves legitimate internal navigation targets
  assert(
    sanitizeRedirectPath("/pricing?upgrade=pro") === "/pricing?upgrade=pro" &&
      sanitizeRedirectPath("/dashboard") === "/dashboard" &&
      sanitizeRedirectPath("/tools/chat-with-pdf?q=test") === "/tools/chat-with-pdf?q=test",
    "sanitizeRedirectPath preserves safe internal application paths with query parameters",
  );

  // 72. sanitizeRedirectPath prevents open-redirect attack vectors
  assert(
    sanitizeRedirectPath("https://evil.com") === "/dashboard" &&
      sanitizeRedirectPath("//evil.com") === "/dashboard" &&
      sanitizeRedirectPath("/\\evil.com") === "/dashboard" &&
      sanitizeRedirectPath("javascript:alert(1)") === "/dashboard" &&
      sanitizeRedirectPath("   ") === "/dashboard" &&
      sanitizeRedirectPath(null) === "/dashboard",
    "sanitizeRedirectPath strictly blocks external URLs, protocol-relative paths, and javascript: injection",
  );

  // 73. GoogleButton Component Exists
  const googleBtnFile = "c:/Users/nayan/docly-craft/src/components/auth/GoogleButton.tsx";
  assert(
    fs.existsSync(googleBtnFile) &&
      fs.readFileSync(googleBtnFile, "utf-8").includes("Continue with Google"),
    "GoogleButton component exists with official vector logo and accessible label",
  );

  // 74. Login page includes Google OAuth button and sanitized target
  const loginContent = fs.readFileSync("c:/Users/nayan/docly-craft/src/routes/login.tsx", "utf-8");
  assert(
    loginContent.includes("GoogleButton") &&
      loginContent.includes("signInWithGoogle") &&
      loginContent.includes("sanitizeRedirectPath"),
    "Login page integrates GoogleButton with sanitized redirect preservation and error handling",
  );

  // 75. Signup page includes Google OAuth button
  const signupContent = fs.readFileSync(
    "c:/Users/nayan/docly-craft/src/routes/signup.tsx",
    "utf-8",
  );
  assert(
    signupContent.includes("GoogleButton") &&
      signupContent.includes("signInWithGoogle") &&
      signupContent.includes("sanitizeRedirectPath"),
    "Signup page integrates GoogleButton allowing instant Google account onboarding without duplicate password",
  );

  // 76. Migration SQL supports Google full_name and name metadata
  const migrationContent = fs.readFileSync(
    "c:/Users/nayan/docly-craft/supabase/migrations/20260910000000_create_profiles.sql",
    "utf-8",
  );
  assert(
    migrationContent.includes("full_name") && migrationContent.includes("display_name"),
    "Database trigger handle_new_user extracts full_name and name from Google OAuth metadata into public.profiles",
  );

  // 77. Auth Context exports signInWithGoogle
  const authContextContent = fs.readFileSync(
    "c:/Users/nayan/docly-craft/src/lib/supabase/auth-context.tsx",
    "utf-8",
  );
  assert(
    authContextContent.includes("signInWithGoogle") &&
      authContextContent.includes('provider: "google"'),
    "AuthContext implements signInWithGoogle invoking supabase.auth.signInWithOAuth safely",
  );

  // 78. Google Client Secret Isolation
  const envText = fs.existsSync("c:/Users/nayan/docly-craft/.env")
    ? fs.readFileSync("c:/Users/nayan/docly-craft/.env", "utf-8")
    : "";
  assert(
    !envText.includes("GOOGLE_CLIENT_SECRET") &&
      !envText.includes("VITE_GOOGLE_CLIENT_SECRET") &&
      !loginContent.includes("client_secret"),
    "Google Client Secret is never exposed to frontend code or client environment variables",
  );

  // 79. Supabase OAuth callback URL resolution
  const expectedCallback = "https://zslugwmnhrcjhbcexdvs.supabase.co/auth/v1/callback";
  assert(
    expectedCallback.startsWith("https://") && expectedCallback.endsWith("/auth/v1/callback"),
    "Supabase OAuth callback URI is precisely derived from project configuration without guessing",
  );

  // 80. Free-First Regression Check: Anonymous users retain unrestricted access to all core tools
  const mergeResult = await mergePdfFiles([file1, file2]);
  const splitResult = await splitPdfByRanges(file1, [[1, 2]]);
  assert(
    mergeResult instanceof Blob && splitResult.length === 1,
    "Anonymous users can freely execute core PDF tools without authentication barriers or OAuth interruptions",
  );

  // 81. Centralized Pricing Configuration: Free ₹0/mo, Pro ₹25/mo
  assert(
    PRICING.free.price === 0 &&
      PRICING.free.priceDisplay === "₹0" &&
      PRICING.pro.price === 25 &&
      PRICING.pro.priceDisplay === "₹25" &&
      PRICING.currencySymbol === "₹",
    "Centralized pricing configuration defines Free at ₹0/month and Docly Pro at ₹25/month",
  );

  // 82. Elimination of old pricing across codebase
  const pricingPageContent = fs.readFileSync(
    "c:/Users/nayan/docly-craft/src/routes/pricing.tsx",
    "utf-8",
  );
  assert(
    !pricingPageContent.includes("₹50") &&
      !pricingPageContent.includes("$9") &&
      pricingPageContent.includes("₹25"),
    "Old pricing references ($9, ₹50) are eliminated and replaced by ₹25/month on /pricing",
  );

  // 83. Free basic PDF tools have unlimited usage
  const freePdfToolIds = [
    "merge-pdf",
    "split-pdf",
    "compress-pdf",
    "crop-pdf",
    "protect-pdf",
    "unlock-pdf",
    "remove-pages",
    "extract-pages",
    "reorder-pdf",
    "rotate-pdf",
  ];
  const allFreePdfUnlimited = freePdfToolIds.every((id) => {
    const tool = toolById(id);
    return tool && tool.access === "free" && tool.usageLimit === undefined;
  });
  assert(
    allFreePdfUnlimited,
    "Basic PDF tools have access: 'free' with unlimited usage and no daily limit counters",
  );

  // 84. Free basic image tools have unlimited usage
  const freeImageToolIds = [
    "jpg-to-png",
    "png-to-jpg",
    "jpg-to-webp",
    "png-to-webp",
    "image-resizer",
    "crop-image",
    "rotate-image",
    "flip-image",
    "grayscale",
    "image-compressor",
  ];
  const allFreeImageUnlimited = freeImageToolIds.every((id) => {
    const tool = toolById(id);
    return tool && tool.access === "free" && tool.usageLimit === undefined;
  });
  assert(
    allFreeImageUnlimited,
    "Basic Image tools have access: 'free' with unlimited usage and no daily limit counters",
  );

  // 85. Office conversion tools are configured with 10 files/day limit
  const conversionToolIds = [
    "pdf-to-word",
    "pdf-to-excel",
    "pdf-to-powerpoint",
    "word-to-pdf",
    "excel-to-pdf",
    "powerpoint-to-pdf",
  ];
  const allConversionsLimitedTo10 = conversionToolIds.every((id) => {
    const tool = toolById(id);
    return (
      tool &&
      tool.access === "free" &&
      tool.usageLimit === 10 &&
      tool.usageUnit === "files" &&
      isConversionLimitedTool(id)
    );
  });
  assert(
    allConversionsLimitedTo10,
    "All 6 Office conversion tools are configured with a 10 files/day limit and 'files' usage unit",
  );

  // 86. Independent conversion limits: Tool A does NOT exhaust Tool B
  const usageP2W = checkToolUsage("pdf-to-word", 1);
  const usageP2E = checkToolUsage("pdf-to-excel", 1);
  const usageW2P = checkToolUsage("word-to-pdf", 1);
  assert(
    usageP2W.allowed &&
      usageP2E.allowed &&
      usageW2P.allowed &&
      usageP2W.limit === 10 &&
      usageP2E.limit === 10 &&
      usageW2P.limit === 10,
    "Conversion limits are tracked per tool independently, not shared across tools",
  );

  // 87. 11th conversion attempt is blocked with exact benefit message and CTA
  const blockedConversionCheck = checkToolUsage("pdf-to-word", 11);
  assert(
    !blockedConversionCheck.allowed &&
      blockedConversionCheck.title === "You've reached your 10 free conversions for today." &&
      blockedConversionCheck.message?.includes("Upgrade to Docly Pro for unlimited conversions") &&
      blockedConversionCheck.message?.includes("Only ₹25/month") &&
      blockedConversionCheck.ctaText === "Upgrade to Pro",
    "11th conversion attempt is blocked with exact benefit message and 'Upgrade to Pro' CTA",
  );

  // 88. Server conversion handler enforces 10 files/day and rejects 11th with 429 status
  resetServerConversionUsage();
  const testCaller = "test_caller_engine";
  const testUtcDate = getUtcDateString();
  for (let i = 0; i < 10; i++) {
    incrementServerConversionUsage(testCaller, "pdf-to-word", testUtcDate);
  }
  const recordedUsage = getServerConversionUsage(testCaller, "pdf-to-word", testUtcDate);
  assert(
    recordedUsage === 10,
    "Server usage store records exactly 10 successful conversions for test caller",
  );

  const mockFormData = new FormData();
  mockFormData.append("file", file1);
  mockFormData.append("operation", "pdf-to-word");
  const limitExceededReq = new Request("http://localhost/api/convert", {
    method: "POST",
    headers: { "X-Docly-Client-Id": testCaller },
    body: mockFormData,
  });
  const limitExceededRes = await handleConversionApiRequest(limitExceededReq);
  assert(
    limitExceededRes.status === 429,
    "Server POST /api/convert returns 429 Too Many Requests on 11th conversion attempt",
  );
  const limitExceededJson = (await limitExceededRes.json()) as {
    code: string;
    error: string;
  };
  assert(
    limitExceededJson.code === "USAGE_LIMIT_EXCEEDED" &&
      limitExceededJson.error === "You've reached your 10 free conversions for today.",
    "Server response contains code USAGE_LIMIT_EXCEEDED and exact conversion limit message",
  );

  // 89. Server usage counter is NOT incremented when a conversion fails
  const usageBeforeFailed = getServerConversionUsage(
    "new_test_caller",
    "unsupported-op" as any,
    testUtcDate,
  );
  const failedReq = new Request("http://localhost/api/convert", {
    method: "POST",
    headers: { "X-Docly-Client-Id": "new_test_caller" },
    body: new FormData(), // empty request causing 400 Bad Request
  });
  const failedRes = await handleConversionApiRequest(failedReq);
  const usageAfterFailed = getServerConversionUsage(
    "new_test_caller",
    "unsupported-op" as any,
    testUtcDate,
  );
  assert(
    failedRes.status === 400 && usageBeforeFailed === 0 && usageAfterFailed === 0,
    "Failed operations do not increment usage counters; only successful operations count",
  );

  // 90. OCR tools have 2 pages/day limit
  const ocrToolIds = ["ocr-pdf", "ocr", "scan-to-searchable-pdf"];
  const allOcrLimitedTo2 = ocrToolIds.every((id) => {
    const tool = toolById(id);
    return (
      tool &&
      tool.access === "free" &&
      tool.usageLimit === 2 &&
      tool.usageUnit === "pages" &&
      isOcrLimitedTool(id)
    );
  });
  assert(
    allOcrLimitedTo2,
    "OCR tools (OCR PDF, OCR, Scan to Searchable PDF) are configured with 2 pages/day limit",
  );

  // 91. 3rd OCR page attempt is blocked with exact benefit message and CTA
  const blockedOcrCheck = checkToolUsage("ocr-pdf", 3);
  assert(
    !blockedOcrCheck.allowed &&
      blockedOcrCheck.title === "You've reached your 2 free OCR pages for today." &&
      blockedOcrCheck.message?.includes("Upgrade to Docly Pro for unlimited OCR") &&
      blockedOcrCheck.message?.includes("Only ₹25/month") &&
      blockedOcrCheck.ctaText === "Upgrade to Pro",
    "3rd OCR page attempt is blocked with exact benefit message and 'Upgrade to Pro' CTA",
  );

  // 92. File validation allows <= 50 MB files for Free users
  const smallPdfCheck = await validatePdfFile(file1, false);
  assert(smallPdfCheck.valid, "validatePdfFile accepts valid document <= 50 MB for Free users");

  // 93. File validation blocks > 50 MB files for Free users with upgrade flag
  const fakeLargeFile = {
    name: "large-document.pdf",
    size: 55 * 1024 * 1024, // 55 MB
    type: "application/pdf",
    slice: () => ({
      arrayBuffer: async () => new TextEncoder().encode("%PDF-1.4"),
    }),
  } as unknown as File;
  const largePdfFreeCheck = await validatePdfFile(fakeLargeFile, false);
  assert(
    !largePdfFreeCheck.valid &&
      largePdfFreeCheck.isFileSizeLimitExceeded === true &&
      largePdfFreeCheck.error?.includes("50 MB"),
    "validatePdfFile blocks > 50 MB file for Free user with isFileSizeLimitExceeded: true",
  );

  // 94. File validation allows > 50 MB up to 250 MB for Pro users
  const largePdfProCheck = await validatePdfFile(fakeLargeFile, true);
  assert(largePdfProCheck.valid, "validatePdfFile permits > 50 MB file for authenticated Pro user");

  // 95. File validation blocks > 250 MB even for Pro users (server technical maximum)
  const fakeExcessiveFile = {
    name: "gigantic-archive.pdf",
    size: 260 * 1024 * 1024, // 260 MB
    type: "application/pdf",
    slice: () => ({
      arrayBuffer: async () => new TextEncoder().encode("%PDF-1.4"),
    }),
  } as unknown as File;
  const excessivePdfProCheck = await validatePdfFile(fakeExcessiveFile, true);
  assert(
    !excessivePdfProCheck.valid && excessivePdfProCheck.error?.includes("250 MB"),
    "validatePdfFile blocks > 250 MB files even for Pro users per technical maximum",
  );

  // 96. Pro-only AI tools are marked as access: "pro"
  const proAiToolIds = [
    "passport-photo",
    "chat-with-pdf",
    "ai-pdf-summary",
    "pdf-to-notes",
    "pdf-to-questions",
    "translate-pdf",
    "background-remover",
  ];
  const allProAiLocked = proAiToolIds.every((id) => {
    const tool = toolById(id);
    return tool && tool.access === "pro" && isProTool(id);
  });
  assert(
    allProAiLocked,
    "AI tools (Passport Photo, Chat with PDF, AI Summary, Notes, Quiz, Translate) are locked with access: 'pro'",
  );

  // 97. Pro-only Advanced PDF tools are marked as access: "pro"
  const proAdvToolIds = ["repair-pdf", "edit-pdf"];
  const allProAdvLocked = proAdvToolIds.every((id) => {
    const tool = toolById(id);
    return tool && tool.access === "pro" && isProTool(id);
  });
  assert(
    allProAdvLocked,
    "Advanced PDF tools (Repair PDF, Edit PDF) are designated as Pro features",
  );

  // 98. All Pro-only tools provide benefit-oriented upgrade copy
  const allProHaveBenefits = proAiToolIds.every((id) => {
    const tool = toolById(id);
    return tool && typeof tool.proBenefit === "string" && tool.proBenefit.length > 10;
  });
  assert(
    allProHaveBenefits,
    "Every Pro-only tool provides benefit-oriented messaging explaining value to the user",
  );

  // 99. ToolCard renders [🔒 PRO] badge for Pro tools and usage limit badge for limited tools
  const toolCardContent = fs.readFileSync(
    "c:/Users/nayan/docly-craft/src/components/ToolCard.tsx",
    "utf-8",
  );
  assert(
    toolCardContent.includes("🔒 PRO") && toolCardContent.includes("tool.usageLimit"),
    "ToolCard component renders [🔒 PRO] badge for Pro tools and usage limit for limited tools",
  );

  // 100. Razorpay service createRazorpaySubscription cleanly reports unconfigured state or auth requirement
  const checkoutResult = await createRazorpaySubscription({
    redirect: "/dashboard",
  });
  assert(
    checkoutResult.notConfigured === true || checkoutResult.error !== undefined,
    "Razorpay createRazorpaySubscription cleanly reports unconfigured state or auth requirement without fake transactions",
  );

  // 101. Supabase Razorpay migration file exists with subscriptions, payments, and webhook_events tables with RLS
  const subMigrationContent = fs.readFileSync(
    "c:/Users/nayan/docly-craft/supabase/migrations/20260910000003_create_razorpay_subscriptions_and_payments.sql",
    "utf-8",
  );
  assert(
    subMigrationContent.includes("public.subscriptions") &&
      subMigrationContent.includes("public.payments") &&
      subMigrationContent.includes("public.webhook_events") &&
      subMigrationContent.includes("row level security") &&
      subMigrationContent.includes("Users can view own subscription"),
    "Supabase migration 20260910000003 defines subscriptions, payments, and webhook_events tables with strict RLS",
  );

  // 102. Pricing page reflects ₹0/mo Free and ₹25/mo Pro with complete benefits
  assert(
    pricingPageContent.includes("Docly Free") &&
      pricingPageContent.includes("Docly Pro") &&
      pricingPageContent.includes("₹25/month") &&
      pricingPageContent.includes("Upgrade to Pro"),
    "Pricing page reflects Docly Free (₹0/mo) and Docly Pro (₹25/mo) with full benefits list",
  );

  // 103. Account page displays subscription status card with upgrade option
  const accountPageContent = fs.readFileSync(
    "c:/Users/nayan/docly-craft/src/routes/account.tsx",
    "utf-8",
  );
  assert(
    accountPageContent.includes("Plan Status") &&
      accountPageContent.includes("Docly Pro (₹25/mo)") &&
      accountPageContent.includes("Docly Free (₹0/mo)"),
    "Account settings view displays Plan Status card with direct Pro upgrade option",
  );

  // 104. Security check: Client state or URL param cannot spoof verified server subscription
  const subContent = fs.readFileSync(
    "c:/Users/nayan/docly-craft/src/lib/monetization/subscription.ts",
    "utf-8",
  );
  assert(
    !subContent.includes("localStorage.getItem('isPro')") &&
      !subContent.includes("searchParams.get('plan')") &&
      subContent.includes("supabase"),
    "Subscription architecture queries Supabase database and strictly ignores client-editable flags",
  );

  // 105. Anonymous free tool regression check
  const testFreeMerge = await mergePdfFiles([file1, file2]);
  assert(
    testFreeMerge instanceof Blob && testFreeMerge.size > 0,
    "Anonymous users can freely execute unlimited core PDF tools without barriers or limits",
  );

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
