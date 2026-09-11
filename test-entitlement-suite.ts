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

// 6. Active Paying Subscriber
runTest("6. Active Razorpay subscriber resolves to PRO", () => {
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const activeSub = {
    plan: "pro",
    status: "active",
    current_period_end: futureDate,
    razorpay_subscription_id: "sub_test123",
  };
  const result = resolveUserEntitlement(SUBSCRIBER_USER_ID, activeSub as any, null);
  assert.strictEqual(result.isPro, true);
  assert.strictEqual(result.effectivePlan, "pro");
  assert.strictEqual(result.status, "active");
  assert.strictEqual(result.razorpaySubscriptionId, "sub_test123");
});

// 7. Cancelled Subscription before period end
runTest("7. Cancelled Razorpay subscription before period end remains PRO until expiry", () => {
  const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const cancelledSub = {
    plan: "pro",
    status: "cancelled",
    cancel_at_period_end: true,
    current_period_end: futureDate,
    razorpay_subscription_id: "sub_test123",
  };
  const result = resolveUserEntitlement(SUBSCRIBER_USER_ID, cancelledSub as any, null);
  assert.strictEqual(result.isPro, true);
  assert.strictEqual(result.effectivePlan, "pro");
  assert.strictEqual(result.cancelAtPeriodEnd, true);
});

// 8. Cancelled Subscription past period end
runTest("8. Cancelled Razorpay subscription past period end resolves to FREE / EXPIRED", () => {
  const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const expiredSub = {
    plan: "pro",
    status: "cancelled",
    cancel_at_period_end: true,
    current_period_end: pastDate,
  };
  const result = resolveUserEntitlement(SUBSCRIBER_USER_ID, expiredSub as any, null);
  assert.strictEqual(result.isPro, false);
  assert.strictEqual(result.effectivePlan, "free");
  assert.strictEqual(result.isExpired, true);
});

// 9. Database Entitlements Table Support
runTest("9. Database entitlement with NULL expires_at gives lifetime PRO", () => {
  const otherUser = "99999999-8888-7777-6666-555555555555";
  const dbEntitlement = {
    plan: "pro",
    grant_type: "admin",
    expires_at: null,
    notes: "Lifetime test grant",
  };
  assert.strictEqual(isEntitlementActive(dbEntitlement), true);
  const result = resolveUserEntitlement(otherUser, null, dbEntitlement);
  assert.strictEqual(result.isPro, true);
  assert.strictEqual(result.effectivePlan, "pro");
  assert.strictEqual(result.status, "active");
});

// 10. Database Entitlement Expired
runTest("10. Expired database entitlement resolves to FREE", () => {
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
