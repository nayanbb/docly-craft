/**
 * Docly Entitlement Resolution Engine
 *
 * Centralized, server-authoritative Pro access evaluation.
 *
 * Pro access is granted by:
 * 1. Permanent admin/test grant
 * 2. Active database entitlement
 * 3. Active paid subscription from a supported payment provider
 *
 * Anonymous users are always Free.
 * Client localStorage, URL parameters, and client-editable flags are never trusted.
 */

import {
  evaluateSubscription,
  type RawSubscriptionData,
  type EffectiveSubscription,
} from "./plan";

/**
 * Registry of permanent admin/test accounts with lifetime Pro access.
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
 * Checks whether a user has a permanent admin/test Pro grant.
 */
export function isPermanentAdminProUser(userId?: string | null): boolean {
  if (!userId) return false;

  return PERMANENT_PRO_USER_IDS.has(userId.trim().toLowerCase());
}

/**
 * Checks whether a database entitlement is currently active.
 *
 * NULL expires_at means the entitlement does not expire.
 */
export function isEntitlementActive(
  entitlement?: RawEntitlementData | null,
  referenceTimeMs: number = Date.now(),
): boolean {
  if (!entitlement) return false;
  if (entitlement.plan?.toLowerCase() !== "pro") return false;

  if (entitlement.expires_at) {
    const expiresMs = new Date(entitlement.expires_at).getTime();

    if (Number.isNaN(expiresMs) || expiresMs <= referenceTimeMs) {
      return false;
    }
  }

  return true;
}

/**
 * Unified entitlement resolver.
 *
 * Priority:
 * 1. Permanent admin/test Pro
 * 2. Active database entitlement
 * 3. Active paid subscription (PayU or legacy Razorpay)
 * 4. Free
 */
export function resolveUserEntitlement(
  userId?: string | null,
  rawSub?: RawSubscriptionData | null,
  rawEntitlement?: RawEntitlementData | null,
  referenceTimeMs: number = Date.now(),
): EffectiveSubscription {
  // 1. Permanent admin/test Pro
  if (isPermanentAdminProUser(userId)) {
    return {
      effectivePlan: "pro",
      isPro: true,
      status: "active",
      isExpired: false,
      isCancelled: false,
      isPastDue: false,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: undefined,
      currentPeriodStart: undefined,
      provider: "admin",
    };
  }

  // 2. Database entitlement
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
      provider: "entitlement",
    };
  }

  // 3. Paid subscription.
  //
  // evaluateSubscription() is provider-neutral and supports
  // provider_subscription_id/provider_customer_id/provider_plan_id.
  if (rawSub) {
    return evaluateSubscription(rawSub, referenceTimeMs);
  }

  // 4. Free
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