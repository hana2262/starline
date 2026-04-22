import { afterEach, describe, expect, it, vi } from "vitest";
import { LLMProviderError, OpenAICompatibleLLMProvider } from "../index.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("OpenAICompatibleLLMProvider", () => {
  it("maps a chat completions response into the shared LLM response shape", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: "gpt-compatible-test",
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: "Test reply from provider",
          },
        },
      ],
      usage: {
        prompt_tokens: 12,
        completion_tokens: 5,
        total_tokens: 17,
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

    const provider = new OpenAICompatibleLLMProvider();
    const response = await provider.generate({
      systemPrompt: "You are helpful.",
      messages: [{ role: "user", content: "Summarize this." }],
      temperature: 0.1,
      maxOutputTokens: 256,
    }, {
      vendor: "custom",
      protocol: "openai-compatible",
      model: "gpt-compatible-test",
      baseUrl: "https://example.test/v1",
      apiKey: "secret",
    });

    expect(response).toEqual({
      content: "Test reply from provider",
      model: "gpt-compatible-test",
      protocol: "openai-compatible",
      finishReason: "stop",
      usage: {
        inputTokens: 12,
        outputTokens: 5,
        totalTokens: 17,
      },
    });
  });

  it("throws a typed error when required config is missing", async () => {
    const provider = new OpenAICompatibleLLMProvider();

    await expect(provider.generate({
      systemPrompt: "You are helpful.",
      messages: [{ role: "user", content: "Hello" }],
    }, {
      vendor: "custom",
      protocol: "openai-compatible",
      model: "gpt-compatible-test",
    })).rejects.toThrow(LLMProviderError);
  });
});
