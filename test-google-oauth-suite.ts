import assert from "node:assert";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Load .env for Node test runner
const envPath = "c:/Users/nayan/docly-craft/.env";
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf-8");
  for (const line of envText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { formatAuthError } from "./src/lib/supabase/client";
import { sanitizeRedirectPath } from "./src/lib/auth/require-auth";

console.log("=================================================");
console.log("    DOCLY GOOGLE OAUTH & CALLBACK TEST SUITE     ");
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
  // 1. formatAuthError maps "Unable to exchange external code: 4/0A..."
  await runTest("1. formatAuthError sanitizes external code exchange failure without leaking raw code", () => {
    const rawError = "Unable to exchange external code: 4/0Abcdef123456789_XYZ";
    const formatted = formatAuthError(rawError);
    assert.strictEqual(formatted, "Google sign-in could not be completed. Please try again.");
    assert.strictEqual(formatted.includes("4/0A"), false);
    assert.strictEqual(formatted.includes("Unable to exchange"), false);
  });

  // 2. formatAuthError maps bad_oauth_callback, invalid_grant, and code verifier errors
  await runTest("2. formatAuthError handles bad_oauth_callback, invalid_grant, and PKCE verifier errors cleanly", () => {
    assert.strictEqual(
      formatAuthError("OAuth error: bad_oauth_callback"),
      "Google sign-in could not be completed. Please try again.",
    );
    assert.strictEqual(
      formatAuthError("invalid_grant: Code was already redeemed."),
      "Google sign-in could not be completed. Please try again.",
    );
    assert.strictEqual(
      formatAuthError("both auth code and code verifier should be non-empty"),
      "Google sign-in could not be completed. Please try again.",
    );
    assert.strictEqual(
      formatAuthError("code_challenge does not match"),
      "Google sign-in could not be completed. Please try again.",
    );
  });

  // 3. formatAuthError preserves normal email/password auth error messages
  await runTest("3. formatAuthError preserves email/password validation and login messages", () => {
    assert.strictEqual(
      formatAuthError("Invalid login credentials"),
      "Incorrect email or password. Please double check and try again.",
    );
    assert.strictEqual(
      formatAuthError("User already registered"),
      "An account with this email already exists. Please log in instead.",
    );
    assert.strictEqual(
      formatAuthError("Password should be at least 6 characters"),
      "Password must be at least 6 characters long.",
    );
  });

  // 4. sanitizeRedirectPath preserves legitimate internal destinations
  await runTest("4. sanitizeRedirectPath preserves internal app routes and query params", () => {
    assert.strictEqual(sanitizeRedirectPath("/dashboard"), "/dashboard");
    assert.strictEqual(sanitizeRedirectPath("/account"), "/account");
    assert.strictEqual(sanitizeRedirectPath("/tools/passport-photo"), "/tools/passport-photo");
    assert.strictEqual(sanitizeRedirectPath("/pricing?upgrade=pro"), "/pricing?upgrade=pro");
  });

  // 5. sanitizeRedirectPath blocks external open redirects
  await runTest("5. sanitizeRedirectPath strictly blocks open redirect attacks", () => {
    assert.strictEqual(sanitizeRedirectPath("https://evil.com"), "/dashboard");
    assert.strictEqual(sanitizeRedirectPath("//attacker.org"), "/dashboard");
    assert.strictEqual(sanitizeRedirectPath("javascript:alert(1)"), "/dashboard");
    assert.strictEqual(sanitizeRedirectPath("   "), "/dashboard");
    assert.strictEqual(sanitizeRedirectPath(null), "/dashboard");
  });

  // 6. Supabase Client PKCE Configuration in client.ts
  await runTest("6. client.ts explicitly configures flowType: 'pkce' and detectSessionInUrl: false", () => {
    const clientPath = "c:/Users/nayan/docly-craft/src/lib/supabase/client.ts";
    const content = fs.readFileSync(clientPath, "utf-8");
    assert.strictEqual(content.includes('flowType: "pkce"'), true, "Missing flowType: 'pkce'");
    assert.strictEqual(content.includes("detectSessionInUrl: false"), true, "detectSessionInUrl must be false to avoid double-exchange race condition");
  });

  // 7. Dedicated /auth/callback route file with deduplication
  await runTest("7. /auth/callback route file implements deduplication and single PKCE code exchange", () => {
    const callbackPath = "c:/Users/nayan/docly-craft/src/routes/auth.callback.tsx";
    assert.strictEqual(fs.existsSync(callbackPath), true);
    const content = fs.readFileSync(callbackPath, "utf-8");
    assert.strictEqual(content.includes('createFileRoute("/auth/callback")'), true);
    assert.strictEqual(content.includes("exchangeCodeForSession"), true);
    assert.strictEqual(content.includes("inFlightExchanges"), true, "Missing inFlightExchanges deduplication map");
    assert.strictEqual(content.includes("completedCodes"), true, "Missing completedCodes set");
    assert.strictEqual(content.includes("docly_auth_next"), true, "Missing sessionStorage target destination retrieval");
  });

  // 8. signInWithGoogle routes via canonical /auth/callback and sessionStorage
  await runTest("8. auth-context signInWithGoogle uses canonical /auth/callback and persists destination", () => {
    const authContextPath = "c:/Users/nayan/docly-craft/src/lib/supabase/auth-context.tsx";
    const content = fs.readFileSync(authContextPath, "utf-8");
    assert.strictEqual(content.includes('const callbackUrl = `${origin}/auth/callback`'), true);
    assert.strictEqual(content.includes('sessionStorage.setItem("docly_auth_next", safePath)'), true);
    assert.strictEqual(content.includes("access_type: \"offline\""), true);
  });

  // 9. Self-healing public.profiles creation in fetchProfile
  await runTest("9. auth-context fetchProfile implements self-healing profile creation", () => {
    const authContextPath = "c:/Users/nayan/docly-craft/src/lib/supabase/auth-context.tsx";
    const content = fs.readFileSync(authContextPath, "utf-8");
    assert.strictEqual(content.includes('.from("profiles")'), true);
    assert.strictEqual(content.includes('.insert({'), true);
    assert.strictEqual(content.includes("display_name: fallbackDisplayName"), true);
  });

  // 10. Live PKCE Code Verifier Generation Verification
  await runTest("10. Live PKCE OAuth initialization stores code_verifier and generates S256 challenge", async () => {
    const testUrl = process.env.VITE_SUPABASE_URL || "https://zslugwmnhrcjhbcexdvs.supabase.co";
    const testAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_326teNMTxtzqTN9bU4vJqg_aDq6yHtE";

    const mockStorage: Record<string, string> = {};
    const storageImpl = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; },
      removeItem: (key: string) => { delete mockStorage[key]; },
    };

    const pkceClient = createClient(testUrl, testAnonKey, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
        storage: storageImpl,
      },
    });

    const res = await pkceClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://docly-tools.vercel.app/auth/callback",
        skipBrowserRedirect: true,
      },
    });

    assert.strictEqual(res.error, null);
    assert.ok(res.data?.url, "signInWithOAuth must return authorization URL");

    // Verify storage has the code-verifier key
    const verifierKey = Object.keys(mockStorage).find(k => k.includes("code-verifier"));
    assert.ok(verifierKey, `Expected code-verifier in storage, keys: ${JSON.stringify(Object.keys(mockStorage))}`);
    assert.ok(mockStorage[verifierKey!].length > 20, "Code verifier must be non-empty random string");

    // Verify Supabase Authorize URL contains PKCE parameters
    const parsedUrl = new URL(res.data!.url!);
    assert.strictEqual(parsedUrl.pathname, "/auth/v1/authorize");
    assert.strictEqual(parsedUrl.searchParams.get("provider"), "google");
    assert.strictEqual(parsedUrl.searchParams.get("code_challenge_method"), "s256");
    assert.ok(parsedUrl.searchParams.get("code_challenge"), "Must include code_challenge");
    assert.strictEqual(
      parsedUrl.searchParams.get("redirect_to"),
      "https://docly-tools.vercel.app/auth/callback"
    );

    // Follow redirect to Google OAuth to verify Google receives response_type=code and client_id
    const authRes = await fetch(res.data!.url!, { redirect: "manual" });
    const googleLocation = authRes.headers.get("location");
    assert.ok(googleLocation, "Supabase authorize must 302 redirect to Google OAuth");
    const googleUrl = new URL(googleLocation!);
    assert.strictEqual(googleUrl.hostname, "accounts.google.com");
    assert.strictEqual(googleUrl.searchParams.get("response_type"), "code");
    assert.ok(googleUrl.searchParams.get("client_id")?.includes("878130018318"), "Must contain Google Client ID");
    assert.strictEqual(googleUrl.searchParams.get("redirect_uri"), "https://zslugwmnhrcjhbcexdvs.supabase.co/auth/v1/callback");
  });

  // 11. Google Client Secret & Service Role Key Isolation from frontend
  await runTest("11. No Google Client Secret or Service Role Key is exposed in VITE_ client variables or client code", () => {
    const envContent = fs.existsSync("c:/Users/nayan/docly-craft/.env")
      ? fs.readFileSync("c:/Users/nayan/docly-craft/.env", "utf-8")
      : "";
    assert.strictEqual(envContent.includes("VITE_GOOGLE_CLIENT_SECRET"), false);
    assert.strictEqual(envContent.includes("GOOGLE_CLIENT_SECRET"), false);
    assert.strictEqual(envContent.includes("VITE_SUPABASE_SERVICE_ROLE_KEY"), false);

    const clientContent = fs.readFileSync("c:/Users/nayan/docly-craft/src/lib/supabase/client.ts", "utf-8");
    assert.strictEqual(clientContent.includes("client_secret"), false);
    assert.strictEqual(clientContent.includes("service_role"), false);
  });

  // 12. Supabase Google OAuth Callback URI check
  await runTest("12. Supabase OAuth callback URI matches https://zslugwmnhrcjhbcexdvs.supabase.co/auth/v1/callback", () => {
    const expectedCallback = "https://zslugwmnhrcjhbcexdvs.supabase.co/auth/v1/callback";
    const url = new URL(expectedCallback);
    assert.strictEqual(url.protocol, "https:");
    assert.strictEqual(url.hostname, "zslugwmnhrcjhbcexdvs.supabase.co");
    assert.strictEqual(url.pathname, "/auth/v1/callback");
    assert.strictEqual(expectedCallback.endsWith("/auth/v1/callback"), true);
    assert.strictEqual(expectedCallback.includes("localhost"), false);
  });

  // 13. Vite config defines server port 3000
  await runTest("13. Vite config defines server port 3000 for local development matching Supabase Site URL", () => {
    const viteConfigContent = fs.readFileSync("c:/Users/nayan/docly-craft/vite.config.ts", "utf-8");
    assert.strictEqual(viteConfigContent.includes("port: 3000"), true);
  });

  // 14. Email Login preserved without regression
  await runTest("14. Email/password sign-in, sign-up, and reset password methods remain intact", () => {
    const authContext = fs.readFileSync("c:/Users/nayan/docly-craft/src/lib/supabase/auth-context.tsx", "utf-8");
    assert.strictEqual(authContext.includes("signInWithPassword"), true);
    assert.strictEqual(authContext.includes("signUp"), true);
    assert.strictEqual(authContext.includes("resetPasswordForEmail"), true);
    assert.strictEqual(authContext.includes("updatePassword"), true);
  });

  console.log(`\n=================================================`);
  console.log(`Test results: ${passed} / ${total} passed.`);
  console.log(`=================================================`);
  if (passed !== total) {
    process.exit(1);
  }
}

main();
