/**
 * Test Suite for Docly Self-Hosted Document Conversion Provider & Cloudflare Worker Integration.
 */

import http from "node:http";
import assert from "node:assert";
import {
  SelfHostedProvider,
  CloudConvertProvider,
  getOfficeConversionProvider,
  getOfficeConversionProviderForOperation,
  UnconfiguredOfficeProvider,
} from "./src/lib/office/providers/index";
import {
  handleConversionStatusRequest,
  handleConversionApiRequest,
  resetServerConversionUsage,
  getServerConversionUsage,
} from "./src/lib/office/server-handler";

function logPass(msg: string) {
  console.log(`  [PASS] ${msg}`);
}

async function run() {
  console.log("==================================================");
  console.log("RUNNING DOCLY SELF-HOSTED PROVIDER TEST SUITE");
  console.log("==================================================");

  // 1. Unconfigured State
  const unconf = new SelfHostedProvider("");
  assert(!unconf.isConfigured, "SelfHostedProvider is unconfigured when URL is empty");
  const unconfHealth = await unconf.checkHealth();
  assert(!unconfHealth, "SelfHostedProvider checkHealth returns false when unconfigured");
  logPass("SelfHostedProvider handles unconfigured state correctly");

  // 2. Supported Operations
  assert(
    unconf.supportedOperations.length === 6,
    "SelfHostedProvider must support all 6 operations",
  );
  assert(unconf.supportedOperations.includes("pdf-to-word"));
  assert(unconf.supportedOperations.includes("pdf-to-excel"));
  assert(unconf.supportedOperations.includes("pdf-to-powerpoint"));
  assert(unconf.supportedOperations.includes("word-to-pdf"));
  assert(unconf.supportedOperations.includes("excel-to-pdf"));
  assert(unconf.supportedOperations.includes("powerpoint-to-pdf"));
  logPass("SelfHostedProvider specifies all 6 target operations");

  // 3. Provider Resolution via Environment Variables
  const envWithConverter = {
    DOCLY_CONVERTER_URL: "http://localhost:8001",
  };

  const resolvedReverse = getOfficeConversionProviderForOperation(
    "pdf-to-word",
    envWithConverter,
  );
  assert(
    resolvedReverse.isConfigured && resolvedReverse.id === "self-hosted",
    "DOCLY_CONVERTER_URL resolves to SelfHostedProvider for reverse conversion (pdf-to-word)",
  );

  const resolvedForward = getOfficeConversionProviderForOperation(
    "word-to-pdf",
    envWithConverter,
  );
  assert(
    resolvedForward.isConfigured && resolvedForward.id === "self-hosted",
    "DOCLY_CONVERTER_URL resolves to SelfHostedProvider for forward conversion (word-to-pdf)",
  );

  const resolvedGeneral = getOfficeConversionProvider(envWithConverter);
  assert(
    resolvedGeneral.isConfigured && resolvedGeneral.id === "self-hosted",
    "DOCLY_CONVERTER_URL resolves to SelfHostedProvider for general provider lookup",
  );
  logPass("Provider resolution routes all operations to SelfHostedProvider when configured");

  // 3b. Canonical Precedence Test: DOCLY_CONVERTER_URL overrides CONVERTER_SERVICE_URL
  const envPrecedence = {
    DOCLY_CONVERTER_URL: "http://canonical-primary:8001",
    CONVERTER_SERVICE_URL: "http://fallback-legacy:8001",
  };
  const precedenceProvider = new SelfHostedProvider(undefined, undefined, envPrecedence);
  assert(
    (precedenceProvider as unknown as { baseUrl: string }).baseUrl === "http://canonical-primary:8001",
    "DOCLY_CONVERTER_URL takes strict canonical precedence over CONVERTER_SERVICE_URL",
  );
  logPass("DOCLY_CONVERTER_URL canonical precedence over CONVERTER_SERVICE_URL confirmed");

  // 3c. Unconfigured Status & Absence of Obsolete Env Var Mentions
  const unconfiguredStatusReq = new Request("http://localhost/api/convert/status?operation=word-to-pdf");
  const unconfiguredStatusRes = await handleConversionStatusRequest(unconfiguredStatusReq, {
    OFFICE_CONVERSION_PROVIDER: "none",
  });
  const unconfiguredData = await unconfiguredStatusRes.json();
  assert(unconfiguredData.configured === false, "Unconfigured environment reports configured: false");
  assert(
    !unconfiguredData.statusMessage?.includes("GOTENBERG_URL"),
    "Status message MUST NOT mention GOTENBERG_URL",
  );
  assert(
    !unconfiguredData.statusMessage?.includes("CLOUDCONVERT_API_KEY"),
    "Status message MUST NOT mention CLOUDCONVERT_API_KEY",
  );
  assert(
    !unconfiguredData.statusMessage?.includes("docker run"),
    "Status message MUST NOT tell customers to run docker",
  );
  logPass("Unconfigured status provides customer-safe message without leaking internal env vars");

  // 3d. Unreachable Self-Hosted Engine Status Test
  const unreachableStatusReq = new Request("http://localhost/api/convert/status?operation=word-to-pdf");
  const unreachableStatusRes = await handleConversionStatusRequest(unreachableStatusReq, {
    DOCLY_CONVERTER_URL: "http://localhost:39999",
  });
  const unreachableData = await unreachableStatusRes.json();
  assert(unreachableData.configured === false, "Unreachable self-hosted engine reports configured: false");
  assert(unreachableData.reachable === false, "Unreachable self-hosted engine reports reachable: false");
  assert(
    !unreachableData.statusMessage?.includes("GOTENBERG_URL"),
    "Unreachable status MUST NOT mention GOTENBERG_URL",
  );
  assert(
    !unreachableData.statusMessage?.includes("docker run"),
    "Unreachable status MUST NOT instruct docker run",
  );
  logPass("Unreachable self-hosted engine returns safe status message without legacy instructions");

  // 4. Mock Self-Hosted Converter HTTP Server
  const mockServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          engines: {
            pdf_to_docx: true,
            pdf_to_pptx: true,
            pdf_to_xlsx: true,
            office_to_pdf: true,
          },
        }),
      );
      return;
    }

    if (url.pathname === "/capabilities" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          supported_operations: [
            "pdf-to-word",
            "pdf-to-excel",
            "pdf-to-powerpoint",
            "word-to-pdf",
            "excel-to-pdf",
            "powerpoint-to-pdf",
          ],
          max_file_size_bytes: 52428800,
        }),
      );
      return;
    }

    if (url.pathname === "/convert" && req.method === "POST") {
      // Return a simulated DOCX package with valid PK\x03\x04 header
      const mockDocxBytes = Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]),
        Buffer.from("Mock converted Word document content"),
      ]);
      res.writeHead(200, {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="converted.docx"',
        "X-Converted-By": "docly-self-hosted",
      });
      res.end(mockDocxBytes);
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  await new Promise<void>((resolve) => mockServer.listen(3997, () => resolve()));

  try {
    const activeProvider = new SelfHostedProvider("http://localhost:3997");
    assert(activeProvider.isConfigured, "Provider is configured with mock URL");

    // 5. Health check against mock server
    const isHealthy = await activeProvider.checkHealth();
    assert(isHealthy, "Provider checkHealth succeeds against active endpoint");
    logPass("SelfHostedProvider checkHealth verifies /health endpoint successfully");

    // 6. Convert execution against mock server
    const fakePdfBytes = new Uint8Array(
      Buffer.concat([
        Buffer.from("%PDF-1.4\n"),
        Buffer.from("1 0 obj << /Type /Catalog >> endobj\nxref\ntrailer << >>\nstartxref\n%%EOF"),
      ]),
    );

    const result = await activeProvider.convert({
      fileBuffer: fakePdfBytes,
      fileName: "test.pdf",
      operation: "pdf-to-word",
    });

    assert(result.outputBuffer.length > 0, "Output buffer must be non-empty");
    assert(
      result.outputBuffer[0] === 0x50 &&
        result.outputBuffer[1] === 0x4b &&
        result.outputBuffer[2] === 0x03 &&
        result.outputBuffer[3] === 0x04,
      "Output buffer must have valid PK\\x03\\x04 ZIP header",
    );
    assert(result.outputFileName === "converted.docx", "Output filename is parsed from headers");
    logPass("SelfHostedProvider converts PDF -> Word returning valid Office OpenXML binary");

    // 7. Status Request with SelfHostedProvider
    const statusReq = new Request(
      "http://localhost/api/convert/status?operation=pdf-to-word",
    );
    const statusRes = await handleConversionStatusRequest(statusReq, {
      DOCLY_CONVERTER_URL: "http://localhost:3997",
    });
    assert(statusRes.status === 200);
    const statusJson = (await statusRes.json()) as {
      configured: boolean;
      provider: string;
      reachable: boolean;
    };
    assert(statusJson.configured === true, "Status reports configured: true");
    assert(statusJson.provider === "self-hosted", "Status reports provider: 'self-hosted'");
    assert(statusJson.reachable === true, "Status reports reachable: true");
    logPass("GET /api/convert/status reports self-hosted provider as active and reachable");

    // 8. End-to-end POST /api/convert route test
    resetServerConversionUsage();
    const boundary = "----TestBoundary123456";
    const multipartBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="operation"\r\n\r\npdf-to-word\r\n`,
      ),
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
      ),
      Buffer.from("%PDF-1.4\n1 0 obj <<>> endobj\nxref\ntrailer <<>>\nstartxref\n%%EOF"),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const convertReq = new Request("http://localhost/api/convert", {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "X-Docly-Client-Id": "self_hosted_test_client",
      },
      body: multipartBody,
    });

    const convertRes = await handleConversionApiRequest(convertReq, {
      DOCLY_CONVERTER_URL: "http://localhost:3997",
    });
    assert(convertRes.status === 200, `Expected 200, got ${convertRes.status}`);
    assert(
      convertRes.headers.get("X-Converted-By") === "self-hosted",
      "Response header indicates X-Converted-By: self-hosted",
    );
    const convBody = new Uint8Array(await convertRes.arrayBuffer());
    assert(convBody[0] === 0x50 && convBody[1] === 0x4b, "Returned body is valid OpenXML binary");
    logPass("POST /api/convert routes through SelfHostedProvider and increments usage counter");

    // Verify usage counter was incremented by exactly 1
    const usage = getServerConversionUsage("self_hosted_test_client", "pdf-to-word");
    assert(usage === 1, `Expected usage 1, got ${usage}`);
    logPass("Conversion usage counter increments only on successful conversion");

    // 9. Rejection of Empty Buffer
    let caughtEmpty = false;
    try {
      await activeProvider.convert({
        fileBuffer: new Uint8Array(0),
        fileName: "empty.pdf",
        operation: "pdf-to-word",
      });
    } catch {
      caughtEmpty = true;
    }
    assert(caughtEmpty, "Empty file buffer is rejected");
    logPass("SelfHostedProvider rejects empty file buffers");

    // 10. Rejection of Oversized File (> 50MB)
    let caughtOversized = false;
    try {
      await activeProvider.convert({
        fileBuffer: new Uint8Array(51 * 1024 * 1024),
        fileName: "large.pdf",
        operation: "pdf-to-word",
      });
    } catch {
      caughtOversized = true;
    }
    assert(caughtOversized, "Oversized file buffer is rejected");
    logPass("SelfHostedProvider rejects files larger than 50MB");
  } finally {
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
  }

  console.log("\n==================================================");
  console.log("ALL SELF-HOSTED PROVIDER INTEGRATION TESTS PASSED!");
  console.log("==================================================");
}

run().catch((e) => {
  console.error("FATAL TEST ERROR:", e);
  process.exit(1);
});
