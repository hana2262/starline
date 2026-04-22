import { z } from "zod";
import type { AgentToolContext } from "./tool-context.js";
import { isVisibleProject, toProjectSummary } from "./tool-context.js";
import type { AgentToolDefinition } from "./types.js";

const ListProjectsInputSchema = z.object({
  status: z.enum(["active", "archived"]).optional(),
});

export function createListProjectsTool(): AgentToolDefinition<
  z.infer<typeof ListProjectsInputSchema>,
  { items: ReturnType<typeof toProjectSummary>[] }
> {
  return {
    name: "list_projects",
    description: "List visible local projects.",
    inputSchema: ListProjectsInputSchema,
    execute(context: AgentToolContext, input) {
      const items = context.projectRepo
        .list()
        .filter((project) => !input.status || project.status === input.status)
        .filter((project) => isVisibleProject(project, context.allowPrivate))
        .map(toProjectSummary);

      return { items };
    },
  };
}
