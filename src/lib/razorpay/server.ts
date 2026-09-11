/**
 * Server-side Razorpay Payment & Webhook Handlers
 *
 * Implements:
 * 1. POST /api/razorpay/subscription - Creates authenticated Razorpay Subscription (₹25/mo)
 * 2. POST /api/razorpay/cancel       - Cancels subscription at period end
 * 3. POST /api/razorpay/webhook      - Verifies HMAC-SHA256 signature & idempotently handles lifecycle events
 * 4. GET  /api/razorpay/status       - Returns current user's verified subscription status
 */

import crypto from "crypto";
import Razorpay from "razorpay";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabase, supabaseUrl } from "@/lib/supabase/client";
import { getEffectivePlan, evaluateSubscription, type RawSubscriptionData } from "@/lib/monetization/plan";
import {
  resolveUserEntitlement,
  isPermanentAdminProUser,
  type RawEntitlementData,
} from "@/lib/monetization/entitlements";

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

export function getRazorpayKeyId(env?: unknown): string {
  return resolveServerSecret("RAZORPAY_KEY_ID", env);
}

export function getRazorpayKeySecret(env?: unknown): string {
  return resolveServerSecret("RAZORPAY_KEY_SECRET", env);
}

export function getRazorpayProPlanId(env?: unknown): string {
  return resolveServerSecret("RAZORPAY_PRO_PLAN_ID", env);
}

export function getRazorpayWebhookSecret(env?: unknown): string {
  return resolveServerSecret("RAZORPAY_WEBHOOK_SECRET", env);
}

