import type {
  AIProvider,
  ChatAnswer,
  ChatMessage,
  NotesOptions,
  NotesResult,
  QuestionOptions,
  QuestionResult,
  SummaryOptions,
  SummaryResult,
  TranslateOptions,
  TranslateResult,
} from "@/lib/ai/providers/types";
import { AIProviderNotConfiguredError } from "@/lib/ai/providers/types";
import { useEffect, useState } from "react";
import type { ExtractedDocument } from "@/lib/ai/document/document-types";
import { ServerBridgeAIProvider } from "@/lib/ai/providers/server-provider";

export * from "@/lib/ai/providers/types";
export * from "@/lib/ai/providers/server-provider";

/**
 * Default unconfigured AI provider.
 * Strictly adheres to project rules:
 * - Never returns fake AI output.
 * - Explains transparently that generative AI requires a secure provider.
 * - Does not require or store client-side secrets.
 */
export class UnconfiguredAIProvider implements AIProvider {
  readonly id = "unconfigured";
  readonly name = "Docly AI Connector";
  readonly isConfigured = false;
  readonly statusMessage =
    "AI provider is not configured yet. Document extraction and analysis are running 100% locally in your browser. Generative output requires connecting a secure AI provider.";

  async summarize(_doc: ExtractedDocument, _options?: SummaryOptions): Promise<SummaryResult> {
    throw new AIProviderNotConfiguredError(
      "AI provider is not configured yet. Document text has been extracted locally, but generative summarization requires a configured AI provider.",
    );
  }

  async chat(
    _doc: ExtractedDocument,
    _query: string,
    _history?: ChatMessage[],
  ): Promise<ChatAnswer> {
    throw new AIProviderNotConfiguredError(
      "AI provider is not configured yet. Local document search is available, but generative question answering requires a configured AI provider.",
    );
  }

  async generateNotes(_doc: ExtractedDocument, _options?: NotesOptions): Promise<NotesResult> {
    throw new AIProviderNotConfiguredError(
      "AI provider is not configured yet. Document outline has been extracted locally, but generative note formatting requires a configured AI provider.",
    );
  }

  async generateQuestions(
    _doc: ExtractedDocument,
    _options?: QuestionOptions,
  ): Promise<QuestionResult> {
    throw new AIProviderNotConfiguredError(
      "AI provider is not configured yet. Generating practice questions requires a configured AI provider.",
    );
  }

  async translate(
    _doc: ExtractedDocument,
    _targetLanguage: string,
    _options?: TranslateOptions,
  ): Promise<TranslateResult> {
    throw new AIProviderNotConfiguredError(
      "AI provider is not configured yet. Translating document content requires a configured translation provider.",
    );
  }

  async analyzeResume(
    _resumeText: string,
    _options?: ResumeAnalysisOptions,
  ): Promise<ResumeAnalysisResult> {
    throw new AIProviderNotConfiguredError(
      "AI provider is not configured yet. Analyzing resumes requires a configured AI provider.",
    );
  }

  async generateDocument(
    _options: DocumentGenerationOptions,
  ): Promise<DocumentGenerationResult> {
    throw new AIProviderNotConfiguredError(
      "AI provider is not configured yet. Generating documents requires a configured AI provider.",
    );
  }

  async assistDocument(
    _doc: ExtractedDocument,
    _options: DocumentAssistantOptions,
  ): Promise<DocumentAssistantResult> {
    throw new AIProviderNotConfiguredError(
      "AI provider is not configured yet. Document assistant requires a configured AI provider.",
    );
  }
}

let activeProvider: AIProvider = new ServerBridgeAIProvider();

export function getActiveAIProvider(): AIProvider {
  return activeProvider;
}

export const getAIProvider = getActiveAIProvider;

export function setActiveAIProvider(provider: AIProvider): void {
  activeProvider = provider;
}

export function isAIProviderConfigured(): boolean {
  return activeProvider.isConfigured;
}

export interface AiProviderStatusHook {
  configured: boolean;
  loading: boolean;
  provider: string;
  providerName: string;
  statusMessage: string;
}

export function useAiProviderStatus(): AiProviderStatusHook {
  const [status, setStatus] = useState<AiProviderStatusHook>(() => ({
    configured: activeProvider.isConfigured,
    loading: !(activeProvider as any).hasCheckedStatus,
    provider: (activeProvider as any).id || "none",
    providerName: (activeProvider as any).activeProviderName || "Docly AI",
    statusMessage: (activeProvider as any).statusMessage || "",
  }));

  useEffect(() => {
    let mounted = true;
    const bridge = activeProvider as ServerBridgeAIProvider;
    if (bridge && typeof bridge.checkStatus === "function") {
      bridge.checkStatus().then((res) => {
        if (mounted && res) {
          setStatus({
            configured: Boolean(res.configured),
            loading: false,
            provider: res.provider || "none",
            providerName: res.providerName || "Docly AI",
            statusMessage: res.statusMessage || "",
          });
        }
      });
    } else {
      setStatus({
        configured: activeProvider.isConfigured,
        loading: false,
        provider: activeProvider.id,
        providerName: activeProvider.name,
        statusMessage: "",
      });
    }

    return () => {
      mounted = false;
    };
  }, []);

  return status;
}
