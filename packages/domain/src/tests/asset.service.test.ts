import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAssetService, AssetImportError } from "../asset/asset.service.js";
import type { AssetRepository, AssetRow } from "@starline/storage";
import type { ListAssetsQuery } from "@starline/shared";
import path from "path";
import os from "os";
import fs from "fs";

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
    status:           "active",
    visibility:       "public",
    createdAt:        "2026-01-01T00:00:00.000Z",
    updatedAt:        "2026-01-01T00:00:00.000Z",
    sourceConnector:  null,
    generationPrompt: null,
    generationMeta:   null,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<AssetRepository> = {}): AssetRepository {
  return {
    create:          vi.fn(),
    getById:         vi.fn(),
    getByHash:       vi.fn(),
    getByFilePath:   vi.fn(),
    updateProject:   vi.fn(),
    updateVisibility: vi.fn(),
    clearProject:    vi.fn(),
    listByProject:   vi.fn(),
    list:            vi.fn(),
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

describe("assetService.list", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("passes filters to repo and wraps result with limit/offset", () => {
    const row = makeAssetRow();
    const repoList = vi.fn().mockReturnValue({ items: [row], total: 1 });
    const repo = makeRepo({ list: repoList });
    const service = createAssetService(repo, vi.fn());

    const filters: ListAssetsQuery = { limit: 50, offset: 0 };
    const result = service.list(filters);

    expect(repoList).toHaveBeenCalledOnce();
    expect(repoList).toHaveBeenCalledWith(filters);
    expect(result.total).toBe(1);
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe("asset-1");
  });

  it("passes query and type filters through unchanged", () => {
    const repoList = vi.fn().mockReturnValue({ items: [], total: 0 });
    const repo = makeRepo({ list: repoList });
    const service = createAssetService(repo, vi.fn());

    const filters: ListAssetsQuery = { query: "cat", type: "image", limit: 10, offset: 0 };
    service.list(filters);

    expect(repoList).toHaveBeenCalledWith(filters);
  });
});

describe("assetService.update", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("updates asset project association", () => {
    const existing = makeAssetRow();
    const updated = makeAssetRow({ projectId: "proj-1" });
    const repo = makeRepo({
      getById: vi.fn().mockReturnValue(existing),
      updateProject: vi.fn().mockReturnValue(updated),
    });

    const service = createAssetService(repo, vi.fn());
    const result = service.update("asset-1", { projectId: "proj-1" });

    expect(repo.updateProject).toHaveBeenCalledWith("asset-1", "proj-1");
    expect(result?.projectId).toBe("proj-1");
  });
});

describe("assetService.importFolder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStatSync.mockReturnValue({ isDirectory: () => true } as ReturnType<typeof statSync>);
  });

  it("imports every file in a folder and infers asset types", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "starline-folder-import-"));
    const imagePath = path.join(tempDir, "cover.png");
    const promptPath = path.join(tempDir, "notes.txt");
    fs.writeFileSync(imagePath, "fake-png");
    fs.writeFileSync(promptPath, "prompt");

    const createdRows = [
      makeAssetRow({ id: "asset-image", filePath: imagePath, name: "cover.png", type: "image", mimeType: "image/png" }),
      makeAssetRow({ id: "asset-prompt", filePath: promptPath, name: "notes.txt", type: "prompt", mimeType: "text/plain" }),
    ];

    const repo = makeRepo({
      getByHash: vi.fn().mockReturnValue(undefined),
      create: vi
        .fn()
        .mockReturnValueOnce(createdRows[0])
        .mockReturnValueOnce(createdRows[1]),
    });
    const computeHash = vi
      .fn()
      .mockResolvedValueOnce({ hash: "img-h", size: 7, mimeType: "image/png" })
      .mockResolvedValueOnce({ hash: "txt-h", size: 6, mimeType: "text/plain" });

    const service = createAssetService(repo, computeHash);
    const result = await service.importFolder({ folderPath: tempDir, projectId: "proj-1", visibility: "private" });

    expect(result.importedCount).toBe(2);
    expect(result.reusedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(repo.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ filePath: imagePath, name: "cover.png", type: "image", projectId: "proj-1", visibility: "private" }),
    );
    expect(repo.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ filePath: promptPath, name: "notes.txt", type: "prompt", projectId: "proj-1", visibility: "private" }),
    );

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
