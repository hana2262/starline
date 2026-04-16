import { eq } from "drizzle-orm";
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

function hydrate(row: Asset): Asset & { tags: string } {
  return row;
}

export type AssetRow = Omit<Asset, "tags"> & { tags: string[] };

function toAssetRow(row: Asset): AssetRow {
  return { ...row, tags: deserializeTags(row.tags) };
}

export function createAssetRepository(db: Db) {
  return {
    create(input: {
      projectId?: string | null;
      name: string;
      type: "image" | "video" | "audio" | "prompt" | "other";
      filePath: string;
      fileSize: number;
      mimeType?: string | null;
      contentHash: string;
      tags?: string[];
      description?: string | null;
    }): AssetRow {
      const row: NewAsset = {
        id:          randomUUID(),
        projectId:   input.projectId ?? null,
        name:        input.name,
        type:        input.type,
        filePath:    input.filePath,
        fileSize:    input.fileSize,
        mimeType:    input.mimeType ?? null,
        contentHash: input.contentHash,
        tags:        serializeTags(input.tags ?? []),
        description: input.description ?? null,
        status:      "active",
        createdAt:   now(),
        updatedAt:   now(),
      };
      db.insert(assets).values(row).run();
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

    listByProject(projectId: string): AssetRow[] {
      return db.select().from(assets).where(eq(assets.projectId, projectId)).all().map(toAssetRow);
    },
  };
}

export type AssetRepository = ReturnType<typeof createAssetRepository>;

// Re-export so callers don't need to import schema directly
export type { Asset, NewAsset };
// Suppress unused warning for hydrate — kept for future use
void hydrate;
