import {
  type AIProvider,
  type ChatAnswer,
  type ChatMessage,
  type NotesOptions,
  type NotesResult,
  type QuestionOptions,
  type QuestionResult,
  type SummaryOptions,
  type SummaryResult,
  type TranslateOptions,
  type TranslateResult,
  type ResumeAnalysisOptions,
  type ResumeAnalysisResult,
  type DocumentGenerationOptions,
  type DocumentGenerationResult,
  type DocumentAssistantOptions,
  type DocumentAssistantResult,
  AIProviderNotConfiguredError,
} from "@/lib/ai/providers/types";
import type { ExtractedDocument } from "@/lib/ai/document/document-types";
import { supabase } from "@/lib/supabase/client";

export interface ServerAiStatus {
  configured: boolean;
  provider: string;
  providerName: string;
  statusMessage: string;
}

export class ProEntitlementError extends Error {
  readonly isProRequired = true;
  readonly benefitMessage?: string;
  readonly code = "PRO_REQUIRED";

  constructor(message: string = "This AI feature requires a Docly Pro subscription.", benefitMessage?: string) {
    super(message);
    this.name = "ProEntitlementError";
    this.benefitMessage = benefitMessage;
  }
}

async function postAiApi<T>(endpoint: string, body: unknown, defaultErrMsg: string): Promise<T> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : typeof window !== "undefined"
      ? endpoint
      : `http://localhost${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    if (supabase && typeof supabase.auth?.getSession === "function") {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
  } catch {
    // Ignore auth session retrieval failure in offline/testing mode
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (netErr) {
    console.error(`Network error calling ${endpoint}:`, netErr);
    throw new Error(
      "Network error connecting to Docly AI. Please check your connection and try again.",
    );
  }

  if (!response.ok) {
    let errorMessage = defaultErrMsg;
    let isNotConfigured = response.status === 503;
    let isProReq = response.status === 403;
    let benefitMsg: string | undefined;

    try {
      const errorData = (await response.json()) as {
        error?: string;
        configured?: boolean;
        code?: string;
        benefitMessage?: string;
      };
      if (errorData.error) {
        errorMessage = errorData.error;
      }
      if (errorData.configured === false) {
        isNotConfigured = true;
      }
      if (errorData.code === "PRO_REQUIRED" || isProReq) {
        isProReq = true;
        benefitMsg = errorData.benefitMessage;
      }
    } catch {
      // Fall back to default
    }

    if (isProReq) {
      throw new ProEntitlementError(errorMessage, benefitMsg);
    }

    if (isNotConfigured) {
      throw new AIProviderNotConfiguredError(errorMessage);
    }

    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}

function serializeDoc(doc: ExtractedDocument) {
  return {
    documentName: doc.filename,
    totalPages: doc.totalPages,
    pages: doc.pages.map((p) => ({
      pageNumber: p.pageNumber,
      text: p.text,
    })),
  };
}

/**
 * Client-Side AI Provider that securely communicates with Docly's
 * server-side AI endpoints (/api/ai/*).
 *
 * Guarantees that zero API keys ever reside in browser code.
 */
export class ServerBridgeAIProvider implements AIProvider {
  readonly id = "server-bridge";
  readonly name = "Docly Grounded AI";
  private _isConfigured: boolean = false;
  private _statusMessage: string = "Connecting to Docly AI Engine...";
  private _activeProviderName: string = "Server AI";

  get isConfigured(): boolean {
    return this._isConfigured;
  }

  get statusMessage(): string {
    return this._statusMessage;
  }

  get activeProviderName(): string {
    return this._activeProviderName;
  }

  private _hasCheckedStatus: boolean = false;
  private _statusPromise: Promise<ServerAiStatus> | null = null;

  get hasCheckedStatus(): boolean {
    return this._hasCheckedStatus;
  }

  setConfigured(configured: boolean, providerName?: string, statusMessage?: string): void {
    this._isConfigured = configured;
    this._hasCheckedStatus = true;
    if (providerName) this._activeProviderName = providerName;
    if (statusMessage) this._statusMessage = statusMessage;
  }

  private async ensureConfigured(): Promise<void> {
    if (!this._hasCheckedStatus && typeof window !== "undefined") {
      await this.checkStatus();
    }
    if (!this._isConfigured) {
      throw new AIProviderNotConfiguredError(
        this._statusMessage ||
          "AI provider is not configured yet. Configure GEMINI_API_KEY in server environment.",
      );
    }
  }

  /**
   * Queries /api/ai/status to verify if the server environment has an active AI key.
   */
  async checkStatus(): Promise<ServerAiStatus> {
    if (this._statusPromise) {
      return this._statusPromise;
    }

    this._statusPromise = (async () => {
      try {
        const url = typeof window !== "undefined" ? "/api/ai/status" : "http://localhost/api/ai/status";
        const res = await fetch(url);
        this._hasCheckedStatus = true;
        if (!res.ok) {
          this._isConfigured = false;
          this._statusMessage = "Unable to connect to Docly AI service.";
          return {
            configured: false,
            provider: "none",
            providerName: "Unavailable",
            statusMessage: this._statusMessage,
          };
        }

        const data = (await res.json()) as ServerAiStatus;
        this._isConfigured = Boolean(data.configured);
        this._activeProviderName = data.providerName || "Server AI";
        this._statusMessage = data.statusMessage || "";
        return data;
      } catch {
        this._hasCheckedStatus = true;
        this._isConfigured = false;
        this._statusMessage = "AI service connection error.";
        return {
          configured: false,
          provider: "none",
          providerName: "Unavailable",
          statusMessage: this._statusMessage,
        };
      } finally {
        this._statusPromise = null;
      }
    })();

    return this._statusPromise;
  }

  /**
   * Executes a grounded question against the uploaded document via /api/ai/chat.
   */
  async chat(doc: ExtractedDocument, query: string, history?: ChatMessage[]): Promise<ChatAnswer> {
    await this.ensureConfigured();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      throw new Error("Please enter a question about your PDF.");
    }

    const payload = {
      query: trimmedQuery,
      documentName: doc.filename,
      totalPages: doc.totalPages,
      pages: doc.pages.map((p) => ({
        pageNumber: p.pageNumber,
        text: p.text,
      })),
      history: (history || []).map((h) => ({
        role: h.role,
        content: h.content,
      })),
    };

    const data = await postAiApi<{
      answer: string;
      sourcePages?: number[];
      relevantSnippets?: Array<{ pageNumber: number; snippet: string }>;
    }>("/api/ai/chat", payload, "Failed to generate answer from PDF.");

    return {
      answer: data.answer,
      sourcePages: Array.isArray(data.sourcePages) ? data.sourcePages : [],
      relevantSnippets: Array.isArray(data.relevantSnippets) ? data.relevantSnippets : [],
    };
  }

  async summarize(doc: ExtractedDocument, options?: SummaryOptions): Promise<SummaryResult> {
    await this.ensureConfigured();
    return await postAiApi<SummaryResult>(
      "/api/ai/summarize",
      { ...serializeDoc(doc), options },
      "Failed to generate document summary.",
    );
  }

  async generateNotes(doc: ExtractedDocument, options?: NotesOptions): Promise<NotesResult> {
    await this.ensureConfigured();
    return await postAiApi<NotesResult>(
      "/api/ai/notes",
      { ...serializeDoc(doc), options },
      "Failed to generate study notes.",
    );
  }

  async generateQuestions(
    doc: ExtractedDocument,
    options?: QuestionOptions,
  ): Promise<QuestionResult> {
    await this.ensureConfigured();
    return await postAiApi<QuestionResult>(
      "/api/ai/questions",
      { ...serializeDoc(doc), options },
      "Failed to generate quiz questions.",
    );
  }

  async translate(
    doc: ExtractedDocument,
    targetLanguage: string,
    options?: TranslateOptions,
  ): Promise<TranslateResult> {
    await this.ensureConfigured();
    return await postAiApi<TranslateResult>(
      "/api/ai/translate",
      { ...serializeDoc(doc), targetLanguage, options },
      "Failed to translate document.",
    );
  }

  async analyzeResume(
    resumeText: string,
    options?: ResumeAnalysisOptions,
  ): Promise<ResumeAnalysisResult> {
    await this.ensureConfigured();
    return await postAiApi<ResumeAnalysisResult>(
      "/api/ai/resume",
      { resumeText, options },
      "Failed to analyze resume.",
    );
  }

  async generateDocument(
    options: DocumentGenerationOptions,
  ): Promise<DocumentGenerationResult> {
    await this.ensureConfigured();
    return await postAiApi<DocumentGenerationResult>(
      "/api/ai/generate",
      options,
      "Failed to generate document.",
    );
  }

  async assistDocument(
    doc: ExtractedDocument,
    options: DocumentAssistantOptions,
  ): Promise<DocumentAssistantResult> {
    await this.ensureConfigured();
    return await postAiApi<DocumentAssistantResult>(
      "/api/ai/assistant",
      { ...serializeDoc(doc), options },
      "Failed to process document assistant request.",
    );
  }
}

