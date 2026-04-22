export type LLMProviderErrorCode =
  | "LLM_PROVIDER_NOT_CONFIGURED"
  | "LLM_PROVIDER_UNSUPPORTED"
  | "LLM_REQUEST_FAILED"
  | "LLM_INVALID_RESPONSE";

export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly code: LLMProviderErrorCode,
    public readonly details?: Record<string, string | undefined>,
  ) {
    super(message);
    this.name = "LLMProviderError";
  }
}
