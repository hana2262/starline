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
    create: vi.fn().mockImplementation(() => stored),
    getById: vi.fn().mockImplementation(() => stored),
    markRunning: vi.fn().mockImplementation(() => {
      stored = { ...stored, status: "running", startedAt: "2026-01-01T00:00:01.000Z" };
    }),
    markSucceeded: vi.fn().mockImplementation((_id: string, assetId: string) => {
      stored = { ...stored, status: "succeeded", assetId, finishedAt: "2026-01-01T00:00:02.000Z" };
    }),
    markFailed: vi.fn().mockImplementation((_id: string, code: string, msg: string) => {
      stored = { ...stored, status: "failed", errorCode: code, errorMessage: msg, finishedAt: "2026-01-01T00:00:02.000Z" };
    }),
    ...overrides,
  };
}

function makeService(
  connectorOverrides: Partial<Connector> = {},
  repoOverrides: Partial<AssetRepository> = {},
  genRepoOverrides: Partial<GenerationRepository> = {},
) {
  const connector = makeMockConnector(connectorOverrides);
  const repo      = makeRepo(repoOverrides);
  const genRepo   = makeGenRepo(genRepoOverrides);
  const registry  = new Map([["mock", connector]]);
  return {
    service:    createGenerationService(registry, repo, genRepo, mockHashFn, APP_DIR),
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

// ── submit() — success path ────────────────────────────────────────────────

describe("generationService.submit — success path", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates job before calling connector.generate()", async () => {
    const { service, genRepo, connector } = makeService();
    await service.submit({ connectorId: "mock", prompt: "a cat", type: "image" });

    const createOrder   = vi.mocked(genRepo.create).mock.invocationCallOrder[0]!;
    const generateOrder = vi.mocked(connector.generate).mock.invocationCallOrder[0]!;
    expect(createOrder).toBeLessThan(generateOrder);
  });

  it("calls markRunning() before generate() and after create()", async () => {
    const { service, genRepo, connector } = makeService();
    await service.submit({ connectorId: "mock", prompt: "a cat", type: "image" });

    const runningOrder  = vi.mocked(genRepo.markRunning).mock.invocationCallOrder[0]!;
    const generateOrder = vi.mocked(connector.generate).mock.invocationCallOrder[0]!;
    const createOrder   = vi.mocked(genRepo.create).mock.invocationCallOrder[0]!;
    expect(createOrder).toBeLessThan(runningOrder);
    expect(runningOrder).toBeLessThan(generateOrder);
  });

  it("calls markSucceeded() with the assetId from assetRepo.create()", async () => {
    const { service, genRepo, repo } = makeService();
    await service.submit({ connectorId: "mock", prompt: "a cat", type: "image" });

    const assetId = vi.mocked(repo.create).mock.results[0]!.value.id as string;
    expect(genRepo.markSucceeded).toHaveBeenCalledWith("job-1", assetId);
  });

  it("returns { job: { status: succeeded }, asset: AssetResponse }", async () => {
    const { service } = makeService();
    const result = await service.submit({ connectorId: "mock", prompt: "a cat", type: "image" });

    expect(result.job.status).toBe("succeeded");
    expect(result.job.connectorId).toBe("mock");
    expect(result.job.assetId).toBeTruthy();
    expect(result.asset).not.toBeNull();
    expect(result.asset?.sourceConnector).toBe("mock");
  });

  it("cleans up temp file after success", async () => {
    const { service } = makeService();
    await service.submit({ connectorId: "mock", prompt: "a cat", type: "image" });
    expect(mockUnlink).toHaveBeenCalled();
  });

  it("passes tags and projectId through to assetRepo.create()", async () => {
    const { service, repo } = makeService();
    await service.submit({
      connectorId: "mock",
      prompt:      "test",
      type:        "audio",
      projectId:   "proj-42",
      tags:        ["foo", "bar"],
    });

    const createCall = vi.mocked(repo.create).mock.calls[0]![0];
    expect(createCall.projectId).toBe("proj-42");
    expect(createCall.tags).toEqual(["foo", "bar"]);
    expect(createCall.type).toBe("audio");
  });

  it("copies file to managed path using path.normalize-safe assertion", async () => {
    const { service, repo } = makeService();
    await service.submit({ connectorId: "mock", prompt: "a cat", type: "image" });

    expect(mockMkdir).toHaveBeenCalledWith(APP_DIR, { recursive: true });
    expect(mockCopy).toHaveBeenCalledOnce();
    const createCall = vi.mocked(repo.create).mock.calls[0]![0];
    expect(path.normalize(createCall.filePath)).toContain(path.normalize(APP_DIR));
  });
});

