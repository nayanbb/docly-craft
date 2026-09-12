/**
 * Unified Payment Service
 *
 * Routes checkout and subscription management to PayU India as the primary payment gateway.
 * Preserves Razorpay as a legacy fallback.
 */

import { openPayUCheckout, cancelPayUSubscription } from "@/lib/payu/checkout";
import { openRazorpayCheckout, cancelRazorpaySubscription } from "@/lib/razorpay/service";

export interface PaymentCheckoutParams {
  redirect?: string;
}

export interface PaymentUserInfo {
  email?: string;
  name?: string;
}

/**
 * Opens checkout modal/portal for upgrading to Docly Pro (₹25/month).
 * Routes to PayU India as the primary provider.
 */
export async function openPaymentCheckout(
  params: PaymentCheckoutParams = {},
  userInfo?: PaymentUserInfo,
): Promise<{ success?: boolean; notConfigured?: boolean; error?: string }> {
  // 1. Attempt PayU checkout (Primary)
  const payUResult = await openPayUCheckout(params);

  // If PayU is configured and initiated, return
  if (payUResult.success) {
    return payUResult;
  }

  // If PayU is unconfigured, check if legacy Razorpay can handle it
  if (payUResult.notConfigured) {
    const rzpResult = await openRazorpayCheckout(params, userInfo);
    if (rzpResult.success) {
      return rzpResult;
    }
    // Return primary error message
    return payUResult;
  }

  return payUResult;
}

/**
 * Cancels active subscription at period end across providers.
 */
export async function cancelUserSubscription(): Promise<{
  cancelled?: boolean;
  message?: string;
  error?: string;
}> {
  // Try PayU first
  const payUResult = await cancelPayUSubscription();
  if (payUResult.cancelled) {
    return payUResult;
  }

  // Try Razorpay if PayU returned error or had no subscription
  const rzpResult = await cancelRazorpaySubscription();
  if (rzpResult.cancelled) {
    return rzpResult;
  }

  return payUResult.error ? payUResult : rzpResult;
}
