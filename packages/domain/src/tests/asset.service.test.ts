import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAssetService, AssetImportError } from "../asset/asset.service.js";
import type { AssetRepository, AssetRow } from "@starline/storage";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeAssetRow(overrides: Partial<AssetRow> = {}): AssetRow {
  return {
    id:          "asset-1",
    projectId:   null,
    name:        "test.txt",
    type:        "other",
    filePath:    "/tmp/test.txt",
    fileSize:    5,
    mimeType:    "text/plain",
    contentHash: "hashA",
    tags:        [],
    description: null,
    status:      "active",
    createdAt:   "2026-01-01T00:00:00.000Z",
    updatedAt:   "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRepo(overrides: Partial<AssetRepository> = {}): AssetRepository {
  return {
    create:          vi.fn(),
    getById:         vi.fn(),
    getByHash:       vi.fn(),
    getByFilePath:   vi.fn(),
    listByProject:   vi.fn(),
    ...overrides,
  };
}

// Mock fs.statSync — hoisted so it runs before imports resolve
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, statSync: vi.fn() };
});

import { statSync } from "fs";
const mockStatSync = vi.mocked(statSync);

// ── tests ─────────────────────────────────────────────────────────────────────

describe("assetService.import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: file exists
    mockStatSync.mockReturnValue({} as ReturnType<typeof statSync>);
  });

  it("creates a new asset when hash and path are unseen", async () => {
    const newRow = makeAssetRow();
    const repo = makeRepo({
      getByHash:     vi.fn().mockReturnValue(undefined),
      create:        vi.fn().mockReturnValue(newRow),
    });
    const computeHash = vi.fn().mockResolvedValue({ hash: "hashA", size: 5, mimeType: "text/plain" });
    const service = createAssetService(repo, computeHash);

    const result = await service.import({ filePath: "/tmp/test.txt", type: "other" });

    expect(result.created).toBe(true);
    expect(result.asset.id).toBe("asset-1");
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it("returns created:false when content hash already exists (content dedup)", async () => {
    const existing = makeAssetRow();
    const repo = makeRepo({
      getByHash: vi.fn().mockReturnValue(existing),
    });
    const computeHash = vi.fn().mockResolvedValue({ hash: "hashA", size: 5, mimeType: "text/plain" });
    const service = createAssetService(repo, computeHash);

    const result = await service.import({ filePath: "/tmp/test.txt", type: "other" });

    expect(result.created).toBe(false);
    expect(result.asset.id).toBe("asset-1");
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("throws FILE_NOT_FOUND without calling computeHash when file is missing", async () => {
    const enoentError = Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });
    mockStatSync.mockImplementation(() => { throw enoentError; });

    const computeHash = vi.fn();
    const repo = makeRepo();
    const service = createAssetService(repo, computeHash);

    await expect(service.import({ filePath: "/tmp/missing.txt", type: "other" })).rejects.toMatchObject({
      code: "FILE_NOT_FOUND",
    });
    expect(computeHash).not.toHaveBeenCalled();
  });

  it("throws PATH_CONFLICT when file_path unique constraint fires and hashes differ", async () => {
    const existingAtPath = makeAssetRow({ id: "old-id", contentHash: "hashOLD" });
    const uniqueError = new Error("UNIQUE constraint failed: assets.file_path");

    const repo = makeRepo({
      getByHash:     vi.fn().mockReturnValue(undefined),     // new hash not seen before
      create:        vi.fn().mockImplementation(() => { throw uniqueError; }),
      getByFilePath: vi.fn().mockReturnValue(existingAtPath),
    });
    const computeHash = vi.fn().mockResolvedValue({ hash: "hashNEW", size: 5, mimeType: "text/plain" });
    const service = createAssetService(repo, computeHash);

    const err = await service
      .import({ filePath: "/tmp/test.txt", type: "other" })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AssetImportError);
    expect((err as AssetImportError).code).toBe("PATH_CONFLICT");
    expect((err as AssetImportError).existingAssetId).toBe("old-id");
  });

  it("returns created:false (defensive guard) when path conflict but hashes match", async () => {
    const existingAtPath = makeAssetRow({ id: "same-id", contentHash: "hashSAME" });
    const uniqueError = new Error("UNIQUE constraint failed: assets.file_path");

    const repo = makeRepo({
      getByHash:     vi.fn().mockReturnValue(undefined),
      create:        vi.fn().mockImplementation(() => { throw uniqueError; }),
      getByFilePath: vi.fn().mockReturnValue(existingAtPath),
    });
    const computeHash = vi.fn().mockResolvedValue({ hash: "hashSAME", size: 5, mimeType: "text/plain" });
    const service = createAssetService(repo, computeHash);

    const result = await service.import({ filePath: "/tmp/test.txt", type: "other" });

    expect(result.created).toBe(false);
    expect(result.asset.id).toBe("same-id");
  });
});

describe("assetService.getById", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns AssetResponse when found", () => {
    const row = makeAssetRow();
    const repo = makeRepo({ getById: vi.fn().mockReturnValue(row) });
    const service = createAssetService(repo, vi.fn());
    expect(service.getById("asset-1")).toMatchObject({ id: "asset-1" });
  });

  it("returns null when not found", () => {
    const repo = makeRepo({ getById: vi.fn().mockReturnValue(undefined) });
    const service = createAssetService(repo, vi.fn());
    expect(service.getById("nope")).toBeNull();
  });
});
