import { LLMProviderError } from "./errors.js";
import { MockLLMProvider } from "./mock.provider.js";
import { OpenAICompatibleLLMProvider } from "./openai-compatible.provider.js";
import type { LLMProvider, AgentLLMHandle } from "./provider.js";
import type { LLMProviderConfig, LLMProtocolId } from "./types.js";

export type LLMProviderFactory = (config: LLMProviderConfig) => LLMProvider;

export class LLMProviderRegistry {
  private readonly factories = new Map<LLMProtocolId, LLMProviderFactory>();

  register(protocolId: LLMProtocolId, factory: LLMProviderFactory): void {
    this.factories.set(protocolId, factory);
  }

  create(config: LLMProviderConfig): AgentLLMHandle {
    const factory = this.factories.get(config.protocol);
    if (!factory) {
      throw new LLMProviderError(
        `Unsupported LLM protocol: ${config.protocol}`,
        "LLM_PROVIDER_UNSUPPORTED",
        { provider: config.protocol },
      );
    }

    return {
      provider: factory(config),
      config,
    };
  }

  listProtocols(): LLMProtocolId[] {
    return Array.from(this.factories.keys());
  }
}

export function createDefaultLLMProviderRegistry(): LLMProviderRegistry {
  const registry = new LLMProviderRegistry();
  registry.register("mock", () => new MockLLMProvider());
  registry.register("openai-compatible", () => new OpenAICompatibleLLMProvider());
  return registry;
}
