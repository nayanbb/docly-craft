import {
  getServerAiProvider,
  type ServerChatContextPage,
  type ServerChatMessage,
} from "@/lib/ai/server/provider";
import { verifyServerUserSubscription } from "@/lib/monetization/subscription";
import { BENEFIT_MESSAGES } from "@/lib/monetization/config";
import { resolveServerEnvVar } from "@/lib/office/providers";
import { supabase } from "@/lib/supabase/client";

/** Limits for cost control and abuse protection */
export const MAX_AI_PAGES = 50;
export const MAX_AI_TEXT_CHARS = 150_000;
export const MAX_PROMPT_CHARS = 2_000;

/**
 * Verifies that the incoming request is authorized to execute a Pro AI feature.
 * Automatically allows execution in automated testing mode (when DOCLY_AI_PROVIDER="mock").
 */
export async function verifyAiEntitlement(
  request: Request,
  toolId: string,
  env?: unknown,
): Promise<{ allowed: boolean; response?: Response; userId?: string }> {
  const forcedProvider = resolveServerEnvVar("DOCLY_AI_PROVIDER", env).toLowerCase();
  const authHeader = request.headers.get("Authorization");

  // In test environments or when explicitly set to mock/test-bypass, allow testing
  if (
    (forcedProvider === "mock" || resolveServerEnvVar("DOCLY_TEST_BYPASS_AUTH", env) === "true") &&
    !authHeader
  ) {
    return { allowed: true, userId: "test-runner" };
  }

  const sub = await verifyServerUserSubscription(request, env);
  if (!sub.isPro) {
    const benefit =
      BENEFIT_MESSAGES[toolId] ||
      "Access all premium AI document and photo features with Docly Pro.";
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          code: "PRO_REQUIRED",
          error: "This AI feature requires a Docly Pro subscription.",
          benefitMessage: benefit,
          price: "₹25/month",
          ctaText: "Upgrade to Pro",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        },
      ),
    };
  }

  return { allowed: true, userId: sub.userId };
}

/**
 * Asynchronously and safely records usage metrics without leaking document contents or secrets.
 */
function trackAiUsage(
  userId?: string,
  feature?: string,
  pageCount: number = 1,
  inputChars: number = 0,
  status: string = "success",
  provider: string = "docly_ai",
): void {
  if (!userId || userId === "test-runner") return;
  try {
    if (supabase && typeof supabase.from === "function") {
      supabase
        .from("ai_usage")
        .insert({
          user_id: userId,
          feature: feature || "ai_feature",
          input_chars: inputChars,
          page_count: pageCount,
          status,
          provider,
        })
        .then(() => {})
        .catch(() => {});
    }
  } catch {
    // Non-blocking telemetry
  }
}

/**
 * Handles GET /api/ai/status
 * Informs client whether an AI provider is active without exposing secrets.
 */
