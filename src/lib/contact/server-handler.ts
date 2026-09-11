/**
 * Server-Side Contact Form & Transactional Email Delivery Handler
 * 
 * Securely handles visitor inquiries from /contact, validates payloads,
 * applies spam protection (honeypot + IP sliding-window rate limiting),
 * and dispatches professional HTML emails to nayanbhatkhade8530@gmail.com
 * via Resend's REST API.
 */

const DEFAULT_RECIPIENT_EMAIL = "nayanbhatkhade8530@gmail.com";
const DEFAULT_FROM_EMAIL = "Docly Contact <onboarding@resend.dev>";
const MAX_NAME_LENGTH = 100;
const MIN_NAME_LENGTH = 2;
const MAX_MESSAGE_LENGTH = 5000;
const MIN_MESSAGE_LENGTH = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 5;

// In-memory sliding-window IP rate limiter
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimitStore = new Map<string, RateLimitEntry>();

// Purge expired entries periodically
function cleanupRateLimits() {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(ip);
    }
  }
}

/**
 * Resolves a server-side secret from Cloudflare Worker env or process.env
 * Strictly never exposed to frontend JavaScript or client bundles.
 */
export function resolveServerSecret(name: string, env?: unknown): string {
  if (env && typeof env === "object" && name in env) {
    const val = (env as Record<string, unknown>)[name];
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
  }
  if (typeof process !== "undefined" && process.env && process.env[name]) {
    const val = process.env[name];
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
  }
  return "";
}

/**
 * Standardized CORS response headers for API endpoints
 */
function getCorsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Content-Type": "application/json",
  };
}

/**
 * Validates an email address against RFC 5322 specifications
 * and guarantees absence of CRLF injection characters.
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  if (/[\r\n]/.test(email)) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email);
}

/**
 * Sanitizes single-line strings to prevent header injection
 */
export function sanitizeSingleLine(input: string): string {
  return input.replace(/[\r\n\t]/g, " ").trim();
}

/**
 * Escapes HTML characters to prevent XSS in HTML email templates
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Check if the caller IP is rate-limited
 */
export function checkRateLimit(ip: string): { limited: boolean; remaining: number } {
  cleanupRateLimits();
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { limited: false, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { limited: true, remaining: 0 };
  }

  entry.count += 1;
  return { limited: false, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count };
}

/**
 * Reset rate limits (useful for test suites)
 */
export function resetRateLimits(): void {
  rateLimitStore.clear();
}

export interface ContactSubmissionPayload {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  hp?: unknown; // Invisible honeypot field
  company_website?: unknown; // Alternative honeypot field
}

export interface ContactValidationResult {
  valid: boolean;
  error?: string;
  data?: {
    name: string;
    email: string;
    message: string;
  };
}

