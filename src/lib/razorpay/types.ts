/**
 * Razorpay Types and Interfaces
 */

export interface CreateSubscriptionParams {
  redirect?: string | undefined;
}

export interface CreateSubscriptionResult {
  subscriptionId?: string;
  keyId?: string;
  amount?: number;
  currency?: string;
  name?: string;
  description?: string;
  notConfigured?: boolean;
  error?: string;
}

export interface RazorpaySubscriptionStatus {
  isConfigured: boolean;
  active: boolean;
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd?: string | undefined;
}

export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

export interface RazorpayCheckoutOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  image?: string;
  handler: (response: RazorpayPaymentSuccessResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

export interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}
