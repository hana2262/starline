import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";
import {
  createGenerationService,
  ConnectorError,
  GenerationCancelError,
  GenerationListError,
} from "../generation/generation.service.js";
import type { AssetRepository, AssetRow, GenerationRepository, GenerationRow } from "@starline/storage";
import type { Connector } from "@starline/connectors";

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    mkdirSync: vi.fn(),
    copyFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

import { mkdirSync, copyFileSync, unlinkSync } from "fs";
const mockMkdir = vi.mocked(mkdirSync);
const mockCopy = vi.mocked(copyFileSync);
const mockUnlink = vi.mocked(unlinkSync);

const APP_DIR = "/app/assets";
const mockHashFn = vi.fn().mockResolvedValue({ hash: "h1", size: 10, mimeType: "text/plain" });

function makeAssetRow(overrides: Partial<AssetRow> = {}): AssetRow {
  return {
    id: "asset-1",
    projectId: null,
    name: "output",
    type: "image",
    filePath: "/managed/asset-1.txt",
    fileSize: 10,
    mimeType: "text/plain",
    contentHash: "h1",
    tags: [],
    description: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sourceConnector: "mock",
    generationPrompt: "a cat",
    generationMeta: '{"model":"mock-v1","seed":"abc","latencyMs":5}',
    ...overrides,
  };
}

function makeGenerationRow(overrides: Partial<GenerationRow> = {}): GenerationRow {
  return {
    id: "job-1",
    connectorId: "mock",
    prompt: "a cat",
    type: "image",
    projectId: null,
    status: "queued",
    assetId: null,
    errorCode: null,
    errorMessage: null,
    cancelReason: null,
    cancelMessage: null,
    cancelRequestedAt: null,
    cancelledAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    startedAt: null,
    finishedAt: null,
    attemptCount: 0,
    maxAttempts: 3,
    nextRetryAt: null,
    retryable: null,
    settings: null,
    ...overrides,
  };
}

