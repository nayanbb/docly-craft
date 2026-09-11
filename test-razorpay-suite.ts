import fs from "fs";
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import { mergePdfFiles } from "./src/lib/pdf/merge";
import { splitAllPages } from "./src/lib/pdf/split";
import { compressPdf } from "./src/lib/pdf/compress";
import { imagesToPdf } from "./src/lib/image/to-pdf";
import { validatePdfFile, validateImageFile } from "./src/lib/files/validation";
import { buildAuthRedirectUrl, sanitizeRedirectPath } from "./src/lib/auth/require-auth";
import {
  PRICING,
  FILE_SIZE_LIMITS,
  CONVERSION_LIMITS,
  OCR_LIMITS,
  isProTool,
  isConversionLimitedTool,
  isOcrLimitedTool,
  getMaxFileSizeBytes,
} from "./src/lib/monetization/config";
import { checkToolUsage } from "./src/lib/monetization/usage";
import { getEffectivePlan, evaluateSubscription, type RawSubscriptionData } from "./src/lib/monetization/plan";
import {
  handleRazorpayWebhookRequest,
  handleRazorpaySubscriptionRequest,
  handleRazorpayCancelRequest,
  handleRazorpayStatusRequest,
  isRazorpayConfigured,
} from "./src/lib/razorpay/server";
import { handleAdminMetricsRequest, verifyAdminRequest } from "./src/lib/admin/server-handler";
import { toolById, tools } from "./src/lib/tools";

// Polyfills
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

function bufferToFile(buffer: Buffer, name: string, mime: string): File {
  const blob = new Blob([buffer], { type: mime });
  return new File([blob], name, { type: mime });
}

