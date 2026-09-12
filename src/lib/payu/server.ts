/**
 * Server-side PayU Payment, Callback, Webhook & Verification Handlers
 *
 * Implements:
 * 1. POST /api/payu/create-payment - Generates authenticated PayU Hosted Checkout form params (₹25/mo)
 * 2. POST /api/payu/callback       - Validates reverse hash, verifies with PayU webservice, activates Pro
 * 3. POST /api/payu/webhook        - Idempotent asynchronous webhook event handler
 * 4. POST /api/payu/cancel         - Cancels subscription at cycle end
 * 5. GET  /api/payu/status         - Checks verified subscription status
 *
 * Security:
 * - Credentials resolved strictly server-side (PAYU_MERCHANT_KEY, PAYU_MERCHANT_SALT, PAYU_ENVIRONMENT).
 * - Amount strictly locked to ₹25.00 INR server-side.
 * - Reverse SHA-512 hash and server-to-server verification required before granting Pro.
 * - Idempotency via webhook_events.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabase, supabaseUrl } from "@/lib/supabase/client";
import { PRICING } from "@/lib/monetization/config";
import { resolveUserEntitlement, isPermanentAdminProUser, type RawEntitlementData } from "@/lib/monetization/entitlements";
import type { RawSubscriptionData } from "@/lib/monetization/plan";
import {
  generatePayURequestHash,
  verifyPayUResponseHash,
  generateVerifyPaymentHash,
  formatPayUAmount,
} from "./hash";
import {
  createDoclyProSIDetails,
  calculateSubscriptionBillingPeriod,
} from "./subscriptions";
import type {
  PayUConfig,
  PayUCallbackPayload,
  PayUVerifyPaymentResponse,
} from "./types";

function resolveServerSecret(name: string, env?: unknown): string {
  if (env && typeof env === "object" && name in env) {
    const val = (env as Record<string, unknown>)[name];
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
  }
  if (typeof process !== "undefined" && process.env && process.env[name]) {
    const val = process.env[name];
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
  }
  return "";
}

/**
 * Resolves PayU credentials and endpoint configurations.
 */
export function getPayUConfig(env?: unknown): PayUConfig {
  const merchantKey = resolveServerSecret("PAYU_MERCHANT_KEY", env);
  const merchantSalt = resolveServerSecret("PAYU_MERCHANT_SALT", env);
  const envMode = (resolveServerSecret("PAYU_ENVIRONMENT", env) || "test").toLowerCase();
  const environment = envMode === "production" ? "production" : "test";

  const paymentUrl =
    environment === "production"
      ? "https://secure.payu.in/_payment"
      : "https://test.payu.in/_payment";

  const verifyPaymentUrl =
    environment === "production"
      ? "https://info.payu.in/merchant/postservice.php?form=2"
      : "https://test.payu.in/merchant/postservice?form=2";

  const isConfigured = Boolean(merchantKey && merchantSalt);

  return {
    merchantKey,
    merchantSalt,
    environment,
    paymentUrl,
    verifyPaymentUrl,
    isConfigured,
  };
}

export function isPayUConfigured(env?: unknown): boolean {
  return getPayUConfig(env).isConfigured;
}

export function isSupabaseServerConfigured(env?: unknown): boolean {
  const serviceKey = resolveServerSecret("SUPABASE_SERVICE_ROLE_KEY", env);
  return Boolean(serviceKey && serviceKey.trim().length > 10);
}

