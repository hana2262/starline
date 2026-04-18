import { z } from "zod";
import { AssetResponseSchema } from "./asset.schema.js";
import { ProjectResponseSchema } from "./project.schema.js";

export const AgentRoleSchema = z.enum(["user", "assistant"]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const AgentQuerySchema = z.object({
  sessionId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  query: z.string().min(1).max(4000),
});
export type AgentQueryInput = z.infer<typeof AgentQuerySchema>;

export const AgentAssetReferenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["image", "video", "audio", "prompt", "other"]),
  projectId: z.string().nullable(),
  reason: z.string(),
  sourceConnector: z.string().nullable(),
  createdAt: z.string(),
});
export type AgentAssetReference = z.infer<typeof AgentAssetReferenceSchema>;

export const AgentMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: AgentRoleSchema,
  content: z.string(),
  relatedAssetIds: z.array(z.string()),
  createdAt: z.string(),
});
export type AgentMessage = z.infer<typeof AgentMessageSchema>;

export const AgentSessionSchema = z.object({
  id: z.string(),
  projectId: z.string().nullable(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AgentSession = z.infer<typeof AgentSessionSchema>;

export const AgentQueryResultSchema = z.object({
  session: AgentSessionSchema,
  userMessage: AgentMessageSchema,
  assistantMessage: AgentMessageSchema,
  relatedAssets: z.array(AgentAssetReferenceSchema),
  project: ProjectResponseSchema.nullable(),
});
export type AgentQueryResult = z.infer<typeof AgentQueryResultSchema>;

export const AgentSessionResultSchema = z.object({
  session: AgentSessionSchema,
  messages: z.array(AgentMessageSchema),
  relatedAssets: z.array(AgentAssetReferenceSchema),
  project: ProjectResponseSchema.nullable(),
});
export type AgentSessionResult = z.infer<typeof AgentSessionResultSchema>;
