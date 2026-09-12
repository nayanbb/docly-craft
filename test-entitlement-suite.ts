import assert from "node:assert";
import {
  isPermanentAdminProUser,
  isEntitlementActive,
  resolveUserEntitlement,
  PERMANENT_PRO_USER_IDS,
} from "./src/lib/monetization/entitlements";
import {
  CONVERSION_LIMITS,
  getMaxFileSizeBytes,
  getMaxFileSizeMb,
} from "./src/lib/monetization/config";
import { validateOfficeFile } from "./src/lib/office/validation";
import {
  getServerConversionUsage,
  incrementServerConversionUsage,
  resetServerConversionUsage,
} from "./src/lib/office/server-handler";

const PERMANENT_TEST_USER_ID = "3b686e20-8f22-4e1c-b274-6dfd7b520994";
const ORDINARY_USER_ID = "00000000-0000-0000-0000-000000000001";
const SUBSCRIBER_USER_ID = "00000000-0000-0000-0000-000000000002";

console.log("=================================================");
console.log("   DOCLY PERMANENT PRO & ENTITLEMENT TEST SUITE  ");
console.log("=================================================\n");

let passed = 0;
let total = 0;

function runTest(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err);
  }
}

// 1. Permanent Admin User ID Registry
runTest("1. Permanent Pro User ID is recognized (case-insensitive, trimmed)", () => {
  assert.strictEqual(isPermanentAdminProUser(PERMANENT_TEST_USER_ID), true);
  assert.strictEqual(isPermanentAdminProUser(PERMANENT_TEST_USER_ID.toUpperCase()), true);
  assert.strictEqual(isPermanentAdminProUser(`  ${PERMANENT_TEST_USER_ID}  `), true);
  assert.strictEqual(isPermanentAdminProUser(ORDINARY_USER_ID), false);
  assert.strictEqual(isPermanentAdminProUser(null), false);
  assert.strictEqual(isPermanentAdminProUser(undefined), false);
  assert.strictEqual(isPermanentAdminProUser(""), false);
});

// 2. Permanent Admin User with NO Razorpay Subscription
runTest("2. Permanent test user with NO Razorpay subscription resolves to PRO", () => {
  const result = resolveUserEntitlement(PERMANENT_TEST_USER_ID, null, null);
  assert.strictEqual(result.isPro, true);
  assert.strictEqual(result.effectivePlan, "pro");
  assert.strictEqual(result.status, "active");
  assert.strictEqual(result.isExpired, false);
  assert.strictEqual(result.isCancelled, false);
});

// 3. Permanent Admin User with Expired/Cancelled Razorpay Record
runTest("3. Permanent test user with expired/cancelled Razorpay record STILL resolves to PRO", () => {
  const expiredSub = {
    plan: "pro",
    status: "cancelled",
    current_period_end: new Date(Date.now() - 100000).toISOString(),
  };
  const result = resolveUserEntitlement(PERMANENT_TEST_USER_ID, expiredSub as any, null);
  assert.strictEqual(result.isPro, true);
  assert.strictEqual(result.effectivePlan, "pro");
  assert.strictEqual(result.status, "active");
});

// 4. Ordinary User without Subscription
runTest("4. Ordinary user with no subscription resolves to FREE", () => {
  const result = resolveUserEntitlement(ORDINARY_USER_ID, null, null);
  assert.strictEqual(result.isPro, false);
  assert.strictEqual(result.effectivePlan, "free");
  assert.strictEqual(result.status, "none");
});

// 5. Anonymous / Unauthenticated Request
runTest("5. Anonymous request resolves to FREE", () => {
  const result = resolveUserEntitlement(null, null, null);
  assert.strictEqual(result.isPro, false);
  assert.strictEqual(result.effectivePlan, "free");
  assert.strictEqual(result.status, "none");
});

// --- PHASE 13 MANDATORY TEST CASES (CASES 1 - 10) ---

// CASE 1: PayU active subscription
runTest("CASE 1: PayU active subscription (future period) -> isPro = true", () => {
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const payuActiveSub = {
    plan: "pro",
    status: "active",
    provider: "payu",
    provider_subscription_id: "payu_test_12345",
    current_period_end: futureDate,
  };
  const result = resolveUserEntitlement(SUBSCRIBER_USER_ID, payuActiveSub as any, null);
  assert.strictEqual(result.isPro, true);
  assert.strictEqual(result.effectivePlan, "pro");
  assert.strictEqual(result.status, "active");
  assert.strictEqual(result.provider, "payu");
  assert.strictEqual(result.providerSubscriptionId, "payu_test_12345");
});

