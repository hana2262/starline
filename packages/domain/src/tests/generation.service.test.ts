import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";
import { createGenerationService, ConnectorError } from "../generation/generation.service.js";
import type { AssetRepository, AssetRow } from "@starline/storage";
import type { Connector } from "@starline/connectors";

// ── FS mock (hoisted) ──────────────────────────────────────────────────────
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    mkdirSync:   vi.fn(),
    copyFileSync: vi.fn(),
    unlinkSync:   vi.fn(),
  };
});

import { mkdirSync, copyFileSync, unlinkSync } from "fs";
const mockMkdir   = vi.mocked(mkdirSync);
const mockCopy    = vi.mocked(copyFileSync);
const mockUnlink  = vi.mocked(unlinkSync);

// ── helpers ────────────────────────────────────────────────────────────────

function makeAssetRow(overrides: Partial<AssetRow> = {}): AssetRow {
  return {
    id:               "gen-1",
    projectId:        null,
    name:             "output",
    type:             "image",
    filePath:         "/managed/gen-1.txt",
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

const APP_DIR     = "/app/assets";
const mockHashFn  = vi.fn().mockResolvedValue({ hash: "h1", size: 10, mimeType: "text/plain" });

function makeService(connectorOverrides: Partial<Connector> = {}, repoOverrides: Partial<AssetRepository> = {}) {
  const connector = makeMockConnector(connectorOverrides);
  const repo      = makeRepo(repoOverrides);
  const registry  = new Map([["mock", connector]]);
  return { service: createGenerationService(registry, repo, mockHashFn, APP_DIR), connector, repo };
}

// ── tests ──────────────────────────────────────────────────────────────────

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

describe("generationService.submit", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("calls generate with correct input and always returns created:true (no dedup)", async () => {
    const { service, connector, repo } = makeService();
    const result = await service.submit({ connectorId: "mock", prompt: "a cat", type: "image" });

    expect(connector.generate).toHaveBeenCalledOnce();
    expect(connector.generate).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "a cat", type: "image" }),
    );
    expect(repo.getByHash).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledOnce();
    expect(result.created).toBe(true);
  });

  it("copies file to managed path and passes managed path to create()", async () => {
    const { service, repo } = makeService();
    await service.submit({ connectorId: "mock", prompt: "a cat", type: "image" });

    expect(mockMkdir).toHaveBeenCalledWith(APP_DIR, { recursive: true });
    expect(mockCopy).toHaveBeenCalledOnce();

    const createCall = vi.mocked(repo.create).mock.calls[0]![0];
    // Use path.normalize so the assertion works on both Windows and Unix
    expect(path.normalize(createCall.filePath)).toContain(path.normalize(APP_DIR));
    expect(createCall.sourceConnector).toBe("mock");
    expect(createCall.generationPrompt).toBe("a cat");
    expect(typeof createCall.generationMeta).toBe("string");
  });

  it("cleans up managed file when create() throws", async () => {
    const { service } = makeService({}, {
      create: vi.fn().mockImplementation(() => { throw new Error("DB error"); }),
    });

    await expect(
      service.submit({ connectorId: "mock", prompt: "a cat", type: "image" }),
    ).rejects.toThrow("DB error");

    // unlinkSync should be called (best-effort cleanup)
    expect(mockUnlink).toHaveBeenCalled();
  });

  it("throws CONNECTOR_NOT_FOUND for unknown connectorId", async () => {
    const { service } = makeService();
    await expect(
      service.submit({ connectorId: "bad", prompt: "x", type: "image" }),
    ).rejects.toMatchObject({ code: "CONNECTOR_NOT_FOUND" });
  });

  it("wraps connector generate() errors as GENERATION_FAILED", async () => {
    const { service } = makeService({
      generate: vi.fn().mockRejectedValue(new Error("provider down")),
    });

    await expect(
      service.submit({ connectorId: "mock", prompt: "x", type: "image" }),
    ).rejects.toMatchObject({ code: "GENERATION_FAILED", connectorId: "mock" });
  });

  it("passes tags and projectId through to create()", async () => {
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
});
