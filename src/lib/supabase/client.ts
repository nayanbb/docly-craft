import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Safely resolves an environment variable across browser and SSR runtime scopes.
 */
function getClientEnvVar(name: string): string {
  // 1. Vite browser bundle injection
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const val = import.meta.env[name];
      if (typeof val === "string" && val.trim().length > 0) {
        return val.trim();
      }
    }
  } catch {
    // import.meta may be undefined in certain node contexts
  }

  // 2. Node / SSR process.env
  try {
    if (typeof process !== "undefined" && process.env) {
      const val = process.env[name];
      if (typeof val === "string" && val.trim().length > 0) {
        return val.trim();
      }
    }
  } catch {
    // process may be undefined
  }

  return "";
}

export const supabaseUrl = getClientEnvVar("VITE_SUPABASE_URL");
export const supabaseAnonKey = getClientEnvVar("VITE_SUPABASE_ANON_KEY");

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith("http") &&
  !supabaseUrl.includes("placeholder-docly"),
);

/**
 * Fallback values used ONLY when environment secrets are not yet configured.
 * Guarantees that public pages and tool executions never crash at bundle evaluation time.
 */
const activeUrl = isSupabaseConfigured ? supabaseUrl : "https://placeholder-docly.supabase.co";

const activeKey = isSupabaseConfigured
  ? supabaseAnonKey
  : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key";

export const supabase: SupabaseClient = createClient(activeUrl, activeKey, {
  auth: {
    flowType: "pkce",
    detectSessionInUrl: true,
    persistSession: typeof window !== "undefined" && isSupabaseConfigured,
    autoRefreshToken: typeof window !== "undefined" && isSupabaseConfigured,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

/**
 * Converts technical Supabase error codes and messages into clean, user-friendly copy.
 */
export function formatAuthError(err: unknown): string {
  if (!err) return "An unexpected error occurred. Please try again.";

  const raw =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err);

  const lower = raw.toLowerCase();

  if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
    return "Incorrect email or password. Please double check and try again.";
  }
  if (lower.includes("user already registered") || lower.includes("already registered")) {
    return "An account with this email already exists. Please log in instead.";
  }
  if (lower.includes("password should be at least")) {
    return "Password must be at least 6 characters long.";
  }
  if (lower.includes("email not confirmed") || lower.includes("confirm your email")) {
    return "Please confirm your email address before signing in. Check your inbox for the confirmation link.";
  }
  if (
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("too many requests") ||
    lower.includes("over_email_send_rate_limit")
  ) {
    return "Too many requests. Please wait a few moments and try again.";
  }
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "Network error. Please check your internet connection and try again.";
  }
  if (lower.includes("token has expired") || lower.includes("recovery link has expired")) {
    return "This password reset link has expired. Please request a new one.";
  }
  if (
    lower.includes("access_denied") ||
    lower.includes("user cancelled") ||
    lower.includes("user canceled") ||
    lower.includes("user declined")
  ) {
    return "Google sign-in was cancelled. Please try again when ready.";
  }
  if (
    lower.includes("unable to exchange external code") ||
    lower.includes("bad_oauth_callback") ||
    lower.includes("oauth callback failed") ||
    lower.includes("invalid_grant") ||
    lower.includes("code was already redeemed") ||
    lower.includes("code verifier") ||
    lower.includes("code_verifier") ||
    lower.includes("code_challenge") ||
    lower.includes("error exchanging external code") ||
    lower.includes("4/0a")
  ) {
    return "Google sign-in could not be completed. Please try again.";
  }
  if (lower.includes("provider is not enabled") || lower.includes("unsupported provider") || lower.includes("provider disabled")) {
    return "Google sign-in is not yet enabled in the Supabase project dashboard.";
  }
  if (lower.includes("popup closed") || lower.includes("window closed")) {
    return "The Google sign-in window was closed before completion. Please try again.";
  }

  // Strip any raw OAuth authorization codes that might leak through
  if (raw.includes("4/0A") || raw.includes("4/0a")) {
    return "Google sign-in could not be completed. Please try again.";
  }

  return raw;
}
