import type { LLMGenerateRequest, LLMGenerateResponse, LLMProviderConfig } from "./types.js";
import type { LLMProvider } from "./provider.js";

export interface MockLLMProviderOptions {
  responseText?: string;
}

export class MockLLMProvider implements LLMProvider {
  readonly id = "mock" as const;

  constructor(private readonly options: MockLLMProviderOptions = {}) {}

  async generate(request: LLMGenerateRequest, config: LLMProviderConfig): Promise<LLMGenerateResponse> {
    const lastUserMessage = [...request.messages].reverse().find((message) => message.role === "user");
    const content = this.options.responseText ?? `Mock response for: ${lastUserMessage?.content ?? request.systemPrompt}`;

    return {
      content,
      model: config.model,
      protocol: this.id,
      finishReason: "stop",
      usage: {
        inputTokens: request.messages.length,
        outputTokens: 1,
        totalTokens: request.messages.length + 1,
      },
    };
  }
}
