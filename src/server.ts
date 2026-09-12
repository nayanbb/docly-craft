import "./lib/error-capture";

// Safely load server environment variables (.env and .dev.vars) on Node server runtime
if (typeof process !== "undefined" && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Optional .env file
  }
  try {
    process.loadEnvFile(".dev.vars");
  } catch {
    // Optional .dev.vars file
  }
}

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

import {
  handleConversionApiRequest,
  handleConversionStatusRequest,
} from "./lib/office/server-handler";
import { handlePdfUnlockRequest } from "./lib/pdf/server-unlock";
import {
  handleAiChatRequest,
  handleAiStatusRequest,
  handleAiDetectFramingRequest,
  handleAiSummarizeRequest,
  handleAiNotesRequest,
  handleAiQuestionsRequest,
  handleAiTranslateRequest,
  handleAiResumeRequest,
  handleAiGenerateRequest,
  handleAiAssistantRequest,
} from "./lib/ai/server/handler";
import {
  handleRazorpaySubscriptionRequest,
  handleRazorpayCancelRequest,
  handleRazorpayWebhookRequest,
  handleRazorpayStatusRequest,
} from "./lib/razorpay/server";
import {
  handlePayUCreatePaymentRequest,
  handlePayUCallbackRequest,
  handlePayUWebhookRequest,
  handlePayUCancelRequest,
  handlePayUStatusRequest,
} from "./lib/payu/server";
import {
  handleAdminMetricsRequest,
  handleAdminPaymentsRequest,
  handleAdminSubscriptionsRequest,
} from "./lib/admin/server-handler";
import { handleContactFormRequest } from "./lib/contact/server-handler";
import { createSitemap } from "./lib/seo/sitemap";
export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/sitemap.xml") {
        return new Response(createSitemap(), {
          status: 200,
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      }
      if (url.pathname === "/api/pdf/unlock") {
        return await handlePdfUnlockRequest(request, env);
      }
      if (url.pathname === "/api/convert/status") {
        return await handleConversionStatusRequest(request, env);
      }
      if (url.pathname === "/api/convert") {
        return await handleConversionApiRequest(request, env);
      }
      if (url.pathname === "/api/ai/status") {
        return await handleAiStatusRequest(request, env);
      }
      if (url.pathname === "/api/ai/chat") {
        return await handleAiChatRequest(request, env);
      }
      if (url.pathname === "/api/ai/detect-framing") {
        return await handleAiDetectFramingRequest(request, env);
      }
      if (url.pathname === "/api/ai/summarize") {
        return await handleAiSummarizeRequest(request, env);
      }
      if (url.pathname === "/api/ai/notes") {
        return await handleAiNotesRequest(request, env);
      }
      if (url.pathname === "/api/ai/questions") {
        return await handleAiQuestionsRequest(request, env);
      }
      if (url.pathname === "/api/ai/translate") {
        return await handleAiTranslateRequest(request, env);
      }
      if (url.pathname === "/api/ai/resume") {
        return await handleAiResumeRequest(request, env);
      }
      if (url.pathname === "/api/ai/generate") {
        return await handleAiGenerateRequest(request, env);
      }
      if (url.pathname === "/api/ai/assistant") {
        return await handleAiAssistantRequest(request, env);
      }

      // PayU Payments & Subscription Endpoints (Primary Gateway)
      if (url.pathname === "/api/payu/create-payment") {
        return await handlePayUCreatePaymentRequest(request, env);
      }
      if (url.pathname === "/api/payu/callback") {
        return await handlePayUCallbackRequest(request, env);
      }
      if (url.pathname === "/api/payu/webhook") {
        return await handlePayUWebhookRequest(request, env);
      }
      if (url.pathname === "/api/payu/cancel") {
        return await handlePayUCancelRequest(request, env);
      }
      if (url.pathname === "/api/payu/status") {
        return await handlePayUStatusRequest(request, env);
      }

      // Razorpay Payments & Subscription Endpoints (Legacy Fallback)
      if (url.pathname === "/api/razorpay/subscription") {
        return await handleRazorpaySubscriptionRequest(request, env);
      }
      if (url.pathname === "/api/razorpay/cancel") {
        return await handleRazorpayCancelRequest(request, env);
      }
      if (url.pathname === "/api/razorpay/webhook") {
        return await handleRazorpayWebhookRequest(request, env);
      }
      if (url.pathname === "/api/razorpay/status") {
        return await handleRazorpayStatusRequest(request, env);
      }

      // Admin Management & Revenue Endpoints
      if (url.pathname === "/api/admin/metrics") {
        return await handleAdminMetricsRequest(request, env);
      }
      if (url.pathname === "/api/admin/payments") {
        return await handleAdminPaymentsRequest(request, env);
      }
      if (url.pathname === "/api/admin/subscriptions") {
        return await handleAdminSubscriptionsRequest(request, env);
      }

      // Contact Form & Diagnostic Endpoints
      if (url.pathname === "/api/contact" || url.pathname === "/api/contact/diagnostic") {
        return await handleContactFormRequest(request, env);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
