import { describe, expect, it, vi } from "vitest";
import type { AssetRepository, AssetRow, ProjectRepository } from "@starline/storage";
import { AgentToolError, createAgentToolContext, createDefaultAgentToolRegistry } from "../agent/tools/index.js";

function makeProject(overrides: Partial<ReturnType<ProjectRepository["getById"]> extends infer T ? Exclude<T, undefined> : never> = {}) {
  return {
    id: "project-1",
    name: "Launch Project",
    description: "Creative launch scope",
    status: "active" as const,
    visibility: "public" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeAsset(overrides: Partial<AssetRow> = {}): AssetRow {
  return {
    id: "asset-1",
    projectId: null,
    name: "hero prompt",
    type: "prompt",
    filePath: "D:/tmp/hero.txt",
    fileSize: 128,
    mimeType: "text/plain",
    contentHash: "hash-1",
    tags: ["hero", "launch"],
    description: "Main prompt",
    status: "active",
    origin: "imported",
    trashedAt: null,
    visibility: "public",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sourceConnector: null,
    generationPrompt: null,
    generationMeta: null,
    ...overrides,
  };
}

function makeProjectRepo(projects = [makeProject()]): ProjectRepository {
  return {
    create: vi.fn(),
    list: vi.fn().mockReturnValue(projects),
    getById: vi.fn().mockImplementation((id: string) => projects.find((project) => project.id === id)),
    update: vi.fn(),
    archive: vi.fn(),
    delete: vi.fn(),
  };
}

function makeAssetRepo(assets = [makeAsset()]): AssetRepository {
  return {
    create: vi.fn(),
    getById: vi.fn().mockImplementation((id: string) => assets.find((asset) => asset.id === id)),
    getByHash: vi.fn(),
    getByFilePath: vi.fn(),
    updateVisibility: vi.fn(),
    updateProject: vi.fn(),
    moveToTrash: vi.fn(),
    restoreFromTrash: vi.fn(),
    hardDelete: vi.fn(),
    listExpiredTrash: vi.fn(),
    clearProject: vi.fn(),
    listByProject: vi.fn().mockImplementation((projectId: string) => assets.filter((asset) => asset.projectId === projectId)),
    list: vi.fn().mockImplementation(() => ({ items: assets, total: assets.length })),
  };
}

describe("AgentToolRegistry", () => {
  it("lists the default tool definitions", () => {
    const registry = createDefaultAgentToolRegistry();
    expect(registry.listDefinitions().map((tool) => tool.name)).toEqual([
      "search_assets",
      "get_asset_detail",
      "list_projects",
      "get_project_detail",
    ]);
  });

  it("filters private and trashed assets from search results by default", async () => {
    const projectRepo = makeProjectRepo([
      makeProject(),
      makeProject({ id: "project-2", name: "Private", visibility: "private" }),
    ]);
    const assetRepo = makeAssetRepo([
      makeAsset(),
      makeAsset({ id: "asset-2", name: "private prompt", visibility: "private" }),
      makeAsset({ id: "asset-3", name: "trashed prompt", status: "trashed" }),
      makeAsset({ id: "asset-4", name: "private project asset", projectId: "project-2" }),
    ]);
    const registry = createDefaultAgentToolRegistry();
    const context = createAgentToolContext({
      projectRepo,
      assetRepo,
      allowPrivate: false,
    });

    const result = await registry.execute<{
      items: Array<{ id: string }>;
    }>("search_assets", { query: "prompt" }, context);

    expect(result.items.map((item) => item.id)).toEqual(["asset-1"]);
  });

  it("returns private assets when explicitly authorized", async () => {
    const projectRepo = makeProjectRepo();
    const assetRepo = makeAssetRepo([
      makeAsset(),
      makeAsset({ id: "asset-2", name: "private prompt", visibility: "private" }),
    ]);
    const registry = createDefaultAgentToolRegistry();
    const context = createAgentToolContext({
      projectRepo,
      assetRepo,
      allowPrivate: true,
    });

    const result = await registry.execute<{
      items: Array<{ id: string }>;
    }>("search_assets", { query: "prompt" }, context);

    expect(result.items.map((item) => item.id)).toEqual(["asset-1", "asset-2"]);
  });

  it("returns null for inaccessible asset detail", async () => {
    const projectRepo = makeProjectRepo();
    const assetRepo = makeAssetRepo([makeAsset({ visibility: "private" })]);
    const registry = createDefaultAgentToolRegistry();
    const context = createAgentToolContext({
      projectRepo,
      assetRepo,
      allowPrivate: false,
    });

    const result = await registry.execute<{ asset: { id: string } | null }>(
      "get_asset_detail",
      { assetId: "asset-1" },
      context,
    );

    expect(result.asset).toBeNull();
  });

  it("lists only visible projects", async () => {
    const projectRepo = makeProjectRepo([
      makeProject(),
      makeProject({ id: "project-2", visibility: "private", name: "Private" }),
    ]);
    const assetRepo = makeAssetRepo();
    const registry = createDefaultAgentToolRegistry();
    const context = createAgentToolContext({
      projectRepo,
      assetRepo,
      allowPrivate: false,
    });

    const result = await registry.execute<{ items: Array<{ id: string }> }>(
      "list_projects",
      {},
      context,
    );

    expect(result.items.map((item) => item.id)).toEqual(["project-1"]);
  });

  it("returns visible project detail with asset count", async () => {
    const projectRepo = makeProjectRepo([makeProject()]);
    const assetRepo = makeAssetRepo([
      makeAsset({ projectId: "project-1" }),
      makeAsset({ id: "asset-2", projectId: "project-1", visibility: "private" }),
    ]);
    const registry = createDefaultAgentToolRegistry();
    const context = createAgentToolContext({
      projectRepo,
      assetRepo,
      allowPrivate: false,
    });

    const result = await registry.execute<{
      project: { id: string } | null;
      assetCount: number;
    }>("get_project_detail", { projectId: "project-1" }, context);

    expect(result.project?.id).toBe("project-1");
    expect(result.assetCount).toBe(1);
  });

  it("throws a typed error for invalid tool input", async () => {
    const registry = createDefaultAgentToolRegistry();
    const context = createAgentToolContext({
      projectRepo: makeProjectRepo(),
      assetRepo: makeAssetRepo(),
      allowPrivate: false,
    });

    await expect(
      registry.execute("search_assets", { query: "" }, context),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      toolName: "search_assets",
    });
  });
});
