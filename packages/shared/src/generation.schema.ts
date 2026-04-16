import { z } from "zod";
import { AssetTypeSchema, AssetResponseSchema } from "./asset.schema.js";

export const ConnectorHealthResponseSchema = z.object({
  ok:          z.boolean(),
  latencyMs:   z.number(),
  connectorId: z.string(),
  error:       z.string().optional(),
});
export type ConnectorHealthResponse = z.infer<typeof ConnectorHealthResponseSchema>;

export const GenerationSubmitSchema = z.object({
  connectorId: z.string().min(1),
  prompt:      z.string().min(1).max(2000),
  type:        AssetTypeSchema,
  projectId:   z.string().min(1).optional(),
  name:        z.string().min(1).max(200).optional(),
  tags:        z.array(z.string().max(50)).max(20).optional(),
  settings:    z.record(z.unknown()).optional(),
});
export type GenerationSubmitInput = z.infer<typeof GenerationSubmitSchema>;

export const GenerationResultSchema = z.object({
  created: z.boolean(),
  asset:   AssetResponseSchema,
});
export type GenerationResult = z.infer<typeof GenerationResultSchema>;
