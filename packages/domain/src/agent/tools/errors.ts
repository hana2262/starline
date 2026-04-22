export class AgentToolError extends Error {
  constructor(
    message: string,
    public readonly code: "TOOL_NOT_FOUND" | "INVALID_INPUT",
    public readonly toolName?: string,
  ) {
    super(message);
    this.name = "AgentToolError";
  }
}
