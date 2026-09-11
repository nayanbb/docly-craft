import assert from "node:assert";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { formatAuthError, AUTH_STORAGE_KEY, supabaseUrl, supabaseAnonKey } from "./src/lib/supabase/client";
import { sanitizeRedirectPath } from "./src/lib/auth/require-auth";
import { CANONICAL_PRODUCTION_ORIGIN, getCanonicalAuthOrigin } from "./src/lib/supabase/auth-context";

console.log("=================================================");
console.log("   DOCLY EMAIL/PASSWORD AUTHENTICATION SUITE     ");
console.log("=================================================\n");

let passed = 0;
let total = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err);
  }
}

async function main() {
  // 1. Verify Canonical Production Origin is strictly https://docly-tools.vercel.app
  await runTest("1. CANONICAL_PRODUCTION_ORIGIN is strictly 'https://docly-tools.vercel.app'", () => {
    assert.strictEqual(CANONICAL_PRODUCTION_ORIGIN, "https://docly-tools.vercel.app");
    assert.strictEqual(CANONICAL_PRODUCTION_ORIGIN.includes("docly-craft"), false);
    assert.strictEqual(CANONICAL_PRODUCTION_ORIGIN.includes("git-main"), false);
  });

  // 2. Verify getCanonicalAuthOrigin fallback
  await runTest("2. getCanonicalAuthOrigin defaults to canonical production domain outside localhost", () => {
    const origin = getCanonicalAuthOrigin();
    assert.strictEqual(origin, "https://docly-tools.vercel.app");
  });

  // 3. Centralized Error Mapper: RATE_LIMIT (HTTP 429)
  await runTest("3. formatAuthError maps HTTP 429 / rate limits to rate limit notice", () => {
    const fromStatus = formatAuthError({ status: 429, message: "Too many requests" });
    assert.strictEqual(fromStatus, "Too many authentication attempts. Please wait a few minutes and try again.");

    const fromCode = formatAuthError({ code: "over_email_send_rate_limit", message: "email rate limit exceeded" });
    assert.strictEqual(fromCode, "Too many authentication attempts. Please wait a few minutes and try again.");
  });

  // 4. Centralized Error Mapper: INVALID_CREDENTIALS
  await runTest("4. formatAuthError maps invalid credentials to user-safe copy", () => {
    const formatted = formatAuthError({ code: "invalid_credentials", message: "Invalid login credentials" });
    assert.strictEqual(formatted, "Incorrect email or password.");
  });

  // 5. Centralized Error Mapper: EMAIL_ALREADY_EXISTS
  await runTest("5. formatAuthError maps user_already_exists to login guidance", () => {
    const formatted = formatAuthError({ code: "user_already_exists", message: "User already registered" });
    assert.strictEqual(formatted, "An account with this email already exists. Try logging in instead.");
  });

  // 6. Centralized Error Mapper: EMAIL_CONFIRMATION_REQUIRED
  await runTest("6. formatAuthError maps email_not_confirmed to check email guidance", () => {
    const formatted = formatAuthError({ code: "email_not_confirmed", message: "Email not confirmed" });
    assert.strictEqual(formatted, "Account created. Please check your email to confirm your account.");
  });

  // 7. Centralized Error Mapper: WEAK_PASSWORD and INVALID_EMAIL
  await runTest("7. formatAuthError maps weak password and invalid email properly", () => {
    const weakPass = formatAuthError({ code: "weak_password", message: "Password should be at least 6 characters" });
    assert.strictEqual(weakPass, "Password must be at least 6 characters long.");

    const invalidEmail = formatAuthError({ code: "invalid_email", message: "invalid email format" });
    assert.strictEqual(invalidEmail, "Please enter a valid email address.");
  });

  // 8. Centralized Error Mapper: NETWORK_ERROR
  await runTest("8. formatAuthError maps network failures to connection guidance", () => {
    const netErr = formatAuthError({ message: "Failed to fetch network resource" });
    assert.strictEqual(netErr, "Unable to connect right now. Please check your internet connection and try again.");
  });

  // 9. Centralized Error Mapper: UNKNOWN_AUTH_ERROR (no raw leaks)
  await runTest("9. formatAuthError maps unknown server errors to safe fallback", () => {
    const rawLeak = formatAuthError({ message: "Postgres error 23505: duplicate key value violates unique constraint" });
    assert.strictEqual(rawLeak, "Unable to complete authentication right now. Please try again later.");
    assert.strictEqual(rawLeak.includes("Postgres"), false);
  });

  // 10. Client.ts persistent session, storageKey, and autoRefreshToken
  await runTest("10. client.ts configures persistSession, autoRefreshToken, detectSessionInUrl, and AUTH_STORAGE_KEY", () => {
    const clientFile = fs.readFileSync("c:/Users/nayan/docly-craft/src/lib/supabase/client.ts", "utf-8");
    assert.strictEqual(clientFile.includes("persistSession: true"), true);
    assert.strictEqual(clientFile.includes("autoRefreshToken: true"), true);
    assert.strictEqual(clientFile.includes("detectSessionInUrl: true"), true);
    assert.strictEqual(clientFile.includes("storageKey: AUTH_STORAGE_KEY"), true);
    assert.strictEqual(AUTH_STORAGE_KEY, "docly_supabase_auth_token");
  });

  // 11. Duplicate submit prevention in signup.tsx
  await runTest("11. signup.tsx implements isSubmittingRef to block duplicate clicks and mutations", () => {
    const signupFile = fs.readFileSync("c:/Users/nayan/docly-craft/src/routes/signup.tsx", "utf-8");
    assert.strictEqual(signupFile.includes("const isSubmittingRef = useRef(false)"), true);
    assert.strictEqual(signupFile.includes("if (isSubmittingRef.current || isLoading || isGoogleLoading)"), true);
    assert.strictEqual(signupFile.includes("isSubmittingRef.current = true;"), true);
    assert.strictEqual(signupFile.includes("isSubmittingRef.current = false;"), true);
  });

  // 12. Duplicate submit prevention in login.tsx
  await runTest("12. login.tsx implements isSubmittingRef to block duplicate clicks and mutations", () => {
    const loginFile = fs.readFileSync("c:/Users/nayan/docly-craft/src/routes/login.tsx", "utf-8");
    assert.strictEqual(loginFile.includes("const isSubmittingRef = useRef(false)"), true);
    assert.strictEqual(loginFile.includes("if (isSubmittingRef.current || isLoading || isGoogleLoading)"), true);
    assert.strictEqual(loginFile.includes("isSubmittingRef.current = true;"), true);
    assert.strictEqual(loginFile.includes("isSubmittingRef.current = false;"), true);
  });

  // 13. AuthContext multi-tab synchronization listener
  await runTest("13. auth-context.tsx listens to storage events for multi-tab synchronization", () => {
    const authContextFile = fs.readFileSync("c:/Users/nayan/docly-craft/src/lib/supabase/auth-context.tsx", "utf-8");
    assert.strictEqual(authContextFile.includes("window.addEventListener(\"storage\", handleStorage)"), true);
    assert.strictEqual(authContextFile.includes("e.key === AUTH_STORAGE_KEY"), true);
    assert.strictEqual(authContextFile.includes("initialResolved = true;"), true);
  });

  // 14. Live Supabase Auth test: verify signInWithPassword against live Supabase project
  await runTest("14. Live Supabase signInWithPassword returns valid 400 invalid_credentials for non-existent probe", async () => {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    const res = await client.auth.signInWithPassword({
      email: "probe_docly_auth_test_user@example.com",
      password: "TestPassword123!",
    });

    assert.ok(res.error, "Must return error for probe credentials");
    assert.strictEqual(res.error!.status, 400);
    assert.strictEqual(res.error!.message.toLowerCase().includes("invalid"), true);
    assert.strictEqual(res.data.session, null);
  });

  console.log(`\n=================================================`);
  console.log(`Test results: ${passed} / ${total} passed.`);
  console.log(`=================================================`);

  if (passed !== total) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Suite failed:", err);
  process.exit(1);
});
