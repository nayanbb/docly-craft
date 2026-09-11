/**
 * Docly Entitlement Resolution Engine
 *
 * Implements centralized, server-authoritative Pro access evaluation:
 *
 *   Permanent Admin Pro Grant (Code or DB Entitlement)
 *                     OR
 *       Active Razorpay Pro Subscription
 *                     ↓
 *                    PRO
 *                 Otherwise
 *                     ↓
 *                   FREE
 *
 * Rules:
 * 1. Specified permanent test/admin user IDs permanently receive Docly Pro without Razorpay payments.
 * 2. Database grants in `public.entitlements` with expires_at = NULL are permanent and non-expiring.
 * 3. Ordinary users require a verified, active Razorpay subscription (current_period_end > Date.now()).
 * 4. Anonymous users are ALWAYS Free.
 * 5. NEVER trusts client localStorage, URL query params, or client-editable flags.
 */

import {
  evaluateSubscription,
  type RawSubscriptionData,
  type EffectiveSubscription,
  type PlanType,
  type SubscriptionStatus,
} from "./plan";

/**
 * Registry of permanent admin/test account User IDs entitled to lifetime Docly Pro access.
 * Managed securely server-side.
 */
export const PERMANENT_PRO_USER_IDS: ReadonlySet<string> = new Set<string>([
  "3b686e20-8f22-4e1c-b274-6dfd7b520994",
]);

export interface RawEntitlementData {
  plan?: string | null | undefined;
  grant_type?: string | null | undefined;
  expires_at?: string | null | undefined;
  notes?: string | null | undefined;
}

/**
 * Checks if a given Supabase user ID has a permanent admin Pro grant.
 */
export function isPermanentAdminProUser(userId?: string | null): boolean {
  if (!userId) return false;
  return PERMANENT_PRO_USER_IDS.has(userId.trim().toLowerCase());
}

/**
 * Validates whether a database entitlement record is currently active.
 * If `expires_at` is NULL or undefined, the grant is permanent and never expires.
 */
export function isEntitlementActive(
  entitlement?: RawEntitlementData | null,
  referenceTimeMs: number = Date.now(),
): boolean {
  if (!entitlement) return false;
  if (entitlement.plan !== "pro") return false;

  // NULL or undefined expires_at indicates a permanent lifetime grant
  if (entitlement.expires_at) {
    const expiresMs = new Date(entitlement.expires_at).getTime();
    if (isNaN(expiresMs) || expiresMs <= referenceTimeMs) {
      return false;
    }
  }

  return true;
}

/**
 * Unified Entitlement Resolver.
 *
 * Evaluates all entitlement sources with strict priority:
 * 1. Permanent Admin Pro user ID match -> PRO (active, non-expiring)
 * 2. Active Database Entitlement grant (`public.entitlements`) -> PRO
 * 3. Active Razorpay Pro subscription (status in active/authenticated, unexpired) -> PRO
 * 4. Otherwise -> FREE
 */
export function resolveUserEntitlement(
  userId?: string | null,
  rawSub?: RawSubscriptionData | null,
  rawEntitlement?: RawEntitlementData | null,
  referenceTimeMs: number = Date.now(),
): EffectiveSubscription {
  // 1. Permanent Admin Pro User ID Check
  if (isPermanentAdminProUser(userId)) {
    return {
      effectivePlan: "pro",
      isPro: true,
      status: "active",
      isExpired: false,
      isCancelled: false,
      isPastDue: false,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: undefined, // Non-expiring permanent grant
      currentPeriodStart: undefined,
      razorpayCustomerId: undefined,
      razorpaySubscriptionId: undefined,
      razorpayPlanId: undefined,
    };
  }

  // 2. Database Entitlement Grant Check (public.entitlements)
  if (isEntitlementActive(rawEntitlement, referenceTimeMs)) {
    return {
      effectivePlan: "pro",
      isPro: true,
      status: "active",
      isExpired: false,
      isCancelled: false,
      isPastDue: false,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: rawEntitlement?.expires_at || undefined,
      currentPeriodStart: undefined,
      razorpayCustomerId: undefined,
      razorpaySubscriptionId: undefined,
      razorpayPlanId: undefined,
    };
  }

  // 3. Razorpay Subscription Evaluation
  if (rawSub) {
    return evaluateSubscription(rawSub, referenceTimeMs);
  }

  // 4. Default: Anonymous / Free
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
