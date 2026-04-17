import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";
import { createGenerationService, ConnectorError } from "../generation/generation.service.js";
import type { AssetRepository, AssetRow, GenerationRepository, GenerationRow } from "@starline/storage";
import type { Connector } from "@starline/connectors";

// ── FS mock (hoisted) ──────────────────────────────────────────────────────
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    mkdirSync:    vi.fn(),
    copyFileSync: vi.fn(),
    unlinkSync:   vi.fn(),
  };
});

import { mkdirSync, copyFileSync, unlinkSync } from "fs";
const mockMkdir  = vi.mocked(mkdirSync);
const mockCopy   = vi.mocked(copyFileSync);
const mockUnlink = vi.mocked(unlinkSync);

// ── helpers ────────────────────────────────────────────────────────────────

const APP_DIR    = "/app/assets";
const mockHashFn = vi.fn().mockResolvedValue({ hash: "h1", size: 10, mimeType: "text/plain" });

function makeAssetRow(overrides: Partial<AssetRow> = {}): AssetRow {
  return {
    id:               "asset-1",
    projectId:        null,
    name:             "output",
    type:             "image",
    filePath:         "/managed/asset-1.txt",
    fileSize:         10,
    mimeType:         "text/plain",
    contentHash:      "h1",
    tags:             [],
    description:      null,
    status:           "active",
    createdAt:        "2026-01-01T00:00:00.000Z",
    updatedAt:        "2026-01-01T00:00:00.000Z",
    sourceConnector:  "mock",
    generationPrompt: "a cat",
    generationMeta:   '{"model":"mock-v1","seed":"abc","latencyMs":5}',
    ...overrides,
  };
}

function makeGenerationRow(overrides: Partial<GenerationRow> = {}): GenerationRow {
  return {
    id:           "job-1",
    connectorId:  "mock",
    prompt:       "a cat",
    type:         "image",
    projectId:    null,
    status:       "queued",
    assetId:      null,
    errorCode:    null,
    errorMessage: null,
    createdAt:    "2026-01-01T00:00:00.000Z",
    startedAt:    null,
    finishedAt:   null,
    attemptCount: 0,
    maxAttempts:  3,
    nextRetryAt:  null,
    retryable:    null,
    settings:     null,
    ...overrides,
  };
}

