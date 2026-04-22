import { LLMProviderError } from "./errors.js";
import type { LLMProvider } from "./provider.js";
import type { LLMGenerateRequest, LLMGenerateResponse, LLMProviderConfig } from "./types.js";

interface OpenAICompatibleMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAICompatibleChoice {
  finish_reason?: string | null;
  message?: {
    content?: string | null;
  } | null;
}

interface OpenAICompatibleUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface OpenAICompatibleResponse {
  choices?: OpenAICompatibleChoice[];
  usage?: OpenAICompatibleUsage;
  model?: string;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function toMessages(request: LLMGenerateRequest): OpenAICompatibleMessage[] {
  return [
    { role: "system", content: request.systemPrompt },
    ...request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
}

function toFinishReason(reason: string | null | undefined): LLMGenerateResponse["finishReason"] {
  if (reason === "stop" || reason === "length" || reason === "tool_calls") {
    return reason;
  }
  return "unknown";
}

export class OpenAICompatibleLLMProvider implements LLMProvider {
  readonly id = "openai-compatible" as const;

  async generate(request: LLMGenerateRequest, config: LLMProviderConfig): Promise<LLMGenerateResponse> {
    if (!config.baseUrl) {
      throw new LLMProviderError("OpenAI-compatible base URL is missing", "LLM_PROVIDER_NOT_CONFIGURED", {
        provider: this.id,
        field: "baseUrl",
      });
    }
    if (!config.apiKey) {
      throw new LLMProviderError("OpenAI-compatible API key is missing", "LLM_PROVIDER_NOT_CONFIGURED", {
        provider: this.id,
        field: "apiKey",
      });
    }

    const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: toMessages(request),
        temperature: request.temperature ?? config.temperature,
        max_tokens: request.maxOutputTokens ?? config.maxOutputTokens,
      }),
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      throw new LLMProviderError("OpenAI-compatible request failed", "LLM_REQUEST_FAILED", {
        provider: this.id,
        reason: message,
      });
    });

    if (!response.ok) {
      const body = await response.text();
      throw new LLMProviderError("OpenAI-compatible request failed", "LLM_REQUEST_FAILED", {
        provider: this.id,
        status: String(response.status),
        body,
      });
    }

    const payload = await response.json() as OpenAICompatibleResponse;
    const choice = payload.choices?.[0];
    const content = choice?.message?.content?.trim();
    if (!content) {
      throw new LLMProviderError("OpenAI-compatible response did not include text content", "LLM_INVALID_RESPONSE", {
        provider: this.id,
      });
    }

    return {
      content,
      model: payload.model ?? config.model,
      protocol: this.id,
      finishReason: toFinishReason(choice?.finish_reason),
      usage: payload.usage ? {
        inputTokens: payload.usage.prompt_tokens,
        outputTokens: payload.usage.completion_tokens,
        totalTokens: payload.usage.total_tokens,
      } : undefined,
    };
  }
}
