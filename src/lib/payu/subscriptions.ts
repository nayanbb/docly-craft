/**
 * PayU Recurring Payments & Subscriptions Lifecycle Handler
 *
 * Implements Standing Instructions (SI) mandate generation and
 * provider-neutral subscription lifecycle status mappings.
 */

import { PRICING } from "@/lib/monetization/config";
import type { SubscriptionStatus } from "@/lib/monetization/plan";
import type { PayUSIDetails } from "./types";

/**
 * Creates PayU SI Details JSON structure for Docly Pro (₹25/month).
 * Amount is strictly sourced from server monetization config (PRICING.pro.price).
 */
export function createDoclyProSIDetails(startDate?: Date): {
  siDetails: PayUSIDetails;
  siDetailsJson: string;
} {
  const start = startDate || new Date();
  // Format YYYY-MM-DD
  const paymentStartDate = start.toISOString().split("T")[0];

  // 10 years in the future for ongoing recurring monthly subscription
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 10);
  const paymentEndDate = end.toISOString().split("T")[0];

  const priceFormatted = PRICING.pro.price.toFixed(2);

  const siDetails: PayUSIDetails = {
    billingAmount: priceFormatted,
    billingCurrency: "INR",
    billingCycle: "MONTHLY",
    billingInterval: 1,
    paymentStartDate,
    paymentEndDate,
    maxAmount: priceFormatted,
    remarks: "Docly Pro Monthly Subscription",
  };

  return {
    siDetails,
    siDetailsJson: JSON.stringify(siDetails),
  };
}

/**
 * Maps PayU callback or webhook transaction statuses to Docly's internal SubscriptionStatus.
 */
export function mapPayUStatusToSubscriptionStatus(
  payUStatus?: string | null,
  unmappedStatus?: string | null,
): SubscriptionStatus {
  const status = (payUStatus || "").toLowerCase();
  const unmapped = (unmappedStatus || "").toLowerCase();

  if (status === "success" || unmapped === "captured" || unmapped === "success") {
    return "active";
  }

  if (status === "pending" || unmapped === "in progress" || unmapped === "pending") {
    return "pending";
  }

  if (
    status === "failure" ||
    status === "failed" ||
    unmapped === "failed" ||
    unmapped === "bounced" ||
    unmapped === "dropped"
  ) {
    return "past_due";
  }

  if (status === "cancelled" || unmapped === "usercancelled") {
    return "cancelled";
  }

  return "none";
}

/**
 * Calculates current period dates for a 1-month billing interval.
 */
export function calculateSubscriptionBillingPeriod(startDate?: Date): {
  currentPeriodStart: string;
  currentPeriodEnd: string;
} {
  const start = startDate || new Date();
  const currentPeriodStart = start.toISOString();

  // Next renewal date is 30 days / 1 month from start
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  const currentPeriodEnd = end.toISOString();

  return {
    currentPeriodStart,
    currentPeriodEnd,
  };
}
