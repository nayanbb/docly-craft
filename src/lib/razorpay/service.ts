/**
 * Client-side Razorpay Service
 *
 * Connects frontend upgrade and management interactions with server endpoints.
 * Never trusts client state; relays authenticated Supabase session tokens.
 */

import { supabase } from "@/lib/supabase/client";
import type {
  CreateSubscriptionParams,
  CreateSubscriptionResult,
  RazorpaySubscriptionStatus,
  RazorpayCheckoutOptions,
} from "./types";

/**
 * Dynamically loads the official Razorpay Checkout SDK script.
 */
export async function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;

  return new Promise((resolve) => {
    const existingScript = document.getElementById("razorpay-checkout-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.id = "razorpay-checkout-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Initiates a Razorpay Subscription for upgrading to Docly Pro (₹25/month).
 */
export async function createRazorpaySubscription(
  params: CreateSubscriptionParams = {},
): Promise<CreateSubscriptionResult> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      return {
        error: "Please sign in to upgrade your account.",
      };
    }

    const response = await fetch("/api/razorpay/subscription", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 503 || data.notConfigured) {
        return {
          notConfigured: true,
          error: data.error || "Pro checkout isn't available yet. Your account is ready for Docly Pro.",
        };
      }
      return {
        error: data.error || "Failed to initialize subscription.",
      };
    }

    return data as CreateSubscriptionResult;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Unable to reach subscription service.",
    };
  }
}

/**
 * Opens official Razorpay Checkout modal for recurring ₹25/month Docly Pro subscription.
 */
export async function openRazorpayCheckout(
  params: CreateSubscriptionParams = {},
  userInfo?: { email?: string | undefined; name?: string | undefined } | undefined,
): Promise<{ success?: boolean | undefined; notConfigured?: boolean | undefined; error?: string | undefined }> {
  const result = await createRazorpaySubscription(params);

  if (result.notConfigured) {
    return { notConfigured: true, error: result.error };
  }

  if (result.error || !result.subscriptionId || !result.keyId) {
    return { error: result.error || "Failed to create subscription." };
  }

  const scriptLoaded = await loadRazorpayScript();
  const RazorpayClass = window.Razorpay;
  if (!scriptLoaded || !RazorpayClass) {
    return { error: "Failed to load Razorpay payment gateway. Please try again." };
  }

  const redirectTarget = params.redirect || "/dashboard";

  return new Promise((resolve) => {
    const options: RazorpayCheckoutOptions = {
      key: result.keyId!,
      subscription_id: result.subscriptionId!,
      name: "Docly",
      description: "Docly Pro — ₹25/month recurring subscription",
      prefill: {
        name: userInfo?.name || "",
        email: userInfo?.email || "",
      },
      theme: {
        color: "#4f46e5",
      },
      handler: (response) => {
        const successUrl = `/payment/success?subscription_id=${encodeURIComponent(
          response.razorpay_subscription_id,
        )}&payment_id=${encodeURIComponent(response.razorpay_payment_id)}&redirect=${encodeURIComponent(
          redirectTarget,
        )}`;
        window.location.href = successUrl;
        resolve({ success: true });
      },
      modal: {
        ondismiss: () => {
          window.location.href = "/payment/cancelled";
          resolve({ error: "Payment dismissed" });
        },
      },
    };

    const rzp = new RazorpayClass(options);
    rzp.open();
  });
}

/**
 * Cancels active Razorpay subscription at the end of the billing period.
 */
export async function cancelRazorpaySubscription(): Promise<{ cancelled?: boolean | undefined; message?: string | undefined; error?: string | undefined }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      return { error: "Please sign in to manage your subscription." };
    }

    const response = await fetch("/api/razorpay/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { error: data.error || "Failed to cancel subscription." };
    }

    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unable to reach cancellation service." };
  }
}

/**
 * Retrieves the user's active subscription status from the server endpoint.
 */
export async function getSubscriptionStatus(): Promise<RazorpaySubscriptionStatus> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch("/api/razorpay/status", { headers });
    if (!response.ok) {
      return {
        isConfigured: false,
        active: false,
        plan: "free",
        status: "none",
      };
    }

    const data = await response.json();
    return {
      isConfigured: Boolean(data.isConfigured),
      active: Boolean(data.isPro),
      plan: data.effectivePlan || "free",
      status: data.status || "none",
      currentPeriodEnd: data.currentPeriodEnd,
    };
  } catch {
    return {
      isConfigured: false,
      active: false,
      plan: "free",
      status: "none",
    };
  }
}
