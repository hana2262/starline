import type { LLMGenerateRequest, LLMGenerateResponse, LLMProviderConfig, LLMProtocolId } from "./types.js";

export interface LLMProvider {
  readonly id: LLMProtocolId;
  generate(request: LLMGenerateRequest, config: LLMProviderConfig): Promise<LLMGenerateResponse>;
}

export interface AgentLLMHandle {
  provider: LLMProvider;
  config: LLMProviderConfig;
}