function makeMockConnector(overrides: Partial<Connector> = {}): Connector {
  return {
    id: "mock",
    name: "Mock",
    healthCheck: vi.fn().mockResolvedValue({ ok: true, latencyMs: 5 }),
    generate: vi.fn().mockResolvedValue({
      filePath: "/tmp/fake-abc.txt",
      mimeType: "text/plain",
      name: "output",
      meta: { model: "mock-v1", seed: "abc", latencyMs: 5 },
    }),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<AssetRepository> = {}): AssetRepository {
  return {
    create: vi.fn().mockReturnValue(makeAssetRow()),
    getById: vi.fn(),
    getByHash: vi.fn(),
    getByFilePath: vi.fn(),
    listByProject: vi.fn(),
    list: vi.fn(),
    ...overrides,
  };
}

function makeGenRepo(overrides: Partial<GenerationRepository> = {}): GenerationRepository {
  let stored: GenerationRow = makeGenerationRow();
  return {
    create: vi.fn().mockImplementation((input: Parameters<GenerationRepository["create"]>[0]) => {
      stored = {
        ...stored,
        id: input.id ?? stored.id,
        connectorId: input.connectorId,
        prompt: input.prompt,
        type: input.type,
        projectId: input.projectId ?? null,
        maxAttempts: input.maxAttempts ?? 3,
        settings: input.settings ?? null,
      };
      return stored;
    }),
    getById: vi.fn().mockImplementation(() => stored),
    markRunning: vi.fn().mockImplementation(() => {
      stored = {
        ...stored,
        status: "running",
        startedAt: "2026-01-01T00:00:01.000Z",
        attemptCount: stored.attemptCount + 1,
        nextRetryAt: null,
        cancelReason: null,
        cancelMessage: null,
        cancelRequestedAt: null,
        cancelledAt: null,
      };
    }),
    markSucceeded: vi.fn().mockImplementation((_id: string, assetId: string) => {
      stored = {
        ...stored,
        status: "succeeded",
        assetId,
        finishedAt: "2026-01-01T00:00:02.000Z",
        errorCode: null,
        errorMessage: null,
        retryable: null,
        cancelReason: null,
        cancelMessage: null,
        cancelRequestedAt: null,
        cancelledAt: null,
      };
    }),
    markFailed: vi.fn().mockImplementation((_id: string, code: string, msg: string, retryable: boolean) => {
      stored = {
        ...stored,
        status: "failed",
        errorCode: code,
        errorMessage: msg,
        finishedAt: "2026-01-01T00:00:02.000Z",
        retryable: retryable ? 1 : 0,
        nextRetryAt: null,
        cancelReason: null,
        cancelMessage: null,
        cancelRequestedAt: null,
        cancelledAt: null,
      };
    }),
    markRetrying: vi.fn().mockImplementation((_id: string, nextRetryAt: string) => {
      stored = {
        ...stored,
        status: "queued",
        nextRetryAt,
        startedAt: null,
        finishedAt: null,
        errorCode: null,
        errorMessage: null,
        retryable: null,
        cancelReason: null,
        cancelMessage: null,
        cancelRequestedAt: null,
        cancelledAt: null,
      };
    }),
    requeue: vi.fn().mockImplementation(() => {
      stored = {
        ...stored,
        status: "queued",
        assetId: null,
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        attemptCount: 0,
        nextRetryAt: null,
        retryable: null,
        cancelReason: null,
        cancelMessage: null,
        cancelRequestedAt: null,
        cancelledAt: null,
      };
    }),
    markCancelling: vi.fn().mockImplementation((_id: string, reason: string, message: string, requestedAt: string) => {
      stored = {
        ...stored,
        status: "cancelling",
        cancelReason: reason,
        cancelMessage: message,
        cancelRequestedAt: requestedAt,
        cancelledAt: null,
      };
    }),
    markCancelled: vi.fn().mockImplementation((_id: string, reason: string, message: string, requestedAt: string, cancelledAt: string) => {
      stored = {
        ...stored,
        status: "cancelled",
        assetId: null,
        errorCode: null,
        errorMessage: null,
        retryable: null,
        nextRetryAt: null,
        finishedAt: cancelledAt,
        cancelReason: reason,
        cancelMessage: message,
        cancelRequestedAt: requestedAt,
        cancelledAt,
      };
    }),
    listQueuedReady: vi.fn().mockReturnValue([]),
    listRunning: vi.fn().mockReturnValue([]),
    listCancelling: vi.fn().mockReturnValue([]),
    list: vi.fn().mockReturnValue({ items: [], nextCursor: null }),
    ...overrides,
  };
}

function makeService(
  connectorOverrides: Partial<Connector> = {},
  repoOverrides: Partial<AssetRepository> = {},
  genRepoOverrides: Partial<GenerationRepository> = {},
  serviceOpts?: { retryBaseMs?: number },
) {
  const connector = makeMockConnector(connectorOverrides);
  const repo = makeRepo(repoOverrides);
  const genRepo = makeGenRepo(genRepoOverrides);
  const registry = new Map([["mock", connector]]);
  return {
    service: createGenerationService(registry, repo, genRepo, mockHashFn, APP_DIR, serviceOpts ?? { retryBaseMs: 0 }),
    connector,
    repo,
    genRepo,
  };
}

describe("generationService.test", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("calls healthCheck and returns connectorId", async () => {
    const { service, connector } = makeService();
    const result = await service.test("mock");
    expect(connector.healthCheck).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    expect(result.connectorId).toBe("mock");
  });

  it("throws CONNECTOR_NOT_FOUND for unknown connectorId", async () => {
    const { service } = makeService();
    await expect(service.test("nope")).rejects.toBeInstanceOf(ConnectorError);
  });
});

describe("generationService.enqueue", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("throws CONNECTOR_NOT_FOUND before creating a job when connector unknown", async () => {
    const { service, genRepo } = makeService();
    await expect(service.enqueue({ connectorId: "bad", prompt: "x", type: "image" })).rejects.toMatchObject({ code: "CONNECTOR_NOT_FOUND" });
    expect(genRepo.create).not.toHaveBeenCalled();
  });

  it("creates job and returns queued response immediately", async () => {
    const { service } = makeService();
    const result = await service.enqueue({ connectorId: "mock", prompt: "a cat", type: "image" });
    expect(result.job.status).toBe("queued");
    expect(result.job.connectorId).toBe("mock");
    expect(result.job.attemptCount).toBe(0);
    expect(result.job.assetId).toBeNull();
  });
});

