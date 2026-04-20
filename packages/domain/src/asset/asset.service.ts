import { statSync } from "fs";
import { basename } from "path";
import { randomUUID } from "crypto";
import type { AssetRepository, EventRepository } from "@starline/storage";
import type {
  ImportAssetInput,
  ImportAssetResult,
  AssetResponse,
  ListAssetsQuery,
  AssetListResponse,
} from "@starline/shared";
import type { computeFileHash } from "./file.utils.js";

export class AssetImportError extends Error {
  constructor(
    message: string,
    public readonly code: "FILE_NOT_FOUND" | "IO_ERROR" | "PATH_CONFLICT",
    public readonly existingAssetId?: string,
  ) {
    super(message);
    this.name = "AssetImportError";
  }
}

type ComputeHashFn = typeof computeFileHash;

function toResponse(row: {
  id:               string;
  projectId:        string | null;
  name:             string;
  type:             "image" | "video" | "audio" | "prompt" | "other";
  filePath:         string;
  fileSize:         number;
  mimeType:         string | null;
  contentHash:      string;
  tags:             string[];
  description:      string | null;
  status:           "active" | "archived";
  visibility:       "public" | "private";
  createdAt:        string;
  updatedAt:        string;
  sourceConnector?:  string | null;
  generationPrompt?: string | null;
  generationMeta?:   string | null;
}): AssetResponse {
  return {
    id:               row.id,
    projectId:        row.projectId,
    name:             row.name,
    type:             row.type,
    filePath:         row.filePath,
    fileSize:         row.fileSize,
    mimeType:         row.mimeType,
    contentHash:      row.contentHash,
    tags:             row.tags,
    description:      row.description,
    status:           row.status,
    visibility:       row.visibility,
    createdAt:        row.createdAt,
    updatedAt:        row.updatedAt,
    sourceConnector:  row.sourceConnector  ?? null,
    generationPrompt: row.generationPrompt ?? null,
    generationMeta:   row.generationMeta   ?? null,
  };
}

function isSqliteUniqueError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes("UNIQUE constraint failed") ||
      (err as NodeJS.ErrnoException).code === "SQLITE_CONSTRAINT_UNIQUE")
  );
}

export function createAssetService(repo: AssetRepository, computeHash: ComputeHashFn, eventRepo?: EventRepository) {
  return {
    async import(input: ImportAssetInput): Promise<ImportAssetResult> {
      // Step 1 — File exists check (before any hashing)
      try {
        statSync(input.filePath);
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code === "ENOENT") {
          throw new AssetImportError(
            `File not found: ${input.filePath}`,
            "FILE_NOT_FOUND",
          );
        }
        throw new AssetImportError(e.message, "IO_ERROR");
      }

      // Step 2 — Hash computation
      let hash: string;
      let size: number;
      let mimeType: string;
      try {
        ({ hash, size, mimeType } = await computeHash(input.filePath));
      } catch (err) {
        throw new AssetImportError(
          (err as Error).message,
          "IO_ERROR",
        );
      }

      // Step 3 — Content-hash dedup
      const existingByHash = repo.getByHash(hash);
      if (existingByHash) {
        return { created: false, asset: toResponse(existingByHash) };
      }

      // Step 4 — Attempt insert
      const name = input.name ?? basename(input.filePath);
      try {
        const newAsset = repo.create({
          projectId:   input.projectId ?? null,
          name,
          type:        input.type,
          filePath:    input.filePath,
          fileSize:    size,
          mimeType,
          contentHash: hash,
          tags:        input.tags ?? [],
          description: input.description ?? null,
          visibility:  input.visibility ?? "public",
        });
        eventRepo?.create({
          eventType: "asset.imported",
          entityType: "asset",
          entityId: newAsset.id,
          projectId: newAsset.projectId,
          payload: {
            type: newAsset.type,
            fileSize: newAsset.fileSize,
            mimeType: newAsset.mimeType,
            source: "manual_import",
            visibility: newAsset.visibility,
          },
        });
        return { created: true, asset: toResponse(newAsset) };
      } catch (err) {
        if (isSqliteUniqueError(err)) {
          const existingByPath = repo.getByFilePath(input.filePath);
          if (existingByPath) {
            if (existingByPath.contentHash === hash) {
              // Defensive guard: concurrent write, treat as dedup
              return { created: false, asset: toResponse(existingByPath) };
            }
            throw new AssetImportError(
              "File path already used by a different asset",
              "PATH_CONFLICT",
              existingByPath.id,
            );
          }
        }
        throw err;
      }
    },

    getById(id: string): AssetResponse | null {
      const row = repo.getById(id);
      return row ? toResponse(row) : null;
    },

    list(filters: ListAssetsQuery): AssetListResponse {
      const { items, total } = repo.list(filters);
      return {
        items:  items.map(toResponse),
        total,
        limit:  filters.limit,
        offset: filters.offset,
      };
    },
  };
}

export type AssetService = ReturnType<typeof createAssetService>;

// Exported for use in server wiring
export { randomUUID };
