import { z } from "zod";
import { AssetTypeSchema, AssetResponseSchema } from "./asset.schema.js";

export const ListAssetsQuerySchema = z.object({
  query:     z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  type:      AssetTypeSchema.optional(),
  status:    z.enum(["active", "trashed", "all"]).optional(),
  limit:     z.coerce.number().int().min(1).max(200).default(50),
  offset:    z.coerce.number().int().min(0).default(0),
});
export type ListAssetsQuery = z.infer<typeof ListAssetsQuerySchema>;

export const AssetListResponseSchema = z.object({
  items:  z.array(AssetResponseSchema),
  total:  z.number().int(),
  limit:  z.number().int(),
  offset: z.number().int(),
});
export type AssetListResponse = z.infer<typeof AssetListResponseSchema>;
