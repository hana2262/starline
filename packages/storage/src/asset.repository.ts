import { eq, and, inArray, desc, sql, like, or } from "drizzle-orm";
import type Database from "better-sqlite3";
import { randomUUID } from "crypto";
import type { Db } from "./db.js";
import { assets } from "./schema.js";
import type { Asset, NewAsset } from "./schema.js";

function now(): string {
  return new Date().toISOString();
}

function serializeTags(tags: string[]): string {
  return JSON.stringify(tags);
}

function deserializeTags(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export type AssetRow = Omit<Asset, "tags"> & { tags: string[] };

function toAssetRow(row: Asset): AssetRow {
  return { ...row, tags: deserializeTags(row.tags) };
}

/** Strip FTS5 operators / quotes so user input can't inject MATCH syntax. */
function tokenize(raw: string): string[] {
  return raw
    .replace(/['"()*:^~\-+]/g, " ")
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

export function createAssetRepository(db: Db, sqlite: Database.Database) {
  return {
    create(input: {
      id?:              string;
      projectId?:       string | null;
      name:             string;
      type:             "image" | "video" | "audio" | "prompt" | "other";
      filePath:         string;
      fileSize:         number;
      mimeType?:        string | null;
      contentHash:      string;
      tags?:            string[];
      description?:     string | null;
      origin?:          "imported" | "generated";
      visibility?:      "public" | "private";
      sourceConnector?:  string | null;
      generationPrompt?: string | null;
      generationMeta?:   string | null;
    }): AssetRow {
      const row: NewAsset = {
        id:               input.id ?? randomUUID(),
        projectId:        input.projectId ?? null,
        name:             input.name,
        type:             input.type,
        filePath:         input.filePath,
        fileSize:         input.fileSize,
        mimeType:         input.mimeType ?? null,
        contentHash:      input.contentHash,
        tags:             serializeTags(input.tags ?? []),
        description:      input.description ?? null,
        status:           "active",
        origin:           input.origin ?? "imported",
        trashedAt:        null,
        visibility:       input.visibility ?? "public",
        createdAt:        now(),
        updatedAt:        now(),
        sourceConnector:  input.sourceConnector  ?? null,
        generationPrompt: input.generationPrompt ?? null,
        generationMeta:   input.generationMeta   ?? null,
      };
      db.insert(assets).values(row).run();

      // Sync FTS — delete-before-insert guard prevents duplicate rows on retry
      sqlite.prepare(`DELETE FROM assets_fts WHERE id = ?`).run(row.id);
      sqlite.prepare(
        `INSERT INTO assets_fts(id, name, tags, description) VALUES (?, ?, ?, ?)`
      ).run(
        row.id,
        row.name,
        (input.tags ?? []).join(" "),
        input.description ?? "",
      );

      return toAssetRow(row as Asset);
    },

    getById(id: string): AssetRow | undefined {
      const row = db.select().from(assets).where(eq(assets.id, id)).get();
      return row ? toAssetRow(row) : undefined;
    },

    getByHash(hash: string): AssetRow | undefined {
      const row = db.select().from(assets).where(eq(assets.contentHash, hash)).get();
      return row ? toAssetRow(row) : undefined;
    },

    getByFilePath(filePath: string): AssetRow | undefined {
      const row = db.select().from(assets).where(eq(assets.filePath, filePath)).get();
      return row ? toAssetRow(row) : undefined;
    },

    updateVisibility(id: string, visibility: "public" | "private"): AssetRow | undefined {
      db
        .update(assets)
        .set({
          visibility,
          updatedAt: now(),
        })
        .where(eq(assets.id, id))
        .run();

      const row = db.select().from(assets).where(eq(assets.id, id)).get();
      return row ? toAssetRow(row) : undefined;
    },

    updateProject(id: string, projectId: string | null): AssetRow | undefined {
      db
        .update(assets)
        .set({
          projectId,
          updatedAt: now(),
        })
        .where(eq(assets.id, id))
        .run();

      const row = db.select().from(assets).where(eq(assets.id, id)).get();
      return row ? toAssetRow(row) : undefined;
    },

    moveToTrash(id: string, trashedAt: string): AssetRow | undefined {
      db
        .update(assets)
        .set({
          status: "trashed",
          trashedAt,
          updatedAt: now(),
        })
        .where(eq(assets.id, id))
        .run();

      const row = db.select().from(assets).where(eq(assets.id, id)).get();
      return row ? toAssetRow(row) : undefined;
    },

    restoreFromTrash(id: string): AssetRow | undefined {
      db
        .update(assets)
        .set({
          status: "active",
          trashedAt: null,
          updatedAt: now(),
        })
        .where(eq(assets.id, id))
        .run();

      const row = db.select().from(assets).where(eq(assets.id, id)).get();
      return row ? toAssetRow(row) : undefined;
    },

    hardDelete(id: string): number {
      sqlite.prepare(`DELETE FROM assets_fts WHERE id = ?`).run(id);
      const result = db.delete(assets).where(eq(assets.id, id)).run();
      return result.changes;
    },

    listExpiredTrash(beforeIso: string): AssetRow[] {
      return db
        .select()
        .from(assets)
        .where(
          and(
            eq(assets.status, "trashed"),
            sql`${assets.trashedAt} IS NOT NULL`,
            sql`${assets.trashedAt} <= ${beforeIso}`,
          ),
        )
        .all()
        .map(toAssetRow);
    },

    clearProject(projectId: string): number {
      const result = db
        .update(assets)
        .set({
          projectId: null,
          updatedAt: now(),
        })
        .where(eq(assets.projectId, projectId))
        .run();

      return result.changes;
    },

    listByProject(projectId: string): AssetRow[] {
      return db.select().from(assets).where(eq(assets.projectId, projectId)).all().map(toAssetRow);
    },

    list(filters: {
      query?: string;
      projectId?: string;
      type?: "image" | "video" | "audio" | "prompt" | "other";
      status?: "active" | "trashed" | "all";
      visibility?: "public" | "private";
      limit: number;
      offset: number;
    }): { items: AssetRow[]; total: number } {
      const conditions: ReturnType<typeof eq>[] = [];

      if (filters.query) {
        const tokens = tokenize(filters.query);
        if (tokens.length > 0) {
          // FTS path: each token quoted and joined with AND
          const safe = tokens.map(t => `"${t}"`).join(" AND ");
          const ftsIds = (
            sqlite.prepare(
              `SELECT id FROM assets_fts WHERE assets_fts MATCH ? ORDER BY rank`
            ).all(safe) as { id: string }[]
          ).map(r => r.id);

          if (ftsIds.length === 0) return { items: [], total: 0 };
          conditions.push(inArray(assets.id, ftsIds) as ReturnType<typeof eq>);
        }
        // tokens.length === 0 → degenerate input (all operators) → no query predicate;
        // other filters (projectId, type) still apply below.
      }

      if (filters.projectId) {
        conditions.push(eq(assets.projectId, filters.projectId));
      }
      if (filters.type) {
        conditions.push(eq(assets.type, filters.type));
      }
      if (filters.status && filters.status !== "all") {
        conditions.push(eq(assets.status, filters.status));
      }
      if (!filters.status) {
        conditions.push(eq(assets.status, "active"));
      }
      if (filters.visibility) {
        conditions.push(eq(assets.visibility, filters.visibility));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [{ total }] = db
        .select({ total: sql<number>`count(*)` })
        .from(assets)
        .where(where)
        .all();

      const items = db
        .select()
        .from(assets)
        .where(where)
        .orderBy(desc(assets.createdAt))
        .limit(filters.limit)
        .offset(filters.offset)
        .all()
        .map(toAssetRow);

      return { items, total };
    },
  };
}

export type AssetRepository = ReturnType<typeof createAssetRepository>;

// Re-export so callers don't need to import schema directly
export type { Asset, NewAsset };

// LIKE fallback helper (AND-over-tokens / OR-over-columns) — kept for future use
// when tokenize() is relaxed to yield tokens that need plain-text fallback.
export function buildLikeFallback(tokens: string[]) {
  return tokens.map(token => {
    const pat = `%${token}%`;
    return or(
      like(assets.name, pat),
      like(assets.tags, pat),
      like(assets.description, pat),
    )!;
  });
}
