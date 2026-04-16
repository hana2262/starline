import { mkdirSync, copyFileSync, unlinkSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Connector, GenerateOutput } from "@starline/connectors";
import type { AssetRepository } from "@starline/storage";
import type {
  ConnectorHealthResponse,
  GenerationSubmitInput,
  GenerationResult,
  AssetResponse,
} from "@starline/shared";
import type { computeFileHash } from "../asset/file.utils.js";
import type { AssetRow } from "@starline/storage";

export class ConnectorError extends Error {
  constructor(
    message: string,
    public readonly code: "CONNECTOR_NOT_FOUND" | "HEALTH_CHECK_FAILED" | "GENERATION_FAILED",
    public readonly connectorId: string,
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}

type ConnectorRegistry = Map<string, Connector>;
type ComputeHashFn = typeof computeFileHash;

/** Simple MIME → file extension map for common generation types. */
const MIME_EXT: Record<string, string> = {
  "image/png":  "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4":  "mp4",
  "audio/wav":  "wav",
  "audio/mpeg": "mp3",
  "text/plain": "txt",
};

function extFor(mimeType: string): string {
  return MIME_EXT[mimeType] ?? "bin";
}

function toResponse(row: AssetRow): AssetResponse {
  return {
    id:               row.id,
    projectId:        row.projectId ?? null,
    name:             row.name,
    type:             row.type,
    filePath:         row.filePath,
    fileSize:         row.fileSize,
    mimeType:         row.mimeType ?? null,
    contentHash:      row.contentHash,
    tags:             row.tags,
    description:      row.description ?? null,
    status:           row.status,
    createdAt:        row.createdAt,
    updatedAt:        row.updatedAt,
    sourceConnector:  row.sourceConnector  ?? null,
    generationPrompt: row.generationPrompt ?? null,
    generationMeta:   row.generationMeta   ?? null,
  };
}

export function createGenerationService(
  registry:    ConnectorRegistry,
  assetRepo:   AssetRepository,
  computeHash: ComputeHashFn,
  appDataDir:  string,
) {
  function resolve(id: string): Connector {
    const c = registry.get(id);
    if (!c) throw new ConnectorError(`Unknown connector: ${id}`, "CONNECTOR_NOT_FOUND", id);
    return c;
  }

  return {
    async test(connectorId: string): Promise<ConnectorHealthResponse> {
      const connector = resolve(connectorId);
      try {
        const result = await connector.healthCheck();
        return { ...result, connectorId };
      } catch (err) {
        throw new ConnectorError(
          (err as Error).message,
          "HEALTH_CHECK_FAILED",
          connectorId,
        );
      }
    },

    async submit(input: GenerationSubmitInput): Promise<GenerationResult> {
      const connector = resolve(input.connectorId);

      // 1. Run generation — connector writes to OS temp
      let output: GenerateOutput;
      try {
        output = await connector.generate({
          prompt:    input.prompt,
          type:      input.type,
          projectId: input.projectId,
          settings:  input.settings,
        });
      } catch (err) {
        throw new ConnectorError(
          (err as Error).message,
          "GENERATION_FAILED",
          input.connectorId,
        );
      }

      // 2. Hash the temp file
      const { hash, size, mimeType } = await computeHash(output.filePath);

      // 3. Move temp → managed path (appDataDir/<assetId>.<ext>)
      const assetId     = randomUUID();
      const ext         = extFor(output.mimeType ?? mimeType);
      const managedPath = path.join(appDataDir, `${assetId}.${ext}`);
      mkdirSync(appDataDir, { recursive: true });
      copyFileSync(output.filePath, managedPath);

      // 4. Persist — NO content-hash dedup: every run creates a new record
      let row: AssetRow;
      try {
        row = assetRepo.create({
          id:               assetId,
          projectId:        input.projectId ?? null,
          name:             input.name ?? output.name,
          type:             input.type,
          filePath:         managedPath,
          fileSize:         size,
          mimeType:         output.mimeType ?? mimeType,
          contentHash:      hash,
          tags:             input.tags ?? [],
          description:      null,
          sourceConnector:  input.connectorId,
          generationPrompt: input.prompt,
          generationMeta:   JSON.stringify(output.meta),
        });
      } catch (err) {
        // Persistence failed — clean up managed file best-effort
        try { unlinkSync(managedPath); } catch { /* ignore */ }
        try { unlinkSync(output.filePath); } catch { /* ignore */ }
        throw err;
      }

      // 5. Clean up temp file best-effort
      try { unlinkSync(output.filePath); } catch { /* ignore */ }

      return { created: true, asset: toResponse(row) };
    },
  };
}

export type GenerationService = ReturnType<typeof createGenerationService>;