export function isRazorpayConfigured(env?: unknown): boolean {
  return Boolean(
    getRazorpayKeyId(env) &&
    getRazorpayKeySecret(env) &&
    getRazorpayProPlanId(env),
  );
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

export function getRazorpayClient(env?: unknown): Razorpay | null {
  const key_id = getRazorpayKeyId(env);
  const key_secret = getRazorpayKeySecret(env);
  if (!key_id || !key_secret) return null;
  return new Razorpay({ key_id, key_secret });
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
 * POST /api/razorpay/subscription
 */
export async function handleRazorpaySubscriptionRequest(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = await authenticateRequestUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "Authentication required to upgrade." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const keyId = getRazorpayKeyId(env);
  const planId = getRazorpayProPlanId(env);
  const razorpay = getRazorpayClient(env);

  if (!razorpay || !keyId || !planId) {
    return new Response(
      JSON.stringify({
        notConfigured: true,
        error: "Pro checkout isn't available yet. Your account is ready for Docly Pro.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  // Prevent duplicate active subscription or checkout for permanent Pro
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
      .select("plan, status, current_period_end, razorpay_customer_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    db
      .from("entitlements")
      .select("plan, grant_type, expires_at, notes")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const subData = subResult?.data;
  const evaluated = resolveUserEntitlement(
    user.id,
    subData as RawSubscriptionData | null,
    entResult?.data as RawEntitlementData | null,
  );

  if (evaluated.isPro) {
    return new Response(
      JSON.stringify({ error: "You're already on Docly Pro." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const subParams: Record<string, unknown> = {
      plan_id: planId,
      total_count: 120, // 10 years of monthly cycles
      quantity: 1,
      customer_notify: 1,
      notes: {
        userId: user.id,
        userEmail: user.email || "",
      },
    };

    if (subData?.razorpay_customer_id) {
      subParams["customer_id"] = subData.razorpay_customer_id;
    }

    const subscription = (await razorpay.subscriptions.create(subParams as any)) as any;

    return new Response(
      JSON.stringify({
        subscriptionId: subscription.id,
        keyId,
        amount: 2500, // ₹25 in paise
        currency: "INR",
        name: "Docly Pro",
        description: "Docly Pro — ₹25/month recurring subscription",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Failed to create Razorpay subscription:", err);
    return new Response(
      JSON.stringify({ error: "Failed to initialize Razorpay subscription. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

/**
 * POST /api/razorpay/cancel
 */
export async function handleRazorpayCancelRequest(request: Request, env?: unknown): Promise<Response> {
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

  const razorpay = getRazorpayClient(env);
  if (!razorpay) {
    return new Response(
      JSON.stringify({ error: "Razorpay service is currently unconfigured." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const db = getServiceSupabase(env);
  const { data: subData } = await db
    .from("subscriptions")
    .select("razorpay_subscription_id, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subData?.razorpay_subscription_id) {
    return new Response(
      JSON.stringify({ error: "No active Razorpay subscription found." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    // Cancel at end of cycle so user keeps Pro until current_period_end
    await (razorpay.subscriptions as any).cancel(subData.razorpay_subscription_id, {
      cancel_at_cycle_end: 1,
    });

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
    console.error("Failed to cancel Razorpay subscription:", err);
    return new Response(
      JSON.stringify({ error: "Failed to cancel subscription." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

/**
 * POST /api/razorpay/webhook
 */
export async function handleRazorpayWebhookRequest(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = getRazorpayWebhookSecret(env);
  if (!webhookSecret) {
    return new Response("Webhook secret unconfigured", { status: 503 });
  }

  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return new Response("Missing x-razorpay-signature header", { status: 400 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return new Response("Unable to read request payload", { status: 400 });
  }

  // Verify HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  if (expectedSignature !== signature) {
    console.warn("Invalid Razorpay webhook signature");
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  const db = getServiceSupabase(env);

  // Idempotency check using event ID or fallback key
  const eventId =
    event.id ||
    `${event.event}_${event.payload?.payment?.entity?.id || event.payload?.subscription?.entity?.id || Date.now()}`;

  const { data: existingEvent } = await db
    .from("webhook_events")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingEvent) {
    // Already processed this event
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Record event ID for idempotency
    await db.from("webhook_events").insert({
      event_id: eventId,
      event_type: event.event || "unknown",
    });

    const eventName = event.event;
    const payload = event.payload || {};

    switch (eventName) {
      case "subscription.authenticated":
      case "subscription.activated":
      case "subscription.charged": {
        const sub = payload.subscription?.entity;
        if (sub) {
          let userId = sub.notes?.userId;
          if (!userId) {
            const { data } = await db
              .from("subscriptions")
              .select("user_id")
              .eq("razorpay_subscription_id", sub.id)
              .maybeSingle();
            userId = data?.user_id;
          }

          if (userId) {
            const currentPeriodStart = sub.current_start
              ? new Date(sub.current_start * 1000).toISOString()
              : new Date().toISOString();
            const currentPeriodEnd = sub.current_end
              ? new Date(sub.current_end * 1000).toISOString()
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            const startedAt = sub.start_at
              ? new Date(sub.start_at * 1000).toISOString()
              : new Date().toISOString();

            await db.from("subscriptions").upsert(
              {
                user_id: userId,
                plan: "pro",
                status: "active",
                razorpay_customer_id: sub.customer_id || null,
                razorpay_subscription_id: sub.id,
                razorpay_plan_id: sub.plan_id || null,
                started_at: startedAt,
                current_period_start: currentPeriodStart,
                current_period_end: currentPeriodEnd,
                cancel_at_period_end: Boolean(sub.cancel_at_cycle_end),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id" },
            );
          }
        }
        break;
      }

      case "subscription.updated": {
        const sub = payload.subscription?.entity;
        if (sub) {
          const { data } = await db
            .from("subscriptions")
            .select("user_id")
            .eq("razorpay_subscription_id", sub.id)
            .maybeSingle();

          if (data?.user_id) {
            const currentPeriodEnd = sub.current_end
              ? new Date(sub.current_end * 1000).toISOString()
              : undefined;

            await db
              .from("subscriptions")
              .update({
                status: sub.status === "active" || sub.status === "authenticated" ? "active" : sub.status,
                current_period_end: currentPeriodEnd,
                cancel_at_period_end: Boolean(sub.cancel_at_cycle_end),
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", data.user_id);
          }
        }
        break;
      }

      case "subscription.pending":
      case "subscription.halted": {
        const sub = payload.subscription?.entity;
        if (sub) {
          await db
            .from("subscriptions")
            .update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("razorpay_subscription_id", sub.id);
        }
        break;
      }

      case "subscription.cancelled": {
        const sub = payload.subscription?.entity;
        if (sub) {
          const nowMs = Date.now();
          const periodEndMs = sub.current_end ? sub.current_end * 1000 : 0;
          const isExpired = periodEndMs > 0 && periodEndMs <= nowMs;

          await db
            .from("subscriptions")
            .update({
              plan: isExpired ? "free" : "pro",
              status: "cancelled",
              cancel_at_period_end: true,
              cancelled_at: new Date().toISOString(),
              expired_at: isExpired ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            })
            .eq("razorpay_subscription_id", sub.id);
        }
        break;
      }

      case "subscription.completed": {
        const sub = payload.subscription?.entity;
        if (sub) {
          await db
            .from("subscriptions")
            .update({
              plan: "free",
              status: "expired",
              expired_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("razorpay_subscription_id", sub.id);
        }
        break;
      }

      case "payment.captured": {
        const payment = payload.payment?.entity;
        if (payment) {
          let userId = payment.notes?.userId;
          if (!userId && payment.subscription_id) {
            const { data } = await db
              .from("subscriptions")
              .select("user_id")
              .eq("razorpay_subscription_id", payment.subscription_id)
              .maybeSingle();
            userId = data?.user_id;
          }

          if (userId) {
            const amount = Number(payment.amount || 0) / 100;
            const currency = (payment.currency || "INR").toUpperCase();
            const paidAt = payment.created_at
              ? new Date(payment.created_at * 1000).toISOString()
              : new Date().toISOString();

            // Check if payment record already inserted
            const { data: existingPayment } = await db
              .from("payments")
              .select("id")
              .eq("razorpay_payment_id", payment.id)
              .maybeSingle();

            if (!existingPayment) {
              await db.from("payments").insert({
                user_id: userId,
                razorpay_payment_id: payment.id,
                razorpay_order_id: payment.order_id || null,
                razorpay_subscription_id: payment.subscription_id || null,
                razorpay_invoice_id: payment.invoice_id || null,
                amount,
                currency,
                status: "succeeded",
                payment_method: payment.method || "card",
                paid_at: paidAt,
              });
            }
          }
        }
        break;
      }

      case "payment.failed": {
        const payment = payload.payment?.entity;
        if (payment) {
          let userId = payment.notes?.userId;
          if (!userId && payment.subscription_id) {
            const { data } = await db
              .from("subscriptions")
              .select("user_id")
              .eq("razorpay_subscription_id", payment.subscription_id)
              .maybeSingle();
            userId = data?.user_id;
          }

          if (userId) {
            const amount = Number(payment.amount || 0) / 100;
            await db.from("payments").insert({
              user_id: userId,
              razorpay_payment_id: payment.id,
              razorpay_order_id: payment.order_id || null,
              razorpay_subscription_id: payment.subscription_id || null,
              amount,
              currency: (payment.currency || "INR").toUpperCase(),
              status: "failed",
              payment_method: payment.method || "card",
              paid_at: new Date().toISOString(),
            });

            if (payment.subscription_id) {
              await db
                .from("subscriptions")
                .update({
                  status: "past_due",
                  updated_at: new Date().toISOString(),
                })
                .eq("razorpay_subscription_id", payment.subscription_id);
            }
          }
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error processing Razorpay webhook:", err);
    return new Response(JSON.stringify({ error: "Webhook processing error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * GET /api/razorpay/status
 */
export async function handleRazorpayStatusRequest(request: Request, env?: unknown): Promise<Response> {
  const user = await authenticateRequestUser(request);
  if (!user) {
    return new Response(
      JSON.stringify({
        isConfigured: isRazorpayConfigured(env),
        effectivePlan: "free",
        isPro: false,
        status: "none",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // 1. Permanent Admin Pro User Check (Server-authoritative lifetime grant)
  if (isPermanentAdminProUser(user.id)) {
    return new Response(
      JSON.stringify({
        isConfigured: isRazorpayConfigured(env),
        effectivePlan: "pro",
        isPro: true,
        status: "active",
        isExpired: false,
        isCancelled: false,
        isPastDue: false,
        cancelAtPeriodEnd: false,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const db = getServiceSupabase(env);
  const [subResult, entResult] = await Promise.all([
    db
      .from("subscriptions")
      .select(
        "plan, status, current_period_start, current_period_end, cancel_at_period_end, razorpay_customer_id, razorpay_subscription_id, razorpay_plan_id",
      )
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

  return new Response(
    JSON.stringify({
      isConfigured: isRazorpayConfigured(env),
      ...evaluated,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
