import fs from "node:fs";
import path from "node:path";

// 1. Prune oversized WASM assets (>5MB Cloudflare limit)
const assetsDir = path.resolve(".output", "public", "assets");
if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  for (const file of files) {
    const filePath = path.join(assetsDir, file);
    const stat = fs.statSync(filePath);
    // Cloudflare free/preview limit is 5MB (5,242,880 bytes).
    // Remove unused bundled wasm files exceeding limit (loaded dynamically from CDN).
    if (stat.size > 5242880 && file.endsWith(".wasm")) {
      console.log(`[clean-build-assets] Removing oversized wasm asset (>5MB): ${file} (${stat.size} bytes)`);
      fs.unlinkSync(filePath);
    }
  }
}
console.log("[clean-build-assets] Asset pruning completed.");

// 2. Sync server environment variables into Cloudflare Worker wrangler.json
const wranglerJsonPath = path.resolve(".output", "server", "wrangler.json");
if (fs.existsSync(wranglerJsonPath)) {
  try {
    const wranglerConfig = JSON.parse(fs.readFileSync(wranglerJsonPath, "utf-8"));
    wranglerConfig.vars = wranglerConfig.vars || {};

    // Read server variables from local .env if available
    const envPath = path.resolve(".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      for (const line of envContent.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const idx = trimmed.indexOf("=");
          const key = trimmed.slice(0, idx).trim();
          let val = trimmed.slice(idx + 1).trim();
          // Strip enclosing quotes if present
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          // Server-only variables (never client VITE_ variables)
          if (key && !key.startsWith("VITE_") && val) {
            wranglerConfig.vars[key] = val;
          }
        }
      }
    }

    // Enforce default email configuration
    wranglerConfig.vars.RESEND_FROM_EMAIL =
      wranglerConfig.vars.RESEND_FROM_EMAIL || "Docly Contact <onboarding@resend.dev>";
    wranglerConfig.vars.CONTACT_RECIPIENT_EMAIL =
      wranglerConfig.vars.CONTACT_RECIPIENT_EMAIL || "nayanbhatkhade8530@gmail.com";

    fs.writeFileSync(wranglerJsonPath, JSON.stringify(wranglerConfig, null, 2));
    console.log("[clean-build-assets] Server environment variables synced to .output/server/wrangler.json (vars configured: RESEND_API_KEY=" + Boolean(wranglerConfig.vars.RESEND_API_KEY) + ")");
  } catch (err) {
    console.error("[clean-build-assets] Warning syncing wrangler vars:", (err && err.message) || err);
  }
}
