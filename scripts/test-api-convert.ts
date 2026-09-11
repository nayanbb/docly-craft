import fs from "node:fs";

async function testConversion(filePath: string, fileName: string, operation: string) {
  const buf = fs.readFileSync(filePath);
  const blob = new Blob([buf]);
  const file = new File([blob], fileName);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("operation", operation);

  console.log(`Posting ${fileName} (${operation}) to /api/convert...`);
  const res = await fetch("http://localhost:8080/api/convert", {
    method: "POST",
    body: formData,
  });

  console.log("  HTTP Status:", res.status);
  console.log("  Content-Type:", res.headers.get("content-type"));
  console.log("  Content-Disposition:", res.headers.get("content-disposition"));
  console.log("  X-Converted-By:", res.headers.get("x-converted-by"));

  if (!res.ok) {
    const text = await res.text();
    console.error("  Error response:", text);
    throw new Error(`Failed with status ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const output = new Uint8Array(arrayBuffer);
  console.log("  Output buffer size:", output.length, "bytes");

  const header = String.fromCharCode(...output.slice(0, 5));
  console.log("  Magic header:", header);

  if (!header.startsWith("%PDF-")) {
    throw new Error("FAIL: Not a PDF!");
  }
  console.log(`  SUCCESS for ${fileName} -> PDF!\n`);
}

async function main() {
  await testConversion("test-fixtures/sample.docx", "sample.docx", "word-to-pdf");
  await testConversion("test-fixtures/sample.xlsx", "sample.xlsx", "excel-to-pdf");
  await testConversion("test-fixtures/sample.pptx", "sample.pptx", "powerpoint-to-pdf");
  console.log("ALL 3 CONVERSIONS PASSED OVER LIVE HTTP API!");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
