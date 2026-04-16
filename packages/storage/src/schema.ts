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
