import { handleAiSummarizeRequest, handleAiStatusRequest } from "./src/lib/ai/server/handler";

async function run() {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error("FAIL: GEMINI_API_KEY not found in environment");
    process.exit(1);
  }

  const env = { GEMINI_API_KEY: geminiKey };

  // 1. Test /api/ai/status
  console.log("Testing GET /api/ai/status...");
  const statusReq = new Request("http://localhost/api/ai/status");
  const statusRes = await handleAiStatusRequest(statusReq, env);
  const statusData = await statusRes.json();
  console.log("Status response:", statusData);

  if (!statusData.configured || statusData.provider !== "gemini") {
    console.error("FAIL: Provider not detected as configured gemini");
    process.exit(1);
  }
  console.log("PASS: /api/ai/status confirms Gemini is active!");

  // 2. Test Real AI PDF Summary via /api/ai/summarize
  console.log("\nTesting POST /api/ai/summarize with real Gemini API call...");
  const sampleDocumentPages = [
    {
      pageNumber: 1,
      text: `Docly is a next-generation document processing platform offering high-performance tools for PDF manipulation, image editing, and optical character recognition. The system is designed with a privacy-first architecture, performing client-side operations using WebAssembly whenever possible, while delegating heavy AI workloads to enterprise-grade server backends. The application features an integrated monetization layer supporting free tiers and Pro subscriptions powered by Razorpay.`,
    },
    {
      pageNumber: 2,
      text: `In version 2.0, Docly introduced biometric-preserving passport photo creation and background removal capabilities. Unlike conventional generative image tools that hallucinate facial features, Docly uses deterministic neural segmentation to isolate subjects cleanly without modifying identity, facial contours, or expressions. Furthermore, the platform integrates intelligent document assistance, enabling users to chat with multi-page PDFs, generate Cornell-style study notes, and extract practice quizzes.`,
    },
  ];

  // First verify unauthenticated call gets 403 PRO_REQUIRED
  const unauthReq = new Request("http://localhost/api/ai/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentName: "docly_platform_whitepaper.pdf",
      totalPages: 2,
      pages: sampleDocumentPages,
    }),
  });

  const unauthRes = await handleAiSummarizeRequest(unauthReq, env);
  const unauthData = await unauthRes.json();
  console.log("Unauthenticated check status:", unauthRes.status, unauthData.code);
  if (unauthRes.status !== 403 || unauthData.code !== "PRO_REQUIRED") {
    console.error("FAIL: Expected 403 PRO_REQUIRED for unauthenticated request");
    process.exit(1);
  }
  console.log("PASS: Server-authoritative Pro entitlement correctly enforced!");

  // Now execute real Gemini generation with test runner auth bypass
  const authEnv = {
    GEMINI_API_KEY: geminiKey,
    DOCLY_TEST_BYPASS_AUTH: "true",
  };

  const summarizeReq = new Request("http://localhost/api/ai/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentName: "docly_platform_whitepaper.pdf",
      totalPages: 2,
      pages: sampleDocumentPages,
      options: { length: "medium" },
    }),
  });

  console.log("Sending real document to Gemini for summarization...");
  const res = await handleAiSummarizeRequest(summarizeReq, authEnv);
  console.log("HTTP status:", res.status);
  const data = await res.json();

  if (res.status !== 200) {
    console.error("FAIL: Expected 200 OK, got:", res.status, data);
    process.exit(1);
  }

  console.log("\n--- REAL GEMINI SUMMARY RESULT ---");
  console.log("Overview:\n", data.overview);
  console.log("\nKey Points (count: " + (data.keyPoints?.length || 0) + "):");
  data.keyPoints?.forEach((p: string, idx: number) => console.log(`  ${idx + 1}. ${p}`));
  console.log("\nImportant Details (count: " + (data.importantDetails?.length || 0) + "):");
  data.importantDetails?.forEach((d: string, idx: number) => console.log(`  - ${d}`));
  console.log("\nConclusion:\n", data.conclusion);

  if (!data.overview || !data.keyPoints || data.keyPoints.length === 0) {
    console.error("FAIL: Summary data is missing required fields");
    process.exit(1);
  }

  console.log("\nPASS: Real Gemini AI PDF Summary generated and validated successfully!");
}

run();
