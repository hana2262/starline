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
    const prompt = lastUserMessage?.content ?? request.systemPrompt;

    if (request.toolResults && request.toolResults.length > 0) {
      const [toolResult] = request.toolResults;
      return {
        content: [
          `Tool-assisted mock response for: ${prompt}`,
          "",
          `Tool used: ${toolResult?.name ?? "unknown"}`,
          "",
          `Tool result: ${JSON.stringify(toolResult?.result, null, 2)}`,
        ].join("\n"),
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

    const normalizedPrompt = prompt.toLowerCase();
    const availableToolNames = new Set((request.tools ?? []).map((tool) => tool.name));

    if (
      availableToolNames.has("search_assets")
      && (
        normalizedPrompt.includes("哪些资产")
        || normalizedPrompt.includes("本地有哪些资产")
        || normalizedPrompt.includes("列出资产")
      )
    ) {
      return {
        content: "",
        model: config.model,
        protocol: this.id,
        finishReason: "tool_calls",
        toolCall: {
          name: "search_assets",
          input: {
            query: "*",
            limit: 5,
          },
        },
        usage: {
          inputTokens: request.messages.length,
          outputTokens: 0,
          totalTokens: request.messages.length,
        },
      };
    }

    if (
      availableToolNames.has("list_projects")
      && (normalizedPrompt.includes("哪些项目") || normalizedPrompt.includes("列出项目"))
    ) {
      return {
        content: "",
        model: config.model,
        protocol: this.id,
        finishReason: "tool_calls",
        toolCall: {
          name: "list_projects",
          input: {},
        },
        usage: {
          inputTokens: request.messages.length,
          outputTokens: 0,
          totalTokens: request.messages.length,
        },
      };
    }

    const content = this.options.responseText ?? `Mock response for: ${prompt}`;

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