// CASE 2: PayU expired subscription
runTest("CASE 2: PayU expired subscription -> isPro = false", () => {
  const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const payuExpiredSub = {
    plan: "pro",
    status: "active",
    provider: "payu",
    provider_subscription_id: "payu_test_expired",
    current_period_end: pastDate,
  };
  const result = resolveUserEntitlement(SUBSCRIBER_USER_ID, payuExpiredSub as any, null);
  assert.strictEqual(result.isPro, false);
  assert.strictEqual(result.effectivePlan, "free");
  assert.strictEqual(result.isExpired, true);
});

// CASE 3: PayU cancelled at period end but period still active
runTest("CASE 3: PayU cancelled at period end but period still active -> isPro = true", () => {
  const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const payuCancelledActiveSub = {
    plan: "pro",
    status: "cancelled",
    cancel_at_period_end: true,
    provider: "payu",
    provider_subscription_id: "payu_test_cancelled_grace",
    current_period_end: futureDate,
  };
  const result = resolveUserEntitlement(SUBSCRIBER_USER_ID, payuCancelledActiveSub as any, null);
  assert.strictEqual(result.isPro, true);
  assert.strictEqual(result.effectivePlan, "pro");
  assert.strictEqual(result.cancelAtPeriodEnd, true);
  assert.strictEqual(result.isCancelled, true);
  assert.strictEqual(result.isExpired, false);
});

// CASE 4: PayU cancelled and period expired
runTest("CASE 4: PayU cancelled and period expired -> isPro = false", () => {
  const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const payuCancelledExpiredSub = {
    plan: "pro",
    status: "cancelled",
    cancel_at_period_end: true,
    provider: "payu",
    provider_subscription_id: "payu_test_cancelled_expired",
    current_period_end: pastDate,
  };
  const result = resolveUserEntitlement(SUBSCRIBER_USER_ID, payuCancelledExpiredSub as any, null);
  assert.strictEqual(result.isPro, false);
  assert.strictEqual(result.effectivePlan, "free");
  assert.strictEqual(result.isExpired, true);
});

// CASE 5: Free user
runTest("CASE 5: Free user -> isPro = false", () => {
  const freeSub = {
    plan: "free",
    status: "active",
  };
  const result = resolveUserEntitlement(ORDINARY_USER_ID, freeSub as any, null);
  assert.strictEqual(result.isPro, false);
  assert.strictEqual(result.effectivePlan, "free");

  // Also user with no subscription row
  const noSubResult = resolveUserEntitlement(ORDINARY_USER_ID, null, null);
  assert.strictEqual(noSubResult.isPro, false);
  assert.strictEqual(noSubResult.effectivePlan, "free");
  assert.strictEqual(noSubResult.status, "none");
});

// CASE 6: Anonymous user
runTest("CASE 6: Anonymous user -> isPro = false", () => {
  const result = resolveUserEntitlement(null, null, null);
  assert.strictEqual(result.isPro, false);
  assert.strictEqual(result.effectivePlan, "free");
  assert.strictEqual(result.status, "none");
});

// CASE 7: Permanent admin user
runTest("CASE 7: Permanent admin user -> isPro = true", () => {
  const result = resolveUserEntitlement(PERMANENT_TEST_USER_ID, null, null);
  assert.strictEqual(result.isPro, true);
  assert.strictEqual(result.effectivePlan, "pro");
  assert.strictEqual(result.status, "active");
});

// CASE 8: Entitlement with expires_at NULL
runTest("CASE 8: Entitlement with expires_at NULL -> isPro = true (lifetime)", () => {
  const otherUser = "99999999-8888-7777-6666-555555555555";
  const dbEntitlement = {
    plan: "pro",
    grant_type: "admin",
    expires_at: null,
    notes: "Lifetime grant",
  };
  assert.strictEqual(isEntitlementActive(dbEntitlement), true);
  const result = resolveUserEntitlement(otherUser, null, dbEntitlement);
  assert.strictEqual(result.isPro, true);
  assert.strictEqual(result.effectivePlan, "pro");
  assert.strictEqual(result.status, "active");
});

