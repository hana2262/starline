import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../server.js";
import path from "path";
import os from "os";
import fs from "fs";

const ts      = Date.now();
const DB_PATH = path.join(os.tmpdir(), `starline-gen-test-${ts}.db`);
const APP_ASSETS_DIR = path.join(os.tmpdir(), `starline-gen-test-${ts}-assets`);

const app = buildServer(DB_PATH);

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
  try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
  try { fs.rmSync(APP_ASSETS_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

type GenBody = { created: boolean; asset: {
  id: string;
  name: string;
  filePath: string;
  sourceConnector: string | null;
  generationPrompt: string | null;
  generationMeta: string | null;
  projectId: string | null;
  tags: string[];
  type: string;
} };

describe("Connector health-check API", () => {
  it("#1 POST /api/connectors/mock/test — 200 ok", async () => {
    const res = await app.inject({ method: "POST", url: "/api/connectors/mock/test" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ ok: boolean; latencyMs: number; connectorId: string }>();
    expect(body.ok).toBe(true);
    expect(body.connectorId).toBe("mock");
    expect(typeof body.latencyMs).toBe("number");
  });

  it("#2 POST /api/connectors/unknown/test — 404 CONNECTOR_NOT_FOUND", async () => {
    const res = await app.inject({ method: "POST", url: "/api/connectors/unknown/test" });
    expect(res.statusCode).toBe(404);
    expect(res.json<{ code: string }>().code).toBe("CONNECTOR_NOT_FOUND");
  });
});

describe("Generation submit API", () => {
  let generatedAssetId: string;
  let generatedFilePath: string;

  it("#3 POST /api/generation/submit — 201 with correct metadata", async () => {
    const res = await app.inject({
      method:  "POST",
      url:     "/api/generation/submit",
      payload: { connectorId: "mock", prompt: "a cat in space", type: "image" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<GenBody>();
    expect(body.created).toBe(true);
    expect(body.asset.sourceConnector).toBe("mock");
    expect(body.asset.generationPrompt).toBe("a cat in space");
    expect(() => JSON.parse(body.asset.generationMeta!)).not.toThrow();
    const meta = JSON.parse(body.asset.generationMeta!);
    expect(meta.model).toBe("mock-v1");
    expect(typeof meta.seed).toBe("string");
    expect(typeof meta.latencyMs).toBe("number");

    generatedAssetId  = body.asset.id;
    generatedFilePath = body.asset.filePath;
  });

  it("#4 POST /api/generation/submit — 201 with projectId and tags", async () => {
    const res = await app.inject({
      method:  "POST",
      url:     "/api/generation/submit",
      payload: { connectorId: "mock", prompt: "dog on moon", type: "audio", projectId: "proj-x", tags: ["foo"] },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<GenBody>();
    expect(body.asset.projectId).toBe("proj-x");
    expect(body.asset.tags).toEqual(["foo"]);
    expect(body.asset.type).toBe("audio");
  });

  it("#5 Managed file exists on disk at asset.filePath (not OS temp)", async () => {
    expect(generatedFilePath).toBeTruthy();
    expect(fs.existsSync(generatedFilePath)).toBe(true);
    // file should NOT be in OS temp (it was moved to appDataDir)
    expect(generatedFilePath).not.toMatch(/starline-mock-/);
  });

  it("#6 Two submits with same prompt — both return 201 with distinct asset IDs (no dedup)", async () => {
    const [r1, r2] = await Promise.all([
      app.inject({
        method:  "POST",
        url:     "/api/generation/submit",
        payload: { connectorId: "mock", prompt: "identical prompt", type: "image" },
      }),
      app.inject({
        method:  "POST",
        url:     "/api/generation/submit",
        payload: { connectorId: "mock", prompt: "identical prompt", type: "image" },
      }),
    ]);
    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
    const b1 = r1.json<GenBody>();
    const b2 = r2.json<GenBody>();
    expect(b1.created).toBe(true);
    expect(b2.created).toBe(true);
    expect(b1.asset.id).not.toBe(b2.asset.id);
  });

  it("#7 POST /api/generation/submit — 404 for bad connectorId", async () => {
    const res = await app.inject({
      method:  "POST",
      url:     "/api/generation/submit",
      payload: { connectorId: "bad", prompt: "x", type: "image" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json<{ code: string }>().code).toBe("CONNECTOR_NOT_FOUND");
  });

  it("#8 POST /api/generation/submit — 400 missing prompt", async () => {
    const res = await app.inject({
      method:  "POST",
      url:     "/api/generation/submit",
      payload: { connectorId: "mock", type: "image" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("#9 POST /api/generation/submit — 400 missing type", async () => {
    const res = await app.inject({
      method:  "POST",
      url:     "/api/generation/submit",
      payload: { connectorId: "mock", prompt: "x" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("#10 GET /api/assets?query=cat — FTS finds generated asset by name", async () => {
    // Asset from #3 has name "a cat in space" which contains "cat"
    const res = await app.inject({ method: "GET", url: "/api/assets?query=cat" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ items: { id: string }[]; total: number }>();
    expect(body.items.some(i => i.id === generatedAssetId)).toBe(true);
  });

  it("#11 GET /api/assets/:id — response includes generation fields", async () => {
    const res = await app.inject({ method: "GET", url: `/api/assets/${generatedAssetId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<GenBody["asset"]>();
    expect(body.sourceConnector).toBe("mock");
    expect(body.generationPrompt).toBe("a cat in space");
    expect(body.generationMeta).toBeTruthy();
  });
});