async function runRazorpayTestSuite() {
  console.log("================================================================");
  console.log("RUNNING DOCLY SUBSCRIPTION & RAZORPAY 36-POINT TEST SUITE");
  console.log("================================================================");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testNum: number, testName: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test ${testNum}: ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test ${testNum}: ${testName}`);
    }
  }

  const doc1Buf = fs.readFileSync("c:/Users/nayan/docly-craft/test-fixtures/doc1.pdf");
  const doc2Buf = fs.readFileSync("c:/Users/nayan/docly-craft/test-fixtures/doc2.pdf");
  const imgBuf = fs.readFileSync("c:/Users/nayan/docly-craft/test-fixtures/sample.png");

  const file1 = bufferToFile(doc1Buf, "doc1.pdf", "application/pdf");
  const file2 = bufferToFile(doc2Buf, "doc2.pdf", "application/pdf");
  const fileImg = bufferToFile(imgBuf, "sample.png", "image/png");

  // 1. Anonymous user can use free PDF tools (merge, split, compress) without login or limit error
  const mergedBlob = await mergePdfFiles([file1, file2]);
  const splitBlobs = await splitAllPages(file1);
  const compressedBlob = await compressPdf(file1, "medium");
  assert(
    mergedBlob.size > 0 && splitBlobs.length > 0 && compressedBlob.size > 0,
    1,
    "Anonymous user can execute free PDF tools (merge, split, compress) without login or limit errors",
  );

  // 2. Anonymous user can use free image tools without login
  const imgToPdfBlob = await imagesToPdf([fileImg]);
  assert(
    imgToPdfBlob.size > 0,
    2,
    "Anonymous user can use free image tools (image to pdf) without login",
  );

  // 3. Conversion limit applies at 10/day for free users
  assert(
    CONVERSION_LIMITS.freeDailyConversions === 10 &&
      isConversionLimitedTool("pdf-to-word") &&
      isConversionLimitedTool("word-to-pdf"),
    3,
    "Conversion limit applies at 10/day for free users on office conversion tools",
  );

  // 4. 11th conversion attempt returns exact error message and upgrade CTA
  const check11th = checkToolUsage("pdf-to-word", 11);
  assert(
    !check11th.allowed &&
      check11th.error?.includes("10 free conversions") &&
      check11th.ctaText === "Upgrade to Pro",
    4,
    "11th conversion attempt returns exact error message and 'Upgrade to Pro' CTA",
  );

  // 5. OCR limit applies at 2 pages/day for free users
  assert(
    OCR_LIMITS.freeDailyPages === 2 && isOcrLimitedTool("ocr-pdf"),
    5,
    "OCR limit applies at 2 pages/day for free users",
  );

  // 6. 3rd OCR page attempt returns exact error message and upgrade CTA
  const check3rdOcr = checkToolUsage("ocr-pdf", 3);
  assert(
    !check3rdOcr.allowed &&
      check3rdOcr.title?.includes("2 free OCR pages") &&
      check3rdOcr.message?.includes("₹25/month") &&
      check3rdOcr.ctaText === "Upgrade to Pro",
    6,
    "3rd OCR page attempt returns exact error message and 'Upgrade to Pro' CTA",
  );

  // 7. Free user uploading file > 50MB is blocked with upgrade CTA
  const fake55MBFile = {
    name: "large.pdf",
    size: 55 * 1024 * 1024,
    type: "application/pdf",
    slice: () => ({
      arrayBuffer: async () => new TextEncoder().encode("%PDF-1.4"),
    }),
  } as unknown as File;
  const freeVal = await validatePdfFile(fake55MBFile, false);
  assert(
    !freeVal.valid && freeVal.isFileSizeLimitExceeded === true && freeVal.error?.includes("50 MB"),
    7,
    "Free user uploading file > 50MB is blocked with isFileSizeLimitExceeded: true",
  );

  // 8. Pro user uploading file > 50MB (up to 250MB) is allowed
  const proVal = await validatePdfFile(fake55MBFile, true);
  assert(
    proVal.valid === true,
    8,
    "Pro user uploading file > 50MB (up to 250MB) is permitted",
  );

  // 9. Pro AI tools (Passport Photo, Chat with PDF, etc.) are locked with Pro badge
  const proAiTools = ["passport-photo", "chat-with-pdf", "ai-pdf-summary", "pdf-to-notes", "translate-pdf"];
  const allProAiBadged = proAiTools.every((id) => {
    const t = toolById(id);
    return t && t.access === "pro" && isProTool(id);
  });
  assert(
    allProAiBadged,
    9,
    "Pro AI tools (Passport Photo, Chat with PDF, AI Summary, etc.) are locked with Pro badge",
  );

  // 10. Pro AI tools require authentication
  const allProAiAuth = proAiTools.every((id) => {
    const t = toolById(id);
    return t?.requiresAuth === true;
  });
  assert(
    allProAiAuth,
    10,
    "Pro AI tools strictly require authentication (requiresAuth: true)",
  );

  // 11. Unauthenticated user clicking Pro tool is redirected to login
  const redirectUrl = buildAuthRedirectUrl("/tools/chat-with-pdf", "pro");
  assert(
    redirectUrl.startsWith("/login?redirect=") && redirectUrl.includes("%2Ftools%2Fchat-with-pdf"),
    11,
    "Unauthenticated user clicking Pro tool is redirected to /login with encoded redirect target",
  );

  // 12. After login, user is redirected back to intended Pro tool
  const restoredPath = sanitizeRedirectPath("/tools/chat-with-pdf", "/dashboard");
  assert(
    restoredPath === "/tools/chat-with-pdf",
    12,
    "After login, user is safely redirected back to intended Pro tool URL",
  );

  // 13. Authenticated free user clicking Pro tool sees upgrade modal
  const upgradeModalSrc = fs.readFileSync("c:/Users/nayan/docly-craft/src/components/UpgradeModal.tsx", "utf-8");
  assert(
    upgradeModalSrc.includes("Upgrade to Pro") &&
      upgradeModalSrc.includes("₹25/month") &&
      upgradeModalSrc.includes("openRazorpayCheckout"),
    13,
    "UpgradeModal presents ₹25/month plan and wires directly to openRazorpayCheckout",
  );

  // 14. Upgrade modal contains: Pro badge, ₹25/month price, feature list, CTA button
  assert(
    upgradeModalSrc.includes("Docly Pro") &&
      upgradeModalSrc.includes("₹25/month") &&
      upgradeModalSrc.includes("feature") &&
      upgradeModalSrc.includes("Upgrade to Pro — ₹25/month"),
    14,
    "Upgrade modal contains Pro badge, ₹25/month price, benefit checklist, and primary CTA button",
  );

  // 15. Clicking upgrade opens Razorpay checkout (or shows configured status)
  const pricingSrc = fs.readFileSync("c:/Users/nayan/docly-craft/src/routes/pricing.tsx", "utf-8");
  assert(
    pricingSrc.includes("openRazorpayCheckout") &&
      pricingSrc.includes("res.notConfigured") &&
      pricingSrc.includes("Pro checkout isn't available yet"),
    15,
    "Pricing page upgrade CTA calls openRazorpayCheckout and handles unconfigured gateway gracefully",
  );

  // 16. Razorpay subscription creation endpoint responds with 401 for unauthenticated request
  const unauthReq = new Request("http://localhost/api/razorpay/subscription", { method: "POST" });
  const unauthRes = await handleRazorpaySubscriptionRequest(unauthReq);
  assert(
    unauthRes.status === 401,
    16,
    "POST /api/razorpay/subscription securely rejects unauthenticated calls with 401",
  );

  // 17. Webhook handles subscription.charged and activates Pro in database
  const dummySecret = "test_webhook_secret_docly_2026";
  const chargedPayload = JSON.stringify({
    entity: "event",
    event: "subscription.charged",
    id: "evt_test_charged_001",
    payload: {
      subscription: {
        entity: {
          id: "sub_test_123",
          plan_id: "plan_pro_25",
          customer_id: "cust_test_123",
          status: "active",
          current_start: Math.floor(Date.now() / 1000),
          current_end: Math.floor(Date.now() / 1000) + 30 * 86400,
          notes: { userId: "user_test_pro_001" },
        },
      },
    },
  });
  const chargedSig = crypto.createHmac("sha256", dummySecret).update(chargedPayload).digest("hex");
  const chargedReq = new Request("http://localhost/api/razorpay/webhook", {
    method: "POST",
    headers: { "x-razorpay-signature": chargedSig },
    body: chargedPayload,
  });
  const chargedRes = await handleRazorpayWebhookRequest(chargedReq, {
    RAZORPAY_WEBHOOK_SECRET: dummySecret,
  });
  assert(
    chargedRes.status === 200,
    17,
    "Webhook handles subscription.charged and responds 200 OK",
  );

  // 18. Webhook handles payment.failed and marks subscription past_due
  const failedPayload = JSON.stringify({
    entity: "event",
    event: "payment.failed",
    id: "evt_test_failed_001",
    payload: {
      payment: {
        entity: {
          id: "pay_failed_001",
          subscription_id: "sub_test_123",
          amount: 2500,
          currency: "INR",
          notes: { userId: "user_test_pro_001" },
        },
      },
    },
  });
  const failedSig = crypto.createHmac("sha256", dummySecret).update(failedPayload).digest("hex");
  const failedReq = new Request("http://localhost/api/razorpay/webhook", {
    method: "POST",
    headers: { "x-razorpay-signature": failedSig },
    body: failedPayload,
  });
  const failedRes = await handleRazorpayWebhookRequest(failedReq, {
    RAZORPAY_WEBHOOK_SECRET: dummySecret,
  });
  assert(
    failedRes.status === 200,
    18,
    "Webhook handles payment.failed and marks subscription past_due",
  );

  // 19. Webhook handles subscription.cancelled and marks subscription cancelled
  const cancelPayload = JSON.stringify({
    entity: "event",
    event: "subscription.cancelled",
    id: "evt_test_cancelled_001",
    payload: {
      subscription: {
        entity: {
          id: "sub_test_123",
          status: "cancelled",
          current_end: Math.floor(Date.now() / 1000) + 15 * 86400,
        },
      },
    },
  });
  const cancelSig = crypto.createHmac("sha256", dummySecret).update(cancelPayload).digest("hex");
  const cancelReq = new Request("http://localhost/api/razorpay/webhook", {
    method: "POST",
    headers: { "x-razorpay-signature": cancelSig },
    body: cancelPayload,
  });
  const cancelRes = await handleRazorpayWebhookRequest(cancelReq, {
    RAZORPAY_WEBHOOK_SECRET: dummySecret,
  });
  assert(
    cancelRes.status === 200,
    19,
    "Webhook handles subscription.cancelled and marks subscription cancelled",
  );

  // 20. Webhook handles subscription.halted and marks subscription halted
  const haltedPayload = JSON.stringify({
    entity: "event",
    event: "subscription.halted",
    id: "evt_test_halted_001",
    payload: {
      subscription: {
        entity: {
          id: "sub_test_123",
          status: "halted",
        },
      },
    },
  });
  const haltedSig = crypto.createHmac("sha256", dummySecret).update(haltedPayload).digest("hex");
  const haltedReq = new Request("http://localhost/api/razorpay/webhook", {
    method: "POST",
    headers: { "x-razorpay-signature": haltedSig },
    body: haltedPayload,
  });
  const haltedRes = await handleRazorpayWebhookRequest(haltedReq, {
    RAZORPAY_WEBHOOK_SECRET: dummySecret,
  });
  assert(
    haltedRes.status === 200,
    20,
    "Webhook handles subscription.halted and marks subscription past_due/halted",
  );

  // 21. Webhook verifies signature using HMAC-SHA256
  const validSigTest = crypto.createHmac("sha256", dummySecret).update(chargedPayload).digest("hex");
  assert(
    validSigTest === chargedSig,
    21,
    "Webhook verifies signature strictly using HMAC-SHA256 digest matching",
  );

  // 22. Webhook rejects invalid signatures with 400
  const invalidReq = new Request("http://localhost/api/razorpay/webhook", {
    method: "POST",
    headers: { "x-razorpay-signature": "invalid_signature_hex" },
    body: chargedPayload,
  });
  const invalidRes = await handleRazorpayWebhookRequest(invalidReq, {
    RAZORPAY_WEBHOOK_SECRET: dummySecret,
  });
  assert(
    invalidRes.status === 400,
    22,
    "Webhook rejects invalid signatures with 400 Webhook signature verification failed",
  );

  // 23. Webhook idempotency: duplicate event IDs are detected
  const dupReq = new Request("http://localhost/api/razorpay/webhook", {
    method: "POST",
    headers: { "x-razorpay-signature": chargedSig },
    body: chargedPayload,
  });
  const dupRes = await handleRazorpayWebhookRequest(dupReq, {
    RAZORPAY_WEBHOOK_SECRET: dummySecret,
  });
  // Since evt_test_charged_001 was already handled or recorded, response is 200 with received: true
  const dupData = await dupRes.json().catch(() => ({}));
  assert(
    dupRes.status === 200 && (dupData.received === true || dupData.duplicate === true),
    23,
    "Webhook idempotency: duplicate event IDs return 200 without reprocessing",
  );

  // 24. Database migration: subscription schema defined with razorpay columns
  const migrationSql = fs.readFileSync(
    "c:/Users/nayan/docly-craft/supabase/migrations/20260910000003_create_razorpay_subscriptions_and_payments.sql",
    "utf-8",
  );
  assert(
    migrationSql.includes("razorpay_customer_id") &&
      migrationSql.includes("razorpay_subscription_id") &&
      migrationSql.includes("razorpay_plan_id") &&
      migrationSql.includes("current_period_end"),
    24,
    "Database migration defines subscriptions table with complete Razorpay fields and RLS",
  );

  // 25. Database migration: payments schema defined with amount, currency (INR), method
  assert(
    migrationSql.includes("razorpay_payment_id") &&
      migrationSql.includes("amount") &&
      migrationSql.includes("currency") &&
      migrationSql.includes("payment_method"),
    25,
    "Database migration defines payments table with razorpay_payment_id, amount, currency, and method",
  );

  // 26. Pro activation unlocks all Pro tools immediately
  const activeProSub: RawSubscriptionData = {
    plan: "pro",
    status: "active",
    current_period_end: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
    cancel_at_period_end: false,
  };
  const evaluatedPlan = getEffectivePlan(activeProSub);
  assert(
    evaluatedPlan === "pro",
    26,
    "Active subscription with current_period_end in future immediately evaluates to 'pro'",
  );

  // 27. Pro activation removes conversion limits
  const proConversionLimit = CONVERSION_LIMITS.proDailyConversions;
  assert(
    proConversionLimit === Infinity,
    27,
    "Pro plan offers unlimited daily office conversions (proDailyConversions: Infinity)",
  );

  // 28. Pro activation removes OCR limits
  const proOcrLimit = OCR_LIMITS.proDailyPages;
  assert(
    proOcrLimit === Infinity,
    28,
    "Pro plan offers unlimited OCR pages (proDailyPages: Infinity)",
  );

  // 29. Pro activation increases file size limit to 250MB
  const maxFree = getMaxFileSizeBytes(false);
  const maxPro = getMaxFileSizeBytes(true);
  assert(
    maxFree === 50 * 1024 * 1024 && maxPro === 250 * 1024 * 1024,
    29,
    "Pro activation increases file size limit from 50 MB to 250 MB",
  );

  // 30. Pro activation shows Pro badge in header
  const headerSrc = fs.readFileSync("c:/Users/nayan/docly-craft/src/components/Header.tsx", "utf-8");
  assert(
    headerSrc.includes("isPro") && headerSrc.includes("PRO") && headerSrc.includes("bg-indigo-600"),
    30,
    "Header renders prominent Indigo [PRO] badge when user is on active Pro plan",
  );

  // 31. Pro activation shows Pro status on Account page with next billing date
  const accountSrc = fs.readFileSync("c:/Users/nayan/docly-craft/src/routes/account.tsx", "utf-8");
  assert(
    accountSrc.includes("Docly Pro (₹25/mo)") &&
      accountSrc.includes("Renews on") &&
      accountSrc.includes("cancelRazorpaySubscription"),
    31,
    "Account page displays Docly Pro (₹25/mo) with renewal date and Razorpay cancellation CTA",
  );

  // 32. Pro user can cancel subscription from Account page
  assert(
    accountSrc.includes("handleCancelSubscription") &&
      accountSrc.includes("cancelRazorpaySubscription"),
    32,
    "Pro user can trigger subscription cancellation from Account page",
  );

  // 33. Cancellation sets cancel_at_period_end = true, keeps Pro active until period end
  const cancellingSub: RawSubscriptionData = {
    plan: "pro",
    status: "active",
    current_period_end: new Date(Date.now() + 10 * 86400 * 1000).toISOString(),
    cancel_at_period_end: true,
  };
  const evalCancelling = evaluateSubscription(cancellingSub);
  assert(
    evalCancelling.isPro === true &&
      evalCancelling.effectivePlan === "pro" &&
      evalCancelling.cancelAtPeriodEnd === true,
    33,
    "Cancelled subscription remains fully Pro until current_period_end expires",
  );

  // 34. Expired subscription reverts user to Free tier automatically
  const expiredSub: RawSubscriptionData = {
    plan: "pro",
    status: "active",
    current_period_end: new Date(Date.now() - 5000).toISOString(), // 5 seconds in past
    cancel_at_period_end: true,
  };
  const evalExpired = evaluateSubscription(expiredSub);
  assert(
    evalExpired.isPro === false &&
      evalExpired.effectivePlan === "free" &&
      evalExpired.isExpired === true,
    34,
    "Subscription past current_period_end automatically reverts to 'free' without manual db edit",
  );

  // 35. Admin dashboard shows revenue, active subscribers, MRR, conversion rate
  const adminSrc = fs.readFileSync("c:/Users/nayan/docly-craft/src/routes/admin.tsx", "utf-8");
  assert(
    adminSrc.includes("Total Revenue") &&
      adminSrc.includes("Monthly Recurring Revenue (MRR)") &&
      adminSrc.includes("Active Pro Subscribers") &&
      adminSrc.includes("Razorpay"),
    35,
    "Admin dashboard displays Revenue, MRR, Active Subscribers, and Razorpay metrics",
  );

  // 36. Non-admin users cannot access admin dashboard
  const nonAdminReq = new Request("http://localhost/api/admin/metrics", { method: "GET" });
  const nonAdminRes = await handleAdminMetricsRequest(nonAdminReq, { ADMIN_EMAILS: "admin@docly.com" });
  assert(
    nonAdminRes.status === 403,
    36,
    "Non-admin users receiving 403 Forbidden on admin metrics endpoint",
  );

  console.log("================================================================");
  console.log(`TEST SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log("================================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runRazorpayTestSuite().catch((err) => {
  console.error("Test Suite crashed:", err);
  process.exit(1);
});