export function validateContactSubmission(body: ContactSubmissionPayload): ContactValidationResult {
  // Honeypot check: If either honeypot field is non-empty, flag as spam
  const honeypot = (typeof body.hp === "string" ? body.hp : "") ||
                   (typeof body.company_website === "string" ? body.company_website : "");
  if (honeypot.trim().length > 0) {
    // Spambot captured
    return { valid: false, error: "Spam detected." };
  }

  // Name validation
  if (typeof body.name !== "string" || !body.name.trim()) {
    return { valid: false, error: "Please enter your name." };
  }
  const cleanName = sanitizeSingleLine(body.name);
  if (cleanName.length < MIN_NAME_LENGTH) {
    return { valid: false, error: `Name must be at least ${MIN_NAME_LENGTH} characters long.` };
  }
  if (cleanName.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `Name cannot exceed ${MAX_NAME_LENGTH} characters.` };
  }

  // Email validation
  if (typeof body.email !== "string" || !body.email.trim()) {
    return { valid: false, error: "Please enter your email address." };
  }
  const cleanEmail = sanitizeSingleLine(body.email.toLowerCase());
  if (!isValidEmail(cleanEmail)) {
    return { valid: false, error: "Please enter a valid email address." };
  }

  // Message validation
  if (typeof body.message !== "string" || !body.message.trim()) {
    return { valid: false, error: "Please enter your message." };
  }
  const cleanMessage = body.message.trim();
  if (cleanMessage.length < MIN_MESSAGE_LENGTH) {
    return { valid: false, error: `Message must be at least ${MIN_MESSAGE_LENGTH} characters long.` };
  }
  if (cleanMessage.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message is too long (maximum ${MAX_MESSAGE_LENGTH} characters).` };
  }

  return {
    valid: true,
    data: {
      name: cleanName,
      email: cleanEmail,
      message: cleanMessage,
    },
  };
}

/**
 * Builds the professional HTML email template
 */
export function generateContactEmailHtml(data: {
  name: string;
  email: string;
  message: string;
  submittedAtIso: string;
  ipAddress?: string;
}): string {
  const safeName = escapeHtml(data.name);
  const safeEmail = escapeHtml(data.email);
  const safeMessage = escapeHtml(data.message).replace(/\n/g, "<br/>");
  const formattedDate = new Date(data.submittedAtIso).toLocaleString("en-US", {
    timeZone: "UTC",
    dateStyle: "full",
    timeStyle: "long",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Docly Contact Form Message</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 28px 32px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
    .content { padding: 32px; }
    .meta-box { background-color: #f1f5f9; border-radius: 12px; padding: 18px; margin-bottom: 24px; }
    .meta-row { display: flex; margin-bottom: 8px; font-size: 14px; }
    .meta-row:last-child { margin-bottom: 0; }
    .meta-label { font-weight: 600; width: 80px; color: #64748b; }
    .meta-value { font-weight: 500; color: #0f172a; word-break: break-all; }
    .message-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px; }
    .message-body { background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #0284c7; border-radius: 8px; padding: 18px; font-size: 15px; line-height: 1.6; color: #334155; white-space: pre-wrap; }
    .footer { border-top: 1px solid #f1f5f9; background-color: #fafafa; padding: 16px 32px; font-size: 12px; color: #94a3b8; text-align: center; }
    .reply-badge { display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 6px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Docly Contact Form</h1>
      <p>New visitor inquiry submitted from docly.app</p>
    </div>
    <div class="content">
      <div class="meta-box">
        <div class="meta-row">
          <span class="meta-label">Sender:</span>
          <span class="meta-value">${safeName}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Email:</span>
          <span class="meta-value"><a href="mailto:${safeEmail}" style="color: #0284c7; text-decoration: none;">${safeEmail}</a></span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Time:</span>
          <span class="meta-value">${formattedDate} (UTC)</span>
        </div>
      </div>

      <div class="message-title">Message</div>
      <div class="message-body">${safeMessage}</div>

      <div style="text-align: center;">
        <span class="reply-badge">Tip: You can hit Reply in your email client to respond directly to ${safeName}</span>
      </div>
    </div>
    <div class="footer">
      This notification was sent by the Docly production application at ${data.submittedAtIso}.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Plaintext email version
 */
export function generateContactEmailText(data: {
  name: string;
  email: string;
  message: string;
  submittedAtIso: string;
}): string {
  return `Docly Contact Form — New Message
========================================

Sender:  ${data.name}
Email:   ${data.email}
Date:    ${data.submittedAtIso}

Message:
----------------------------------------
${data.message}
----------------------------------------

Note: Reply directly to this email to respond to ${data.email}.
`;
}

/**
 * Dispatches the contact email via Resend's REST API
 */
export async function sendEmailViaResend(params: {
  apiKey: string;
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; id?: string; error?: string; statusCode?: number }> {
  try {
    console.log("[Contact API] CONTACT_RESEND_REQUEST_STARTED=true");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: params.from,
        to: [params.to],
        reply_to: params.replyTo,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    console.log(`[Contact API] CONTACT_RESEND_HTTP_STATUS=${res.status}`);
    const responseData = await res.json().catch(() => null) as { id?: string; message?: string; name?: string } | null;

    if (!res.ok) {
      console.log("[Contact API] CONTACT_RESEND_SUCCESS=false");
      const errorMsg = responseData?.message || `HTTP ${res.status} ${res.statusText}`;

      // Log safe diagnostic categorization without leaking secrets
      if (errorMsg.includes("You can only send testing emails to your own email address")) {
        console.error("[Contact API] Resend Restriction: Test sender onboarding@resend.dev requires recipient to match account owner, or a verified custom domain on resend.com/domains.");
      } else if (res.status === 401) {
        console.error("[Contact API] Resend Authentication Error: API key is invalid or unauthorized.");
      } else {
        console.error(`[Contact API] Resend HTTP ${res.status} Error:`, errorMsg);
      }

      return { ok: false, error: errorMsg, statusCode: res.status };
    }

    console.log("[Contact API] CONTACT_RESEND_SUCCESS=true");
    return { ok: true, id: responseData?.id, statusCode: res.status };
  } catch (err) {
    console.log("[Contact API] CONTACT_RESEND_SUCCESS=false");
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Contact API] Failed to connect to Resend API:", errorMsg);
    return { ok: false, error: errorMsg, statusCode: 500 };
  }
}

/**
 * Safe server-side diagnostic handler: GET /api/contact/diagnostic
 * Verifies runtime reachability to Resend without leaking secrets or full error payloads.
 */
export async function handleContactDiagnosticRequest(request: Request, env?: unknown): Promise<Response> {
  const corsHeaders = getCorsHeaders();

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const resendApiKey = resolveServerSecret("RESEND_API_KEY", env);
  const fromEmail = resolveServerSecret("RESEND_FROM_EMAIL", env) || DEFAULT_FROM_EMAIL;
  const recipientEmail = resolveServerSecret("CONTACT_RECIPIENT_EMAIL", env) || DEFAULT_RECIPIENT_EMAIL;

  const isConfigured = Boolean(resendApiKey);

  if (!isConfigured) {
    return new Response(
      JSON.stringify({
        status: "missing_api_key",
        configured: false,
        from: fromEmail,
        to: recipientEmail,
        message: "RESEND_API_KEY is not configured in the server runtime environment.",
      }),
      { status: 200, headers: corsHeaders }
    );
  }

  // Safe reachability test to Resend API
  try {
    const res = await fetch("https://api.resend.com/api-keys", {
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
      },
    });

    const resData = await res.json().catch(() => null) as { message?: string; name?: string; statusCode?: number } | null;

    if (res.status === 401 && resData?.name !== "restricted_api_key") {
      return new Response(
        JSON.stringify({
          status: "invalid_api_key",
          configured: true,
          from: fromEmail,
          to: recipientEmail,
          message: "Resend rejected the API key as invalid.",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Key is valid. Check if test domain (onboarding@resend.dev) is compatible with target recipient
    const isTestDomain = fromEmail.includes("onboarding@resend.dev");

    return new Response(
      JSON.stringify({
        status: "ready",
        configured: true,
        from: fromEmail,
        to: recipientEmail,
        isTestDomain,
        keyType: resData?.name === "restricted_api_key" ? "sending_only" : "full_access",
        message: isTestDomain
          ? "Resend is configured with onboarding@resend.dev test domain. Ensure recipient matches your Resend account email or verify your domain at resend.com/domains."
          : "Resend is configured with custom domain and ready for production delivery.",
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        status: "network_failure",
        configured: true,
        from: fromEmail,
        to: recipientEmail,
        message: "Failed to connect to https://api.resend.com.",
      }),
      { status: 200, headers: corsHeaders }
    );
  }
}

/**
 * Main HTTP request handler for POST /api/contact
 */
export async function handleContactFormRequest(request: Request, env?: unknown): Promise<Response> {
  const corsHeaders = getCorsHeaders();

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Route GET requests to the safe diagnostic handler
  if (request.method === "GET") {
    return await handleContactDiagnosticRequest(request, env);
  }

  // Enforce POST method for actual submissions
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: corsHeaders }
    );
  }

  // Extract client IP address for sliding-window rate limiting
  const clientIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "127.0.0.1";

  // Check rate limit
  const { limited } = checkRateLimit(clientIp);
  if (limited) {
    return new Response(
      JSON.stringify({
        error: "Too many requests. Please wait a few minutes before sending another message, or email us directly at nayanbhatkhade8530@gmail.com.",
      }),
      { status: 429, headers: corsHeaders }
    );
  }

  // Parse JSON payload
  let body: ContactSubmissionPayload;
  try {
    body = (await request.json()) as ContactSubmissionPayload;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON payload." }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Validate form submission
  const validation = validateContactSubmission(body);
  if (!validation.valid || !validation.data) {
    // If spam honeypot was triggered, respond with 200 to sinkhole the bot quietly
    if (validation.error === "Spam detected.") {
      return new Response(
        JSON.stringify({ success: true, message: "Message sent successfully." }),
        { status: 200, headers: corsHeaders }
      );
    }
    return new Response(
      JSON.stringify({ error: validation.error || "Validation failed." }),
      { status: 400, headers: corsHeaders }
    );
  }

  const { name, email, message } = validation.data;
  const submittedAtIso = new Date().toISOString();

  // Resolve server-side secrets
  const resendApiKey = resolveServerSecret("RESEND_API_KEY", env);
  const fromEmail = resolveServerSecret("RESEND_FROM_EMAIL", env) || DEFAULT_FROM_EMAIL;
  const recipientEmail = resolveServerSecret("CONTACT_RECIPIENT_EMAIL", env) || DEFAULT_RECIPIENT_EMAIL;

  console.log(`[Contact API] CONTACT_EMAIL_CONFIGURED=${Boolean(resendApiKey)}`);

  // Safe fallback error message as explicitly specified by requirements
  const safeUserError = "We couldn't send your message right now. Please try again later or email us directly at nayanbhatkhade8530@gmail.com.";

  if (!resendApiKey) {
    console.error("[Contact API] RESEND_API_KEY is not configured on the server.");
    return new Response(
      JSON.stringify({ error: safeUserError }),
      { status: 503, headers: corsHeaders }
    );
  }

  // Construct email bodies
  const subject = `Docly Contact Form — New Message from ${name}`;
  const html = generateContactEmailHtml({
    name,
    email,
    message,
    submittedAtIso,
    ipAddress: clientIp,
  });
  const text = generateContactEmailText({
    name,
    email,
    message,
    submittedAtIso,
  });

  // Dispatch email via Resend
  const deliveryResult = await sendEmailViaResend({
    apiKey: resendApiKey,
    from: fromEmail,
    to: recipientEmail,
    replyTo: email,
    subject,
    html,
    text,
  });

  if (!deliveryResult.ok) {
    return new Response(
      JSON.stringify({ error: safeUserError }),
      { status: 500, headers: corsHeaders }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Message sent successfully. We've received your message and will get back to you soon.",
      id: deliveryResult.id,
    }),
    { status: 200, headers: corsHeaders }
  );
}
