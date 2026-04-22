import type { ZodType } from "zod";
import type { AgentToolContext } from "./tool-context.js";

export type AgentToolName =
  | "search_assets"
  | "get_asset_detail"
  | "list_projects"
  | "get_project_detail";

export interface AgentToolDefinition<TInput, TOutput> {
  name: AgentToolName;
  description: string;
  inputSchema: ZodType<TInput>;
  execute: (context: AgentToolContext, input: TInput) => Promise<TOutput> | TOutput;
}

export interface AgentToolManifest {
  name: AgentToolName;
  description: string;
}