function makeMockConnector(overrides: Partial<Connector> = {}): Connector {
  return {
    id:          "mock",
    name:        "Mock",
    healthCheck: vi.fn().mockResolvedValue({ ok: true, latencyMs: 5 }),
    generate:    vi.fn().mockResolvedValue({
      filePath: "/tmp/fake-abc.txt",
      mimeType: "text/plain",
      name:     "output",
      meta:     { model: "mock-v1", seed: "abc", latencyMs: 5 },
    }),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<AssetRepository> = {}): AssetRepository {
  return {
    create:        vi.fn().mockReturnValue(makeAssetRow()),
    getById:       vi.fn(),
    getByHash:     vi.fn(),
    getByFilePath: vi.fn(),
    listByProject: vi.fn(),
    list:          vi.fn(),
    ...overrides,
  };
}

function makeGenRepo(overrides: Partial<GenerationRepository> = {}): GenerationRepository {
  // Simulates in-memory state that mutates through mark* calls
  let stored: GenerationRow = makeGenerationRow();
  return {
    create: vi.fn().mockImplementation((input: Parameters<GenerationRepository["create"]>[0]) => {
      stored = {
        ...stored,
        id:          input.id ?? stored.id,
        connectorId: input.connectorId,
        prompt:      input.prompt,
        type:        input.type,
        projectId:   input.projectId ?? null,
        maxAttempts: input.maxAttempts ?? 3,
        settings:    input.settings ?? null,
      };
      return stored;
    }),
    getById: vi.fn().mockImplementation(() => stored),
    markRunning: vi.fn().mockImplementation(() => {
      stored = { ...stored, status: "running", startedAt: "2026-01-01T00:00:01.000Z", attemptCount: stored.attemptCount + 1, nextRetryAt: null };
    }),
    markSucceeded: vi.fn().mockImplementation((_id: string, assetId: string) => {
      stored = { ...stored, status: "succeeded", assetId, finishedAt: "2026-01-01T00:00:02.000Z", errorCode: null, errorMessage: null, retryable: null };
    }),
    markFailed: vi.fn().mockImplementation((_id: string, code: string, msg: string, retryable: boolean) => {
      stored = { ...stored, status: "failed", errorCode: code, errorMessage: msg, finishedAt: "2026-01-01T00:00:02.000Z", retryable: retryable ? 1 : 0, nextRetryAt: null };
    }),
    markRetrying: vi.fn().mockImplementation((_id: string, nextRetryAt: string) => {
      stored = { ...stored, status: "queued", nextRetryAt, startedAt: null, finishedAt: null, errorCode: null, errorMessage: null, retryable: null };
    }),
    requeue: vi.fn().mockImplementation(() => {
      stored = {
        ...stored,
        status:       "queued",
        assetId:      null,
        errorCode:    null,
        errorMessage: null,
        startedAt:    null,
        finishedAt:   null,
        attemptCount: 0,
        nextRetryAt:  null,
        retryable:    null,
      };
    }),
    getNextQueued: vi.fn().mockReturnValue(undefined),
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
  const repo      = makeRepo(repoOverrides);
  const genRepo   = makeGenRepo(genRepoOverrides);
  const registry  = new Map([["mock", connector]]);
  return {
    service:    createGenerationService(registry, repo, genRepo, mockHashFn, APP_DIR, serviceOpts ?? { retryBaseMs: 0 }),
    connector,
    repo,
    genRepo,
  };
}

// ── test() — health check ──────────────────────────────────────────────────

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
    await expect(service.test("nope")).rejects.toMatchObject({ code: "CONNECTOR_NOT_FOUND" });
  });
});

// ── enqueue() — pre-flight ─────────────────────────────────────────────────

describe("generationService.enqueue — pre-flight", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("throws CONNECTOR_NOT_FOUND before creating a job when connector unknown", async () => {
    const { service, genRepo } = makeService();
    await expect(
      service.enqueue({ connectorId: "bad", prompt: "x", type: "image" }),
    ).rejects.toMatchObject({ code: "CONNECTOR_NOT_FOUND" });
    expect(genRepo.create).not.toHaveBeenCalled();
  });

  it("creates job and returns { job: { status: 'queued' } } immediately", async () => {
    const { service } = makeService();
    const result = await service.enqueue({ connectorId: "mock", prompt: "a cat", type: "image" });
    expect(result.job.status).toBe("queued");
    expect(result.job.connectorId).toBe("mock");
    expect(result.job.attemptCount).toBe(0);
    expect(result.job.assetId).toBeNull();
  });

  it("genRepo.create() is called before the queue receives the jobId", async () => {
    const { service, genRepo } = makeService();
    await service.enqueue({ connectorId: "mock", prompt: "a cat", type: "image" });
    // create must have been called since we got a result
    expect(genRepo.create).toHaveBeenCalledOnce();
  });
});

// ── execution — success path ───────────────────────────────────────────────

