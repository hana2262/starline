import type { AssetRepository, ProjectRepository } from "@starline/storage";
import { createGetAssetDetailTool } from "./get-asset-detail.tool.js";
import { createGetProjectDetailTool } from "./get-project-detail.tool.js";
import { createListProjectsTool } from "./list-projects.tool.js";
import { AgentToolRegistry } from "./registry.js";
import { createSearchAssetsTool } from "./search-assets.tool.js";

export * from "./errors.js";
export * from "./registry.js";
export * from "./tool-context.js";
export * from "./types.js";

export function createDefaultAgentToolRegistry(): AgentToolRegistry {
  return new AgentToolRegistry()
    .register(createSearchAssetsTool())
    .register(createGetAssetDetailTool())
    .register(createListProjectsTool())
    .register(createGetProjectDetailTool());
}

export function createAgentToolContext(input: {
  projectRepo: ProjectRepository;
  assetRepo: AssetRepository;
  projectId?: string;
  allowPrivate: boolean;
}) {
  return {
    projectRepo: input.projectRepo,
    assetRepo: input.assetRepo,
    projectId: input.projectId,
    allowPrivate: input.allowPrivate,
  };
}