export async function handleAiStatusRequest(_request: Request, env?: unknown): Promise<Response> {
  const provider = getServerAiProvider(env);

  return new Response(
    JSON.stringify({
      configured: provider.isConfigured,
      provider: provider.id,
      providerName: provider.name,
      statusMessage: provider.isConfigured
        ? `Docly AI Engine is active (${provider.name}). Your questions are processed with strict PDF grounding.`
        : "AI provider is not configured yet. Configure GEMINI_API_KEY (recommended) or OPENAI_API_KEY in server environment.",
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}

interface ChatRequestBody {
  query?: unknown;
  documentName?: unknown;
  totalPages?: unknown;
  pages?: unknown;
  history?: unknown;
}

/**
 * Handles POST /api/ai/chat
 * Validates document and query, executes grounded AI completion via active server provider.
 */
export async function handleAiChatRequest(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON request payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. Validate query
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return new Response(
      JSON.stringify({
        error: "Question cannot be empty. Please ask a question about your PDF.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (query.length > MAX_PROMPT_CHARS) {
    return new Response(
      JSON.stringify({
        error: `Question cannot exceed ${MAX_PROMPT_CHARS} characters.`,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // 2. Validate pages
  if (!Array.isArray(body.pages) || body.pages.length === 0) {
    return new Response(
      JSON.stringify({
        error: "No document pages were provided to answer your question.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (body.pages.length > MAX_AI_PAGES) {
    return new Response(
      JSON.stringify({
        error: `This document exceeds the maximum limit of ${MAX_AI_PAGES} pages for AI processing.`,
      }),
      {
        status: 413,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const validPages: ServerChatContextPage[] = [];
  let totalTextLength = 0;

  for (const p of body.pages) {
    if (typeof p === "object" && p !== null) {
      const pageObj = p as { pageNumber?: unknown; text?: unknown };
      const pageNumber =
        typeof pageObj.pageNumber === "number" ? pageObj.pageNumber : validPages.length + 1;
      const text = typeof pageObj.text === "string" ? pageObj.text : "";
      validPages.push({ pageNumber, text });
      totalTextLength += text.trim().length;
    }
  }

  if (totalTextLength === 0) {
    return new Response(
      JSON.stringify({
        error:
          "This PDF does not contain enough selectable text. OCR is required to chat with this document.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (totalTextLength > MAX_AI_TEXT_CHARS) {
    return new Response(
      JSON.stringify({
        error: `Extracted document text exceeds the limit of ${MAX_AI_TEXT_CHARS.toLocaleString()} characters for AI processing.`,
      }),
      {
        status: 413,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // 3. Document metadata
  const documentName =
    typeof body.documentName === "string" && body.documentName.trim().length > 0
      ? body.documentName.trim()
      : "document.pdf";
  const totalPages =
    typeof body.totalPages === "number" && body.totalPages > 0
      ? body.totalPages
      : validPages.length;

  // 4. Conversation history
  const history: ServerChatMessage[] = [];
  if (Array.isArray(body.history)) {
    for (const h of body.history) {
      if (typeof h === "object" && h !== null) {
        const item = h as { role?: unknown; content?: unknown };
        if (
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string" &&
          item.content.trim().length > 0
        ) {
          history.push({
            role: item.role,
            content: item.content.trim().slice(0, 1000),
          });
        }
      }
    }
  }

  // 5. Resolve active provider
  const provider = getServerAiProvider(env);
  if (!provider.isConfigured) {
    return new Response(
      JSON.stringify({
        error:
          "AI provider is not configured. Configure GEMINI_API_KEY (recommended) or OPENAI_API_KEY in your server environment (.env).",
        configured: false,
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // 6. Check Pro Entitlement for configured provider
  const entitlement = await verifyAiEntitlement(request, "chat-with-pdf", env);
  if (!entitlement.allowed && entitlement.response) {
    return entitlement.response;
  }

  // 7. Execute grounded chat
  try {
    const result = await provider.chat({
      query,
      history,
      pages: validPages,
      documentName,
      totalPages,
    });

    trackAiUsage(entitlement.userId, "chat-with-pdf", totalPages, totalTextLength, "success", provider.id);

    return new Response(
      JSON.stringify({
        answer: result.answer,
        sourcePages: result.sourcePages,
        relevantSnippets: result.relevantSnippets,
        provider: result.provider,
        model: result.model,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    trackAiUsage(entitlement.userId, "chat-with-pdf", totalPages, totalTextLength, "error", provider.id);
    return formatAiError(err);
  }
}

interface FramingRequestBody {
  imageBase64?: unknown;
}

/**
 * Handles POST /api/ai/detect-framing
 * Uses server-side Vision AI strictly to detect normalized bounding boxes
 * of the primary subject's face, head crown, and shoulders for passport framing.
 * NEVER alters or regenerates imagery.
 */
export async function handleAiDetectFramingRequest(
  request: Request,
  env?: unknown,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: FramingRequestBody;
  try {
    body = (await request.json()) as FramingRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON request payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
  if (!rawBase64) {
    return new Response(JSON.stringify({ error: "imageBase64 is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const provider = getServerAiProvider(env);
  if (!provider.isConfigured || provider.id !== "gemini") {
    return new Response(
      JSON.stringify({
        configured: false,
        detail: "Server vision AI not active; falling back to client biometric detector.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const entitlement = await verifyAiEntitlement(request, "passport-photo", env);
  if (!entitlement.allowed && entitlement.response) {
    return entitlement.response;
  }

  try {
    const cleanBase64 = rawBase64.replace(/^data:image\/[a-z]+;base64,/, "");
    const apiKey = (provider as unknown as { apiKey: string }).apiKey;
    const model = (provider as unknown as { model: string }).model || "gemini-2.5-flash";

    const promptText = `Analyze this photograph to locate the primary human subject for biometric passport framing.
The photo may be full-body, medium-distance, or a portrait taken in a mall, room, outdoors, or casual setting with large background.
1. Find the PRIMARY person (largest, most prominent foreground subject). Discard tiny distant background bystanders, reflections, or background posters.
2. If there are TWO or MORE equally prominent, similarly sized foreground subjects, set multipleProminentPeople: true. Otherwise false.
3. Locate the primary subject's:
   - faceBox: {x, y, width, height} tight around forehead, cheeks, chin.
   - headBox: {x, y, width, height} from crown of hair/head to chin tip.
   - shouldersBox: {x, y, width, height} across left to right shoulder line and upper chest.
   - hasUpperBody: true if head, neck, and shoulders are in the photograph.
Return ONLY raw JSON with normalized coordinates between 0.0 and 1.0 without markdown formatting:
{
  "faceBox": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 },
  "headBox": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 },
  "shouldersBox": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 },
  "hasUpperBody": true,
  "multipleProminentPeople": false
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: promptText },
              { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          configured: true,
          error: "Vision AI call failed; falling back to local detector.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const jsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!jsonStr) {
      return new Response(
        JSON.stringify({ configured: true, error: "Empty response from vision AI." }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const parsed = JSON.parse(jsonStr);
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({
        configured: true,
        error: "Vision detection error; falling back to local detector.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
}

function parsePages(pages: unknown): ServerChatContextPage[] {
  const validPages: ServerChatContextPage[] = [];
  if (Array.isArray(pages)) {
    for (const p of pages) {
      if (typeof p === "object" && p !== null) {
        const pageObj = p as { pageNumber?: unknown; text?: unknown };
        const pageNumber =
          typeof pageObj.pageNumber === "number" ? pageObj.pageNumber : validPages.length + 1;
        const text = typeof pageObj.text === "string" ? pageObj.text : "";
        validPages.push({ pageNumber, text });
      }
    }
  }
  return validPages;
}

function formatAiError(err: unknown): Response {
  const rawMsg = err instanceof Error ? err.message : String(err);
  let safeMessage = "Failed to process AI request. Please try again.";
  let code = "AI_PROCESSING_FAILED";
  let statusCode = 500;

  if (
    rawMsg.includes("429") ||
    rawMsg.toLowerCase().includes("quota") ||
    rawMsg.toLowerCase().includes("rate limit")
  ) {
    safeMessage =
      "AI service is currently rate limited or quota exceeded. Please try again in a few moments.";
    code = "RATE_LIMITED";
    statusCode = 429;
  } else if (
    rawMsg.includes("401") ||
    rawMsg.includes("403") ||
    rawMsg.toLowerCase().includes("invalid api key")
  ) {
    safeMessage =
      "AI service authentication failed. Please verify the API key configured in your server environment.";
    code = "AUTH_FAILED";
    statusCode = 502;
  } else if (
    rawMsg.toLowerCase().includes("timeout") ||
    rawMsg.toLowerCase().includes("network")
  ) {
    safeMessage =
      "Connection to AI provider timed out. Please check your network connection and try again.";
    code = "PROCESSING_TIMEOUT";
    statusCode = 504;
  }

  return new Response(
    JSON.stringify({
      ok: false,
      error: safeMessage,
      code,
      message: safeMessage,
    }),
    {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    },
  );
}

/**
 * Handles POST /api/ai/summarize
 */
export async function handleAiSummarizeRequest(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON request payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pages = parsePages(body.pages);
  if (pages.length === 0) {
    return new Response(JSON.stringify({ error: "No document pages provided." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (pages.length > MAX_AI_PAGES) {
    return new Response(
      JSON.stringify({
        error: `Document exceeds the maximum limit of ${MAX_AI_PAGES} pages for summarization.`,
      }),
      { status: 413, headers: { "Content-Type": "application/json" } },
    );
  }

  const totalChars = pages.reduce((acc, p) => acc + p.text.length, 0);
  if (totalChars > MAX_AI_TEXT_CHARS) {
    return new Response(
      JSON.stringify({
        error: `Document text exceeds the limit of ${MAX_AI_TEXT_CHARS.toLocaleString()} characters for AI summarization.`,
      }),
      { status: 413, headers: { "Content-Type": "application/json" } },
    );
  }

  const provider = getServerAiProvider(env);
  if (!provider.isConfigured) {
    return new Response(
      JSON.stringify({ error: "AI provider is not configured.", configured: false }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const entitlement = await verifyAiEntitlement(request, "ai-pdf-summary", env);
  if (!entitlement.allowed && entitlement.response) {
    return entitlement.response;
  }

  try {
    const documentName = typeof body.documentName === "string" ? body.documentName : "document.pdf";
    const totalPages = typeof body.totalPages === "number" ? body.totalPages : pages.length;
    const options = body.options as any;

    const result = await provider.summarize({ documentName, totalPages, pages, options });
    trackAiUsage(entitlement.userId, "ai-pdf-summary", totalPages, totalChars, "success", provider.id);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return formatAiError(err);
  }
}

/**
 * Handles POST /api/ai/notes
 */
export async function handleAiNotesRequest(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON request payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pages = parsePages(body.pages);
  if (pages.length === 0) {
    return new Response(JSON.stringify({ error: "No document pages provided." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (pages.length > MAX_AI_PAGES) {
    return new Response(
      JSON.stringify({
        error: `Document exceeds the maximum limit of ${MAX_AI_PAGES} pages for notes generation.`,
      }),
      { status: 413, headers: { "Content-Type": "application/json" } },
    );
  }

  const totalChars = pages.reduce((acc, p) => acc + p.text.length, 0);
  if (totalChars > MAX_AI_TEXT_CHARS) {
    return new Response(
      JSON.stringify({
        error: `Document text exceeds the limit of ${MAX_AI_TEXT_CHARS.toLocaleString()} characters.`,
      }),
      { status: 413, headers: { "Content-Type": "application/json" } },
    );
  }

  const provider = getServerAiProvider(env);
  if (!provider.isConfigured) {
    return new Response(
      JSON.stringify({ error: "AI provider is not configured.", configured: false }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const entitlement = await verifyAiEntitlement(request, "pdf-to-notes", env);
  if (!entitlement.allowed && entitlement.response) {
    return entitlement.response;
  }

  try {
    const documentName = typeof body.documentName === "string" ? body.documentName : "document.pdf";
    const totalPages = typeof body.totalPages === "number" ? body.totalPages : pages.length;
    const options = body.options as any;

    const result = await provider.generateNotes({ documentName, totalPages, pages, options });
    trackAiUsage(entitlement.userId, "pdf-to-notes", totalPages, totalChars, "success", provider.id);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return formatAiError(err);
  }
}

/**
 * Handles POST /api/ai/questions
 */
export async function handleAiQuestionsRequest(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON request payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pages = parsePages(body.pages);
  if (pages.length === 0) {
    return new Response(JSON.stringify({ error: "No document pages provided." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (pages.length > MAX_AI_PAGES) {
    return new Response(
      JSON.stringify({
        error: `Document exceeds the maximum limit of ${MAX_AI_PAGES} pages for quiz generation.`,
      }),
      { status: 413, headers: { "Content-Type": "application/json" } },
    );
  }

  const totalChars = pages.reduce((acc, p) => acc + p.text.length, 0);
  if (totalChars > MAX_AI_TEXT_CHARS) {
    return new Response(
      JSON.stringify({
        error: `Document text exceeds the limit of ${MAX_AI_TEXT_CHARS.toLocaleString()} characters.`,
      }),
      { status: 413, headers: { "Content-Type": "application/json" } },
    );
  }

  const provider = getServerAiProvider(env);
  if (!provider.isConfigured) {
    return new Response(
      JSON.stringify({ error: "AI provider is not configured.", configured: false }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const entitlement = await verifyAiEntitlement(request, "pdf-to-questions", env);
  if (!entitlement.allowed && entitlement.response) {
    return entitlement.response;
  }

  try {
    const documentName = typeof body.documentName === "string" ? body.documentName : "document.pdf";
    const totalPages = typeof body.totalPages === "number" ? body.totalPages : pages.length;
    const options = body.options as any;

    const result = await provider.generateQuestions({ documentName, totalPages, pages, options });
    trackAiUsage(entitlement.userId, "pdf-to-questions", totalPages, totalChars, "success", provider.id);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return formatAiError(err);
  }
}

/**
 * Handles POST /api/ai/translate
 */
export async function handleAiTranslateRequest(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON request payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const targetLanguage = typeof body.targetLanguage === "string" ? body.targetLanguage.trim() : "";
  if (!targetLanguage) {
    return new Response(JSON.stringify({ error: "targetLanguage is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pages = parsePages(body.pages);
  if (pages.length === 0) {
    return new Response(JSON.stringify({ error: "No document pages provided." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (pages.length > MAX_AI_PAGES) {
    return new Response(
      JSON.stringify({
        error: `Document exceeds the maximum limit of ${MAX_AI_PAGES} pages for translation.`,
      }),
      { status: 413, headers: { "Content-Type": "application/json" } },
    );
  }

  const totalChars = pages.reduce((acc, p) => acc + p.text.length, 0);
  if (totalChars > MAX_AI_TEXT_CHARS) {
    return new Response(
      JSON.stringify({
        error: `Document text exceeds the limit of ${MAX_AI_TEXT_CHARS.toLocaleString()} characters.`,
      }),
      { status: 413, headers: { "Content-Type": "application/json" } },
    );
  }

  const provider = getServerAiProvider(env);
  if (!provider.isConfigured) {
    return new Response(
      JSON.stringify({ error: "AI provider is not configured.", configured: false }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const entitlement = await verifyAiEntitlement(request, "translate-pdf", env);
  if (!entitlement.allowed && entitlement.response) {
    return entitlement.response;
  }

  try {
    const documentName = typeof body.documentName === "string" ? body.documentName : "document.pdf";
    const totalPages = typeof body.totalPages === "number" ? body.totalPages : pages.length;
    const options = body.options as any;

    const result = await provider.translate({
      documentName,
      totalPages,
      pages,
      targetLanguage,
      options,
    });
    trackAiUsage(entitlement.userId, "translate-pdf", totalPages, totalChars, "success", provider.id);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return formatAiError(err);
  }
}

/**
 * Handles POST /api/ai/resume
 */
export async function handleAiResumeRequest(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON request payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resumeText = typeof body.resumeText === "string" ? body.resumeText.trim() : "";
  if (!resumeText) {
    return new Response(JSON.stringify({ error: "resumeText is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (resumeText.length > MAX_AI_TEXT_CHARS) {
    return new Response(
      JSON.stringify({
        error: `Resume text exceeds the limit of ${MAX_AI_TEXT_CHARS.toLocaleString()} characters.`,
      }),
      { status: 413, headers: { "Content-Type": "application/json" } },
    );
  }

  const provider = getServerAiProvider(env);
  if (!provider.isConfigured) {
    return new Response(
      JSON.stringify({ error: "AI provider is not configured.", configured: false }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const entitlement = await verifyAiEntitlement(request, "resume-analyzer", env);
  if (!entitlement.allowed && entitlement.response) {
    return entitlement.response;
  }

  try {
    const options = body.options as any;
    const result = await provider.analyzeResume({ resumeText, options });
    trackAiUsage(entitlement.userId, "resume-analyzer", 1, resumeText.length, "success", provider.id);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return formatAiError(err);
  }
}

/**
 * Handles POST /api/ai/generate
 */
export async function handleAiGenerateRequest(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON request payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt =
    typeof body.prompt === "string"
      ? body.prompt.trim()
      : typeof body.topic === "string"
        ? body.topic.trim()
        : "";

  if (!prompt) {
    return new Response(
      JSON.stringify({ error: "Prompt or topic is required to generate a document." }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (prompt.length > MAX_PROMPT_CHARS) {
    return new Response(
      JSON.stringify({ error: `Prompt cannot exceed ${MAX_PROMPT_CHARS} characters.` }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const documentType =
    typeof body.documentType === "string"
      ? (body.documentType as any)
      : typeof body.type === "string"
        ? (body.type as any)
        : "general";

  const provider = getServerAiProvider(env);
  if (!provider.isConfigured) {
    return new Response(
      JSON.stringify({ error: "AI provider is not configured.", configured: false }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const entitlement = await verifyAiEntitlement(request, "ai-document-generator", env);
  if (!entitlement.allowed && entitlement.response) {
    return entitlement.response;
  }

  try {
    const result = await provider.generateDocument({
      prompt,
      documentType,
      tone: body.tone as any,
      length: body.length as any,
      variables: body.variables as any,
    });
    trackAiUsage(entitlement.userId, "ai-document-generator", 1, prompt.length, "success", provider.id);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return formatAiError(err);
  }
}

/**
 * Handles POST /api/ai/assistant
 */
export async function handleAiAssistantRequest(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON request payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pages = parsePages(body.pages);
  if (pages.length === 0) {
    return new Response(JSON.stringify({ error: "No document pages provided." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (pages.length > MAX_AI_PAGES) {
    return new Response(
      JSON.stringify({
        error: `Document exceeds the maximum limit of ${MAX_AI_PAGES} pages for assistant operations.`,
      }),
      { status: 413, headers: { "Content-Type": "application/json" } },
    );
  }

  const totalChars = pages.reduce((acc, p) => acc + p.text.length, 0);
  if (totalChars > MAX_AI_TEXT_CHARS) {
    return new Response(
      JSON.stringify({
        error: `Document text exceeds the limit of ${MAX_AI_TEXT_CHARS.toLocaleString()} characters.`,
      }),
      { status: 413, headers: { "Content-Type": "application/json" } },
    );
  }

  const options = (body.options || {}) as any;
  const mode =
    typeof options.mode === "string"
      ? options.mode
      : typeof options.action === "string"
        ? options.action
        : "explain";

  const provider = getServerAiProvider(env);
  if (!provider.isConfigured) {
    return new Response(
      JSON.stringify({ error: "AI provider is not configured.", configured: false }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const entitlement = await verifyAiEntitlement(request, "ai-document-assistant", env);
  if (!entitlement.allowed && entitlement.response) {
    return entitlement.response;
  }

  try {
    const documentName = typeof body.documentName === "string" ? body.documentName : "document.pdf";
    const totalPages = typeof body.totalPages === "number" ? body.totalPages : pages.length;

    const result = await provider.assistDocument({
      documentName,
      totalPages,
      pages,
      options: {
        mode,
        query: typeof options.query === "string" ? options.query : undefined,
        selectedText: typeof options.selectedText === "string" ? options.selectedText : undefined,
      },
    });
    trackAiUsage(entitlement.userId, "ai-document-assistant", totalPages, totalChars, "success", provider.id);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return formatAiError(err);
  }
}
