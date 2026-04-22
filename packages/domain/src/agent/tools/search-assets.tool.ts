import { z } from "zod";
import type { AgentToolContext } from "./tool-context.js";
import { isVisibleAsset, toAssetSummary } from "./tool-context.js";
import type { AgentToolDefinition } from "./types.js";

const SearchAssetsInputSchema = z.object({
  query: z.string().min(1),
  type: z.enum(["image", "video", "audio", "prompt", "other"]).optional(),
  limit: z.number().int().positive().max(25).optional(),
  projectId: z.string().optional(),
});

export function createSearchAssetsTool(): AgentToolDefinition<
  z.infer<typeof SearchAssetsInputSchema>,
  {
    query: string;
    projectId: string | null;
    total: number;
    items: ReturnType<typeof toAssetSummary>[];
  }
> {
  return {
    name: "search_assets",
    description: "Search local assets by query, type, and project scope.",
    inputSchema: SearchAssetsInputSchema,
    execute(context: AgentToolContext, input) {
      const effectiveProjectId = input.projectId ?? context.projectId;
      const requestedLimit = input.limit ?? 5;
      const page = context.assetRepo.list({
        query: input.query,
        projectId: effectiveProjectId,
        type: input.type,
        status: "active",
        visibility: context.allowPrivate ? undefined : "public",
        limit: Math.max(requestedLimit * 3, requestedLimit),
        offset: 0,
      });

      const visibleItems = page.items
        .filter((asset) => isVisibleAsset(asset, context))
        .slice(0, requestedLimit)
        .map(toAssetSummary);

      return {
        query: input.query,
        projectId: effectiveProjectId ?? null,
        total: visibleItems.length,
        items: visibleItems,
      };
    },
  };
}
