export type LLMMessageRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMMessageRole;
  content: string;
}

export interface LLMUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export type LLMFinishReason = "stop" | "length" | "tool_calls" | "unknown";

export type LLMVendorId =
  | "mock"
  | "openai"
  | "anthropic"
  | "gemini"
  | "deepseek"
  | "kimi"
  | "minimax"
  | "openrouter"
  | "qwen"
  | "custom";

export type LLMProtocolId =
  | "mock"
  | "openai-responses"
  | "openai-compatible"
  | "anthropic"
  | "gemini"
  | "bedrock";

export interface LLMGenerateRequest {
  systemPrompt: string;
  messages: LLMMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  metadata?: Record<string, string>;
}

export interface LLMGenerateResponse {
  content: string;
  model: string;
  protocol: LLMProtocolId;
  finishReason: LLMFinishReason;
  usage?: LLMUsage;
}

export interface LLMProviderConfig {
  vendor: LLMVendorId;
  protocol: LLMProtocolId;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  temperature?: number;
  maxOutputTokens?: number;
}