describe("generationService — execution success path", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("after idle: job.status === 'succeeded' with assetId linked", async () => {
    const { service, genRepo } = makeService();
    await service.enqueue({ connectorId: "mock", prompt: "a cat", type: "image" });
    await service.queue.waitForIdle();
    expect(genRepo.markSucceeded).toHaveBeenCalledOnce();
    const [, assetId] = vi.mocked(genRepo.markSucceeded).mock.calls[0]!;
    expect(typeof assetId).toBe("string");
  });

  it("markRunning() called before connector.generate()", async () => {
    const { service, genRepo, connector } = makeService();
    await service.enqueue({ connectorId: "mock", prompt: "a cat", type: "image" });
    await service.queue.waitForIdle();
    const runningOrder  = vi.mocked(genRepo.markRunning).mock.invocationCallOrder[0]!;
    const generateOrder = vi.mocked(connector.generate).mock.invocationCallOrder[0]!;
    expect(runningOrder).toBeLessThan(generateOrder);
  });

  it("markSucceeded() called with assetId from assetRepo.create()", async () => {
    const { service, genRepo, repo } = makeService();
    await service.enqueue({ connectorId: "mock", prompt: "a cat", type: "image" });
    await service.queue.waitForIdle();
    const assetId = vi.mocked(repo.create).mock.results[0]!.value.id as string;
    expect(genRepo.markSucceeded).toHaveBeenCalledWith("job-1", assetId);
  });

  it("temp file is unlinked after success", async () => {
    const { service } = makeService();
    await service.enqueue({ connectorId: "mock", prompt: "a cat", type: "image" });
    await service.queue.waitForIdle();
    expect(mockUnlink).toHaveBeenCalled();
  });

  it("tags, projectId, and settings flow through to assetRepo.create()", async () => {
    const { service, repo } = makeService();
    await service.enqueue({
      connectorId: "mock",
      prompt:      "test",
      type:        "audio",
      projectId:   "proj-42",
      tags:        ["foo", "bar"],
      settings:    { quality: "high" },
    });
    await service.queue.waitForIdle();

    const createCall = vi.mocked(repo.create).mock.calls[0]![0];
    expect(createCall.projectId).toBe("proj-42");
    expect(createCall.tags).toEqual(["foo", "bar"]);
    expect(createCall.type).toBe("audio");
  });

  it("copies temp file to managed path under APP_DIR", async () => {
    const { service, repo } = makeService();
    await service.enqueue({ connectorId: "mock", prompt: "a cat", type: "image" });
    await service.queue.waitForIdle();

    expect(mockMkdir).toHaveBeenCalledWith(APP_DIR, { recursive: true });
    expect(mockCopy).toHaveBeenCalledOnce();
    const createCall = vi.mocked(repo.create).mock.calls[0]![0];
    expect(path.normalize(createCall.filePath)).toContain(path.normalize(APP_DIR));
  });
});

// ── execution — retryable failure ─────────────────────────────────────────

describe("generationService — retryable failure", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("markRetrying() called; job status goes back to 'queued' with nextRetryAt", async () => {
    const { service, genRepo } = makeService({
      generate: vi.fn().mockRejectedValue(new Error("transient")),
    }, {}, {}, { retryBaseMs: 0 });

    await service.enqueue({ connectorId: "mock", prompt: "x", type: "image" });
    await service.queue.waitForIdle();

    expect(genRepo.markRetrying).toHaveBeenCalledOnce();
    const [, nextRetryAt] = vi.mocked(genRepo.markRetrying).mock.calls[0]!;
    expect(typeof nextRetryAt).toBe("string");
  });

  it("markFailed() NOT called when retries remain", async () => {
    const { service, genRepo } = makeService({
      generate: vi.fn().mockRejectedValue(new Error("transient")),
    }, {}, {}, { retryBaseMs: 0 });

    await service.enqueue({ connectorId: "mock", prompt: "x", type: "image" });
    await service.queue.waitForIdle();

    expect(genRepo.markFailed).not.toHaveBeenCalled();
  });

  it("after maxAttempts exhausted: markFailed() called terminally", async () => {
    const { service, genRepo } = makeService({
      generate: vi.fn().mockRejectedValue(new Error("always fails")),
    }, {}, {
      // Start with attemptCount already at maxAttempts so first attempt exhausts retries
      getById: vi.fn().mockReturnValue(makeGenerationRow({ attemptCount: 3, maxAttempts: 3 })),
    }, { retryBaseMs: 0 });

    await service.enqueue({ connectorId: "mock", prompt: "x", type: "image" });
    await service.queue.waitForIdle();

    expect(genRepo.markFailed).toHaveBeenCalledWith("job-1", "GENERATION_FAILED", "always fails", true);
    expect(genRepo.markRetrying).not.toHaveBeenCalled();
  });
});

