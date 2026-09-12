/**
 * Server-side Admin Handlers (Razorpay)
 *
 * Implements protected endpoints for:
 * 1. GET /api/admin/metrics - Financial and subscriber KPIs derived from verified Razorpay records
 * 2. GET /api/admin/payments - Verified Razorpay payment history
 * 3. GET /api/admin/subscriptions - User subscriber directory
 *
 * Enforces server-side authorization via ADMIN_EMAILS or public.profiles.role = 'admin'.
 * Normal users receive 403 Forbidden.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabase, supabaseUrl } from "@/lib/supabase/client";

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

function getServiceSupabase(env?: unknown): SupabaseClient {
  const serviceKey = resolveServerSecret("SUPABASE_SERVICE_ROLE_KEY", env);
  if (serviceKey && supabaseUrl) {
    return createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase;
}

/**
 * Verifies that the incoming request is made by an authorized admin user.
 */
export async function verifyAdminRequest(
  request: Request,
  env?: unknown,
): Promise<{ authorized: boolean; email?: string; userId?: string; error?: string }> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authorized: false, error: "Unauthorized: Missing authentication token." };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return { authorized: false, error: "Unauthorized: Empty authentication token." };
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return { authorized: false, error: "Unauthorized: Invalid or expired session." };
    }

    const user = userData.user;
    const email = user.email?.toLowerCase() || "";
    const adminEmails = (resolveServerSecret("ADMIN_EMAILS", env) || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    // 1. Check against ADMIN_EMAILS environment variable
    if (adminEmails.includes(email)) {
      return { authorized: true, email, userId: user.id };
    }

    // 2. Check public.profiles role
    const db = getServiceSupabase(env);
    const { data: profile } = await db
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "admin") {
      return { authorized: true, email, userId: user.id };
    }

    return { authorized: false, error: "Forbidden: Admin privileges required." };
  } catch (err) {
    return { authorized: false, error: "Authorization failed." };
  }
}

/**
 * GET /api/admin/metrics
 */
