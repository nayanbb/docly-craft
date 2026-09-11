/**
 * Comprehensive Automated Test Suite: Docly Contact Form & Email Delivery
 * Run with: npx tsx test-contact-suite.ts
 */

import {
  validateContactSubmission,
  isValidEmail,
  sanitizeSingleLine,
  escapeHtml,
  checkRateLimit,
  resetRateLimits,
  generateContactEmailHtml,
  generateContactEmailText,
  handleContactFormRequest,
} from "./src/lib/contact/server-handler";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ ${testName}${detail ? `: ${detail}` : ""}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log("=================================================");
  console.log("  TEST SUITE: Docly Contact & Email Delivery     ");
  console.log("=================================================\n");

  // 1. Email Format & Validation
  console.log("Group 1: Email Format & Validation");
  assert(isValidEmail("nayanbhatkhade8530@gmail.com"), "Valid standard Gmail address passes");
  assert(isValidEmail("test.user+tag@company.co.uk"), "Complex subaddress with tags passes");
  assert(!isValidEmail(""), "Empty email rejected");
  assert(!isValidEmail("invalid-email"), "Email missing @ and domain rejected");
  assert(!isValidEmail("test@"), "Email missing domain rejected");
  assert(!isValidEmail("@domain.com"), "Email missing local-part rejected");
  assert(!isValidEmail("user@domain\r\nBcc:spam@evil.com"), "Email with CRLF injection characters rejected");

  // 2. Header Injection Sanitization
  console.log("\nGroup 2: Input Sanitization & Anti-Injection");
  const dirtyName = "John Doe\r\nBcc:victim@example.com\tSpecial";
  const cleanName = sanitizeSingleLine(dirtyName);
  assert(!cleanName.includes("\r") && !cleanName.includes("\n"), "CRLF stripped from single-line input");
  assert(cleanName === "John Doe  Bcc:victim@example.com Special", "Whitespaces cleanly normalized");

  const xssString = "<script>alert('xss')</script>&\"'";
  const escaped = escapeHtml(xssString);
  assert(
    escaped === "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;&amp;&quot;&#039;",
    "HTML special characters safely escaped for email body"
  );

  // 3. Payload Validation
  console.log("\nGroup 3: Form Payload Validation");
  const validResult = validateContactSubmission({
    name: "Docly Tester",
    email: "visitor@example.com",
    message: "This is a legitimate production inquiry for Docly.",
  });
  assert(validResult.valid === true, "Valid submission passes validation");
  assert(validResult.data?.name === "Docly Tester", "Name captured correctly");
  assert(validResult.data?.email === "visitor@example.com", "Email normalized to lowercase");

  // Missing / empty fields
  const emptyNameResult = validateContactSubmission({
    name: " ",
    email: "visitor@example.com",
    message: "Valid length message here.",
  });
  assert(!emptyNameResult.valid && emptyNameResult.error === "Please enter your name.", "Empty name rejected");

  const shortNameResult = validateContactSubmission({
    name: "A",
    email: "visitor@example.com",
    message: "Valid length message here.",
  });
  assert(!shortNameResult.valid, "Single character name rejected");

  const invalidEmailResult = validateContactSubmission({
    name: "Valid Name",
    email: "not-an-email",
    message: "Valid length message here.",
  });
  assert(!invalidEmailResult.valid && invalidEmailResult.error === "Please enter a valid email address.", "Invalid email rejected");

  const shortMessageResult = validateContactSubmission({
    name: "Valid Name",
    email: "visitor@example.com",
    message: "Too short",
  });
  assert(!shortMessageResult.valid, "Message shorter than 10 chars rejected");

  const oversizedMessage = "A".repeat(5001);
  const oversizedResult = validateContactSubmission({
    name: "Valid Name",
    email: "visitor@example.com",
    message: oversizedMessage,
  });
  assert(!oversizedResult.valid, "Message exceeding 5000 chars rejected");

  // 4. Honeypot Spambot Detection
  console.log("\nGroup 4: Spam Protection — Honeypot Trap");
  const honeypotResult = validateContactSubmission({
    name: "Spammer Bot",
    email: "bot@spam.com",
    message: "Buy cheap luxury watches now!",
    hp: "http://spam-link.ru",
  });
  assert(!honeypotResult.valid && honeypotResult.error === "Spam detected.", "Filled honeypot field caught as spam");

  const altHoneypotResult = validateContactSubmission({
    name: "Spammer Bot",
    email: "bot@spam.com",
    message: "Buy cheap luxury watches now!",
    company_website: "http://bot-site.com",
  });
  assert(!altHoneypotResult.valid && altHoneypotResult.error === "Spam detected.", "Alternative honeypot caught as spam");

  // 5. Sliding-Window Rate Limiting
  console.log("\nGroup 5: Rate Limiting Enforcement");
  resetRateLimits();
  const testIp = "203.0.113.42";
  for (let i = 1; i <= 5; i++) {
    const { limited, remaining } = checkRateLimit(testIp);
    assert(!limited, `Request ${i}/5 under limit (remaining: ${remaining})`);
  }
  const blockedCheck = checkRateLimit(testIp);
  assert(blockedCheck.limited === true && blockedCheck.remaining === 0, "6th request within window blocked by rate limiter");

  // Different IP is not affected
  const otherIpCheck = checkRateLimit("198.51.100.99");
  assert(!otherIpCheck.limited, "Different client IP is not affected by rate limit");

  // 6. Email Content Generation
  console.log("\nGroup 6: Email Content & Templates");
  const emailHtml = generateContactEmailHtml({
    name: "Alice Smith",
    email: "alice@example.com",
    message: "Hello Docly,\nI need help with PDF merge.",
    submittedAtIso: "2026-09-11T10:00:00.000Z",
  });
  assert(emailHtml.includes("Docly Contact Form"), "HTML email contains Docly branding header");
  assert(emailHtml.includes("Alice Smith"), "HTML email contains sender name");
  assert(emailHtml.includes("mailto:alice@example.com"), "HTML email contains mailto link");
  assert(emailHtml.includes("Hello Docly,<br/>I need help with PDF merge."), "Linebreaks converted in HTML body");
  assert(emailHtml.includes("Tip: You can hit Reply"), "HTML email guides admin on direct Reply-To");

  const emailText = generateContactEmailText({
    name: "Alice Smith",
    email: "alice@example.com",
    message: "Hello Docly, I need help with PDF merge.",
    submittedAtIso: "2026-09-11T10:00:00.000Z",
  });
  assert(emailText.includes("Sender:  Alice Smith"), "Plaintext contains sender name");
  assert(emailText.includes("Email:   alice@example.com"), "Plaintext contains email");
  assert(emailText.includes("Reply directly to this email to respond"), "Plaintext indicates Reply-To behavior");

  // 7. HTTP Endpoint Handler Simulation
  console.log("\nGroup 7: HTTP Endpoint Handler (/api/contact)");
  resetRateLimits();

  // OPTIONS preflight
  const optionsReq = new Request("http://localhost:3000/api/contact", { method: "OPTIONS" });
  const optionsRes = await handleContactFormRequest(optionsReq);
  assert(optionsRes.status === 204, "OPTIONS returns HTTP 204 No Content for CORS");

  // GET method returns safe diagnostic endpoint
  const getReq = new Request("http://localhost:3000/api/contact", { method: "GET" });
  const getRes = await handleContactFormRequest(getReq, {});
  assert(getRes.status === 200, "GET returns HTTP 200 for safe diagnostics");
  const diagData = await getRes.json() as { status: string; configured: boolean };
  assert(diagData.configured === false, "Diagnostic correctly reports unconfigured key when empty");

  // PUT method rejection
  const putReq = new Request("http://localhost:3000/api/contact", { method: "PUT" });
  const putRes = await handleContactFormRequest(putReq);
  assert(putRes.status === 405, "PUT returns HTTP 405 Method Not Allowed");

  // Invalid JSON
  const badJsonReq = new Request("http://localhost:3000/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not-json-string{",
  });
  const badJsonRes = await handleContactFormRequest(badJsonReq);
  assert(badJsonRes.status === 400, "Malformed JSON returns HTTP 400");

  // Missing RESEND_API_KEY safe fallback
  const validSubmissionReq = new Request("http://localhost:3000/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": "1.2.3.4" },
    body: JSON.stringify({
      name: "Docly Test",
      email: "test@example.com",
      message: "This is a production contact form test.",
    }),
  });
  // Empty env without RESEND_API_KEY
  const unconfiguredRes = await handleContactFormRequest(validSubmissionReq, {});
  assert(unconfiguredRes.status === 503, "Unconfigured key returns HTTP 503");
  const unconfiguredData = await unconfiguredRes.json() as { error: string };
  assert(
    unconfiguredData.error ===
      "We couldn't send your message right now. Please try again later or email us directly at nayanbhatkhade8530@gmail.com.",
    "Unconfigured error returns exact specified safe fallback message without exposing secrets"
  );

  // Honeypot request sinkhole returns 200 without sending
  const botReq = new Request("http://localhost:3000/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": "1.2.3.5" },
    body: JSON.stringify({
      name: "Bot",
      email: "bot@spam.com",
      message: "Buy cheap crypto",
      hp: "http://bot.com",
    }),
  });
  const botRes = await handleContactFormRequest(botReq, {});
  assert(botRes.status === 200, "Spambot is quietly sinkholed with HTTP 200");

  // 8. Resend REST API Payload & Dispatch Simulation
  console.log("\nGroup 8: Resend REST API Payload & Dispatch Simulation");
  const originalFetch = globalThis.fetch;
  let interceptedPayload: any = null;
  let interceptedAuth = "";

  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = input.toString();
      if (urlStr === "https://api.resend.com/emails") {
        interceptedAuth = (init?.headers as Record<string, string>)?.["Authorization"] || "";
        interceptedPayload = JSON.parse(init?.body as string);
        return new Response(JSON.stringify({ id: "msg_re_test123456" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const mockEnv = {
      RESEND_API_KEY: "re_mock_test_key_abc123",
      CONTACT_RECIPIENT_EMAIL: "nayanbhatkhade8530@gmail.com",
    };

    const deliveryReq = new Request("http://localhost:3000/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "10.0.0.1" },
      body: JSON.stringify({
        name: "Docly Test Visitor",
        email: "visitor@business.org",
        message: "Hello! This is a production contact form test message.",
      }),
    });

    const deliveryRes = await handleContactFormRequest(deliveryReq, mockEnv);
    assert(deliveryRes.status === 200, "Successful delivery returns HTTP 200");

    const deliveryData = await deliveryRes.json() as { success: boolean; id: string; message: string };
    assert(deliveryData.success === true, "Response reports success: true");
    assert(deliveryData.id === "msg_re_test123456", "Response includes Resend email ID");
    assert(deliveryData.message.includes("Message sent successfully"), "Response contains success message");

    // Check payload sent to Resend
    assert(interceptedAuth === "Bearer re_mock_test_key_abc123", "Authorization header has Bearer token");
    assert(interceptedPayload.to[0] === "nayanbhatkhade8530@gmail.com", "Destination email is nayanbhatkhade8530@gmail.com");
    assert(interceptedPayload.reply_to === "visitor@business.org", "Reply-To is set to visitor's email");
    assert(interceptedPayload.subject === "Docly Contact Form — New Message from Docly Test Visitor", "Subject includes visitor name");
    assert(interceptedPayload.html.includes("Docly Test Visitor"), "HTML body includes visitor name");
    assert(interceptedPayload.text.includes("visitor@business.org"), "Plaintext body includes visitor email");
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("\n=================================================");
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test runner encountered error:", err);
  process.exit(1);
});
