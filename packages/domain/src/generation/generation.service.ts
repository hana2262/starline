import { mkdirSync, copyFileSync, unlinkSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Connector, GenerateInput, GenerateOutput } from "@starline/connectors";
import type { AssetRepository, AssetRow, GenerationRepository, GenerationRow } from "@starline/storage";
import type {
  ConnectorHealthResponse,
  GenerationSubmitInput,
  GenerationJob,
  GenerationListQuery,
  GenerationListResult,
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

export class GenerationCancelError extends Error {
  constructor(
    message: string,
    public readonly code: "JOB_NOT_FOUND" | "JOB_NOT_CANCELLABLE",
    public readonly jobId: string,
  ) {
    super(message);
    this.name = "GenerationCancelError";
  }
}

export class GenerationListError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID_QUERY",
  ) {
    super(message);
    this.name = "GenerationListError";
  }
}

type ConnectorRegistry = Map<string, Connector>;
type ComputeHashFn = typeof computeFileHash;
type GenerationSettings = { tags?: string[]; name?: string; settings?: Record<string, unknown> };
type GenerationLogger = {
  info(payload: Record<string, unknown>, message?: string): void;
  warn?(payload: Record<string, unknown>, message?: string): void;
};
type GenerationMetricsState = {
  submitted: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  retryCount: number;
  failureCodeCounts: Record<string, number>;
  durationSampleCount: number;
  totalDurationMs: number;
};

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
  "text/plain": "txt",
};

const USER_CANCEL_REASON = "user_requested";
const USER_CANCEL_MESSAGE = "Cancellation requested by user.";

function extFor(mimeType: string): string {
  return MIME_EXT[mimeType] ?? "bin";
}

function toJobResponse(row: GenerationRow): GenerationJob {
  return {
    id: row.id,
    connectorId: row.connectorId,
    prompt: row.prompt,
    type: row.type as GenerationJob["type"],
    projectId: row.projectId ?? null,
    status: row.status as GenerationJob["status"],
    assetId: row.assetId ?? null,
    errorCode: row.errorCode ?? null,
    errorMessage: row.errorMessage ?? null,
    cancelReason: row.cancelReason ?? null,
    cancelMessage: row.cancelMessage ?? null,
    cancelRequestedAt: row.cancelRequestedAt ?? null,
    cancelledAt: row.cancelledAt ?? null,
    createdAt: row.createdAt,
    startedAt: row.startedAt ?? null,
    finishedAt: row.finishedAt ?? null,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    nextRetryAt: row.nextRetryAt ?? null,
  };
}

function tryUnlink(filePath: string): void {
  try { unlinkSync(filePath); } catch { /* best-effort */ }
}

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id }), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: string; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      createdAt?: unknown;
      id?: unknown;
    };
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
      throw new Error("Invalid cursor shape");
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new GenerationListError("Invalid generation list query.", "INVALID_QUERY");
  }
}

function parseSettings(settings: string | null): GenerationSettings {
  if (!settings) return {};
  return JSON.parse(settings) as GenerationSettings;
}

