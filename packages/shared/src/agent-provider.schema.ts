import { z } from "zod";

export const AgentVendorIdSchema = z.enum([
  "mock",
  "openai",
  "anthropic",
  "gemini",
  "deepseek",
  "kimi",
  "minimax",
  "openrouter",
  "qwen",
  "custom",
]);
export type AgentVendorId = z.infer<typeof AgentVendorIdSchema>;

export const AgentProtocolIdSchema = z.enum([
  "mock",
  "openai-responses",
  "openai-compatible",
  "anthropic",
  "gemini",
  "bedrock",
]);
export type AgentProtocolId = z.infer<typeof AgentProtocolIdSchema>;

export const AgentProviderSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/);
export type AgentProviderSlug = z.infer<typeof AgentProviderSlugSchema>;

export const AgentProviderConfigSchema = z.object({
  id: z.string(),
  slug: AgentProviderSlugSchema,
  vendor: AgentVendorIdSchema,
  protocol: AgentProtocolIdSchema,
  label: z.string().min(1).max(80),
  note: z.string().max(200).nullable(),
  website: z.string().url().nullable(),
  baseUrl: z.string().url().nullable(),
  model: z.string().min(1).max(120),
  temperature: z.string().nullable(),
  maxOutputTokens: z.number().int().positive().nullable(),
  isActive: z.boolean(),
  hasApiKey: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AgentProviderConfig = z.infer<typeof AgentProviderConfigSchema>;

export const AgentProviderListResultSchema = z.object({
  items: z.array(AgentProviderConfigSchema),
});
export type AgentProviderListResult = z.infer<typeof AgentProviderListResultSchema>;

export const AgentProviderUpsertSchema = z.object({
  id: z.string().optional(),
  slug: AgentProviderSlugSchema,
  vendor: AgentVendorIdSchema,
  protocol: AgentProtocolIdSchema,
  label: z.string().min(1).max(80),
  note: z.string().max(200).optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  baseUrl: z.string().url().optional().or(z.literal("")),
  model: z.string().min(1).max(120),
  apiKey: z.string().min(1).optional(),
  temperature: z.string().optional().or(z.literal("")),
  maxOutputTokens: z.number().int().positive().optional(),
  isActive: z.boolean(),
});
export type AgentProviderUpsertInput = z.infer<typeof AgentProviderUpsertSchema>;

export const AgentProviderUpsertResultSchema = z.object({
  item: AgentProviderConfigSchema,
});
export type AgentProviderUpsertResult = z.infer<typeof AgentProviderUpsertResultSchema>;

export const AgentProviderActivateResultSchema = z.object({
  item: AgentProviderConfigSchema,
});
export type AgentProviderActivateResult = z.infer<typeof AgentProviderActivateResultSchema>;

export const AgentProviderTestResultSchema = z.object({
  ok: z.boolean(),
  vendor: AgentVendorIdSchema,
  protocol: AgentProtocolIdSchema,
  model: z.string(),
  latencyMs: z.number().int().nonnegative(),
  error: z.string().optional(),
});
export type AgentProviderTestResult = z.infer<typeof AgentProviderTestResultSchema>;
