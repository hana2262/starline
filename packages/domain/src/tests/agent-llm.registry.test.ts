import { describe, expect, it } from "vitest";
import {
  createDefaultLLMProviderRegistry,
  LLMProviderError,
  MockLLMProvider,
} from "../index.js";

describe("LLMProviderRegistry", () => {
  it("creates a mock provider handle from config", async () => {
    const registry = createDefaultLLMProviderRegistry();
    const handle = registry.create({
      vendor: "mock",
      protocol: "mock",
      model: "mock-model",
      temperature: 0.2,
      maxOutputTokens: 256,
    });

    expect(handle.provider).toBeInstanceOf(MockLLMProvider);

    const response = await handle.provider.generate({
      systemPrompt: "You are a helpful assistant.",
      messages: [
        { role: "user", content: "Plan the next step." },
      ],
    }, handle.config);

    expect(response.protocol).toBe("mock");
    expect(response.model).toBe("mock-model");
    expect(response.content).toContain("Plan the next step.");
  });

  it("lets the mock provider request a tool call for asset listing prompts", async () => {
    const registry = createDefaultLLMProviderRegistry();
    const handle = registry.create({
      vendor: "mock",
      protocol: "mock",
      model: "mock-model",
    });

    const response = await handle.provider.generate({
      systemPrompt: "You are a helpful assistant.",
      messages: [
        { role: "user", content: "本地有哪些资产" },
      ],
      tools: [
        { name: "search_assets", description: "Search local assets." },
      ],
    }, handle.config);

    expect(response.finishReason).toBe("tool_calls");
    expect(response.toolCall).toEqual({
      name: "search_assets",
      input: {
        query: "*",
        limit: 5,
      },
    });
  });

  it("throws a typed error for unsupported providers", () => {
    const registry = createDefaultLLMProviderRegistry();

    expect(() => registry.create({
      vendor: "custom",
      protocol: "bedrock",
      model: "custom-placeholder",
    })).toThrow(LLMProviderError);
  });
});
