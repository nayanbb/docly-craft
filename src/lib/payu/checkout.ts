/**
 * Client-side PayU Checkout Service
 *
 * Connects frontend upgrade and management interactions with server endpoints.
 * Never stores or touches private merchant keys or salts.
 */

import { supabase } from "@/lib/supabase/client";
import type { CreatePayUPaymentResult, PayUSubscriptionStatus } from "./types";

export interface InitiatePayUCheckoutParams {
  redirect?: string;
}

/**
 * Calls server endpoint to prepare a signed PayU Hosted Checkout transaction.
 */
export async function createPayUPayment(
  params: InitiatePayUCheckoutParams = {},
): Promise<CreatePayUPaymentResult> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      return {
        error: "Please sign in to upgrade your account.",
      };
    }

    const response = await fetch("/api/payu/create-payment", {
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
        error: data.error || "Failed to initialize payment.",
      };
    }

    return data as CreatePayUPaymentResult;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Unable to reach payment service.",
    };
  }
}

/**
 * Initiates PayU Hosted Checkout by dynamically posting a signed form.
 */
export async function openPayUCheckout(
  params: InitiatePayUCheckoutParams = {},
): Promise<{ success?: boolean; notConfigured?: boolean; error?: string }> {
  const result = await createPayUPayment(params);

  if (result.notConfigured) {
    return { notConfigured: true, error: result.error };
  }

  if (result.error || !result.actionUrl || !result.params) {
    return { error: result.error || "Failed to create payment session." };
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return { error: "Window environment unavailable" };
  }

  // Dynamically create and submit POST form to PayU Hosted Checkout
  const form = document.createElement("form");
  form.method = "POST";
  form.action = result.actionUrl;
  form.style.display = "none";

  for (const [key, value] of Object.entries(result.params)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();

  return { success: true };
}

/**
 * Cancels active PayU subscription at period end.
 */
export async function cancelPayUSubscription(): Promise<{
  cancelled?: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      return { error: "Please sign in to manage your subscription." };
    }

    const response = await fetch("/api/payu/cancel", {
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
 * Retrieves current subscription status from server.
 */
export async function getPayUSubscriptionStatus(): Promise<PayUSubscriptionStatus> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch("/api/payu/status", { headers });
    if (!response.ok) {
      return {
        isConfigured: false,
        provider: "none",
        active: false,
        plan: "free",
        status: "none",
      };
    }

    const data = await response.json();
    return {
      isConfigured: Boolean(data.isConfigured),
      provider: data.provider || "payu",
      active: Boolean(data.isPro),
      plan: data.effectivePlan || "free",
      status: data.status || "none",
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    };
  } catch {
    return {
      isConfigured: false,
      provider: "none",
      active: false,
      plan: "free",
      status: "none",
    };
  }
}