export async function handleAdminMetricsRequest(request: Request, env?: unknown): Promise<Response> {
  const auth = await verifyAdminRequest(request, env);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error || "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getServiceSupabase(env);

  try {
    // 1. Fetch payments
    const { data: payments } = await db
      .from("payments")
      .select("amount, currency, status, paid_at");

    // 2. Fetch subscriptions
    const { data: subscriptions } = await db
      .from("subscriptions")
      .select("plan, status, current_period_end");

    const now = Date.now();
    const currentMonthPrefix = new Date().toISOString().slice(0, 7); // e.g. "2026-09"

    let totalSuccessfulPayments = 0;
    let thisMonthSuccessfulPayments = 0;
    let grossRevenue = 0;
    let refundedAmount = 0;
    let failedPayments = 0;

    (payments || []).forEach((p) => {
      const amount = Number(p.amount) || 0;
      if (p.status === "succeeded") {
        totalSuccessfulPayments += 1;
        grossRevenue += amount;
        if (p.paid_at && p.paid_at.startsWith(currentMonthPrefix)) {
          thisMonthSuccessfulPayments += 1;
        }
      } else if (p.status === "refunded") {
        refundedAmount += amount;
      } else if (p.status === "failed") {
        failedPayments += 1;
      }
    });

    let activeProSubscribers = 0;
    let cancelledSubscriptions = 0;
    let expiredSubscriptions = 0;
    let pastDueSubscriptions = 0;

    (subscriptions || []).forEach((s) => {
      const isProPlan = s.plan === "pro";
      const isPastDue = s.status === "past_due" || s.status === "halted";
      const isCancelled = s.status === "cancelled";
      const periodEndMs = s.current_period_end ? new Date(s.current_period_end).getTime() : 0;
      const isExpired = s.status === "expired" || (periodEndMs > 0 && periodEndMs <= now);

      if (isPastDue) {
        pastDueSubscriptions += 1;
      }
      if (isCancelled) {
        cancelledSubscriptions += 1;
      }
      if (isExpired && isProPlan) {
        expiredSubscriptions += 1;
      }
      if (isProPlan && (s.status === "active" || s.status === "authenticated") && (!periodEndMs || periodEndMs > now)) {
        activeProSubscribers += 1;
      }
    });

    const netRevenue = Math.max(0, grossRevenue - refundedAmount);

    return new Response(
      JSON.stringify({
        totalSuccessfulPayments,
        thisMonthSuccessfulPayments,
        grossRevenue,
        refundedAmount,
        netRevenue,
        activeProSubscribers,
        cancelledSubscriptions,
        expiredSubscriptions,
        pastDueSubscriptions,
        failedPayments,
        sourceOfTruthNotice:
          "Revenue displayed is derived from verified payment and subscription records in Supabase (PayU & Razorpay). Bank payouts and merchant balance are managed directly in the payment gateway dashboards.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Failed to compute admin metrics:", err);
    return new Response(JSON.stringify({ error: "Failed to compute admin metrics" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * GET /api/admin/payments
 */
export async function handleAdminPaymentsRequest(request: Request, env?: unknown): Promise<Response> {
  const auth = await verifyAdminRequest(request, env);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error || "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getServiceSupabase(env);

  try {
    let payments: any[] = [];
    const { data: fullPayments, error: fullError } = await db
      .from("payments")
      .select(
        "id, user_id, amount, currency, status, payment_method, paid_at, provider, provider_payment_id, provider_order_id, provider_subscription_id, razorpay_payment_id, razorpay_order_id, razorpay_subscription_id, razorpay_invoice_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (!fullError && fullPayments) {
      payments = fullPayments;
    } else {
      const { data: fallbackPayments, error: fallbackError } = await db
        .from("payments")
        .select(
          "id, user_id, amount, currency, status, payment_method, paid_at, razorpay_payment_id, razorpay_order_id, razorpay_subscription_id, razorpay_invoice_id, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (fallbackError) throw fallbackError;
      payments = (fallbackPayments || []).map((p) => ({
        ...p,
        provider: "payu",
        provider_payment_id: p.razorpay_payment_id,
        provider_order_id: p.razorpay_order_id,
        provider_subscription_id: p.razorpay_subscription_id,
      }));
    }

    const userIds = Array.from(new Set((payments || []).map((p) => p.user_id)));
    const { data: profiles } = await db
      .from("profiles")
      .select("id, email, display_name")
      .in("id", userIds);

    const emailMap = new Map((profiles || []).map((pr) => [pr.id, pr.email || pr.display_name || "Unknown"]));

    const enriched = (payments || []).map((p) => ({
      ...p,
      email: emailMap.get(p.user_id) || p.user_id,
      plan: "Docly Pro (₹25/mo)",
    }));

    return new Response(JSON.stringify({ payments: enriched }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Failed to load admin payments:", err);
    return new Response(JSON.stringify({ error: "Failed to load payments" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * GET /api/admin/subscriptions
 */
export async function handleAdminSubscriptionsRequest(request: Request, env?: unknown): Promise<Response> {
  const auth = await verifyAdminRequest(request, env);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error || "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = getServiceSupabase(env);

  try {
    let subs: any[] = [];
    const { data: fullSubs, error: fullError } = await db
      .from("subscriptions")
      .select(
        "id, user_id, plan, status, started_at, current_period_start, current_period_end, cancel_at_period_end, provider, provider_subscription_id, provider_customer_id, provider_plan_id, razorpay_customer_id, razorpay_subscription_id, razorpay_plan_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (!fullError && fullSubs) {
      subs = fullSubs;
    } else {
      const { data: fallbackSubs, error: fallbackError } = await db
        .from("subscriptions")
        .select(
          "id, user_id, plan, status, started_at, current_period_start, current_period_end, cancel_at_period_end, razorpay_customer_id, razorpay_subscription_id, razorpay_plan_id, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (fallbackError) throw fallbackError;
      subs = (fallbackSubs || []).map((s) => ({
        ...s,
        provider: "payu",
        provider_subscription_id: s.razorpay_subscription_id,
        provider_customer_id: s.razorpay_customer_id,
        provider_plan_id: s.razorpay_plan_id,
      }));
    }

    const userIds = Array.from(new Set((subs || []).map((s) => s.user_id)));
    const { data: profiles } = await db
      .from("profiles")
      .select("id, email, display_name")
      .in("id", userIds);

    const emailMap = new Map((profiles || []).map((pr) => [pr.id, pr.email || pr.display_name || "Unknown"]));

    const enriched = (subs || []).map((s) => ({
      ...s,
      email: emailMap.get(s.user_id) || s.user_id,
    }));

    return new Response(JSON.stringify({ subscriptions: enriched }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Failed to load admin subscriptions:", err);
    return new Response(JSON.stringify({ error: "Failed to load subscriptions" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