// ── submit() — GENERATION_FAILED ──────────────────────────────────────────

describe("generationService.submit — GENERATION_FAILED", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns { job: { status: failed, errorCode: GENERATION_FAILED }, asset: null }", async () => {
    const { service } = makeService({
      generate: vi.fn().mockRejectedValue(new Error("provider down")),
    });
    const result = await service.submit({ connectorId: "mock", prompt: "x", type: "image" });
    expect(result.job.status).toBe("failed");
    expect(result.job.errorCode).toBe("GENERATION_FAILED");
    expect(result.job.errorMessage).toBe("provider down");
    expect(result.asset).toBeNull();
  });

  it("calls markFailed() with GENERATION_FAILED and the error message", async () => {
    const { service, genRepo } = makeService({
      generate: vi.fn().mockRejectedValue(new Error("provider down")),
    });
    await service.submit({ connectorId: "mock", prompt: "x", type: "image" });
    expect(genRepo.markFailed).toHaveBeenCalledWith("job-1", "GENERATION_FAILED", "provider down");
  });

  it("does NOT call assetRepo.create() when generate() fails", async () => {
    const { service, repo } = makeService({
      generate: vi.fn().mockRejectedValue(new Error("provider down")),
    });
    await service.submit({ connectorId: "mock", prompt: "x", type: "image" });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("does NOT call markSucceeded() when generate() fails", async () => {
    const { service, genRepo } = makeService({
      generate: vi.fn().mockRejectedValue(new Error("provider down")),
    });
    await service.submit({ connectorId: "mock", prompt: "x", type: "image" });
    expect(genRepo.markSucceeded).not.toHaveBeenCalled();
  });
});

// ── submit() — PERSIST_FAILED ──────────────────────────────────────────────

describe("generationService.submit — PERSIST_FAILED", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns failed job when assetRepo.create() throws", async () => {
    const { service } = makeService({}, {
      create: vi.fn().mockImplementation(() => { throw new Error("DB error"); }),
    });
    const result = await service.submit({ connectorId: "mock", prompt: "a cat", type: "image" });
    expect(result.job.status).toBe("failed");
    expect(result.job.errorCode).toBe("PERSIST_FAILED");
    expect(result.asset).toBeNull();
  });

  it("cleans up managed file when assetRepo.create() throws", async () => {
    const { service } = makeService({}, {
      create: vi.fn().mockImplementation(() => { throw new Error("DB error"); }),
    });
    await service.submit({ connectorId: "mock", prompt: "a cat", type: "image" });
    expect(mockUnlink).toHaveBeenCalled();
  });

  it("calls markFailed() with PERSIST_FAILED when assetRepo.create() throws", async () => {
    const { service, genRepo } = makeService({}, {
      create: vi.fn().mockImplementation(() => { throw new Error("DB error"); }),
    });
    await service.submit({ connectorId: "mock", prompt: "a cat", type: "image" });
    expect(genRepo.markFailed).toHaveBeenCalledWith("job-1", "PERSIST_FAILED", "DB error");
  });
});

// ── submit() — CONNECTOR_NOT_FOUND ────────────────────────────────────────

describe("generationService.submit — CONNECTOR_NOT_FOUND", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("throws ConnectorError with code CONNECTOR_NOT_FOUND for unknown connector", async () => {
    const { service } = makeService();
    await expect(
      service.submit({ connectorId: "bad", prompt: "x", type: "image" }),
    ).rejects.toMatchObject({ code: "CONNECTOR_NOT_FOUND" });
  });

  it("does NOT call genRepo.create() when connector is not found", async () => {
    const { service, genRepo } = makeService();
    await expect(
      service.submit({ connectorId: "bad", prompt: "x", type: "image" }),
    ).rejects.toThrow();
    expect(genRepo.create).not.toHaveBeenCalled();
  });
});

// ── getJob() ───────────────────────────────────────────────────────────────

describe("generationService.getJob", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns GenerationJob when job exists", () => {
    const { service } = makeService();
    const job = service.getJob("job-1");
    expect(job).not.toBeNull();
    expect(job?.id).toBe("job-1");
    expect(job?.connectorId).toBe("mock");
    expect(job?.status).toBe("queued");
  });

  it("returns null when job does not exist", () => {
    const { service } = makeService({}, {}, {
      getById: vi.fn().mockReturnValue(undefined),
    });
    const job = service.getJob("no-such-id");
    expect(job).toBeNull();
  });
});
