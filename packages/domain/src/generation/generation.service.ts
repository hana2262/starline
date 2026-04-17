import { mkdirSync, copyFileSync, unlinkSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Connector, GenerateInput, GenerateOutput } from "@starline/connectors";
import type { AssetRepository, AssetRow, GenerationRepository, GenerationRow } from "@starline/storage";
import type {
  ConnectorHealthResponse,
  GenerationSubmitInput,
  GenerationJob,
} from "@starline/shared";
import type { computeFileHash } from "../asset/file.utils.js";
import { GenerationQueue } from "./generation.queue.js";

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

export class GenerationRetryError extends Error {
  constructor(
    message: string,
    public readonly code: "JOB_NOT_FOUND" | "JOB_NOT_FAILED" | "JOB_NOT_RETRYABLE",
    public readonly jobId: string,
  ) {
    super(message);
    this.name = "GenerationRetryError";
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
    attemptCount: row.attemptCount,
    maxAttempts:  row.maxAttempts,
    nextRetryAt:  row.nextRetryAt ?? null,
  };
}

function tryUnlink(filePath: string): void {
  try { unlinkSync(filePath); } catch { /* best-effort */ }
}

export function createGenerationService(
  registry:    ConnectorRegistry,
  assetRepo:   AssetRepository,
  genRepo:     GenerationRepository,
  computeHash: ComputeHashFn,
  appDataDir:  string,
  opts?:       { retryBaseMs?: number; maxRetryDelayMs?: number },
) {
  const retryBaseMs     = opts?.retryBaseMs     ?? 1000;
  const maxRetryDelayMs = opts?.maxRetryDelayMs ?? 30_000;

  function resolve(id: string): Connector {
    const c = registry.get(id);
    if (!c) throw new ConnectorError(`Unknown connector: ${id}`, "CONNECTOR_NOT_FOUND", id);
    return c;
  }

  // queue is referenced inside executeJob (closure); executeJob is a hoisted function declaration
  const queue = new GenerationQueue(executeJob);

  // ── private helpers ─────────────────────────────────────────────────────────

  function handleFailure(
    jobId:    string,
    code:     string,
    err:      unknown,
  ): void {
    const retryable = (err as { retryable?: boolean }).retryable !== false;
    const row = genRepo.getById(jobId);
    if (!row) return;

    if (retryable && row.attemptCount < row.maxAttempts) {
      const delay      = Math.min(Math.pow(2, row.attemptCount - 1) * retryBaseMs, maxRetryDelayMs);
      const nextRetryAt = new Date(Date.now() + delay).toISOString();
      genRepo.markRetrying(jobId, nextRetryAt);
      queue.scheduleRetry(jobId, delay);
    } else {
      genRepo.markFailed(jobId, code, (err as Error).message ?? String(err), retryable);
    }
  }

  // ── job executor (hoisted, so GenerationQueue constructor can reference it) ─

  async function executeJob(jobId: string): Promise<void> {
    // 1. Fetch current job row
    const row = genRepo.getById(jobId);
    if (!row) return;

    // 2. Resolve connector — terminal if missing (config error)
    const connector = registry.get(row.connectorId);
    if (!connector) {
      genRepo.markFailed(jobId, "CONNECTOR_NOT_FOUND", `Unknown connector: ${row.connectorId}`, false);
      return;
    }

    // 3. Mark running — increments attemptCount
    genRepo.markRunning(jobId);

    // 4. Run generation — connector writes to OS temp dir
    const inputJson: { tags?: string[]; name?: string; settings?: Record<string, unknown> } =
      row.settings ? (JSON.parse(row.settings) as { tags?: string[]; name?: string; settings?: Record<string, unknown> }) : {};
    const inputTags         = inputJson.tags     ?? [];
    const inputNameOverride = inputJson.name;
    const inputSettings     = inputJson.settings;

    let output: GenerateOutput;
    try {
      output = await connector.generate({
        prompt:    row.prompt,
        type:      row.type as GenerateInput["type"],
        projectId: row.projectId ?? undefined,
        settings:  inputSettings,
      });
    } catch (err) {
      handleFailure(jobId, "GENERATION_FAILED", err);
      return;
    }

    // 5. Hash the temp file
    let hash: string, size: number, mimeType: string;
    try {
      ({ hash, size, mimeType } = await computeHash(output.filePath));
    } catch (err) {
      tryUnlink(output.filePath);
      handleFailure(jobId, "HASH_FAILED", err);
      return;
    }

    // 6. Copy temp → managed path
    const assetId     = randomUUID();
    const ext         = extFor(output.mimeType ?? mimeType);
    const managedPath = path.join(appDataDir, `${assetId}.${ext}`);
    mkdirSync(appDataDir, { recursive: true });
    try {
      copyFileSync(output.filePath, managedPath);
    } catch (err) {
      tryUnlink(output.filePath);
      handleFailure(jobId, "PERSIST_FAILED", err);
      return;
    }

    // 7. Persist asset row — no content-hash dedup
    let assetRow: AssetRow;
    try {
      const currentRow = genRepo.getById(jobId)!;
      assetRow = assetRepo.create({
        id:               assetId,
        projectId:        currentRow.projectId ?? null,
        name:             inputNameOverride ?? output.name,
        type:             currentRow.type as AssetRow["type"],
        filePath:         managedPath,
        fileSize:         size,
        mimeType:         output.mimeType ?? mimeType,
        contentHash:      hash,
        tags:             inputTags,
        description:      null,
        sourceConnector:  currentRow.connectorId,
        generationPrompt: currentRow.prompt,
        generationMeta:   JSON.stringify(output.meta),
      });
    } catch (err) {
      tryUnlink(managedPath);
      tryUnlink(output.filePath);
      handleFailure(jobId, "PERSIST_FAILED", err);
      return;
    }

    // 8. Mark succeeded
    genRepo.markSucceeded(jobId, assetRow.id);

    // 9. Clean up temp file best-effort
    tryUnlink(output.filePath);
  }

  // ── public API ───────────────────────────────────────────────────────────────

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

    async enqueue(input: GenerationSubmitInput): Promise<{ job: GenerationJob }> {
      // Validate connector exists before creating a job row
      resolve(input.connectorId);

      const job = genRepo.create({
        connectorId: input.connectorId,
        prompt:      input.prompt,
        type:        input.type,
        projectId:   input.projectId ?? null,
        maxAttempts: 3,
        settings:    JSON.stringify({
          tags:     input.tags     ?? [],
          name:     input.name,
          settings: input.settings,
        }),
      });

      queue.push(job.id);

      return { job: toJobResponse(job) };
    },

    getJob(jobId: string): GenerationJob | null {
      const row = genRepo.getById(jobId);
      return row ? toJobResponse(row) : null;
    },

    retry(jobId: string): { job: GenerationJob } {
      const row = genRepo.getById(jobId);
      if (!row) {
        throw new GenerationRetryError(`Generation job not found: ${jobId}`, "JOB_NOT_FOUND", jobId);
      }
      if (row.status !== "failed") {
        throw new GenerationRetryError(`Generation job is not failed: ${jobId}`, "JOB_NOT_FAILED", jobId);
      }
      if (row.retryable !== 1) {
        throw new GenerationRetryError(`Generation job is not retryable: ${jobId}`, "JOB_NOT_RETRYABLE", jobId);
      }

      genRepo.requeue(jobId);
      const queued = genRepo.getById(jobId);
      if (!queued) {
        throw new GenerationRetryError(`Generation job not found: ${jobId}`, "JOB_NOT_FOUND", jobId);
      }

      queue.push(jobId);
      return { job: toJobResponse(queued) };
    },

    recoverPendingJobs(): void {
      const runningJobs = genRepo.listRunning();
      for (const row of runningJobs) {
        genRepo.markFailed(
          row.id,
          "WORKER_RECOVERY_FAILED",
          "Generation job was running during the previous shutdown and requires manual retry.",
          true,
        );
      }

      const queuedJobs = genRepo.listQueuedReady();
      for (const row of queuedJobs) {
        queue.push(row.id);
      }
    },

    /** Exposed for server lifecycle management and test synchronisation. */
    queue,
  };
}

export type GenerationService = ReturnType<typeof createGenerationService>;
