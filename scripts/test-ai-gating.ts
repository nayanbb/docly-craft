import assert from "node:assert";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { PRO_ONLY_TOOL_IDS, isProTool } from "../src/lib/monetization/config";
import { verifyAiEntitlement } from "../src/lib/ai/server/handler";
import { verifyServerUserSubscription } from "../src/lib/monetization/subscription";

console.log("=================================================");
console.log("   DOCLY AI TOOLS & GATING VERIFICATION SUITE   ");
console.log("=================================================\n");

const envContent = fs.readFileSync(path.resolve(".env"), "utf8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const k = trimmed.substring(0, idx).trim();
      let v = trimmed.substring(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.substring(1, v.length - 1);
      }
      env[k] = v;
    }
  }
}

const url = env["VITE_SUPABASE_URL"] || "";
const anonKey = env["VITE_SUPABASE_ANON_KEY"] || "";
const serviceKey = env["SUPABASE_SERVICE_ROLE_KEY"] || "";

const adminDb = createClient(url, serviceKey);
const clientDb = createClient(url, anonKey);

async function runAiGatingSuite() {
  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            console.log(`[PASS] ${name}`);
            passed++;
          })
          .catch((err) => {
            console.error(`[FAIL] ${name}:`, err);
          });
      } else {
        console.log(`[PASS] ${name}`);
        passed++;
      }
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err);
    }
  }

  // 1. Generate real user session token for active PayU subscriber
  const { data: linkData } = await adminDb.auth.admin.generateLink({
    type: "magiclink",
    email: "ayankoji15@gmail.com",
  });
  const { data: sessionData } = await clientDb.auth.verifyOtp({
    token_hash: linkData!.properties!.hashed_token!,
    type: "magiclink",
  });
  const proUserToken = sessionData.session!.access_token;
  const proUserId = sessionData.user!.id;

  // 2. Generate a separate free user session token
  const freeEmail = `test_free_${Date.now()}@docly.tools`;
  const { data: freeUserCreated } = await adminDb.auth.admin.createUser({
    email: freeEmail,
    password: "Password123!",
    email_confirm: true,
  });
  const freeUserId = freeUserCreated!.user!.id;
  const { data: freeSession } = await clientDb.auth.signInWithPassword({
    email: freeEmail,
    password: "Password123!",
  });
  const freeUserToken = freeSession.session!.access_token;

  const aiTools = [
    "chat-with-pdf",
    "passport-photo",
    "ai-passport-photo",
    "background-remover",
    "ai-background-replacement",
    "ai-pdf-summary",
    "pdf-to-notes",
    "pdf-to-questions",
    "translate-pdf",
    "resume-analyzer",
    "ai-document-generator",
    "ai-document-assistant",
  ];

  // SECTION 1: Tool Registry & UI Gating Classification
  console.log("--- Section 1: Tool Classification in Registry ---");
  for (const toolId of aiTools) {
    test(`Tool '${toolId}' is classified as Pro-only in configuration`, () => {
      assert.strictEqual(isProTool(toolId), true, `isProTool('${toolId}') must be true`);
      assert.strictEqual(PRO_ONLY_TOOL_IDS.has(toolId), true);
    });
  }

  // SECTION 2: Server-side Entitlement for Authenticated Active PayU Pro User
  console.log("\n--- Section 2: Active PayU Pro User Authorization ---");
  await test("Active PayU subscriber resolves isPro = true server-side", async () => {
    const req = new Request("http://localhost/api/ai/summarize", {
      headers: { Authorization: `Bearer ${proUserToken}` },
    });
    const sub = await verifyServerUserSubscription(req, env);
    assert.strictEqual(sub.isPro, true, "Active PayU subscriber must be isPro: true");
    assert.strictEqual(sub.plan, "pro");
    assert.strictEqual(sub.userId, proUserId);
  });

  for (const toolId of aiTools) {
    await test(`Active PayU Pro request allowed for endpoint '${toolId}'`, async () => {
      const req = new Request(`http://localhost/api/ai/${toolId}`, {
        headers: { Authorization: `Bearer ${proUserToken}` },
      });
      const result = await verifyAiEntitlement(req, toolId, env);
      assert.strictEqual(result.allowed, true, `PayU Pro user must be allowed for ${toolId}`);
      assert.strictEqual(result.userId, proUserId);
      assert.strictEqual(result.response, undefined, "No 403 error response for Pro user");
    });
  }

  // SECTION 3: Server-side Entitlement for Authenticated Free User
  console.log("\n--- Section 3: Free User Rejection & Upgrade UI ---");
  await test("Free user resolves isPro = false server-side", async () => {
    const req = new Request("http://localhost/api/ai/summarize", {
      headers: { Authorization: `Bearer ${freeUserToken}` },
    });
    const sub = await verifyServerUserSubscription(req, env);
    assert.strictEqual(sub.isPro, false, "Free user must be isPro: false");
    assert.strictEqual(sub.plan, "free");
  });

  for (const toolId of aiTools) {
    await test(`Free user request rejected with 403 PRO_REQUIRED for '${toolId}'`, async () => {
      const req = new Request(`http://localhost/api/ai/${toolId}`, {
        headers: { Authorization: `Bearer ${freeUserToken}` },
      });
      const result = await verifyAiEntitlement(req, toolId, env);
      assert.strictEqual(result.allowed, false, `Free user must NOT be allowed for ${toolId}`);
      assert.ok(result.response, "403 response must be returned");
      assert.strictEqual(result.response.status, 403);
      const body = await result.response.json();
      assert.strictEqual(body.code, "PRO_REQUIRED");
      assert.strictEqual(body.error, "This AI feature requires a Docly Pro subscription.");
      assert.ok(body.benefitMessage, "Benefit message provided");
      assert.strictEqual(body.price, "₹25/month");
    });
  }

  // SECTION 4: Anonymous / Unauthenticated User
  console.log("\n--- Section 4: Anonymous User Rejection ---");
  for (const toolId of aiTools) {
    await test(`Anonymous request rejected with 403 PRO_REQUIRED for '${toolId}'`, async () => {
      const req = new Request(`http://localhost/api/ai/${toolId}`, {
        headers: {}, // No authorization header
      });
      const result = await verifyAiEntitlement(req, toolId, env);
      assert.strictEqual(result.allowed, false, `Anonymous user must NOT be allowed for ${toolId}`);
      assert.ok(result.response, "403 response must be returned");
      assert.strictEqual(result.response.status, 403);
      const body = await result.response.json();
      assert.strictEqual(body.code, "PRO_REQUIRED");
    });
  }

  // Clean up test free user from auth
  await adminDb.auth.admin.deleteUser(freeUserId);

  console.log(`\n=================================================`);
  console.log(`AI GATING TESTS COMPLETE: ${passed} / ${total} passed.`);
  console.log(`=================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runAiGatingSuite().catch((err) => {
  console.error("AI gating suite failed:", err);
  process.exit(1);
});
