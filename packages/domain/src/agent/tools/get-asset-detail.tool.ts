import { z } from "zod";
import type { AgentToolContext } from "./tool-context.js";
import { isVisibleAsset, toAssetDetail } from "./tool-context.js";
import type { AgentToolDefinition } from "./types.js";

const GetAssetDetailInputSchema = z.object({
  assetId: z.string().min(1),
});

export function createGetAssetDetailTool(): AgentToolDefinition<
  z.infer<typeof GetAssetDetailInputSchema>,
  { asset: ReturnType<typeof toAssetDetail> | null }
> {
  return {
    name: "get_asset_detail",
    description: "Get a visible local asset by id.",
    inputSchema: GetAssetDetailInputSchema,
    execute(context: AgentToolContext, input) {
      const asset = context.assetRepo.getById(input.assetId);
      if (!asset || !isVisibleAsset(asset, context)) {
        return { asset: null };
      }

      return {
        asset: toAssetDetail(asset),
      };
    },
  };
}
