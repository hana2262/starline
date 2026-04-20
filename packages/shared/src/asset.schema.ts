import { z } from "zod";
import { VisibilitySchema } from "./project.schema.js";

export const AssetTypeSchema = z.enum(["image", "video", "audio", "prompt", "other"]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const ImportAssetSchema = z.object({
  filePath:    z.string().min(1),
  type:        AssetTypeSchema,
  name:        z.string().min(1).max(200).optional(),
  projectId:   z.string().min(1).optional(),
  tags:        z.array(z.string().max(50)).max(20).optional(),
  description: z.string().max(2000).optional(),
  visibility: VisibilitySchema.optional(),
});

export type ImportAssetInput = z.infer<typeof ImportAssetSchema>;

export const AssetResponseSchema = z.object({
  id:               z.string(),
  projectId:        z.string().nullable(),
  name:             z.string(),
  type:             AssetTypeSchema,
  filePath:         z.string(),
  fileSize:         z.number(),
  mimeType:         z.string().nullable(),
  contentHash:      z.string(),
  tags:             z.array(z.string()),
  description:      z.string().nullable(),
  status:           z.enum(["active", "archived"]),
  visibility:       VisibilitySchema,
  createdAt:        z.string(),
  updatedAt:        z.string(),
  sourceConnector:  z.string().nullable(),
  generationPrompt: z.string().nullable(),
  generationMeta:   z.string().nullable(),
});

export type AssetResponse = z.infer<typeof AssetResponseSchema>;

export const ImportAssetResultSchema = z.object({
  created: z.boolean(),
  asset:   AssetResponseSchema,
});

export type ImportAssetResult = z.infer<typeof ImportAssetResultSchema>;
