export * from "./gemini";
export {
  getServerAiProvider,
  DeterministicMockAiProvider,
  UnconfiguredServerAiProvider,
  type ServerAiProvider,
  type ServerChatOptions,
  type ServerChatResult,
  type ServerChatContextPage,
  type ServerChatMessage,
} from "@/lib/ai/server/provider";
