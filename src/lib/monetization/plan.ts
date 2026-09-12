/**
 * Centralized Plan and Expiration Evaluation Service (Razorpay)
 *
 * Rules:
 * 1. Pro access requires:
 *    - subscription.plan === "pro"
 *    - subscription.status in ("active", "authenticated")
 *    - current_period_end > current server/client time
 * 2. If current_period_end has passed:
 *    - The user is IMMEDIATELY treated as FREE regardless of database status.
 * 3. Never trust client localStorage or URL parameters.
 */

export type PlanType = "free" | "pro";

export type SubscriptionStatus =
  | "active"
  | "authenticated"
  | "pending"
  | "halted"
  | "cancelled"
  | "expired"
  | "past_due"
  | "none";

export interface RawSubscriptionData {
  plan?: string | null | undefined;
  status?: string | null | undefined;
  current_period_end?: string | null | undefined;
  current_period_start?: string | null | undefined;
  cancel_at_period_end?: boolean | null | undefined;
  provider?: string | null | undefined;
  provider_subscription_id?: string | null | undefined;
  provider_customer_id?: string | null | undefined;
  provider_plan_id?: string | null | undefined;
  razorpay_customer_id?: string | null | undefined;
  razorpay_subscription_id?: string | null | undefined;
  razorpay_plan_id?: string | null | undefined;
}

export interface EffectiveSubscription {
  effectivePlan: PlanType;
  isPro: boolean;
  status: SubscriptionStatus;
  isExpired: boolean;
  isCancelled: boolean;
  isPastDue: boolean;
  currentPeriodEnd?: string | undefined;
  currentPeriodStart?: string | undefined;
  cancelAtPeriodEnd: boolean;
  provider?: string | undefined;
  providerSubscriptionId?: string | undefined;
  providerCustomerId?: string | undefined;
  providerPlanId?: string | undefined;
  razorpayCustomerId?: string | undefined;
  razorpaySubscriptionId?: string | undefined;
  razorpayPlanId?: string | undefined;
}

/**
 * Returns the effective plan ("free" or "pro") strictly validating status and expiration date.
 */
export function getEffectivePlan(
  sub?: RawSubscriptionData | null,
  referenceTimeMs: number = Date.now(),
): PlanType {
  if (!sub) return "free";
  if (sub.plan !== "pro") return "free";

  const rawStatus = (sub.status || "").toLowerCase();
  const isActiveStatus =
    rawStatus === "active" ||
    rawStatus === "authenticated" ||
    (rawStatus === "cancelled" && Boolean(sub.cancel_at_period_end));
  if (!isActiveStatus) return "free";

  if (sub.current_period_end) {
    const periodEndMs = new Date(sub.current_period_end).getTime();
    if (isNaN(periodEndMs) || periodEndMs <= referenceTimeMs) {
      return "free";
    }
  }

  return "pro";
}

/**
 * Evaluates raw subscription data and returns a comprehensive status object.
 */
export function evaluateSubscription(
  sub?: RawSubscriptionData | null,
  referenceTimeMs: number = Date.now(),
): EffectiveSubscription {
  if (!sub) {
    return {
      effectivePlan: "free",
      isPro: false,
      status: "none",
      isExpired: false,
      isCancelled: false,
      isPastDue: false,
      cancelAtPeriodEnd: false,
    };
  }

  const rawStatus = (sub.status || "none").toLowerCase() as SubscriptionStatus;
  const isPastDue = rawStatus === "past_due" || rawStatus === "halted";
  const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);

  let isExpired = rawStatus === "expired";
  if (sub.current_period_end) {
    const periodEndMs = new Date(sub.current_period_end).getTime();
    if (!isNaN(periodEndMs) && periodEndMs <= referenceTimeMs) {
      isExpired = true;
    }
  }

  const effectivePlan = getEffectivePlan(sub, referenceTimeMs);
  const isPro = effectivePlan === "pro";
  const isCancelled = cancelAtPeriodEnd && isPro;

  let resolvedStatus: SubscriptionStatus = rawStatus;
  if (isExpired && (rawStatus === "active" || rawStatus === "authenticated")) {
    resolvedStatus = "expired";
  }

  return {
    effectivePlan,
    isPro,
    status: resolvedStatus,
    isExpired,
    isCancelled,
    isPastDue,
    currentPeriodEnd: sub.current_period_end || undefined,
    currentPeriodStart: sub.current_period_start || undefined,
    cancelAtPeriodEnd,
    provider: sub.provider || (sub.razorpay_subscription_id ? "razorpay" : undefined),
    providerSubscriptionId: sub.provider_subscription_id || sub.razorpay_subscription_id || undefined,
    providerCustomerId: sub.provider_customer_id || sub.razorpay_customer_id || undefined,
    providerPlanId: sub.provider_plan_id || sub.razorpay_plan_id || undefined,
    razorpayCustomerId: sub.razorpay_customer_id || undefined,
    razorpaySubscriptionId: sub.razorpay_subscription_id || undefined,
    razorpayPlanId: sub.razorpay_plan_id || undefined,
  };
}

/**
 * Formats a billing date for display.
 */
export function formatBillingDate(dateStr?: string | null | undefined): string {
  if (!dateStr) return "End of billing cycle";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}
