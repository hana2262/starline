import { ZodError } from "zod";
import { AgentToolError } from "./errors.js";
import type { AgentToolContext } from "./tool-context.js";
import type { AgentToolDefinition, AgentToolManifest, AgentToolName } from "./types.js";

export class AgentToolRegistry {
  private readonly tools = new Map<AgentToolName, AgentToolDefinition<unknown, unknown>>();

  register<TInput, TOutput>(tool: AgentToolDefinition<TInput, TOutput>): this {
    this.tools.set(tool.name, tool as AgentToolDefinition<unknown, unknown>);
    return this;
  }

  listDefinitions(): AgentToolManifest[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  async execute<TOutput = unknown>(
    name: AgentToolName,
    rawInput: unknown,
    context: AgentToolContext,
  ): Promise<TOutput> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new AgentToolError(`Tool ${name} is not registered.`, "TOOL_NOT_FOUND", name);
    }

    try {
      const input = tool.inputSchema.parse(rawInput);
      return await tool.execute(context, input) as TOutput;
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        throw new AgentToolError(`Invalid input for tool ${name}.`, "INVALID_INPUT", name);
      }
      throw error;
    }
  }
}
