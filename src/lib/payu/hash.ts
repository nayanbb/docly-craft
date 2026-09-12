/**
 * PayU Hash Generation & Verification Module
 *
 * Implements official PayU SHA-512 cryptographic hash routines for:
 * 1. Payment Request Hash (Standard & Standing Instructions / Subscriptions)
 * 2. Response / Callback Reverse Hash Verification (with additionalCharges handling)
 * 3. Verify Payment webservice command hash
 *
 * Reference: https://docs.payu.in/
 */

import crypto from "crypto";

export interface RequestHashOptions {
  key: string;
  txnid: string;
  amount: string | number;
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  si_details?: string;
  salt: string;
}

export interface ResponseHashOptions {
  key: string;
  txnid: string;
  amount: string | number;
  productinfo: string;
  firstname: string;
  email: string;
  status: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  additionalCharges?: string;
  salt: string;
  receivedHash: string;
}

/**
 * Formats amount consistently to 2 decimal places as required by PayU.
 */
export function formatPayUAmount(amount: string | number): string {
  const num = typeof amount === "number" ? amount : parseFloat(amount);
  if (isNaN(num)) {
    throw new Error(`Invalid amount for PayU: ${amount}`);
  }
  return num.toFixed(2);
}

/**
 * Generates the SHA-512 request hash for PayU Hosted Checkout.
 *
 * Sequence for Standard Transactions:
 *   sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 *
 * Sequence for Standing Instructions (SI) / Subscriptions:
 *   sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|||||si_details|SALT)
 */
export function generatePayURequestHash(options: RequestHashOptions): string {
  const {
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1 = "",
    udf2 = "",
    udf3 = "",
    udf4 = "",
    udf5 = "",
    si_details,
    salt,
  } = options;

  if (!key || !txnid || !salt) {
    throw new Error("Missing required parameters for PayU request hash generation.");
  }

  const formattedAmount = formatPayUAmount(amount);

  let hashSequence: string;
  if (si_details && si_details.trim().length > 0) {
    // Official PayU Subscription Sequence (18 tokens, 17 pipes):
    // 5 empty slots (udf6, udf7, udf8, udf9, udf10) between udf5 and si_details:
    // sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||si_details|SALT)
    hashSequence = `${key}|${txnid}|${formattedAmount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${si_details}|${salt}`;
  } else {
    // Standard Sequence (17 tokens, 16 pipes):
    // 5 empty slots (udf6, udf7, udf8, udf9, udf10) between udf5 and salt:
    // sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
    hashSequence = `${key}|${txnid}|${formattedAmount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${salt}`;
  }

  return crypto.createHash("sha512").update(hashSequence).digest("hex").toLowerCase();
}

/**
 * Creates a safe diagnostic object for debugging hash parameters
 * without exposing merchant salt, merchant key, or raw full hash input string.
 */
export function getSafeHashDiagnostic(
  options: RequestHashOptions,
  generatedHash: string,
): Record<string, unknown> {
  return {
    hasKey: Boolean(options.key),
    txnid: options.txnid,
    amount: formatPayUAmount(options.amount),
    productinfo: options.productinfo,
    firstname: options.firstname,
    email: options.email,
    udf1: options.udf1 || "",
    udf2: options.udf2 || "",
    udf3: options.udf3 || "",
    udf4: options.udf4 || "",
    udf5: options.udf5 || "",
    hasSiDetails: Boolean(options.si_details),
    siDetailsLength: options.si_details?.length || 0,
    hashLength: generatedHash.length,
    hashFingerprintSha256: crypto.createHash("sha256").update(generatedHash).digest("hex").substring(0, 16),
  };
}

/**
 * Validates the reverse SHA-512 hash returned in PayU callbacks / webhooks.
 *
 * Standard Formula:
 *   sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 *
 * Formula when additionalCharges is present:
 *   sha512(additionalCharges|SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 *
 * Uses crypto.timingSafeEqual to defend against timing attacks.
 */
export function verifyPayUResponseHash(options: ResponseHashOptions): boolean {
  const {
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    status,
    udf1 = "",
    udf2 = "",
    udf3 = "",
    udf4 = "",
    udf5 = "",
    additionalCharges,
    salt,
    receivedHash,
  } = options;

  if (!key || !txnid || !salt || !receivedHash) {
    return false;
  }

  const formattedAmount = formatPayUAmount(amount);

  // Standard reverse hash
  const standardSequence = `${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${formattedAmount}|${txnid}|${key}`;
  const calculatedStandard = crypto
    .createHash("sha512")
    .update(standardSequence)
    .digest("hex")
    .toLowerCase();

  const cleanReceived = receivedHash.trim().toLowerCase();

  if (safeCompare(calculatedStandard, cleanReceived)) {
    return true;
  }

  // If additional charges are present or might have been applied by the PG
  if (additionalCharges && additionalCharges.trim().length > 0) {
    const additionalSequence = `${additionalCharges}|${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${formattedAmount}|${txnid}|${key}`;
    const calculatedAdditional = crypto
      .createHash("sha512")
      .update(additionalSequence)
      .digest("hex")
      .toLowerCase();

    if (safeCompare(calculatedAdditional, cleanReceived)) {
      return true;
    }
  }

  return false;
}

/**
 * Generates hash for the PayU server-to-server Verify Payment WebService:
 *   sha512(key|verify_payment|var1|SALT)
 * where var1 is the txnid.
 */
export function generateVerifyPaymentHash(key: string, txnid: string, salt: string): string {
  const sequence = `${key}|verify_payment|${txnid}|${salt}`;
  return crypto.createHash("sha512").update(sequence).digest("hex").toLowerCase();
}

/**
 * Constant-time string comparison preventing timing leakage.
 */
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