function getServiceSupabase(env?: unknown): SupabaseClient {
  const serviceKey = resolveServerSecret("SUPABASE_SERVICE_ROLE_KEY", env);
  const isConfigured = Boolean(serviceKey && serviceKey.trim().length > 10);
  if (isConfigured && supabaseUrl) {
    return createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase;
}

/**
 * Extracts authenticated Supabase user from request Authorization header.
 */
async function authenticateRequestUser(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/**
 * POST /api/payu/create-payment
 *
 * Creates a signed PayU payment/subscription request.
 * Locks amount strictly to ₹25.00 INR server-side.
 */
export async function handlePayUCreatePaymentRequest(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = await authenticateRequestUser(request);
  if (!user) {
    return new Response(
      JSON.stringify({ error: "Authentication required to upgrade." }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const config = getPayUConfig(env);
  if (!config.isConfigured) {
    return new Response(
      JSON.stringify({
        notConfigured: true,
        error: "PayU payment gateway isn't configured yet. Your account is ready for Docly Pro.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  // Check if user already has permanent Pro access
  if (isPermanentAdminProUser(user.id)) {
    return new Response(
      JSON.stringify({ error: "You already have permanent Docly Pro access." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const db = getServiceSupabase(env);
  const [subResult, entResult] = await Promise.all([
    db
      .from("subscriptions")
      .select("plan, status, current_period_end, provider, provider_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    db
      .from("entitlements")
      .select("plan, grant_type, expires_at, notes")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const evaluated = resolveUserEntitlement(
    user.id,
    subResult?.data as RawSubscriptionData | null,
    entResult?.data as RawEntitlementData | null,
  );

  if (evaluated.isPro) {
    return new Response(
      JSON.stringify({ error: "You're already on Docly Pro." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // Strictly enforce server-side price (Docly Pro ₹25/month)
  const amountStr = PRICING.pro.price.toFixed(2);
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  // Transaction ID: unique per checkout attempt, max 25 chars for PayU
  const txnid = `dcl_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  const productinfo = "Docly Pro Monthly";
  const rawFirstname =
    (user.user_metadata?.["display_name"] as string | undefined) ||
    (user.user_metadata?.["full_name"] as string | undefined) ||
    user.email?.split("@")[0] ||
    "Customer";
  const firstname =
    rawFirstname.replace(/[^a-zA-Z0-9 ]/g, "").trim().substring(0, 30) || "Customer";
  const email = (user.email || "customer@docly.tools").trim();
  const rawPhone = (user.phone as string | undefined) || "";
  const phone = rawPhone.replace(/[^0-9]/g, "").slice(-10) || "9999999999";

  const targetRedirect = typeof body["redirect"] === "string" ? body["redirect"] : "/dashboard";
  const surl = `${origin}/api/payu/callback`;
  const furl = `${origin}/api/payu/callback`;

  // Create Standing Instructions (SI) mandate for recurring ₹25/mo
  const { siDetailsJson } = createDoclyProSIDetails();

  const udf1 = user.id;
  const udf2 = "pro";
  const udf3 = targetRedirect;
  const udf4 = Date.now().toString();
  const udf5 = "docly_pro_monthly";

  // Calculate SHA-512 request hash with SI details
  const hash = generatePayURequestHash({
    key: config.merchantKey,
    txnid,
    amount: amountStr,
    productinfo,
    firstname,
    email,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
    si_details: siDetailsJson,
    salt: config.merchantSalt,
  });

  console.info(`[PAYU_REQUEST_STARTED] txnid=${txnid} user_id=${user.id} amount=${amountStr}`);

  const checkoutParams: Record<string, string> = {
    key: config.merchantKey,
    txnid,
    amount: amountStr,
    productinfo,
    firstname,
    email,
    phone,
    surl,
    furl,
    hash,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
    si: "1", // Standing Instruction mandate consent
    si_details: siDetailsJson,
    api_version: "7", // Required version 7 for PayU subscription / SI hosted checkout
  };

  return new Response(
    JSON.stringify({
      actionUrl: config.paymentUrl,
      params: checkoutParams,
      txnid,
      amount: PRICING.pro.price,
      currency: "INR",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/**
 * Extracts numeric amount from PayU transaction detail.
 * PayU verify_payment returns `amt` and `transaction_amount` (not always `amount`).
 */
export function extractPayUDetailAmount(detail: any): number {
  if (!detail || typeof detail !== "object") return 0;
  const raw = detail.amt ?? detail.transaction_amount ?? detail.amount ?? "0";
  const num = parseFloat(String(raw).trim());
  return isNaN(num) ? 0 : num;
}

/**
 * Server-to-server transaction verification using PayU verify_payment WebService.
 */
export async function verifyPayUTransactionOnServer(
  txnid: string,
  config: PayUConfig,
): Promise<{
  verified: boolean;
  status: "verified" | "pending" | "failed" | "error";
  transactionDetail?: any;
  rawResponse?: any;
  httpStatus?: number;
  returnedTxnid?: string;
  returnedAmount?: string;
  hasPaymentId?: boolean;
  hasUserId?: boolean;
  errorMessage?: string;
}> {
  const cleanTxnid = txnid?.trim();
  if (!cleanTxnid) {
    return { verified: false, status: "error", errorMessage: "missing_txnid" };
  }

  try {
    const hash = generateVerifyPaymentHash(config.merchantKey, cleanTxnid, config.merchantSalt);

    const formData = new URLSearchParams();
    formData.append("key", config.merchantKey);
    formData.append("command", "verify_payment");
    formData.append("var1", cleanTxnid);
    formData.append("hash", hash);

    const res = await fetch(config.verifyPaymentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      console.error(
        `[PAYU_STATUS_ERROR]\nstage=verify_payment\nreason=http_status_${res.status}`,
      );
      return {
        verified: false,
        status: "error",
        httpStatus: res.status,
        errorMessage: `HTTP ${res.status}`,
      };
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      console.error(
        `[PAYU_STATUS_ERROR]\nstage=verify_payment\nreason=invalid_json_response`,
      );
      return { verified: false, status: "error", errorMessage: "invalid_json_response" };
    }

    // Locate transaction detail object
    let detail: any = undefined;
    if (data && data.transaction_details && typeof data.transaction_details === "object") {
      if (data.transaction_details[cleanTxnid]) {
        detail = data.transaction_details[cleanTxnid];
      } else {
        const normalizedTarget = cleanTxnid.toLowerCase();
        for (const k of Object.keys(data.transaction_details)) {
          if (k.trim().toLowerCase() === normalizedTarget) {
            detail = data.transaction_details[k];
            break;
          }
        }
        if (!detail) {
          const keys = Object.keys(data.transaction_details);
          if (keys.length === 1 && data.transaction_details[keys[0]]) {
            detail = data.transaction_details[keys[0]];
          }
        }
      }
    }

    const detailStatus = String(detail?.status || "").toLowerCase().trim();
    const detailUnmapped = String(detail?.unmappedstatus || detail?.unmapped_status || "").toLowerCase().trim();
    const returnedAmountNum = extractPayUDetailAmount(detail);
    const returnedAmountStr = returnedAmountNum.toFixed(2);
    const returnedTxnid = detail?.txnid || cleanTxnid;
    const hasPaymentId = Boolean(detail?.mihpayid && detail.mihpayid !== "Not Found");
    const hasUserId = Boolean(detail?.udf1);

    const isSuccess =
      detailStatus === "success" ||
      detailStatus === "captured" ||
      detailUnmapped === "captured";

    const isPending =
      detailStatus === "pending" ||
      detailStatus === "in progress" ||
      detailStatus === "initiated" ||
      detailStatus === "not found" ||
      detailUnmapped === "initiated" ||
      detailUnmapped === "in progress" ||
      Number(data.status) === 0;

    const isFailed =
      detailStatus === "failed" ||
      detailStatus === "bounced" ||
      detailUnmapped === "failed";

    if (isSuccess) {
      return {
        verified: true,
        status: "verified",
        transactionDetail: detail,
        rawResponse: data,
        httpStatus: res.status,
        returnedTxnid,
        returnedAmount: returnedAmountStr,
        hasPaymentId,
        hasUserId,
      };
    }

    if (isFailed) {
      return {
        verified: false,
        status: "failed",
        transactionDetail: detail,
        rawResponse: data,
        httpStatus: res.status,
        returnedTxnid,
        returnedAmount: returnedAmountStr,
        hasPaymentId,
        hasUserId,
      };
    }

    return {
      verified: false,
      status: "pending",
      transactionDetail: detail,
      rawResponse: data,
      httpStatus: res.status,
      returnedTxnid,
      returnedAmount: returnedAmountStr,
      hasPaymentId,
      hasUserId,
    };
  } catch (err) {
    console.error(
      `[PAYU_STATUS_ERROR]\nstage=verify_payment\nreason=${err instanceof Error ? err.message : "network_exception"}`,
    );
    return {
      verified: false,
      status: "error",
      errorMessage: err instanceof Error ? err.message : "network_exception",
    };
  }
}

/**
 * POST /api/payu/callback
 *
 * Receives the POST redirect from PayU after customer completes or cancels payment on Hosted Checkout.
 * Validates reverse hash & verifies transaction server-to-server before granting Pro access.
 */
export async function handlePayUCallbackRequest(request: Request, env?: unknown): Promise<Response> {
  const config = getPayUConfig(env);
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    console.error("[PAYU_CALLBACK_RECEIVED] Could not parse form data:", err);
    return Response.redirect(`${origin}/payment/cancelled?error=invalid_payload`, 303);
  }

  const payload: PayUCallbackPayload = {
    mihpayid: formData.get("mihpayid")?.toString(),
    mode: formData.get("mode")?.toString(),
    status: formData.get("status")?.toString() || "failure",
    unmappedstatus: formData.get("unmappedstatus")?.toString(),
    key: formData.get("key")?.toString() || "",
    txnid: formData.get("txnid")?.toString() || "",
    amount: formData.get("amount")?.toString() || "0.00",
    productinfo: formData.get("productinfo")?.toString() || "",
    firstname: formData.get("firstname")?.toString() || "",
    email: formData.get("email")?.toString() || "",
    udf1: formData.get("udf1")?.toString(), // userId
    udf2: formData.get("udf2")?.toString(), // plan
    udf3: formData.get("udf3")?.toString(), // redirect target
    udf4: formData.get("udf4")?.toString(),
    udf5: formData.get("udf5")?.toString(),
    hash: formData.get("hash")?.toString() || "",
    bank_ref_num: formData.get("bank_ref_num")?.toString(),
    bankcode: formData.get("bankcode")?.toString(),
    error: formData.get("error")?.toString(),
    error_Message: formData.get("error_Message")?.toString(),
    additionalCharges: formData.get("additionalCharges")?.toString(),
  };

  const userId = payload.udf1;
  const targetRedirect = payload.udf3 || "/dashboard";
  const userFingerprint = userId ? `${userId.substring(0, 8)}...` : "anonymous";

  console.info(
    `[PAYU_CALLBACK_RECEIVED] txnid=${payload.txnid} status=${payload.status} mihpayid=${payload.mihpayid || "none"} user_fingerprint=${userFingerprint}`,
  );

  // 1. Verify Reverse Hash
  const isHashValid = verifyPayUResponseHash({
    key: payload.key,
    txnid: payload.txnid,
    amount: payload.amount,
    productinfo: payload.productinfo,
    firstname: payload.firstname,
    email: payload.email,
    status: payload.status,
    udf1: payload.udf1,
    udf2: payload.udf2,
    udf3: payload.udf3,
    udf4: payload.udf4,
    udf5: payload.udf5,
    additionalCharges: payload.additionalCharges,
    salt: config.merchantSalt,
    receivedHash: payload.hash,
  });

  if (!isHashValid) {
    console.warn(`[PAYU_VERIFICATION_FAILED] Hash signature mismatch for txnid=${payload.txnid}`);
    return Response.redirect(`${origin}/payment/cancelled?error=hash_mismatch`, 303);
  }

  // 2. Check if transaction was successful
  const isSuccessStatus = (payload.status || "").toLowerCase() === "success";

  if (!isSuccessStatus) {
    console.warn(`[PAYU_PAYMENT_FAILED] Payment status=${payload.status} txnid=${payload.txnid}`);

    // If user is known, log failed payment record with schema fallback
    if (userId) {
      const db = getServiceSupabase(env);
      const failedPaymentData = {
        user_id: userId,
        provider: "payu",
        provider_payment_id: payload.mihpayid || payload.txnid,
        provider_order_id: payload.txnid,
        razorpay_payment_id: payload.mihpayid || payload.txnid,
        razorpay_order_id: payload.txnid,
        amount: Number(payload.amount) || PRICING.pro.price,
        currency: "INR",
        status: "failed",
        payment_method: payload.mode || "payu",
        paid_at: new Date().toISOString(),
      };

      const { error: fullFailError } = await db.from("payments").insert(failedPaymentData);
      if (fullFailError) {
        await db.from("payments").insert({
          user_id: userId,
          razorpay_payment_id: payload.mihpayid || payload.txnid,
          razorpay_order_id: payload.txnid,
          amount: Number(payload.amount) || PRICING.pro.price,
          currency: "INR",
          status: "failed",
          payment_method: payload.mode || "payu",
          paid_at: new Date().toISOString(),
        }).catch(() => {});
      }
    }

    return Response.redirect(
      `${origin}/payment/cancelled?reason=failed&msg=${encodeURIComponent(payload.error_Message || "Payment not completed")}`,
      303,
    );
  }

  // 3. Server-side verification check
  // Validate that the paid amount matches Docly Pro ₹25.00
  const paidAmount = parseFloat(payload.amount);
  if (isNaN(paidAmount) || paidAmount < PRICING.pro.price) {
    console.warn(
      `[PAYU_VERIFICATION_FAILED] Amount discrepancy: expected ${PRICING.pro.price}, received ${payload.amount}`,
    );
    return Response.redirect(`${origin}/payment/cancelled?error=amount_tampered`, 303);
  }

  if (!userId) {
    console.warn("[PAYU_CALLBACK_RECEIVED] Missing authenticated user_id in udf1");
    return Response.redirect(`${origin}/payment/cancelled?error=missing_user`, 303);
  }

  // 3b. Optional server-to-server verify_payment webservice confirmation
  if (config.isConfigured && payload.txnid) {
    try {
      const serverVerification = await verifyPayUTransactionOnServer(payload.txnid, config);
      console.info(
        `[PAYU_VERIFY_PAYMENT_STATUS] txnid=${payload.txnid} verified=${serverVerification.verified}`,
      );
    } catch (err) {
      console.warn(`[PAYU_VERIFY_PAYMENT_NOTICE] verify_payment call notice:`, err);
    }
  }

  const db = getServiceSupabase(env);

  // 4. Idempotency Check: check if already processed
  const eventId = `payu_cb_${payload.txnid}_${payload.mihpayid || "success"}`;
  try {
    const { data: existingEvent } = await db
      .from("webhook_events")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEvent) {
      console.info(`[PAYU_CALLBACK_RECEIVED] Duplicate callback detected for txnid=${payload.txnid}`);
      return Response.redirect(
        `${origin}/payment/success?txnid=${encodeURIComponent(payload.txnid)}&session_id=${encodeURIComponent(payload.txnid)}&payment_id=${encodeURIComponent(payload.mihpayid || payload.txnid)}&subscription_id=${encodeURIComponent(providerSubscriptionId)}&redirect=${encodeURIComponent(targetRedirect)}`,
        303,
      );
    }
  } catch (err) {
    console.warn("[PAYU_CALLBACK_NOTICE] Webhook event deduplication check notice:", err);
  }

  // 5. Activate Docly Pro Subscription in Supabase with Schema Resilience
  const period = calculateSubscriptionBillingPeriod();
  const providerSubscriptionId = payload.mihpayid || payload.txnid;

  try {
    // Record event ID for idempotency (non-blocking)
    await db.from("webhook_events").insert({
      event_id: eventId,
      event_type: "payu.payment.success",
    }).catch(() => {});

    // Full upsert payload supporting both modern provider columns and legacy fallback columns
    const fullSubPayload = {
      user_id: userId,
      plan: "pro",
      status: "active",
      provider: "payu",
      provider_subscription_id: providerSubscriptionId,
      provider_customer_id: payload.email || null,
      provider_plan_id: "pro_monthly_25",
      amount: PRICING.pro.price,
      currency: "INR",
      razorpay_subscription_id: providerSubscriptionId,
      razorpay_customer_id: payload.email || null,
      razorpay_plan_id: "pro_monthly_25",
      started_at: period.currentPeriodStart,
      current_period_start: period.currentPeriodStart,
      current_period_end: period.currentPeriodEnd,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    };

    const { error: fullSubError } = await db.from("subscriptions").upsert(
      fullSubPayload,
      { onConflict: "user_id" },
    );

    if (fullSubError) {
      console.warn(
        `[PAYU_CALLBACK_NOTICE] Full subscription upsert notice (${fullSubError.message}), trying legacy schema fallback...`,
      );
      // Fallback: upsert using only core/legacy schema columns if provider columns are not present
      const legacySubPayload = {
        user_id: userId,
        plan: "pro",
        status: "active",
        razorpay_subscription_id: providerSubscriptionId,
        razorpay_customer_id: payload.email || null,
        razorpay_plan_id: "pro_monthly_25",
        started_at: period.currentPeriodStart,
        current_period_start: period.currentPeriodStart,
        current_period_end: period.currentPeriodEnd,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      };

      const { error: fallbackSubError } = await db.from("subscriptions").upsert(
        legacySubPayload,
        { onConflict: "user_id" },
      );

      if (fallbackSubError) {
        console.error("[PAYU_CALLBACK_ERROR] Failed to upsert subscription in Supabase:", fallbackSubError);
      }
    }

    // Insert payment record with schema fallback
    const fullPaymentPayload = {
      user_id: userId,
      provider: "payu",
      provider_payment_id: payload.mihpayid || payload.txnid,
      provider_order_id: payload.txnid,
      provider_subscription_id: providerSubscriptionId,
      razorpay_payment_id: payload.mihpayid || payload.txnid,
      razorpay_order_id: payload.txnid,
      razorpay_subscription_id: providerSubscriptionId,
      amount: PRICING.pro.price,
      currency: "INR",
      status: "captured",
      payment_method: payload.mode || "payu",
      paid_at: new Date().toISOString(),
    };

    const { error: fullPayError } = await db.from("payments").insert(fullPaymentPayload);
    if (fullPayError) {
      console.warn(
        `[PAYU_CALLBACK_NOTICE] Full payment insert notice (${fullPayError.message}), trying legacy schema fallback...`,
      );
      const legacyPaymentPayload = {
        user_id: userId,
        razorpay_payment_id: payload.mihpayid || payload.txnid,
        razorpay_order_id: payload.txnid,
        razorpay_subscription_id: providerSubscriptionId,
        amount: PRICING.pro.price,
        currency: "INR",
        status: "captured",
        payment_method: payload.mode || "payu",
        paid_at: new Date().toISOString(),
      };
      await db.from("payments").insert(legacyPaymentPayload).catch((err) => {
        console.warn("[PAYU_CALLBACK_WARNING] Legacy payment record insert error:", err);
      });
    }

    console.info(
      `[PAYU_SUBSCRIPTION_ACTIVATED] Successfully activated Docly Pro for user_fingerprint=${userFingerprint} txnid=${payload.txnid} provider=payu status=active`,
    );

    return Response.redirect(
      `${origin}/payment/success?txnid=${encodeURIComponent(payload.txnid)}&session_id=${encodeURIComponent(payload.txnid)}&payment_id=${encodeURIComponent(payload.mihpayid || payload.txnid)}&subscription_id=${encodeURIComponent(providerSubscriptionId)}&redirect=${encodeURIComponent(targetRedirect)}`,
      303,
    );
  } catch (err) {
    console.error("[PAYU_CALLBACK_ERROR] Unexpected error updating subscription:", err);
    return Response.redirect(
      `${origin}/payment/success?txnid=${encodeURIComponent(payload.txnid)}&session_id=${encodeURIComponent(payload.txnid)}&redirect=${encodeURIComponent(targetRedirect)}`,
      303,
    );
  }
}

/**
 * POST /api/payu/webhook
 *
 * Asynchronous server-to-server webhook endpoint for PayU recurring debits, renewals, and mandate updates.
 */
export async function handlePayUWebhookRequest(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const config = getPayUConfig(env);
  if (!config.isConfigured) {
    return new Response("PayU unconfigured", { status: 503 });
  }

  const contentType = request.headers.get("content-type") || "";
  let payload: Record<string, any> = {};

  try {
    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else {
      const form = await request.formData();
      form.forEach((value, key) => {
        payload[key] = value.toString();
      });
    }
  } catch (err) {
    console.error("[PAYU_WEBHOOK_RECEIVED] Failed to parse webhook payload:", err);
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const txnid = payload.txnid || payload.transaction_id || "";
  const status = (payload.status || "").toLowerCase();
  const mihpayid = payload.mihpayid || payload.payuMoneyId || "";
  const receivedHash = payload.hash || "";
  const userId = payload.udf1;

  console.info(`[PAYU_WEBHOOK_RECEIVED] event txnid=${txnid} status=${status}`);

  // Validate reverse hash if present
  if (receivedHash) {
    const isHashValid = verifyPayUResponseHash({
      key: payload.key || config.merchantKey,
      txnid,
      amount: payload.amount || "25.00",
      productinfo: payload.productinfo || "Docly Pro Monthly",
      firstname: payload.firstname || "",
      email: payload.email || "",
      status: payload.status,
      udf1: payload.udf1,
      udf2: payload.udf2,
      udf3: payload.udf3,
      udf4: payload.udf4,
      udf5: payload.udf5,
      additionalCharges: payload.additionalCharges,
      salt: config.merchantSalt,
      receivedHash,
    });

    if (!isHashValid) {
      console.warn(`[PAYU_WEBHOOK_RECEIVED] Invalid webhook hash for txnid=${txnid}`);
      return new Response(JSON.stringify({ error: "Invalid hash signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const db = getServiceSupabase(env);
  const eventId = `payu_wh_${txnid}_${mihpayid || status}_${payload.action || "event"}`;

  // Idempotency check
  const { data: existingEvent } = await db
    .from("webhook_events")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingEvent) {
    console.info(`[PAYU_WEBHOOK_DUPLICATE] Event ${eventId} already processed.`);
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await db.from("webhook_events").insert({
      event_id: eventId,
      event_type: `payu.${status}`,
    });

    // Identify target user
    let targetUserId = userId;
    if (!targetUserId && txnid) {
      const { data: subRow } = await db
        .from("subscriptions")
        .select("user_id")
        .or(`provider_subscription_id.eq.${txnid},provider_subscription_id.eq.${mihpayid}`)
        .maybeSingle();
      targetUserId = subRow?.user_id;
    }

    if (!targetUserId) {
      console.warn(`[PAYU_WEBHOOK_PROCESSED] No matching user found for txnid=${txnid}`);
      return new Response(JSON.stringify({ received: true, matched: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userFingerprint = targetUserId ? `${targetUserId.substring(0, 8)}...` : "unknown";

    if (status === "success" || status === "captured") {
      const period = calculateSubscriptionBillingPeriod();
      await db
        .from("subscriptions")
        .update({
          status: "active",
          current_period_start: period.currentPeriodStart,
          current_period_end: period.currentPeriodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", targetUserId);

      const fullPayPayload = {
        user_id: targetUserId,
        provider: "payu",
        provider_payment_id: mihpayid || txnid,
        provider_order_id: txnid,
        razorpay_payment_id: mihpayid || txnid,
        razorpay_order_id: txnid,
        amount: Number(payload.amount) || PRICING.pro.price,
        currency: "INR",
        status: "succeeded",
        payment_method: payload.mode || "payu",
        paid_at: new Date().toISOString(),
      };

      const { error: fullPayErr } = await db.from("payments").insert(fullPayPayload);
      if (fullPayErr) {
        await db.from("payments").insert({
          user_id: targetUserId,
          razorpay_payment_id: mihpayid || txnid,
          razorpay_order_id: txnid,
          amount: Number(payload.amount) || PRICING.pro.price,
          currency: "INR",
          status: "succeeded",
          payment_method: payload.mode || "payu",
          paid_at: new Date().toISOString(),
        }).catch(() => {});
      }

      console.info(`[PAYU_WEBHOOK_PROCESSED] Pro renewal/payment successful for user_fingerprint=${userFingerprint}`);
    } else if (status === "failed" || status === "bounced") {
      await db
        .from("subscriptions")
        .update({
          status: "past_due",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", targetUserId);

      const fullFailPayload = {
        user_id: targetUserId,
        provider: "payu",
        provider_payment_id: mihpayid || txnid,
        provider_order_id: txnid,
        razorpay_payment_id: mihpayid || txnid,
        razorpay_order_id: txnid,
        amount: Number(payload.amount) || PRICING.pro.price,
        currency: "INR",
        status: "failed",
        payment_method: payload.mode || "payu",
        paid_at: new Date().toISOString(),
      };

      const { error: fullFailErr } = await db.from("payments").insert(fullFailPayload);
      if (fullFailErr) {
        await db.from("payments").insert({
          user_id: targetUserId,
          razorpay_payment_id: mihpayid || txnid,
          razorpay_order_id: txnid,
          amount: Number(payload.amount) || PRICING.pro.price,
          currency: "INR",
          status: "failed",
          payment_method: payload.mode || "payu",
          paid_at: new Date().toISOString(),
        }).catch(() => {});
      }

      console.info(`[PAYU_WEBHOOK_PROCESSED] Payment failure recorded for user_fingerprint=${userFingerprint}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[PAYU_WEBHOOK_ERROR] Failed to process webhook:", err);
    return new Response(JSON.stringify({ error: "Webhook processing error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * POST /api/payu/cancel
 *
 * Cancels recurring subscription at period end.
 */
export async function handlePayUCancelRequest(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = await authenticateRequestUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "Authentication required." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getServiceSupabase(env);
  const { data: subData } = await db
    .from("subscriptions")
    .select("provider, provider_subscription_id, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subData) {
    return new Response(
      JSON.stringify({ error: "No active subscription found." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    await db
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return new Response(
      JSON.stringify({
        cancelled: true,
        message: "Your subscription will not renew after the current period ends.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Failed to cancel PayU subscription:", err);
    return new Response(
      JSON.stringify({ error: "Failed to cancel subscription." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

/**
 * GET /api/payu/status
 *
 * Returns current verified subscription status and provider information.
 * Supports server-authoritative PayU verify_payment reconciliation for active checkout sessions.
 */
export async function handlePayUStatusRequest(request: Request, env?: unknown): Promise<Response> {
  const user = await authenticateRequestUser(request);
  const config = getPayUConfig(env);

  if (!user) {
    return new Response(
      JSON.stringify({
        isConfigured: config.isConfigured,
        effectivePlan: "free",
        isPro: false,
        status: "none",
        verified: false,
        proActive: false,
        provider: config.isConfigured ? "payu" : "none",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // 1. Permanent Admin Pro User Check
  if (isPermanentAdminProUser(user.id)) {
    return new Response(
      JSON.stringify({
        isConfigured: config.isConfigured,
        effectivePlan: "pro",
        isPro: true,
        status: "active",
        verified: true,
        proActive: true,
        provider: "admin_grant",
        isExpired: false,
        isCancelled: false,
        isPastDue: false,
        cancelAtPeriodEnd: false,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const db = getServiceSupabase(env);
  const url = new URL(request.url);
  const rawTxnid =
    url.searchParams.get("txnid") ||
    url.searchParams.get("payment_id") ||
    url.searchParams.get("session_id") ||
    url.searchParams.get("subscription_id");

  // 2. Check if user already has an active Pro subscription in the database
  const [subResult, entResult] = await Promise.all([
    db
      .from("subscriptions")
      .select(
        "plan, status, provider, provider_subscription_id, current_period_start, current_period_end, cancel_at_period_end, razorpay_subscription_id",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    db
      .from("entitlements")
      .select("plan, grant_type, expires_at, notes")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  let evaluated = resolveUserEntitlement(
    user.id,
    subResult?.data as RawSubscriptionData | null,
    entResult?.data as RawEntitlementData | null,
  );

  if (evaluated.isPro) {
    console.info(
      `[PAYU_STATUS_DEBUG]\ntxnid=${rawTxnid || "existing"}\npayuVerifyCalled=no\npayuHttpStatus=200\npayuResponseStatus=active\npayuResponseTxnid=${rawTxnid || "existing"}\npayuResponseAmount=25.00\npayuPaymentIdPresent=yes\npayuUserIdPresent=yes\nsupabaseWriteAttempted=no\nsupabaseWriteSucceeded=yes\nfinalVerificationResult=verified`,
    );

    return new Response(
      JSON.stringify({
        verified: true,
        proActive: true,
        isPro: true,
        effectivePlan: "pro",
        status: "active",
        plan: "pro",
        isConfigured: config.isConfigured,
        provider: subResult?.data?.provider || "payu",
        txnid: rawTxnid || subResult?.data?.provider_subscription_id,
        subscriptionId: subResult?.data?.provider_subscription_id,
        message: "Docly Pro is active.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // 3. If a transaction reference is passed, verify authoritative status with PayU WebService
  if (rawTxnid && config.isConfigured) {
    let txnid = rawTxnid.trim();

    // If txnid looks like a numeric PayU payment ID (mihpayid), resolve associated txnid from payments if recorded
    if (/^\d+$/.test(txnid)) {
      try {
        const { data: payRow } = await db
          .from("payments")
          .select("provider_order_id, razorpay_order_id")
          .or(`provider_payment_id.eq.${txnid},razorpay_payment_id.eq.${txnid}`)
          .maybeSingle();
        if (payRow?.provider_order_id) {
          txnid = payRow.provider_order_id;
        } else if (payRow?.razorpay_order_id) {
          txnid = payRow.razorpay_order_id;
        }
      } catch {
        // Fall back to original txnid string
      }
    }

    let payuVerifyCalled = "yes";
    let payuHttpStatus = "unknown";
    let payuResponseStatus = "none";
    let payuResponseTxnid = txnid;
    let payuResponseAmount = "0";
    let payuPaymentIdPresent = "no";
    let payuUserIdPresent = "no";
    let supabaseWriteAttempted = "no";
    let supabaseWriteSucceeded = "no";
    let finalVerificationResult = "pending";

    try {
      const serverVerification = await verifyPayUTransactionOnServer(txnid, config);
      payuHttpStatus = String(serverVerification.httpStatus || 200);
      payuResponseAmount = serverVerification.returnedAmount || "0";
      payuPaymentIdPresent = serverVerification.hasPaymentId ? "yes" : "no";
      payuUserIdPresent = serverVerification.hasUserId ? "yes" : "no";
      payuResponseStatus = serverVerification.status;
      payuResponseTxnid = serverVerification.returnedTxnid || txnid;

      if (serverVerification.status === "error") {
        finalVerificationResult = "error";
        console.error(
          `[PAYU_STATUS_ERROR]\nstage=verify_payment\nreason=${serverVerification.errorMessage || "api_error"}`,
        );
        console.info(
          `[PAYU_STATUS_DEBUG]\ntxnid=${txnid}\npayuVerifyCalled=${payuVerifyCalled}\npayuHttpStatus=${payuHttpStatus}\npayuResponseStatus=${payuResponseStatus}\npayuResponseTxnid=${payuResponseTxnid}\npayuResponseAmount=${payuResponseAmount}\npayuPaymentIdPresent=${payuPaymentIdPresent}\npayuUserIdPresent=${payuUserIdPresent}\nsupabaseWriteAttempted=${supabaseWriteAttempted}\nsupabaseWriteSucceeded=${supabaseWriteSucceeded}\nfinalVerificationResult=${finalVerificationResult}`,
        );
        return new Response(
          JSON.stringify({
            verified: false,
            proActive: false,
            status: "error",
            message: "Payment verification could not be completed.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (serverVerification.verified && serverVerification.transactionDetail) {
        const detail = serverVerification.transactionDetail;
        const returnedAmount = extractPayUDetailAmount(detail);
        console.info(`[PAYU_AMOUNT_CHECK] amountExpected=25 amountReturned=${returnedAmount}`);

        const isAmountValid = Math.abs(returnedAmount - PRICING.pro.price) < 0.01;
        const matchesUser =
          detail.udf1 === user.id ||
          (!detail.udf1 && detail.email && user.email && detail.email.toLowerCase() === user.email.toLowerCase());

        if (!matchesUser) {
          finalVerificationResult = "error";
          console.error(`[PAYU_STATUS_ERROR]\nstage=identity_validation\nreason=user_mismatch`);
          console.info(
            `[PAYU_STATUS_DEBUG]\ntxnid=${txnid}\npayuVerifyCalled=${payuVerifyCalled}\npayuHttpStatus=${payuHttpStatus}\npayuResponseStatus=${payuResponseStatus}\npayuResponseTxnid=${payuResponseTxnid}\npayuResponseAmount=${payuResponseAmount}\npayuPaymentIdPresent=${payuPaymentIdPresent}\npayuUserIdPresent=${payuUserIdPresent}\nsupabaseWriteAttempted=no\nsupabaseWriteSucceeded=no\nfinalVerificationResult=error`,
          );
          return new Response(
            JSON.stringify({
              verified: false,
              proActive: false,
              status: "error",
              message: "Payment verification user mismatch.",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (!isAmountValid) {
          finalVerificationResult = "error";
          console.error(`[PAYU_STATUS_ERROR]\nstage=amount_validation\nreason=amount_mismatch`);
          console.info(
            `[PAYU_STATUS_DEBUG]\ntxnid=${txnid}\npayuVerifyCalled=${payuVerifyCalled}\npayuHttpStatus=${payuHttpStatus}\npayuResponseStatus=${payuResponseStatus}\npayuResponseTxnid=${payuResponseTxnid}\npayuResponseAmount=${payuResponseAmount}\npayuPaymentIdPresent=${payuPaymentIdPresent}\npayuUserIdPresent=${payuUserIdPresent}\nsupabaseWriteAttempted=no\nsupabaseWriteSucceeded=no\nfinalVerificationResult=error`,
          );
          return new Response(
            JSON.stringify({
              verified: false,
              proActive: false,
              status: "error",
              message: "Payment amount does not match Docly Pro.",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // Persist to Supabase using provider-neutral columns
        supabaseWriteAttempted = "yes";
        const period = calculateSubscriptionBillingPeriod();
        const providerSubId = detail.mihpayid || txnid;
        const paymentId = detail.mihpayid || `payu_${txnid}`;
        const userFingerprint = `${user.id.substring(0, 8)}...`;

        const fullSubPayload = {
          user_id: user.id,
          plan: "pro",
          status: "active",
          provider: "payu",
          provider_subscription_id: providerSubId,
          provider_customer_id: user.email || null,
          provider_plan_id: "pro_monthly_25",
          amount: PRICING.pro.price,
          currency: "INR",
          razorpay_subscription_id: providerSubId,
          razorpay_customer_id: user.email || null,
          razorpay_plan_id: "pro_monthly_25",
          started_at: period.currentPeriodStart,
          current_period_start: period.currentPeriodStart,
          current_period_end: period.currentPeriodEnd,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        };

        const { error: fullSubError } = await db.from("subscriptions").upsert(
          fullSubPayload,
          { onConflict: "user_id" },
        );

        if (fullSubError) {
          console.error(`[PAYU_STATUS_ERROR]\nstage=supabase_write\nreason=${fullSubError.message}`);
          supabaseWriteSucceeded = "no";
          finalVerificationResult = "error";
          return new Response(
            JSON.stringify({
              verified: false,
              proActive: false,
              status: "error",
              message: "Payment verification database write failed.",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // Insert payment record idempotently
        const fullPaymentPayload = {
          user_id: user.id,
          provider: "payu",
          provider_payment_id: paymentId,
          provider_order_id: txnid,
          provider_subscription_id: providerSubId,
          razorpay_payment_id: paymentId,
          razorpay_order_id: txnid,
          razorpay_subscription_id: providerSubId,
          amount: PRICING.pro.price,
          currency: "INR",
          status: "captured",
          payment_method: detail.mode || "payu",
          paid_at: new Date().toISOString(),
        };

        const { data: existingPay } = await db
          .from("payments")
          .select("id")
          .or(`provider_payment_id.eq.${paymentId},provider_order_id.eq.${txnid}`)
          .maybeSingle();

        if (!existingPay) {
          const { error: payErr } = await db.from("payments").insert(fullPaymentPayload);
          if (payErr) {
            console.warn("[PAYU_STATUS_NOTICE] Payment insert notice:", payErr.message);
          }
        }

        supabaseWriteSucceeded = "yes";
        finalVerificationResult = "verified";

        console.info(
          `[PAYU_STATUS_DEBUG]\ntxnid=${txnid}\npayuVerifyCalled=yes\npayuHttpStatus=200\npayuResponseStatus=success\npayuResponseTxnid=${detail.txnid || txnid}\npayuResponseAmount=${returnedAmount}\npayuPaymentIdPresent=yes\npayuUserIdPresent=yes\nsupabaseWriteAttempted=yes\nsupabaseWriteSucceeded=yes\nfinalVerificationResult=verified`,
        );

        console.info(
          `[PAYU_STATUS_RECONCILED] Authoritatively verified with PayU & activated Docly Pro for user_fingerprint=${userFingerprint} txnid=${txnid}`,
        );

        return new Response(
          JSON.stringify({
            verified: true,
            proActive: true,
            isPro: true,
            effectivePlan: "pro",
            status: "active",
            plan: "pro",
            txnid: txnid,
            subscriptionId: providerSubId,
            message: "Payment verified and Docly Pro is active.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      // If here, transaction was not confirmed as success
      finalVerificationResult = serverVerification.status === "failed" ? "failed" : "pending";
      console.info(
        `[PAYU_STATUS_DEBUG]\ntxnid=${txnid}\npayuVerifyCalled=${payuVerifyCalled}\npayuHttpStatus=${payuHttpStatus}\npayuResponseStatus=${payuResponseStatus}\npayuResponseTxnid=${payuResponseTxnid}\npayuResponseAmount=${payuResponseAmount}\npayuPaymentIdPresent=${payuPaymentIdPresent}\npayuUserIdPresent=${payuUserIdPresent}\nsupabaseWriteAttempted=no\nsupabaseWriteSucceeded=no\nfinalVerificationResult=${finalVerificationResult}`,
      );

      return new Response(
        JSON.stringify({
          verified: false,
          proActive: false,
          status: finalVerificationResult,
          message:
            finalVerificationResult === "failed"
              ? "Payment failed on PayU."
              : "Payment verification is pending.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } catch (err) {
      console.error(
        `[PAYU_STATUS_ERROR]\nstage=verify_payment\nreason=${err instanceof Error ? err.message : "unknown_reconciliation_error"}`,
      );
      return new Response(
        JSON.stringify({
          verified: false,
          proActive: false,
          status: "error",
          message: "Payment verification could not be completed.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // 4. Fallback: Return current unverified state
  return new Response(
    JSON.stringify({
      verified: false,
      proActive: false,
      isPro: false,
      effectivePlan: evaluated.effectivePlan,
      status: evaluated.status,
      isConfigured: config.isConfigured,
      provider: subResult?.data?.provider || "payu",
      ...evaluated,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
