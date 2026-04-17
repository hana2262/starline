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
