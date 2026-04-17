import { mkdirSync, copyFileSync, unlinkSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Connector, GenerateOutput } from "@starline/connectors";
import type { AssetRepository } from "@starline/storage";
import type { GenerationRepository, GenerationRow } from "@starline/storage";
import type {
  ConnectorHealthResponse,
  GenerationSubmitInput,
  GenerationSubmitResult,
  GenerationJob,
  AssetResponse,
} from "@starline/shared";
import type { computeFileHash } from "../asset/file.utils.js";
import type { AssetRow } from "@starline/storage";

export class ConnectorError extends Error {
  constructor(
    message: string,
    public readonly code: "CONNECTOR_NOT_FOUND" | "HEALTH_CHECK_FAILED",
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

function toJobResponse(row: GenerationRow): GenerationJob {
  return {
    id:           row.id,
    connectorId:  row.connectorId,
    prompt:       row.prompt,
    type:         row.type as GenerationJob["type"],
    projectId:    row.projectId ?? null,
    status:       row.status as GenerationJob["status"],
    assetId:      row.assetId ?? null,
    errorCode:    row.errorCode ?? null,
    errorMessage: row.errorMessage ?? null,
    createdAt:    row.createdAt,
    startedAt:    row.startedAt ?? null,
    finishedAt:   row.finishedAt ?? null,
  };
}

function toAssetResponse(row: AssetRow): AssetResponse {
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
  genRepo:     GenerationRepository,
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

    async submit(input: GenerationSubmitInput): Promise<GenerationSubmitResult> {
      // 0. Resolve connector — throws CONNECTOR_NOT_FOUND before any job is created
      const connector = resolve(input.connectorId);

      // 1. Create job row (status: queued)
      const job = genRepo.create({
        connectorId: input.connectorId,
        prompt:      input.prompt,
        type:        input.type,
        projectId:   input.projectId ?? null,
      });

      // 2. Mark running
      genRepo.markRunning(job.id);

      // 3. Run generation — connector writes to OS temp
      let output: GenerateOutput;
      try {
        output = await connector.generate({
          prompt:    input.prompt,
          type:      input.type,
          projectId: input.projectId,
          settings:  input.settings,
        });
      } catch (err) {
        genRepo.markFailed(job.id, "GENERATION_FAILED", (err as Error).message);
        return { job: toJobResponse(genRepo.getById(job.id)!), asset: null };
      }

      // 4. Hash the temp file
      let hash: string, size: number, mimeType: string;
      try {
        ({ hash, size, mimeType } = await computeHash(output.filePath));
      } catch (err) {
        try { unlinkSync(output.filePath); } catch { /* ignore */ }
        genRepo.markFailed(job.id, "HASH_FAILED", (err as Error).message);
        return { job: toJobResponse(genRepo.getById(job.id)!), asset: null };
      }

      // 5. Copy temp → managed path (appDataDir/<assetId>.<ext>)
      const assetId     = randomUUID();
      const ext         = extFor(output.mimeType ?? mimeType);
      const managedPath = path.join(appDataDir, `${assetId}.${ext}`);
      mkdirSync(appDataDir, { recursive: true });
      try {
        copyFileSync(output.filePath, managedPath);
      } catch (err) {
        try { unlinkSync(output.filePath); } catch { /* ignore */ }
        genRepo.markFailed(job.id, "PERSIST_FAILED", (err as Error).message);
        return { job: toJobResponse(genRepo.getById(job.id)!), asset: null };
      }

      // 6. Persist asset — NO content-hash dedup
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
        try { unlinkSync(managedPath); }     catch { /* ignore */ }
        try { unlinkSync(output.filePath); } catch { /* ignore */ }
        genRepo.markFailed(job.id, "PERSIST_FAILED", (err as Error).message);
        return { job: toJobResponse(genRepo.getById(job.id)!), asset: null };
      }

      // 7. Mark succeeded
      genRepo.markSucceeded(job.id, row.id);

      // 8. Clean up temp file best-effort
      try { unlinkSync(output.filePath); } catch { /* ignore */ }

      // 9. Re-fetch job so finishedAt + assetId are populated
      const succeededJob = genRepo.getById(job.id)!;
      return { job: toJobResponse(succeededJob), asset: toAssetResponse(row) };
    },

    getJob(jobId: string): GenerationJob | null {
      const row = genRepo.getById(jobId);
      return row ? toJobResponse(row) : null;
    },
  };
}

export type GenerationService = ReturnType<typeof createGenerationService>;
