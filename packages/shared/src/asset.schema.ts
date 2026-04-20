import { z } from "zod";
import { VisibilitySchema } from "./project.schema.js";

export const AssetTypeSchema = z.enum(["image", "video", "audio", "prompt", "other"]);
export type AssetType = z.infer<typeof AssetTypeSchema>;
export const AssetStatusSchema = z.enum(["active", "trashed"]);
export type AssetStatus = z.infer<typeof AssetStatusSchema>;
export const AssetOriginSchema = z.enum(["imported", "generated"]);
export type AssetOrigin = z.infer<typeof AssetOriginSchema>;

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

export const ImportAssetFolderSchema = z.object({
  folderPath:  z.string().min(1),
  projectId:   z.string().min(1).optional(),
  visibility:  VisibilitySchema.optional(),
});

export type ImportAssetFolderInput = z.infer<typeof ImportAssetFolderSchema>;

export const UpdateAssetSchema = z.object({
  projectId: z.string().min(1).nullable().optional(),
  visibility: VisibilitySchema.optional(),
}).refine((input) => input.visibility !== undefined || input.projectId !== undefined, {
  message: "At least one field must be provided",
});

export type UpdateAssetInput = z.infer<typeof UpdateAssetSchema>;

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
  status:           AssetStatusSchema,
  origin:           AssetOriginSchema,
  trashedAt:        z.string().nullable(),
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

export const ImportAssetFolderResultSchema = z.object({
  importedCount: z.number().int().nonnegative(),
  reusedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  items: z.array(ImportAssetResultSchema),
  errors: z.array(
    z.object({
      filePath: z.string(),
      code: z.enum(["FILE_NOT_FOUND", "IO_ERROR", "PATH_CONFLICT"]),
      message: z.string(),
    }),
  ),
});

export type ImportAssetFolderResult = z.infer<typeof ImportAssetFolderResultSchema>;