describe("generationService execution success path", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("completes queued work to succeeded with asset linkage", async () => {
    const { service, genRepo } = makeService();
    await service.enqueue({ connectorId: "mock", prompt: "a cat", type: "image" });
    await service.queue.waitForIdle();
    expect(genRepo.markSucceeded).toHaveBeenCalledOnce();
  });

  it("calls markRunning before connector.generate", async () => {
    const { service, genRepo, connector } = makeService();
    await service.enqueue({ connectorId: "mock", prompt: "a cat", type: "image" });
    await service.queue.waitForIdle();
    expect(vi.mocked(genRepo.markRunning).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(connector.generate).mock.invocationCallOrder[0]!,
    );
  });

  it("passes projectId, tags, and settings through to assetRepo.create", async () => {
    const { service, repo } = makeService();
    await service.enqueue({
      connectorId: "mock",
      prompt: "test",
      type: "audio",
      projectId: "proj-42",
      tags: ["foo", "bar"],
      settings: { quality: "high" },
    });
    await service.queue.waitForIdle();

    const createCall = vi.mocked(repo.create).mock.calls[0]![0];
    expect(createCall.projectId).toBe("proj-42");
    expect(createCall.tags).toEqual(["foo", "bar"]);
    expect(createCall.type).toBe("audio");
  });

  it("copies temp file into managed path", async () => {
    const { service, repo } = makeService();
    await service.enqueue({ connectorId: "mock", prompt: "a cat", type: "image" });
    await service.queue.waitForIdle();
    expect(mockMkdir).toHaveBeenCalledWith(APP_DIR, { recursive: true });
    expect(mockCopy).toHaveBeenCalledOnce();
    const createCall = vi.mocked(repo.create).mock.calls[0]![0];
    expect(path.normalize(createCall.filePath)).toContain(path.normalize(APP_DIR));
  });
});

describe("generationService failure and retry behavior", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("marks retrying when a retryable error still has attempts left", async () => {
    const { service, genRepo } = makeService({
      generate: vi.fn().mockRejectedValue(new Error("transient")),
    }, {}, {}, { retryBaseMs: 0 });

    await service.enqueue({ connectorId: "mock", prompt: "x", type: "image" });
    await service.queue.waitForIdle();

    expect(genRepo.markRetrying).toHaveBeenCalledOnce();
    expect(genRepo.markFailed).not.toHaveBeenCalled();
  });

  it("marks failed when maxAttempts are exhausted", async () => {
    const fixedRow = makeGenerationRow({ attemptCount: 3, maxAttempts: 3 });
    const { service, genRepo } = makeService({
      generate: vi.fn().mockRejectedValue(new Error("always fails")),
    }, {}, {
      getById: vi.fn().mockReturnValue(fixedRow),
    }, { retryBaseMs: 0 });

    await service.enqueue({ connectorId: "mock", prompt: "x", type: "image" });
    await service.queue.waitForIdle();

    expect(genRepo.markFailed).toHaveBeenCalledWith("job-1", "GENERATION_FAILED", "always fails", true);
  });

  it("marks failed immediately for non-retryable connector errors", async () => {
    const nonRetryableErr = Object.assign(new Error("content policy"), { retryable: false });
    const { service, genRepo } = makeService({
      generate: vi.fn().mockRejectedValue(nonRetryableErr),
    });

    await service.enqueue({ connectorId: "mock", prompt: "x", type: "image" });
    await service.queue.waitForIdle();

    expect(genRepo.markFailed).toHaveBeenCalledWith("job-1", "GENERATION_FAILED", "content policy", false);
    expect(genRepo.markRetrying).not.toHaveBeenCalled();
  });
});

describe("generationService getJob and retry", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns GenerationJob when job exists", () => {
    const { service } = makeService();
    const job = service.getJob("job-1");
    expect(job?.id).toBe("job-1");
    expect(job?.status).toBe("queued");
  });

  it("returns null when job does not exist", () => {
    const { service } = makeService({}, {}, {
      getById: vi.fn().mockReturnValue(undefined),
    });
    expect(service.getJob("missing")).toBeNull();
  });

  it("requeues a failed retryable job and returns queued state", () => {
    const failedRow = makeGenerationRow({
      status: "failed",
      errorCode: "GENERATION_FAILED",
      errorMessage: "transient provider error",
      attemptCount: 3,
      retryable: 1,
      finishedAt: "2026-01-01T00:00:02.000Z",
    });
    const { service, genRepo } = makeService({}, {}, {
      getById: vi.fn()
        .mockReturnValueOnce(failedRow)
        .mockReturnValueOnce({ ...failedRow, status: "queued", errorCode: null, errorMessage: null, attemptCount: 0, retryable: null, finishedAt: null }),
    });

    const result = service.retry("job-1");
    expect(genRepo.requeue).toHaveBeenCalledWith("job-1");
    expect(result.job.status).toBe("queued");
  });
});

