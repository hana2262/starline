import { z } from "zod";

export const ConnectorIdSchema = z.enum(["minimax", "stable-diffusion"]);
export type ConnectorId = z.infer<typeof ConnectorIdSchema>;

export const MinimaxConnectorConfigSchema = z.object({
  apiKey: z.string().min(1).optional(),
});
export type MinimaxConnectorConfig = z.infer<typeof MinimaxConnectorConfigSchema>;

export const StableDiffusionConnectorConfigSchema = z.object({
  baseUrl: z.string().url(),
});
export type StableDiffusionConnectorConfig = z.infer<typeof StableDiffusionConnectorConfigSchema>;

export const ConnectorConfigUpsertSchema = z.discriminatedUnion("connectorId", [
  z.object({
    connectorId: z.literal("minimax"),
    enabled: z.boolean(),
    config: MinimaxConnectorConfigSchema,
  }),
  z.object({
    connectorId: z.literal("stable-diffusion"),
    enabled: z.boolean(),
    config: StableDiffusionConnectorConfigSchema,
  }),
]);
export type ConnectorConfigUpsertInput = z.infer<typeof ConnectorConfigUpsertSchema>;

export const ConnectorConfigViewSchema = z.discriminatedUnion("connectorId", [
  z.object({
    connectorId: z.literal("minimax"),
    enabled: z.boolean(),
    source: z.enum(["db", "env"]),
    config: z.object({}),
    hasSensitiveConfig: z.boolean(),
    hasStoredSecret: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  z.object({
    connectorId: z.literal("stable-diffusion"),
    enabled: z.boolean(),
    source: z.enum(["db", "env"]),
    config: StableDiffusionConnectorConfigSchema,
    hasSensitiveConfig: z.boolean(),
    hasStoredSecret: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
]);
export type ConnectorConfigView = z.infer<typeof ConnectorConfigViewSchema>;

export const ConnectorConfigListResultSchema = z.object({
  items: z.array(ConnectorConfigViewSchema),
});
export type ConnectorConfigListResult = z.infer<typeof ConnectorConfigListResultSchema>;

export const ConnectorConfigUpsertResultSchema = z.object({
  item: ConnectorConfigViewSchema,
});
export type ConnectorConfigUpsertResult = z.infer<typeof ConnectorConfigUpsertResultSchema>;
