import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import {
  handleConversionStatusRequest,
  handleConversionApiRequest,
  resetServerConversionUsage,
  getServerConversionUsage,
} from "./src/lib/office/server-handler";

const CONVERTER_URL = process.env.DOCLY_CONVERTER_URL || "http://127.0.0.1:8001";
const CONVERTER_SECRET = process.env.DOCLY_CONVERTER_SECRET || "";

const workerEnv = {
  DOCLY_CONVERTER_URL: CONVERTER_URL,
  DOCLY_CONVERTER_SECRET: CONVERTER_SECRET,
};

async function testPipeline() {
  console.log("==================================================");
  console.log("TESTING LIVE PRODUCTION CONVERTER PIPELINE");
  console.log(`Converter URL: ${CONVERTER_URL}`);
  console.log("==================================================");

  // 1. Test status check via server handler
  console.log("\n[1] Testing Worker Status Handler against live tunnel...");
  const statusReq = new Request("http://localhost/api/convert/status?operation=pdf-to-word");
  const statusRes = await handleConversionStatusRequest(statusReq, workerEnv);
  assert.strictEqual(statusRes.status, 200, "Status endpoint must return 200");
  const statusData = await statusRes.json();
  console.log("  Status Response:", statusData);
  assert.strictEqual(statusData.configured, true, "Status must be configured");
  assert.strictEqual(statusData.reachable, true, "Status must be reachable");
  assert.strictEqual(statusData.provider, "self-hosted", "Provider must be self-hosted");
  console.log("  [PASS] Cloudflare Worker reaches production converter over tunnel");

  // 2. Test all 6 conversions through handleConversionApiRequest
  const operations = [
    {
      op: "pdf-to-word",
      file: "sample-from-word.pdf",
      mime: "application/pdf",
      expectedMagic: [0x50, 0x4b, 0x03, 0x04], // ZIP / DOCX
      name: "PDF -> Word (docx)",
    },
    {
      op: "pdf-to-powerpoint",
      file: "sample-from-powerpoint.pdf",
      mime: "application/pdf",
      expectedMagic: [0x50, 0x4b, 0x03, 0x04], // ZIP / PPTX
      name: "PDF -> PowerPoint (pptx)",
    },
    {
      op: "pdf-to-excel",
      file: "sample-from-excel.pdf",
      mime: "application/pdf",
      expectedMagic: [0x50, 0x4b, 0x03, 0x04], // ZIP / XLSX
      name: "PDF -> Excel (xlsx)",
    },
    {
      op: "word-to-pdf",
      file: "sample.docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      expectedMagic: [0x25, 0x50, 0x44, 0x46], // %PDF
      name: "Word (docx) -> PDF",
    },
    {
      op: "powerpoint-to-pdf",
      file: "sample.pptx",
      mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      expectedMagic: [0x25, 0x50, 0x44, 0x46], // %PDF
      name: "PowerPoint (pptx) -> PDF",
    },
    {
      op: "excel-to-pdf",
      file: "sample.xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      expectedMagic: [0x25, 0x50, 0x44, 0x46], // %PDF
      name: "Excel (xlsx) -> PDF",
    },
  ];

  console.log("\n[2] Testing all 6 conversion operations through Worker pipeline...");
  const outDir = path.resolve("./scratch-test-outputs");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const item of operations) {
    const filePath = path.resolve("./test-fixtures", item.file);
    const fileBytes = fs.readFileSync(filePath);
    const formData = new FormData();
    const blob = new Blob([fileBytes], { type: item.mime });
    formData.append("file", blob, item.file);
    formData.append("operation", item.op);

    const convertReq = new Request("http://localhost/api/convert", {
      method: "POST",
      body: formData,
      headers: {
        "X-Docly-Client-Id": `test-client-${item.op}`,
      },
    });

    const startTime = Date.now();
    const res = await handleConversionApiRequest(convertReq, workerEnv);
    const duration = Date.now() - startTime;

    assert.strictEqual(
      res.status,
      200,
      `Conversion for ${item.name} failed with status ${res.status}`,
    );

    const outBytes = new Uint8Array(await res.arrayBuffer());
    assert(outBytes.length > 0, `Output buffer for ${item.name} is empty`);

    // Check magic bytes
    for (let i = 0; i < item.expectedMagic.length; i++) {
      assert.strictEqual(
        outBytes[i],
        item.expectedMagic[i],
        `Magic byte mismatch at index ${i} for ${item.name}`,
      );
    }

    const disp = res.headers.get("Content-Disposition") || "";
    console.log(
      `  [PASS] ${item.name}: ${fileBytes.length} bytes -> ${outBytes.length} bytes in ${duration}ms (${disp})`,
    );

    // Save output to scratch directory for inspection
    const outName = `${item.op}-output${item.op.endsWith("-to-pdf") ? ".pdf" : item.op === "pdf-to-word" ? ".docx" : item.op === "pdf-to-excel" ? ".xlsx" : ".pptx"}`;
    fs.writeFileSync(path.join(outDir, outName), outBytes);
  }

  // 3. Verify Limits & Safety
  console.log("\n[3] Testing limits, quota, and security...");

  // 3a. Free daily limits (10/day)
  resetServerConversionUsage();
  const testClient = "quota-test-user";
  const dummyFile = fs.readFileSync(path.resolve("./test-fixtures/sample.docx"));

  for (let i = 1; i <= 10; i++) {
    const fd = new FormData();
    fd.append("file", new Blob([dummyFile]), "sample.docx");
    fd.append("operation", "word-to-pdf");
    const req = new Request("http://localhost/api/convert", {
      method: "POST",
      body: fd,
      headers: { "X-Docly-Client-Id": testClient },
    });
    const res = await handleConversionApiRequest(req, workerEnv);
    assert.strictEqual(res.status, 200, `Conversion #${i} should succeed within free limit`);
  }
  assert.strictEqual(
    getServerConversionUsage(testClient, "word-to-pdf"),
    10,
    "Usage should be exactly 10",
  );

  // 11th conversion must be rejected with 429
  const fd11 = new FormData();
  fd11.append("file", new Blob([dummyFile]), "sample.docx");
  fd11.append("operation", "word-to-pdf");
  const req11 = new Request("http://localhost/api/convert", {
    method: "POST",
    body: fd11,
    headers: { "X-Docly-Client-Id": testClient },
  });
  const res11 = await handleConversionApiRequest(req11, workerEnv);
  assert.strictEqual(res11.status, 429, "11th conversion must return 429 Too Many Requests");
  const err11 = await res11.json();
  assert.strictEqual(err11.code, "USAGE_LIMIT_EXCEEDED", "Response must indicate USAGE_LIMIT_EXCEEDED");
  console.log("  [PASS] Free 10/day limit enforced: 11th request rejected with 429 (USAGE_LIMIT_EXCEEDED)");

  // 3b. 50 MB limit rejection
  const bigBuffer = new Uint8Array(51 * 1024 * 1024);
  const bigFd = new FormData();
  bigFd.append("file", new Blob([bigBuffer]), "large.pdf");
  bigFd.append("operation", "pdf-to-word");
  const bigReq = new Request("http://localhost/api/convert", {
    method: "POST",
    body: bigFd,
    headers: { "X-Docly-Client-Id": "big-file-user" },
  });
  const bigRes = await handleConversionApiRequest(bigReq, workerEnv);
  assert.strictEqual(bigRes.status, 400, "Oversized file (>50MB) must return 400");
  console.log("  [PASS] 50 MB file size limit enforced (HTTP 400)");

  console.log("\n==================================================");
  console.log("ALL PIPELINE TESTS PASSED (100%)");
  console.log("==================================================");
}

testPipeline().catch((err) => {
  console.error("Pipeline test failed:", err);
  process.exit(1);
});