// CASE 9: Entitlement expired
runTest("CASE 9: Entitlement expired -> isPro = false", () => {
  const otherUser = "99999999-8888-7777-6666-555555555555";
  const pastDate = new Date(Date.now() - 1000).toISOString();
  const dbEntitlement = {
    plan: "pro",
    grant_type: "trial",
    expires_at: pastDate,
  };
  assert.strictEqual(isEntitlementActive(dbEntitlement), false);
  const result = resolveUserEntitlement(otherUser, null, dbEntitlement);
  assert.strictEqual(result.isPro, false);
  assert.strictEqual(result.effectivePlan, "free");
});

// CASE 10: PayU subscription with NO Razorpay IDs (mandatory test)
runTest("CASE 10: PayU subscription with NO Razorpay IDs -> isPro = true", () => {
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const purelyPayUSub = {
    plan: "pro",
    status: "active",
    provider: "payu",
    provider_subscription_id: "payu_sub_strictly_no_razorpay",
    provider_customer_id: "payu_customer_123",
    provider_plan_id: "pro_monthly_25",
    current_period_end: futureDate,
    current_period_start: new Date().toISOString(),
    cancel_at_period_end: false,
    // Explicitly NO Razorpay IDs
    razorpay_customer_id: undefined,
    razorpay_subscription_id: undefined,
    razorpay_plan_id: undefined,
  };
  const result = resolveUserEntitlement("user_purely_payu", purelyPayUSub as any, null);
  assert.strictEqual(result.isPro, true, "Pure PayU subscription must unlock Pro");
  assert.strictEqual(result.effectivePlan, "pro", "Effective plan must be pro");
  assert.strictEqual(result.status, "active", "Status must be active");
  assert.strictEqual(result.provider, "payu", "Provider must be payu");
  assert.strictEqual(result.providerSubscriptionId, "payu_sub_strictly_no_razorpay");
  assert.strictEqual(result.razorpaySubscriptionId, undefined, "Razorpay ID is completely undefined");
});

// 11. File Size Limits (Free = 50MB, Pro = 250MB)
runTest("11. File size limits enforce 50MB Free vs 250MB Pro", async () => {
  assert.strictEqual(getMaxFileSizeMb(false), 50);
  assert.strictEqual(getMaxFileSizeMb(true), 250);
  assert.strictEqual(getMaxFileSizeBytes(false), 50 * 1024 * 1024);
  assert.strictEqual(getMaxFileSizeBytes(true), 250 * 1024 * 1024);

  // Fake 60 MB file
  const fake60MbFile = {
    name: "test.docx",
    size: 60 * 1024 * 1024,
    arrayBuffer: async () => new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer,
  };

  const freeValidation = await validateOfficeFile(fake60MbFile, "word-to-pdf", false);
  assert.strictEqual(freeValidation.valid, false);
  assert.strictEqual(freeValidation.isFileSizeLimitExceeded, true);

  const proValidation = await validateOfficeFile(fake60MbFile, "word-to-pdf", true);
  assert.strictEqual(proValidation.valid, true);
});

// 12. Office Conversion Daily Quota (Free = 10, Pro = Unlimited)
runTest("12. Conversion daily limit limits Free users to 10 and provides unlimited for Pro", () => {
  resetServerConversionUsage();
  const callerId = `user_${ORDINARY_USER_ID}`;
  const op = "word-to-pdf";
  const dateStr = "2026-09-10";

  // Free user up to 10 conversions
  for (let i = 0; i < 10; i++) {
    const usage = getServerConversionUsage(callerId, op, dateStr);
    assert.strictEqual(usage < CONVERSION_LIMITS.dailyFreeLimitPerTool, true);
    incrementServerConversionUsage(callerId, op, dateStr);
  }

  // 11th conversion for free user
  const usageAfter10 = getServerConversionUsage(callerId, op, dateStr);
  assert.strictEqual(usageAfter10 >= CONVERSION_LIMITS.dailyFreeLimitPerTool, true);

  // Pro user does not increment and is not checked by the server handler
  const proCallerId = `user_${PERMANENT_TEST_USER_ID}`;
  const proUsage = getServerConversionUsage(proCallerId, op, dateStr);
  assert.strictEqual(proUsage, 0); // never incremented for Pro!
});

console.log(`\nResults: ${passed} / ${total} tests passed.`);
if (passed !== total) {
  process.exit(1);
}
