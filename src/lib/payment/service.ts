/**
 * Unified Payment Service
 *
 * Routes checkout and subscription management to PayU India as the primary payment gateway.
 * Preserves Razorpay as a legacy fallback.
 */

import { openPayUCheckout, cancelPayUSubscription } from "@/lib/payu/checkout";
import { cancelRazorpaySubscription } from "@/lib/razorpay/service";

export interface PaymentCheckoutParams {
  redirect?: string;
}

export interface PaymentUserInfo {
  email?: string;
  name?: string;
}

/**
 * Opens checkout modal/portal for upgrading to Docly Pro (₹25/month).
 * Routes to PayU India as the authoritative provider.
 */
export async function openPaymentCheckout(
  params: PaymentCheckoutParams = {},
  _userInfo?: PaymentUserInfo,
): Promise<{ success?: boolean; notConfigured?: boolean; error?: string }> {
  // Exclusively route to PayU Hosted Checkout
  return await openPayUCheckout(params);
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
