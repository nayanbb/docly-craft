import assert from "node:assert";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { formatAuthError } from "./src/lib/supabase/client";
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

  // 3. Verify formatAuthError handles invalid login credentials safely
  await runTest("3. formatAuthError converts 'Invalid login credentials' to user-friendly copy", () => {
    const formatted = formatAuthError({ message: "Invalid login credentials" });
    assert.strictEqual(formatted, "Incorrect email or password. Please double check and try again.");
  });

  // 4. Verify formatAuthError handles email not confirmed
  await runTest("4. formatAuthError converts 'Email not confirmed' to confirmation guidance", () => {
    const formatted = formatAuthError({ message: "Email not confirmed" });
    assert.strictEqual(formatted, "Please confirm your email address before signing in. Check your inbox for the confirmation link.");
  });

  // 5. Verify formatAuthError handles rate limit
  await runTest("5. formatAuthError converts 'rate limit' to throttle message", () => {
    const formatted = formatAuthError({ message: "over_email_send_rate_limit" });
    assert.strictEqual(formatted.includes("rate limit") || formatted.includes("wait a few moments") || formatted.includes("Too many"), true);
  });

  // 6. Verify client.ts configuration has persistSession, autoRefreshToken, and detectSessionInUrl
  await runTest("6. client.ts configures persistSession, autoRefreshToken, and detectSessionInUrl", () => {
    const clientFile = fs.readFileSync("c:/Users/nayan/docly-craft/src/lib/supabase/client.ts", "utf-8");
    assert.strictEqual(clientFile.includes("persistSession: typeof window !== \"undefined\""), true);
    assert.strictEqual(clientFile.includes("autoRefreshToken: typeof window !== \"undefined\""), true);
    assert.strictEqual(clientFile.includes("detectSessionInUrl: true"), true);
    assert.strictEqual(clientFile.includes("storage: typeof window !== \"undefined\" ? window.localStorage : undefined"), true);
  });

  // 7. Verify login.tsx email/password submit handler does NOT redirect to Vercel
  await runTest("7. login.tsx email/password submit handler uses internal navigate() to redirectTarget", () => {
    const loginFile = fs.readFileSync("c:/Users/nayan/docly-craft/src/routes/login.tsx", "utf-8");
    assert.strictEqual(loginFile.includes("await signIn(cleanEmail, password)"), true);
    assert.strictEqual(loginFile.includes("navigate({ to: redirectTarget })"), true);
    // Verify no window.location redirect in handleSubmit
    assert.strictEqual(loginFile.includes("window.location.href = redirectTarget"), false);
    assert.strictEqual(loginFile.includes("window.location.assign"), false);
    assert.strictEqual(loginFile.includes("window.location.replace"), false);
  });

  // 8. Verify auth-context.tsx signUp passes canonical emailRedirectTo
  await runTest("8. auth-context.tsx signUp includes canonical emailRedirectTo pointing to /dashboard", () => {
    const authContextFile = fs.readFileSync("c:/Users/nayan/docly-craft/src/lib/supabase/auth-context.tsx", "utf-8");
    assert.strictEqual(authContextFile.includes("emailRedirectTo: `${canonicalOrigin}/dashboard`"), true);
    assert.strictEqual(authContextFile.includes("redirectTo: `${canonicalOrigin}/reset-password`"), true);
  });

  // 9. Verify __root.tsx has canonical production domain guard
  await runTest("9. __root.tsx guards against preview deployment domains (*.vercel.app)", () => {
    const rootFile = fs.readFileSync("c:/Users/nayan/docly-craft/src/routes/__root.tsx", "utf-8");
    assert.strictEqual(rootFile.includes("hostname.endsWith(\".vercel.app\")"), true);
    assert.strictEqual(rootFile.includes("hostname !== \"docly-tools.vercel.app\""), true);
    assert.strictEqual(rootFile.includes("canonicalTarget = `https://docly-tools.vercel.app"), true);
  });

  // 10. Live Supabase Auth test: verify signInWithPassword against live Supabase project
  await runTest("10. Live Supabase signInWithPassword returns valid auth response (invalid_credentials for test probe)", async () => {
    const client = createClient(
      "https://zslugwmnhrcjhbcexdvs.supabase.co",
      "sb_publishable_326teNMTxtzqTN9bU4vJqg_aDq6yHtE"
    );
    const res = await client.auth.signInWithPassword({
      email: "probe_nonexistent_user@example.com",
      password: "TestPassword123!",
    });

    // Should return error from Supabase (not an unhandled network drop or HTML page)
    assert.ok(res.error, "Must return error for invalid credentials");
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
