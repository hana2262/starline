import type { LLMGenerateRequest, LLMGenerateResponse, LLMProviderConfig } from "./types.js";
import type { LLMProvider } from "./provider.js";

export interface MockLLMProviderOptions {
  responseText?: string;
}

function hasAnyIntent(haystack: string, patterns: string[]): boolean {
  return patterns.some((pattern) => haystack.includes(pattern));
}

export class MockLLMProvider implements LLMProvider {
  readonly id = "mock" as const;

  constructor(private readonly options: MockLLMProviderOptions = {}) {}

  async generate(request: LLMGenerateRequest, config: LLMProviderConfig): Promise<LLMGenerateResponse> {
    const lastUserMessage = [...request.messages].reverse().find((message) => message.role === "user");
    const prompt = lastUserMessage?.content ?? request.systemPrompt;
    const normalizedPrompt = prompt.toLowerCase();

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

    const availableToolNames = new Set((request.tools ?? []).map((tool) => tool.name));

    if (
      availableToolNames.has("search_assets")
      && hasAnyIntent(normalizedPrompt, [
        "资产",
        "素材",
        "本地有哪些",
        "当前项目有哪些",
        "项目里有哪些",
        "asset",
        "assets",
        "local library",
      ])
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
      && hasAnyIntent(normalizedPrompt, ["项目", "project", "projects"])
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

  async stream(
    request: LLMGenerateRequest,
    config: LLMProviderConfig,
    onChunk: (chunk: { delta: string }) => void,
  ): Promise<LLMGenerateResponse> {
    const response = await this.generate(request, config);
    const content = response.content;
    const chunkSize = 24;

    for (let index = 0; index < content.length; index += chunkSize) {
      onChunk({ delta: content.slice(index, index + chunkSize) });
    }

    return response;
  }
}