export function createGenerationService(
  registry: ConnectorRegistry,
  assetRepo: AssetRepository,
  genRepo: GenerationRepository,
  computeHash: ComputeHashFn,
  appDataDir: string,
  opts?: {
    retryBaseMs?: number;
    maxRetryDelayMs?: number;
    concurrency?: number;
    logger?: GenerationLogger;
  },
) {
  const retryBaseMs = opts?.retryBaseMs ?? 1000;
  const maxRetryDelayMs = opts?.maxRetryDelayMs ?? 30_000;
  const concurrency = opts?.concurrency ?? 1;
  const logger = opts?.logger;
  const metrics: GenerationMetricsState = {
    submitted: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    retryCount: 0,
    failureCodeCounts: {},
    durationSampleCount: 0,
    totalDurationMs: 0,
  };

  function recordDuration(row: GenerationRow): number | null {
    if (!row.startedAt) return null;
    const durationMs = Math.max(0, Date.now() - new Date(row.startedAt).getTime());
    metrics.durationSampleCount++;
    metrics.totalDurationMs += durationMs;
    return durationMs;
  }

  function logMetrics(event: string, row: GenerationRow, extra?: Record<string, unknown>): void {
    logger?.info({
      event: "generation.metrics",
      metricEvent: event,
      jobId: row.id,
      status: row.status,
      connectorId: row.connectorId,
      attemptCount: row.attemptCount,
      successRate: metrics.submitted > 0 ? Number((metrics.succeeded / metrics.submitted).toFixed(4)) : 0,
      avgDurationMs: metrics.durationSampleCount > 0
        ? Math.round(metrics.totalDurationMs / metrics.durationSampleCount)
        : null,
      retryCount: metrics.retryCount,
      totals: {
        submitted: metrics.submitted,
        succeeded: metrics.succeeded,
        failed: metrics.failed,
        cancelled: metrics.cancelled,
      },
      failureCodeCounts: metrics.failureCodeCounts,
      ...extra,
    }, "generation metrics updated");
  }

  function resolve(id: string): Connector {
    const connector = registry.get(id);
    if (!connector) throw new ConnectorError(`Unknown connector: ${id}`, "CONNECTOR_NOT_FOUND", id);
    return connector;
  }

  function markCancelledFromRow(row: GenerationRow, fallbackMessage?: string): void {
    const cancelledAt = new Date().toISOString();
    genRepo.markCancelled(
      row.id,
      row.cancelReason ?? USER_CANCEL_REASON,
      row.cancelMessage ?? fallbackMessage ?? USER_CANCEL_MESSAGE,
      row.cancelRequestedAt ?? cancelledAt,
      cancelledAt,
    );
    const cancelledRow = genRepo.getById(row.id);
    if (!cancelledRow) return;
    metrics.cancelled++;
    const durationMs = recordDuration(cancelledRow);
    logMetrics("cancelled", cancelledRow, { durationMs });
  }

  function getCurrentJobOrCancel(jobId: string): GenerationRow | null {
    const row = genRepo.getById(jobId);
    if (!row) return null;
    if (row.status === "cancelled") return null;
    if (row.status === "cancelling") {
      markCancelledFromRow(row);
      return null;
    }
    return row;
  }

  function handleFailure(jobId: string, code: string, err: unknown): void {
    const retryable = (err as { retryable?: boolean }).retryable !== false;
    const row = genRepo.getById(jobId);
    if (!row) return;

    if (row.status === "cancelling" || row.status === "cancelled") {
      markCancelledFromRow(row);
      return;
    }

    if (retryable && row.attemptCount < row.maxAttempts) {
      const delay = Math.min(Math.pow(2, row.attemptCount - 1) * retryBaseMs, maxRetryDelayMs);
      const nextRetryAt = new Date(Date.now() + delay).toISOString();
      genRepo.markRetrying(jobId, nextRetryAt);
      metrics.retryCount++;
      logMetrics("retry_scheduled", row, { errorCode: code, nextRetryAt });
      queue.scheduleRetry(jobId, delay);
      return;
    }

    genRepo.markFailed(jobId, code, (err as Error).message ?? String(err), retryable);
    const failedRow = genRepo.getById(jobId);
    if (!failedRow) return;
    metrics.failed++;
    metrics.failureCodeCounts[code] = (metrics.failureCodeCounts[code] ?? 0) + 1;
    const durationMs = recordDuration(failedRow);
    logMetrics("failed", failedRow, { durationMs, errorCode: code, retryable });
  }

  async function executeJob(jobId: string): Promise<void> {
    const row = genRepo.getById(jobId);
    if (!row) return;
    if (row.status === "cancelled") return;
    if (row.status === "cancelling") {
      markCancelledFromRow(row);
      return;
    }

    const connector = registry.get(row.connectorId);
    if (!connector) {
      genRepo.markFailed(jobId, "CONNECTOR_NOT_FOUND", `Unknown connector: ${row.connectorId}`, false);
      const failedRow = genRepo.getById(jobId);
      if (failedRow) {
        metrics.failed++;
        metrics.failureCodeCounts["CONNECTOR_NOT_FOUND"] = (metrics.failureCodeCounts["CONNECTOR_NOT_FOUND"] ?? 0) + 1;
        const durationMs = recordDuration(failedRow);
        logMetrics("failed", failedRow, { durationMs, errorCode: "CONNECTOR_NOT_FOUND", retryable: false });
      }
      return;
    }

    genRepo.markRunning(jobId);
    const runningRow = getCurrentJobOrCancel(jobId);
    if (!runningRow) return;

    const inputJson = parseSettings(runningRow.settings ?? null);
    const inputTags = inputJson.tags ?? [];
    const inputNameOverride = inputJson.name;
    const inputSettings = inputJson.settings;

    let output: GenerateOutput;
    try {
      output = await connector.generate({
        prompt: runningRow.prompt,
        type: runningRow.type as GenerateInput["type"],
        projectId: runningRow.projectId ?? undefined,
        settings: inputSettings,
      });
    } catch (err) {
      handleFailure(jobId, "GENERATION_FAILED", err);
      return;
    }

    const afterGenerate = getCurrentJobOrCancel(jobId);
    if (!afterGenerate) {
      tryUnlink(output.filePath);
      return;
    }

    let hash: string;
    let size: number;
    let mimeType: string;
    try {
      ({ hash, size, mimeType } = await computeHash(output.filePath));
    } catch (err) {
      tryUnlink(output.filePath);
      handleFailure(jobId, "HASH_FAILED", err);
      return;
    }

    const assetId = randomUUID();
    const ext = extFor(output.mimeType ?? mimeType);
    const managedPath = path.join(appDataDir, `${assetId}.${ext}`);
    mkdirSync(appDataDir, { recursive: true });
    try {
      copyFileSync(output.filePath, managedPath);
    } catch (err) {
      tryUnlink(output.filePath);
      handleFailure(jobId, "PERSIST_FAILED", err);
      return;
    }

    const beforePersist = getCurrentJobOrCancel(jobId);
    if (!beforePersist) {
      tryUnlink(managedPath);
      tryUnlink(output.filePath);
      return;
    }

    let assetRow: AssetRow;
    try {
      assetRow = assetRepo.create({
        id: assetId,
        projectId: beforePersist.projectId ?? null,
        name: inputNameOverride ?? output.name,
        type: beforePersist.type as AssetRow["type"],
        filePath: managedPath,
        fileSize: size,
        mimeType: output.mimeType ?? mimeType,
        contentHash: hash,
        tags: inputTags,
        description: null,
        sourceConnector: beforePersist.connectorId,
        generationPrompt: beforePersist.prompt,
        generationMeta: JSON.stringify(output.meta),
      });
    } catch (err) {
      tryUnlink(managedPath);
      tryUnlink(output.filePath);
      handleFailure(jobId, "PERSIST_FAILED", err);
      return;
    }

    const beforeSuccess = getCurrentJobOrCancel(jobId);
    if (!beforeSuccess) {
      tryUnlink(output.filePath);
      return;
    }

    genRepo.markSucceeded(jobId, assetRow.id);
    const succeededRow = genRepo.getById(jobId);
    if (succeededRow) {
      metrics.succeeded++;
      const durationMs = recordDuration(succeededRow);
      logMetrics("succeeded", succeededRow, { durationMs, assetId: assetRow.id });
    }
    tryUnlink(output.filePath);
  }

  const queue = new GenerationQueue(executeJob, concurrency);

  return {
    async test(connectorId: string): Promise<ConnectorHealthResponse> {
      const connector = resolve(connectorId);
      try {
        const result = await connector.healthCheck();
        return { ...result, connectorId };
      } catch (err) {
        throw new ConnectorError((err as Error).message, "HEALTH_CHECK_FAILED", connectorId);
      }
    },

    async enqueue(input: GenerationSubmitInput): Promise<{ job: GenerationJob }> {
      resolve(input.connectorId);

      const job = genRepo.create({
        connectorId: input.connectorId,
        prompt: input.prompt,
        type: input.type,
        projectId: input.projectId ?? null,
        maxAttempts: 3,
        settings: JSON.stringify({
          tags: input.tags ?? [],
          name: input.name,
          settings: input.settings,
        }),
      });

      metrics.submitted++;
      queue.push(job.id);
      logMetrics("submitted", job);
      return { job: toJobResponse(job) };
    },

    getJob(jobId: string): GenerationJob | null {
      const row = genRepo.getById(jobId);
      return row ? toJobResponse(row) : null;
    },

    listJobs(query: GenerationListQuery): GenerationListResult {
      const page = genRepo.list({
        status: query.status,
        connectorId: query.connectorId,
        projectId: query.projectId,
        cursor: query.cursor ? decodeCursor(query.cursor) : undefined,
        limit: query.limit,
      });

      return {
        items: page.items.map(toJobResponse),
        nextCursor: page.nextCursor ? encodeCursor(page.nextCursor.createdAt, page.nextCursor.id) : null,
      };
    },

    cancel(jobId: string): { job: GenerationJob } {
      const row = genRepo.getById(jobId);
      if (!row) {
        throw new GenerationCancelError(`Generation job not found: ${jobId}`, "JOB_NOT_FOUND", jobId);
      }

      if (row.status === "cancelling") {
        return { job: toJobResponse(row) };
      }

      const requestedAt = new Date().toISOString();
      if (row.status === "queued") {
      genRepo.markCancelled(jobId, USER_CANCEL_REASON, USER_CANCEL_MESSAGE, requestedAt, requestedAt);
      } else if (row.status === "running") {
        genRepo.markCancelling(jobId, USER_CANCEL_REASON, USER_CANCEL_MESSAGE, requestedAt);
      } else {
        throw new GenerationCancelError(`Generation job is not cancellable: ${jobId}`, "JOB_NOT_CANCELLABLE", jobId);
      }

      const updated = genRepo.getById(jobId);
      if (!updated) {
        throw new GenerationCancelError(`Generation job not found: ${jobId}`, "JOB_NOT_FOUND", jobId);
      }
      if (updated.status === "cancelling") {
        logMetrics("cancelling", updated);
      }
      return { job: toJobResponse(updated) };
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
      metrics.retryCount++;
      const queued = genRepo.getById(jobId);
      if (!queued) {
        throw new GenerationRetryError(`Generation job not found: ${jobId}`, "JOB_NOT_FOUND", jobId);
      }

      queue.push(jobId);
      logMetrics("retry_requeued", queued);
      return { job: toJobResponse(queued) };
    },

    recoverPendingJobs(): void {
      const cancellingJobs = genRepo.listCancelling();
      for (const row of cancellingJobs) {
        markCancelledFromRow(row, "Cancellation completed during recovery.");
      }

      const runningJobs = genRepo.listRunning();
      for (const row of runningJobs) {
        genRepo.markFailed(
          row.id,
          "WORKER_RECOVERY_FAILED",
          "Generation job was running during the previous shutdown and requires manual retry.",
          true,
        );
        const failedRow = genRepo.getById(row.id);
        if (failedRow) {
          metrics.failed++;
          metrics.failureCodeCounts["WORKER_RECOVERY_FAILED"] = (metrics.failureCodeCounts["WORKER_RECOVERY_FAILED"] ?? 0) + 1;
          const durationMs = recordDuration(failedRow);
          logMetrics("failed", failedRow, { durationMs, errorCode: "WORKER_RECOVERY_FAILED", retryable: true });
        }
      }

      const queuedJobs = genRepo.listQueuedReady();
      for (const row of queuedJobs) {
        queue.push(row.id);
      }
    },

    queue,
  };
}

export type GenerationService = ReturnType<typeof createGenerationService>;
