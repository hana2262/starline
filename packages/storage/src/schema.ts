import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["active", "archived"] })
    .notNull()
    .default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export const assets = sqliteTable(
  "assets",
  {
    id:          text("id").primaryKey(),
    projectId:   text("project_id"),
    name:        text("name").notNull(),
    type:        text("type", { enum: ["image", "video", "audio", "prompt", "other"] }).notNull(),
    filePath:    text("file_path").notNull(),
    fileSize:    integer("file_size").notNull(),
    mimeType:    text("mime_type"),
    contentHash: text("content_hash").notNull(),
    tags:        text("tags").notNull().default("[]"),
    description:      text("description"),
    status:           text("status", { enum: ["active", "archived"] }).notNull().default("active"),
    createdAt:        text("created_at").notNull(),
    updatedAt:        text("updated_at").notNull(),
    sourceConnector:  text("source_connector"),
    generationPrompt: text("generation_prompt"),
    generationMeta:   text("generation_meta"),
  },
  (table) => ({
    contentHashIdx:    uniqueIndex("assets_content_hash_idx").on(table.contentHash),
    filePathIdx:       uniqueIndex("assets_file_path_idx").on(table.filePath),
    projectCreatedIdx: index("assets_project_created_idx").on(table.projectId, table.createdAt),
  }),
);

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;

export const generations = sqliteTable("generations", {
  id:           text("id").primaryKey(),
  connectorId:  text("connector_id").notNull(),
  prompt:       text("prompt").notNull(),
  type:         text("type").notNull(),
  projectId:    text("project_id"),
  status:       text("status").notNull().default("queued"),
  assetId:      text("asset_id"),
  errorCode:    text("error_code"),
  errorMessage: text("error_message"),
  cancelReason: text("cancel_reason"),
  cancelMessage: text("cancel_message"),
  cancelRequestedAt: text("cancel_requested_at"),
  cancelledAt:  text("cancelled_at"),
  createdAt:    text("created_at").notNull(),
  startedAt:    text("started_at"),
  finishedAt:   text("finished_at"),
  attemptCount: integer("attempt_count").notNull().default(0),
  maxAttempts:  integer("max_attempts").notNull().default(3),
  nextRetryAt:  text("next_retry_at"),
  retryable:    integer("retryable"),
  settings:     text("settings"),
});

export type Generation    = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;

export const connectorConfigs = sqliteTable("connector_configs", {
  connectorId: text("connector_id").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  config: text("config").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type ConnectorConfig = typeof connectorConfigs.$inferSelect;
export type NewConnectorConfig = typeof connectorConfigs.$inferInsert;

export const connectorSecrets = sqliteTable("connector_secrets", {
  connectorId: text("connector_id").primaryKey(),
  secret: text("secret").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type ConnectorSecret = typeof connectorSecrets.$inferSelect;
export type NewConnectorSecret = typeof connectorSecrets.$inferInsert;

export const agentSessions = sqliteTable("agent_sessions", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  title: text("title").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  projectUpdatedIdx: index("agent_sessions_project_updated_idx").on(table.projectId, table.updatedAt),
}));

export type AgentSession = typeof agentSessions.$inferSelect;
export type NewAgentSession = typeof agentSessions.$inferInsert;

export const agentMessages = sqliteTable("agent_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  relatedAssetIds: text("related_asset_ids").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  sessionCreatedIdx: index("agent_messages_session_created_idx").on(table.sessionId, table.createdAt),
}));

export type AgentMessage = typeof agentMessages.$inferSelect;
export type NewAgentMessage = typeof agentMessages.$inferInsert;
