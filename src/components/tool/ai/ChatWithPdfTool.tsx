import { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  User,
  Trash2,
  Sparkles,
  BookOpen,
  Search,
  RotateCcw,
  Copy,
  Check,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import type { ExtractedDocument } from "@/lib/ai/document/document-types";
import { type ChatMessage } from "@/lib/ai/providers";
import {
  askDocumentQuestion,
  generateSuggestedQuestions,
  searchRelevantChunks,
} from "@/lib/ai/chat";
import { AiToolHeader } from "@/components/tool/ai/AiToolHeader";
import { ProviderNotice } from "@/components/tool/ai/ProviderNotice";

interface ChatWithPdfToolProps {
  document: ExtractedDocument;
  onReset: () => void;
}

export function ChatWithPdfTool({ document, onReset }: ChatWithPdfToolProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [suggestedQuestions] = useState<string[]>(() => generateSuggestedQuestions(document));
  const [isServerReady, setIsServerReady] = useState<boolean>(false);
  const [serverProviderName, setServerProviderName] = useState<string>("");
  const [isCheckingServer, setIsCheckingServer] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasReadableText =
    document.hasExtractableText !== false &&
    document.totalWords >= 5 &&
    document.totalCharacters >= 15;

  // Check server-side AI provider configuration on mount
  useEffect(() => {
    let isMounted = true;
    async function checkServer() {
      try {
        const res = await fetch("/api/ai/status");
        if (res.ok) {
          const data = (await res.json()) as {
            configured?: boolean;
            provider?: string;
            providerName?: string;
          };
          if (isMounted) {
            setIsServerReady(Boolean(data.configured));
            setServerProviderName(data.providerName || (data.configured ? "Docly AI" : ""));
          }
        }
      } catch {
        if (isMounted) {
          setIsServerReady(false);
        }
      } finally {
        if (isMounted) {
          setIsCheckingServer(false);
        }
      }
    }
    checkServer();
    return () => {
      isMounted = false;
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (queryToSend?: string) => {
    const query = (queryToSend || inputQuery).trim();
    if (!query || isLoading) return;

    if (!hasReadableText) {
      setError(
        "This PDF does not contain enough selectable text. OCR is required to chat with this document.",
      );
      return;
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsLoading(true);
    setError(null);

    if (isServerReady) {
      try {
        const answer = await askDocumentQuestion(document, query, messages);
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: answer.answer,
          sourcePages: answer.sourcePages,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        console.error("Chat question failed:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to generate answer. Please check your connection and try again.",
        );
      } finally {
        setIsLoading(false);
      }
    } else {
      // Local chunk retrieval with genuine page references & quote citations
      setTimeout(() => {
        const matches = searchRelevantChunks(document, query, 3);
        const sourcePages = Array.from(new Set(matches.flatMap((m) => m.pageNumbers))).sort(
          (a, b) => a - b,
        );

        let responseContent = "";
        if (matches.length === 0) {
          responseContent = "I couldn't find that information in the uploaded PDF.";
        } else {
          const mainSnippet = matches[0]?.snippet || "";
          const firstPage = matches[0]?.pageNumbers[0] || 1;
          responseContent = `According to page ${firstPage}, "${mainSnippet}".`;

          if (matches.length > 1) {
            responseContent +=
              "\n\nAdditional matching excerpts found in your document:\n" +
              matches
                .slice(1)
                .map((m) => `• [Pages ${m.pageNumbers.join(", ")}]: "${m.snippet}"`)
                .join("\n");
          }
        }

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: responseContent,
          sourcePages,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setIsLoading(false);
      }, 350);
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(id);
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch {
      // Clipboard write failed
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-6">
      {/* Document Information & Preview Header */}
      <AiToolHeader document={document} />

      {/* Image-Only / Scanned PDF Warning */}
      {!hasReadableText && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-foreground space-y-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-700 dark:text-amber-300">
                Insufficient Extractable Text
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This PDF does not contain enough selectable text. OCR is required to chat with this
                document.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onReset}
              className="rounded-xl bg-amber-600 dark:bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-90 transition-opacity"
            >
              Upload Another PDF
            </button>
          </div>
        </div>
      )}

      {/* AI Provider Notice if server key is not configured */}
      {!isCheckingServer && !isServerReady && hasReadableText && (
        <ProviderNotice
          featureName="Generative Q&A"
          customMessage="Docly has indexed your document pages locally. Grounded passage search is active below. To unlock conversational generative synthesis, configure GEMINI_API_KEY (recommended) or OPENAI_API_KEY in your server environment (.env)."
        />
      )}

      {/* Suggested Questions Strip */}
      {hasReadableText && suggestedQuestions.length > 0 && messages.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-2">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Suggested Questions for this Document
          </span>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(q)}
                disabled={isLoading}
                className="rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 text-left disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Chat Interface */}
      <div className="rounded-2xl border border-border bg-card shadow-sm flex flex-col min-h-[460px] max-h-[620px] transition-all">
        {/* Chat Card Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-surface/50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">Document Assistant</span>
                {isServerReady && (
                  <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] font-bold text-emerald-600 dark:text-emerald-400">
                    {serverProviderName || "Grounded AI Active"}
                  </span>
                )}
                {!isServerReady && !isCheckingServer && (
                  <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                    Local Index Search
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearChat}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors py-1 px-2 rounded-lg hover:bg-destructive/10"
                title="Clear conversation history"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear Chat</span>
              </button>
            )}

            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-lg hover:bg-surface border border-transparent hover:border-border"
              title="Upload another document"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Upload New PDF</span>
            </button>
          </div>
        </div>

        {/* Conversation Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16 text-muted-foreground space-y-2.5">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/5 text-primary/70 mb-1">
                <Search className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold text-foreground">
                Ask any question about {document.filename}
              </p>
              <p className="text-xs max-w-sm text-muted-foreground leading-relaxed">
                Answers are grounded strictly in your document with verified source page citations.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 text-xs leading-relaxed ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary mt-0.5">
                    <Bot className="h-4 w-4" />
                  </span>
                )}

                <div
                  className={`max-w-2xl rounded-2xl p-4 space-y-3 relative group ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground font-medium shadow-xs"
                      : "border border-border bg-surface text-foreground shadow-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                  {/* Assistant Footer: Citations & Copy Button */}
                  {msg.role === "assistant" && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-[0.7rem]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {msg.sourcePages && msg.sourcePages.length > 0 ? (
                          <>
                            <span className="text-[0.65rem] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <BookOpen className="h-3 w-3 text-primary" />
                              Citations:
                            </span>
                            {msg.sourcePages.map((pg) => (
                              <span
                                key={pg}
                                className="inline-flex items-center rounded-md bg-primary/15 px-2 py-0.5 text-[0.7rem] font-bold text-primary"
                              >
                                Page {pg}
                              </span>
                            ))}
                          </>
                        ) : (
                          <span className="text-[0.65rem] text-muted-foreground italic">
                            No matching pages found
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-card border border-transparent hover:border-border"
                        title="Copy answer to clipboard"
                      >
                        {copiedMessageId === msg.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              Copied!
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {msg.role === "user" && (
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-secondary text-foreground mt-0.5">
                    <User className="h-4 w-4" />
                  </span>
                )}
              </div>
            ))
          )}

          {/* Thinking / Loading State */}
          {isLoading && (
            <div className="flex gap-3 text-xs justify-start">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Bot className="h-4 w-4 animate-pulse" />
              </span>
              <div className="rounded-2xl border border-border bg-surface p-4 text-muted-foreground flex items-center gap-2.5">
                <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
                <span>Reading document pages and verifying facts...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error Alert Strip */}
        {error && (
          <div className="px-5 py-3 text-xs text-destructive bg-destructive/10 border-t border-destructive/20 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <span className="truncate">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-[0.7rem] font-semibold text-destructive underline hover:opacity-80 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 border-t border-border bg-surface/40 rounded-b-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                hasReadableText
                  ? "Ask a question about this PDF (e.g. 'What is the summary of page 1?')..."
                  : "Chat disabled — document lacks extractable text"
              }
              disabled={isLoading || !hasReadableText}
              className="flex-1 rounded-xl border border-input bg-surface px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isLoading || !hasReadableText}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
