import { useState, useRef, useEffect, ReactNode } from "react";
import { Send, Bot, User, CornerDownLeft } from "lucide-react";
import { AISourceCitationsList } from "./AISourceCitation";
import { AIProcessingState } from "./AIProcessingState";

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  sourcePages?: number[];
  snippets?: Array<{ pageNumber: number; snippet: string }>;
  timestamp?: number;
}

interface AIChatPanelProps {
  messages: ChatMessageItem[];
  onSendMessage: (query: string) => void;
  isLoading?: boolean;
  suggestions?: string[];
  placeholder?: string;
  onSelectPage?: (page: number) => void;
  headerSlot?: ReactNode;
  className?: string;
}

/**
 * Shared AI Chat Panel for Grounded PDF & Document Conversations.
 */
export function AIChatPanel({
  messages,
  onSendMessage,
  isLoading = false,
  suggestions = [],
  placeholder = "Ask a question about your document...",
  onSelectPage,
  headerSlot,
  className = "",
}: AIChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput("");
  };

  return (
    <div
      className={`flex flex-col rounded-2xl border border-border bg-card shadow-sm overflow-hidden min-h-[520px] max-h-[700px] ${className}`}
    >
      {headerSlot && <div className="border-b border-border p-3.5 bg-surface/50">{headerSlot}</div>}

      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 my-auto">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Bot className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground">Ask anything about this document</h4>
              <p className="text-xs text-muted-foreground max-w-sm">
                Answers are grounded strictly in your document content with verified page citations.
              </p>
            </div>

            {suggestions.length > 0 && (
              <div className="pt-3 w-full max-w-md space-y-2">
                <span className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
                  Suggested Questions
                </span>
                <div className="flex flex-col gap-1.5">
                  {suggestions.slice(0, 3).map((sugg, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSendMessage(sugg)}
                      className="text-left rounded-xl border border-border bg-surface/70 px-3.5 py-2 text-xs text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer"
                    >
                      {sugg}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-muted text-foreground border border-border"
              }`}
            >
              {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
            </div>

            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-xs"
                  : "border border-border bg-surface rounded-tl-xs text-foreground shadow-2xs"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {msg.role === "assistant" && msg.sourcePages && msg.sourcePages.length > 0 && (
                <AISourceCitationsList
                  pages={msg.sourcePages}
                  snippets={msg.snippets}
                  onSelectPage={onSelectPage}
                />
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-muted text-foreground border border-border">
              <Bot className="h-4 w-4 text-primary animate-pulse" />
            </div>
            <div className="max-w-[85%]">
              <AIProcessingState
                stage="Searching document & formulating answer..."
                detail="Anchoring reply strictly to verified page citations."
                className="py-3 px-4 text-left"
              />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <form onSubmit={handleSubmit} className="border-t border-border p-3 bg-surface/50">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder={placeholder}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary disabled:opacity-50 pr-12 shadow-2xs"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 transition-all cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
