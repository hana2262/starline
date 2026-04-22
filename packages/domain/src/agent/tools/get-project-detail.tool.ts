import { z } from "zod";
import type { AgentToolContext } from "./tool-context.js";
import { isVisibleAsset, isVisibleProject, toProjectSummary } from "./tool-context.js";
import type { AgentToolDefinition } from "./types.js";

const GetProjectDetailInputSchema = z.object({
  projectId: z.string().min(1),
});

export function createGetProjectDetailTool(): AgentToolDefinition<
  z.infer<typeof GetProjectDetailInputSchema>,
  {
    project: ReturnType<typeof toProjectSummary> | null;
    assetCount: number;
  }
> {
  return {
    name: "get_project_detail",
    description: "Get one visible local project and a visible asset count.",
    inputSchema: GetProjectDetailInputSchema,
    execute(context: AgentToolContext, input) {
      const project = context.projectRepo.getById(input.projectId);
      if (!project || !isVisibleProject(project, context.allowPrivate)) {
        return {
          project: null,
          assetCount: 0,
        };
      }

      const assetCount = context.assetRepo
        .listByProject(project.id)
        .filter((asset) => isVisibleAsset(asset, context))
        .length;

      return {
        project: toProjectSummary(project),
        assetCount,
      };
    },
  };
}
