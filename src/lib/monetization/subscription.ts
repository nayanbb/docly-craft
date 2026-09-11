/**
 * Docly Subscription Architecture & State Management (Razorpay)
 *
 * Enforces server/database verification for Docly Pro status.
 * NEVER trusts localStorage, URL query parameters, or client-editable state.
 */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/supabase/auth-context";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getEffectivePlan,
  evaluateSubscription,
  type PlanType,
  type SubscriptionStatus,
  type RawSubscriptionData,
} from "./plan";
import {
  isPermanentAdminProUser,
  resolveUserEntitlement,
  type RawEntitlementData,
} from "./entitlements";

export type { PlanType, SubscriptionStatus };

export interface UserSubscription {
  plan: PlanType;
  isPro: boolean;
  status: SubscriptionStatus;
  currentPeriodEnd?: string | undefined;
  currentPeriodStart?: string | undefined;
  cancelAtPeriodEnd?: boolean | undefined;
  razorpayCustomerId?: string | undefined;
  razorpaySubscriptionId?: string | undefined;
  razorpayPlanId?: string | undefined;
  isExpired?: boolean | undefined;
  isCancelled?: boolean | undefined;
  isPastDue?: boolean | undefined;
  isLoading: boolean;
  error?: string | null | undefined;
  refetch: () => Promise<void>;
}

export const SUBSCRIPTION_QUERY_KEY = ["subscription"];

const DEFAULT_FREE_SUBSCRIPTION: Omit<UserSubscription, "refetch" | "isLoading" | "error"> = {
  plan: "free",
  isPro: false,
  status: "none",
  cancelAtPeriodEnd: false,
  isExpired: false,
  isCancelled: false,
  isPastDue: false,
};

/**
 * Triggers an immediate revalidation event across the application.
 * Components listening to this event will instantly update their Pro status.
 */
export function triggerSubscriptionRefresh(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("docly:subscription-updated"));
  }
}

/**
 * React hook to retrieve the current user's authenticated subscription and entitlement status.
 * - Powered by TanStack Query for automatic caching and revalidation.
 * - Anonymous / unauthenticated users are ALWAYS Free.
 * - Checks permanent admin Pro grant (code and database entitlements).
 * - Authenticated users query verified rows in `public.subscriptions` and `public.entitlements`.
 * - Validates status AND current_period_end > Date.now().
 * - Rejects any attempt to spoof Pro status via localStorage or URL params.
 */
export function useSubscription(): UserSubscription {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...SUBSCRIPTION_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user || !isSupabaseConfigured) {
        return DEFAULT_FREE_SUBSCRIPTION;
      }

      // 1. Permanent Admin Pro User Grant Check (instant resolution, survives all state changes)
      if (isPermanentAdminProUser(user.id)) {
        return {
          plan: "pro" as PlanType,
          isPro: true,
          status: "active" as SubscriptionStatus,
          cancelAtPeriodEnd: false,
          isExpired: false,
          isCancelled: false,
          isPastDue: false,
        };
      }

      // 2. Query both public.subscriptions and public.entitlements
      const [subResult, entResult] = await Promise.all([
        supabase
          .from("subscriptions")
          .select(
            "plan, status, current_period_start, current_period_end, cancel_at_period_end, razorpay_customer_id, razorpay_subscription_id, razorpay_plan_id",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("entitlements")
          .select("plan, grant_type, expires_at, notes")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (subResult.error) {
        console.warn("Error reading subscription status:", subResult.error.message);
      }

      const evaluated = resolveUserEntitlement(
        user.id,
        subResult.data as RawSubscriptionData | null,
        entResult.data as RawEntitlementData | null,
      );

      return {
        plan: evaluated.effectivePlan,
        isPro: evaluated.isPro,
        status: evaluated.status,
        currentPeriodEnd: evaluated.currentPeriodEnd,
        currentPeriodStart: evaluated.currentPeriodStart,
        cancelAtPeriodEnd: evaluated.cancelAtPeriodEnd,
        razorpayCustomerId: evaluated.razorpayCustomerId,
        razorpaySubscriptionId: evaluated.razorpaySubscriptionId,
        razorpayPlanId: evaluated.razorpayPlanId,
        isExpired: evaluated.isExpired,
        isCancelled: evaluated.isCancelled,
        isPastDue: evaluated.isPastDue,
      };
    },
    enabled: !isAuthLoading && Boolean(user),
    staleTime: 1000 * 30, // 30 seconds
  });

  // Revalidate TanStack Query whenever docly:subscription-updated is dispatched
  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    };

    window.addEventListener("docly:subscription-updated", handleUpdate);
    return () => {
      window.removeEventListener("docly:subscription-updated", handleUpdate);
    };
  }, [queryClient]);

  const activeSub = (!user || isAuthLoading) ? DEFAULT_FREE_SUBSCRIPTION : (data || DEFAULT_FREE_SUBSCRIPTION);

  return {
    ...activeSub,
    isLoading: isAuthLoading || (Boolean(user) && isLoading),
    error: error instanceof Error ? error.message : null,
    refetch: async () => {
      await refetch();
    },
  };
}

/**
 * Server-side helper to verify user Pro status from request Authorization header.
 * Decodes the Supabase JWT and evaluates permanent admin grants and active subscriptions.
 */
export async function verifyServerUserSubscription(
  request: Request,
  _env?: unknown,
): Promise<{
  userId?: string | undefined;
  userEmail?: string | undefined;
  isPro: boolean;
  plan: PlanType;
  subscriptionData?: RawSubscriptionData | undefined;
}> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { isPro: false, plan: "free" };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return { isPro: false, plan: "free" };
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return { isPro: false, plan: "free" };
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email || undefined;

    // 1. Permanent Admin Pro User Grant Check (Server-authoritative)
    if (isPermanentAdminProUser(userId)) {
      return {
        userId,
        userEmail,
        isPro: true,
        plan: "pro",
      };
    }

    // 2. Query both public.subscriptions and public.entitlements
    const [subResult, entResult] = await Promise.all([
      supabase
        .from("subscriptions")
        .select(
          "plan, status, current_period_start, current_period_end, cancel_at_period_end, razorpay_customer_id, razorpay_subscription_id, razorpay_plan_id",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("entitlements")
        .select("plan, grant_type, expires_at, notes")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const evaluated = resolveUserEntitlement(
      userId,
      subResult.data as RawSubscriptionData | null,
      entResult.data as RawEntitlementData | null,
    );

    return {
      userId,
      userEmail,
      isPro: evaluated.isPro,
      plan: evaluated.effectivePlan,
      subscriptionData: (subResult.data as RawSubscriptionData) || undefined,
    };
  } catch {
    return { isPro: false, plan: "free" };
  }
}
