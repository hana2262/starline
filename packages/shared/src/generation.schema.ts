import { z } from "zod";
import { AssetTypeSchema } from "./asset.schema.js";

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

export const GenerationJobSchema = z.object({
  id:           z.string(),
  connectorId:  z.string(),
  prompt:       z.string(),
  type:         AssetTypeSchema,
  projectId:    z.string().nullable(),
  status:       z.enum(["queued", "running", "cancelling", "cancelled", "succeeded", "failed"]),
  assetId:      z.string().nullable(),
  errorCode:    z.string().nullable(),
  errorMessage: z.string().nullable(),
  cancelReason: z.string().nullable(),
  cancelMessage:z.string().nullable(),
  cancelRequestedAt: z.string().nullable(),
  cancelledAt:  z.string().nullable(),
  createdAt:    z.string(),
  startedAt:    z.string().nullable(),
  finishedAt:   z.string().nullable(),
  attemptCount: z.number().int().nonnegative(),
  maxAttempts:  z.number().int().positive(),
  nextRetryAt:  z.string().nullable(),
});
export type GenerationJob = z.infer<typeof GenerationJobSchema>;

export const GenerationSubmitResultSchema = z.object({
  job: GenerationJobSchema,
});
export type GenerationSubmitResult = z.infer<typeof GenerationSubmitResultSchema>;

export const GenerationListQuerySchema = z.object({
  status: z.enum(["queued", "running", "cancelling", "cancelled", "succeeded", "failed"]).optional(),
  connectorId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type GenerationListQuery = z.infer<typeof GenerationListQuerySchema>;

export const GenerationListResultSchema = z.object({
  items: z.array(GenerationJobSchema),
  nextCursor: z.string().nullable(),
});
export type GenerationListResult = z.infer<typeof GenerationListResultSchema>;