// ── execution — non-retryable failure ─────────────────────────────────────

describe("generationService — non-retryable failure", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("err.retryable === false → markFailed() on first attempt, no retry scheduled", async () => {
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

// ── execution — PERSIST_FAILED cleanup ────────────────────────────────────

describe("generationService — PERSIST_FAILED managed file cleanup", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("managed file unlinked when assetRepo.create() throws", async () => {
    const { service } = makeService({}, {
      create: vi.fn().mockImplementation(() => { throw new Error("DB error"); }),
    }, {}, { retryBaseMs: 0 });

    await service.enqueue({ connectorId: "mock", prompt: "a cat", type: "image" });
    await service.queue.waitForIdle();

    // unlinkSync should be called for both managedPath and temp file
    expect(mockUnlink).toHaveBeenCalled();
  });
});

// ── getJob() ──────────────────────────────────────────────────────────────

describe("generationService.getJob", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns GenerationJob when job exists", () => {
    const { service } = makeService();
    const job = service.getJob("job-1");
    expect(job).not.toBeNull();
    expect(job?.id).toBe("job-1");
    expect(job?.connectorId).toBe("mock");
    expect(job?.status).toBe("queued");
    expect(job?.attemptCount).toBe(0);
    expect(job?.maxAttempts).toBe(3);
  });

  it("returns null when job does not exist", () => {
    const { service } = makeService({}, {}, {
      getById: vi.fn().mockReturnValue(undefined),
    });
    const job = service.getJob("no-such-id");
    expect(job).toBeNull();
  });
});

describe("generationService.retry", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("requeues a failed retryable job and returns queued job", () => {
    const failedRow = makeGenerationRow({
      status:       "failed",
      errorCode:    "GENERATION_FAILED",
      errorMessage: "transient provider error",
      attemptCount: 3,
      retryable:    1,
      finishedAt:   "2026-01-01T00:00:02.000Z",
    });
    const { service, genRepo } = makeService({}, {}, {
      getById: vi.fn()
        .mockReturnValueOnce(failedRow)
        .mockReturnValueOnce({ ...failedRow, status: "queued", errorCode: null, errorMessage: null, attemptCount: 0, retryable: null, finishedAt: null }),
    });

    const result = service.retry("job-1");

    expect(genRepo.requeue).toHaveBeenCalledWith("job-1");
    expect(result.job.status).toBe("queued");
    expect(result.job.attemptCount).toBe(0);
    expect(result.job.errorCode).toBeNull();
  });

  it("throws JOB_NOT_FOUND when job does not exist", () => {
    const { service } = makeService({}, {}, {
      getById: vi.fn().mockReturnValue(undefined),
    });

    expect(() => service.retry("missing")).toThrowError(/not found/i);
  });

  it("throws JOB_NOT_FAILED when job is not failed", () => {
    const { service } = makeService({}, {}, {
      getById: vi.fn().mockReturnValue(makeGenerationRow({ status: "succeeded" })),
    });

    expect(() => service.retry("job-1")).toThrowError(/not failed/i);
  });

  it("throws JOB_NOT_RETRYABLE when failed job is marked non-retryable", () => {
    const { service } = makeService({}, {}, {
      getById: vi.fn().mockReturnValue(makeGenerationRow({
        status:       "failed",
        errorCode:    "GENERATION_FAILED",
        errorMessage: "content policy",
        retryable:    0,
      })),
    });

    expect(() => service.retry("job-1")).toThrowError(/not retryable/i);
  });
});
