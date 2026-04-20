import { existsSync, readdirSync, statSync, unlinkSync } from "fs";
import { basename, extname, join } from "path";
import { randomUUID } from "crypto";
import type { AssetRepository, EventRepository } from "@starline/storage";
import type {
  ImportAssetInput,
  ImportAssetFolderInput,
  ImportAssetFolderResult,
  ImportAssetResult,
  AssetResponse,
  ListAssetsQuery,
  AssetListResponse,
  UpdateAssetInput,
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

function inferAssetType(filePath: string): "image" | "video" | "audio" | "prompt" | "other" {
  const ext = extname(filePath).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) return "image";
  if ([".mp4", ".webm"].includes(ext)) return "video";
  if ([".mp3", ".wav", ".ogg"].includes(ext)) return "audio";
  if ([".txt", ".md", ".json"].includes(ext)) return "prompt";
  return "other";
}

function listFilesRecursive(folderPath: string): string[] {
  const entries = readdirSync(folderPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(folderPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(entryPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

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
  status:           "active" | "trashed";
  origin:           "imported" | "generated";
  trashedAt:        string | null;
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
    origin:           row.origin,
    trashedAt:        row.trashedAt ?? null,
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
          origin:      "imported",
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

    async importFolder(input: ImportAssetFolderInput): Promise<ImportAssetFolderResult> {
      try {
        const stats = statSync(input.folderPath);
        if (!stats.isDirectory()) {
          throw new AssetImportError(`Folder not found: ${input.folderPath}`, "FILE_NOT_FOUND");
        }
      } catch (err) {
        if (err instanceof AssetImportError) {
          throw err;
        }
        const e = err as NodeJS.ErrnoException;
        if (e.code === "ENOENT") {
          throw new AssetImportError(`Folder not found: ${input.folderPath}`, "FILE_NOT_FOUND");
        }
        throw new AssetImportError(e.message, "IO_ERROR");
      }

      const filePaths = listFilesRecursive(input.folderPath);
      const items: ImportAssetResult[] = [];
      const errors: Array<{ filePath: string; code: "FILE_NOT_FOUND" | "IO_ERROR" | "PATH_CONFLICT"; message: string }> = [];
      let importedCount = 0;
      let reusedCount = 0;

      for (const filePath of filePaths) {
        try {
          const result = await this.import({
            filePath,
            type: inferAssetType(filePath),
            projectId: input.projectId,
            visibility: input.visibility,
          });
          items.push(result);
          if (result.created) {
            importedCount += 1;
          } else {
            reusedCount += 1;
          }
        } catch (err) {
          if (err instanceof AssetImportError) {
            errors.push({
              filePath,
              code: err.code,
              message: err.message,
            });
            continue;
          }
          throw err;
        }
      }

      return {
        importedCount,
        reusedCount,
        failedCount: errors.length,
        items,
        errors,
      };
    },

    getById(id: string): AssetResponse | null {
      const row = repo.getById(id);
      return row ? toResponse(row) : null;
    },

    moveToTrash(id: string): AssetResponse | null {
      const existing = repo.getById(id);
      if (!existing) return null;
      if (existing.status === "trashed") return toResponse(existing);

      const trashedAt = new Date().toISOString();
      const updated = repo.moveToTrash(id, trashedAt);
      if (!updated) return null;
      return toResponse(updated);
    },

    restoreFromTrash(id: string): AssetResponse | null {
      const existing = repo.getById(id);
      if (!existing) return null;
      if (existing.status !== "trashed") return toResponse(existing);

      const updated = repo.restoreFromTrash(id);
      if (!updated) return null;
      return toResponse(updated);
    },

    purgeExpiredTrash(now = new Date()): { purgedCount: number; deletedFiles: number } {
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const expiredAssets = repo.listExpiredTrash(cutoff);
      let purgedCount = 0;
      let deletedFiles = 0;

      for (const asset of expiredAssets) {
        if (asset.origin === "generated" && existsSync(asset.filePath)) {
          try {
            unlinkSync(asset.filePath);
            deletedFiles += 1;
          } catch {
            // best-effort local cleanup; record deletion from platform regardless
          }
        }

        purgedCount += repo.hardDelete(asset.id);
      }

      return { purgedCount, deletedFiles };
    },

    update(id: string, input: UpdateAssetInput): AssetResponse | null {
      const existing = repo.getById(id);
      if (!existing) return null;

      let row = existing;
      if (input.projectId !== undefined) {
        const updated = repo.updateProject(id, input.projectId);
        if (!updated) return null;
        row = updated;
      }
      if (input.visibility !== undefined) {
        const updated = repo.updateVisibility(id, input.visibility);
        if (!updated) return null;
        row = updated;
      }

      return toResponse(row);
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
