/**
 * PayU India Integration Types & Interfaces
 *
 * Implements official PayU Hosted Checkout & Standing Instructions (Recurring Payments) specifications.
 * Reference: https://docs.payu.in/
 */

export type PayUEnvironment = "test" | "production";

export interface PayUConfig {
  merchantKey: string;
  merchantSalt: string;
  environment: PayUEnvironment;
  paymentUrl: string;
  verifyPaymentUrl: string;
  isConfigured: boolean;
}

export interface PayUSIDetails {
  billingAmount: string; // e.g. "25.00"
  billingCurrency: string; // "INR"
  billingCycle: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "ONCE";
  billingInterval: number; // e.g. 1
  paymentStartDate: string; // YYYY-MM-DD
  paymentEndDate: string; // YYYY-MM-DD
  maxAmount?: string; // e.g. "25.00"
  remarks?: string;
}

export interface PayUPaymentRequestParams {
  key: string;
  txnid: string;
  amount: string; // "25.00"
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
  udf1?: string; // userId
  udf2?: string; // plan ('pro')
  udf3?: string; // redirect ('/dashboard')
  udf4?: string; // timestamp or nonce
  udf5?: string;
  si?: number; // 1 (consent only) or 4 (pay and subscribe)
  si_details?: string; // Stringified JSON
  api_version?: string;
}

export interface PayUCheckoutFormData {
  actionUrl: string;
  params: Record<string, string>;
}

export interface PayUCallbackPayload {
  mihpayid?: string;
  mode?: string;
  status: string; // "success" | "failure"
  unmappedstatus?: string;
  key: string;
  txnid: string;
  amount: string;
  discount?: string;
  net_amount_debit?: string;
  addedon?: string;
  productinfo: string;
  firstname: string;
  lastname?: string;
  email: string;
  phone?: string;
  udf1?: string; // userId
  udf2?: string; // plan
  udf3?: string; // redirect
  udf4?: string;
  udf5?: string;
  hash: string;
  bank_ref_num?: string;
  bankcode?: string;
  error?: string;
  error_Message?: string;
  additionalCharges?: string;
  [key: string]: string | undefined;
}

export interface PayUVerifyPaymentTransactionDetail {
  mihpayid: string;
  request_id?: string;
  bank_ref_num?: string;
  amt: string;
  transaction_amount: string;
  txnid: string;
  additional_charges?: string;
  productinfo: string;
  firstname: string;
  bankcode: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string;
  error_code?: string;
  error_Message?: string;
  net_amount_debit?: string;
  status: string; // "success" | "failure"
  unmappedstatus?: string;
  addedon?: string;
  mode?: string;
}

export interface PayUVerifyPaymentResponse {
  status: number;
  msg: string;
  transaction_details?: Record<string, PayUVerifyPaymentTransactionDetail>;
}

export interface PayUSubscriptionStatus {
  isConfigured: boolean;
  provider: "payu" | "razorpay" | "none";
  active: boolean;
  plan: "free" | "pro";
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface CreatePayUPaymentResult {
  actionUrl?: string;
  params?: Record<string, string>;
  txnid?: string;
  amount?: number;
  notConfigured?: boolean;
  error?: string;
}
