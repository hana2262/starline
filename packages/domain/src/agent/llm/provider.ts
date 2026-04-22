import type { LLMGenerateRequest, LLMGenerateResponse, LLMProviderConfig, LLMProtocolId, LLMStreamChunk } from "./types.js";

export interface LLMProvider {
  readonly id: LLMProtocolId;
  generate(request: LLMGenerateRequest, config: LLMProviderConfig): Promise<LLMGenerateResponse>;
  stream?(
    request: LLMGenerateRequest,
    config: LLMProviderConfig,
    onChunk: (chunk: LLMStreamChunk) => void,
  ): Promise<LLMGenerateResponse>;
}

export interface AgentLLMHandle {
  provider: LLMProvider;
  config: LLMProviderConfig;
}
