import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const CANONICAL_SUPABASE_URL = "https://zslugwmnhrcjhbcexdvs.supabase.co";
export const CANONICAL_SUPABASE_ANON_KEY = "sb_publishable_326teNMTxtzqTN9bU4vJqg_aDq6yHtE";

// Direct static member expressions are required for Vite AST compile-time inlining into browser bundle
function resolveSupabaseUrl(): string {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_URL) {
      const val = String(import.meta.env.VITE_SUPABASE_URL).trim();
      if (val.length > 0 && !val.includes("placeholder-docly")) {
        return val;
      }
    }
  } catch {}
  try {
    if (typeof process !== "undefined" && process.env && process.env.VITE_SUPABASE_URL) {
      const val = String(process.env.VITE_SUPABASE_URL).trim();
      if (val.length > 0 && !val.includes("placeholder-docly")) {
        return val;
      }
    }
  } catch {}
  return CANONICAL_SUPABASE_URL;
}

function resolveSupabaseAnonKey(): string {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      const val = String(import.meta.env.VITE_SUPABASE_ANON_KEY).trim();
      if (val.length > 0 && !val.includes("dummy_anon_key")) {
        return val;
      }
    }
  } catch {}
  try {
    if (typeof process !== "undefined" && process.env && process.env.VITE_SUPABASE_ANON_KEY) {
      const val = String(process.env.VITE_SUPABASE_ANON_KEY).trim();
      if (val.length > 0 && !val.includes("dummy_anon_key")) {
        return val;
      }
    }
  } catch {}
  return CANONICAL_SUPABASE_ANON_KEY;
}

export const supabaseUrl = resolveSupabaseUrl();
export const supabaseAnonKey = resolveSupabaseAnonKey();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith("http") &&
  !supabaseUrl.includes("placeholder-docly"),
);

export const AUTH_STORAGE_KEY = "docly_supabase_auth_token";

/**
 * ONE shared browser Supabase client.
 * Configured with persistent local session storage, auto-refresh tokens, and PKCE flow.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: "pkce",
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: AUTH_STORAGE_KEY,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

/**
 * Centralized, secure authentication error mapper.
 * Distinguishes rate limits, invalid credentials, existing accounts, confirmation requirements,
 * network errors, and weak passwords without exposing raw system internals.
 */
export function formatAuthError(err: unknown): string {
  if (!err) return "An unexpected error occurred. Please try again.";

  const raw =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err);

  const status =
    typeof err === "object" && err !== null && "status" in err
      ? Number((err as { status: unknown }).status)
      : 0;

  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code).toLowerCase()
      : "";

  const lower = raw.toLowerCase();

  // 1. Genuine Rate Limiting (HTTP 429 or Supabase rate limit error codes)
  if (
    status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("too many requests") ||
    lower.includes("over_email_send_rate_limit")
  ) {
    return "Too many authentication attempts. Please wait a few minutes and try again.";
  }

  // 2. Invalid Credentials
  if (
    code === "invalid_credentials" ||
    lower.includes("invalid login credentials") ||
    lower.includes("invalid credentials")
  ) {
    return "Incorrect email or password.";
  }

  // 3. Account Already Exists
  if (
    code === "user_already_exists" ||
    lower.includes("user already registered") ||
    lower.includes("already registered") ||
    lower.includes("already exists") ||
    lower.includes("user already exists")
  ) {
    return "An account with this email already exists. Try logging in instead.";
  }

  // 4. Email Confirmation Required
  if (
    code === "email_not_confirmed" ||
    lower.includes("email not confirmed") ||
    lower.includes("confirm your email")
  ) {
    return "Account created. Please check your email to confirm your account.";
  }

  // 5. Weak Password
  if (
    code === "weak_password" ||
    lower.includes("password should be at least") ||
    lower.includes("weak password") ||
    lower.includes("password is too short")
  ) {
    return "Password must be at least 6 characters long.";
  }

  // 6. Invalid Email
  if (
    code === "invalid_email" ||
    lower.includes("invalid email") ||
    lower.includes("unable to validate email address")
  ) {
    return "Please enter a valid email address.";
  }

  // 7. Network / Connectivity Error
  if (
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("aborterror") ||
    lower.includes("connection refused") ||
    lower.includes("offline")
  ) {
    return "Unable to connect right now. Please check your internet connection and try again.";
  }

  // 8. Password Reset Token Expired
  if (
    code === "token_expired" ||
    lower.includes("token has expired") ||
    lower.includes("recovery link has expired")
  ) {
    return "This password reset link has expired. Please request a new one.";
  }

  // 9. Google Sign-In Cancelled
  if (
    lower.includes("access_denied") ||
    lower.includes("user cancelled") ||
    lower.includes("user canceled") ||
    lower.includes("user declined")
  ) {
    return "Google sign-in was cancelled. Please try again when ready.";
  }

  // 10. Google Sign-In Exchange / Code Failure
  if (
    lower.includes("unable to exchange") ||
    lower.includes("bad_oauth_callback") ||
    lower.includes("oauth callback failed") ||
    lower.includes("invalid_grant") ||
    lower.includes("code was already redeemed") ||
    lower.includes("code verifier") ||
    lower.includes("code_verifier") ||
    lower.includes("code_challenge") ||
    lower.includes("4/0a")
  ) {
    return "Google sign-in could not be completed. Please try again.";
  }

  if (
    lower.includes("provider is not enabled") ||
    lower.includes("unsupported provider") ||
    lower.includes("provider disabled")
  ) {
    return "Google sign-in is not yet enabled in the Supabase project dashboard.";
  }

  if (lower.includes("popup closed") || lower.includes("window closed")) {
    return "The Google sign-in window was closed before completion. Please try again.";
  }

  // Fallback: Safe generic message to avoid leaking database/server internals
  return "Unable to complete authentication right now. Please try again later.";
}
