import { z } from "zod";
import { ProjectResponseSchema } from "./project.schema.js";

export const AgentRoleSchema = z.enum(["user", "assistant"]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const AgentQuerySchema = z.object({
  sessionId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  allowPrivateForThisQuery: z.boolean().optional(),
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

export const AgentSessionListResultSchema = z.object({
  sessions: z.array(AgentSessionSchema),
});
export type AgentSessionListResult = z.infer<typeof AgentSessionListResultSchema>;

export const AgentRuntimeSchema = z.object({
  mode: z.enum(["template", "llm"]),
  vendor: z.string().nullable(),
  protocol: z.string().nullable(),
  model: z.string().nullable(),
});
export type AgentRuntime = z.infer<typeof AgentRuntimeSchema>;

export const AgentToolUsageSchema = z.object({
  name: z.string(),
});
export type AgentToolUsage = z.infer<typeof AgentToolUsageSchema>;

export const AgentQueryResultSchema = z.object({
  session: AgentSessionSchema,
  userMessage: AgentMessageSchema,
  assistantMessage: AgentMessageSchema,
  relatedAssets: z.array(AgentAssetReferenceSchema),
  project: ProjectResponseSchema.nullable(),
  agentRuntime: AgentRuntimeSchema,
  toolUsage: z.array(AgentToolUsageSchema).default([]),
});
export type AgentQueryResult = z.infer<typeof AgentQueryResultSchema>;

export const AgentSessionResultSchema = z.object({
  session: AgentSessionSchema,
  messages: z.array(AgentMessageSchema),
  relatedAssets: z.array(AgentAssetReferenceSchema),
  project: ProjectResponseSchema.nullable(),
  agentRuntime: AgentRuntimeSchema,
});
export type AgentSessionResult = z.infer<typeof AgentSessionResultSchema>;