describe("generationService cancel", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("cancels queued jobs terminally", () => {
    const { service, genRepo } = makeService();
    const result = service.cancel("job-1");
    expect(genRepo.markCancelled).toHaveBeenCalledOnce();
    expect(result.job.status).toBe("cancelled");
    expect(result.job.cancelReason).toBe("user_requested");
  });

  it("marks running jobs as cancelling", async () => {
    let resolveGenerate: (() => void) | undefined;
    const generate = vi.fn().mockImplementation(() => new Promise<Awaited<ReturnType<Connector["generate"]>>>((resolve) => {
      resolveGenerate = () => resolve({
        filePath: "/tmp/fake-abc.txt",
        mimeType: "text/plain",
        name: "output",
        meta: { model: "mock-v1", seed: "abc", latencyMs: 5 },
      });
    }));
    const { service } = makeService({ generate });

    await service.enqueue({ connectorId: "mock", prompt: "a cat", type: "image" });
    expect(generate).toHaveBeenCalledOnce();

    const cancelResult = service.cancel("job-1");
    expect(cancelResult.job.status).toBe("cancelling");

    resolveGenerate?.();
    await service.queue.waitForIdle();

    const finalJob = service.getJob("job-1");
    expect(finalJob?.status).toBe("cancelled");
    expect(finalJob?.cancelledAt).not.toBeNull();
  });

  it("is idempotent for cancelling jobs", () => {
    const cancellingRow = makeGenerationRow({
      status: "cancelling",
      cancelReason: "user_requested",
      cancelMessage: "Cancellation requested by user.",
      cancelRequestedAt: "2026-01-01T00:00:01.000Z",
    });
    const { service, genRepo } = makeService({}, {}, {
      getById: vi.fn().mockReturnValue(cancellingRow),
    });

    const result = service.cancel("job-1");
    expect(genRepo.markCancelling).not.toHaveBeenCalled();
    expect(result.job.status).toBe("cancelling");
  });

  it("rejects terminal jobs", () => {
    const { service } = makeService({}, {}, {
      getById: vi.fn().mockReturnValue(makeGenerationRow({ status: "succeeded" })),
    });
    expect(() => service.cancel("job-1")).toThrow(GenerationCancelError);
  });
});

describe("generationService listJobs", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("maps repository rows and emits nextCursor", () => {
    const row = makeGenerationRow({ id: "job-2", createdAt: "2026-01-01T00:00:05.000Z" });
    const { service, genRepo } = makeService({}, {}, {
      list: vi.fn().mockReturnValue({
        items: [row],
        nextCursor: { createdAt: row.createdAt, id: row.id },
      }),
    });

    const result = service.listJobs({ limit: 20 });
    expect(genRepo.list).toHaveBeenCalledWith({
      status: undefined,
      connectorId: undefined,
      projectId: undefined,
      cursor: undefined,
      limit: 20,
    });
    expect(result.items[0]?.id).toBe("job-2");
    expect(result.nextCursor).toBeTruthy();
  });

  it("rejects malformed cursors", () => {
    const { service } = makeService();
    expect(() => service.listJobs({ limit: 20, cursor: "bad-cursor" })).toThrow(GenerationListError);
  });
});

describe("generationService recoverPendingJobs", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("re-enqueues queued jobs eligible to run on startup", async () => {
    const queuedRow = makeGenerationRow({ id: "job-recover-1", status: "queued" });
    const { service, genRepo } = makeService({}, {}, {
      listQueuedReady: vi.fn().mockReturnValue([queuedRow]),
      getById: vi.fn().mockReturnValue(queuedRow),
    });

    service.recoverPendingJobs();
    await service.queue.waitForIdle();

    expect(genRepo.listQueuedReady).toHaveBeenCalledOnce();
    expect(genRepo.markSucceeded).toHaveBeenCalledWith("job-recover-1", expect.any(String));
  });

  it("marks stale running jobs failed and manually retryable", () => {
    const runningRow = makeGenerationRow({ id: "job-running-1", status: "running", attemptCount: 1 });
    const { service, genRepo } = makeService({}, {}, {
      listRunning: vi.fn().mockReturnValue([runningRow]),
    });

    service.recoverPendingJobs();

    expect(genRepo.markFailed).toHaveBeenCalledWith(
      "job-running-1",
      "WORKER_RECOVERY_FAILED",
      expect.stringContaining("manual retry"),
      true,
    );
  });

  it("converges stale cancelling jobs to cancelled on startup", () => {
    const cancellingRow = makeGenerationRow({
      id: "job-cancelling-1",
      status: "cancelling",
      cancelReason: "user_requested",
      cancelMessage: "Cancellation requested by user.",
      cancelRequestedAt: "2026-01-01T00:00:01.000Z",
    });
    const { service, genRepo } = makeService({}, {}, {
      listCancelling: vi.fn().mockReturnValue([cancellingRow]),
    });

    service.recoverPendingJobs();

    expect(genRepo.markCancelled).toHaveBeenCalledWith(
      "job-cancelling-1",
      "user_requested",
      expect.stringContaining("Cancellation"),
      "2026-01-01T00:00:01.000Z",
      expect.any(String),
    );
  });
});
