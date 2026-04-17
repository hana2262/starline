import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { buildServer } from "../server.js";
import { MinimaxConnector } from "@starline/connectors";
import type { GenerationJob } from "@starline/shared";
import path from "path";
import os from "os";
import fs from "fs";

async function waitForJob(
  app: ReturnType<typeof buildServer>,
  jobId: string,
  timeoutMs = 3000,
): Promise<GenerationJob> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await app.inject({ method: "GET", url: `/api/generation/${jobId}` });
    const job = res.json<{ job: GenerationJob }>().job;
    if (job.status !== "queued" && job.status !== "running") return job;
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
}

// ── mock fetch helper ──────────────────────────────────────────────────────────
// Produces a sequential mock:
//   call 0 — GET /v1/models (healthCheck probe) → 200
//   call 1 — POST /v1/image_generation (generate)  → image URL list
//   call 2 — GET <imageUrl>  (image download)       → PNG bytes

function makeMinimaxFetch(): ReturnType<typeof vi.fn> {
  return vi.fn()
    .mockResolvedValueOnce({ ok: true, status: 200 })
    .mockResolvedValueOnce({
      ok: true, status: 200,
      json: () => Promise.resolve({
        data:      { image_urls: ["http://fake-cdn/minimax-img.png"] },
        base_resp: { status_code: 0, status_msg: "success" },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      headers: { get: (k: string) => k === "content-type" ? "image/png" : null },
      arrayBuffer: () => Promise.resolve(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer),
    });
}

// ── describe: MiniMax connector registered via extraConnectors ─────────────────

describe("MiniMax connector (mocked HTTP, injected via extraConnectors)", () => {
  const ts          = Date.now();
  const DB_PATH     = path.join(os.tmpdir(), `starline-minimax-test-${ts}.db`);
  const ASSETS_DIR  = path.join(os.tmpdir(), `starline-minimax-test-${ts}-assets`);

  let app: ReturnType<typeof buildServer>;
  let generatedFilePath = "";

  beforeAll(async () => {
    const mockFetch = makeMinimaxFetch();
    const minimax   = new MinimaxConnector("test-api-key", mockFetch as typeof globalThis.fetch);
    app = buildServer(DB_PATH, { extraConnectors: new Map([["minimax", minimax]]), retryBaseMs: 10 });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    try { fs.unlinkSync(DB_PATH); }                                         catch { /* ignore */ }
    try { fs.rmSync(ASSETS_DIR, { recursive: true, force: true }); }       catch { /* ignore */ }
  });

  it("#1 POST /api/connectors/minimax/test — 200 ok:true", async () => {
    const res = await app.inject({ method: "POST", url: "/api/connectors/minimax/test" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ ok: boolean; latencyMs: number; connectorId: string }>();
    expect(body.ok).toBe(true);
    expect(body.connectorId).toBe("minimax");
    expect(typeof body.latencyMs).toBe("number");
  });

  it("#2 POST /api/generation/submit — 202 queued; job completes with minimax metadata", async () => {
    const res = await app.inject({
      method:  "POST",
      url:     "/api/generation/submit",
      payload: { connectorId: "minimax", prompt: "a glowing neon cat", type: "image" },
    });
    expect(res.statusCode).toBe(202);
    const { job: enqueuedJob } = res.json<{ job: GenerationJob }>();
    expect(enqueuedJob.status).toBe("queued");
    expect(enqueuedJob.connectorId).toBe("minimax");

    const completedJob = await waitForJob(app, enqueuedJob.id);
    expect(completedJob.status).toBe("succeeded");
    expect(completedJob.assetId).toBeTruthy();

    const assetRes = await app.inject({ method: "GET", url: `/api/assets/${completedJob.assetId}` });
    expect(assetRes.statusCode).toBe(200);
    const asset = assetRes.json<{
      id: string;
      filePath: string;
      sourceConnector: string | null;
      generationPrompt: string | null;
      generationMeta: string | null;
    }>();
    expect(asset.sourceConnector).toBe("minimax");
    expect(asset.generationPrompt).toBe("a glowing neon cat");

    const meta = JSON.parse(asset.generationMeta!);
    expect(meta.model).toBe("image-01");
    expect(typeof meta.seed).toBe("string");
    expect(typeof meta.latencyMs).toBe("number");

    generatedFilePath = asset.filePath;
  });

  it("#3 managed file exists on disk at asset.filePath (not OS temp)", async () => {
    expect(generatedFilePath).toBeTruthy();
    expect(fs.existsSync(generatedFilePath)).toBe(true);
    // should NOT be the raw minimax- temp file (it was copied to managed path)
    expect(path.basename(generatedFilePath)).not.toMatch(/^minimax-/);
  });
});

// ── describe: minimax absent when no key and no extraConnectors ────────────────

describe("MiniMax connector absent when MINIMAX_API_KEY is not set", () => {
  const ts2      = Date.now() + 1;
  const DB_PATH2 = path.join(os.tmpdir(), `starline-minimax-nokey-${ts2}.db`);

  let app2: ReturnType<typeof buildServer>;

  beforeAll(async () => {
    // Ensure MINIMAX_API_KEY is not present
    delete process.env["MINIMAX_API_KEY"];
    app2 = buildServer(DB_PATH2); // no extraConnectors
    await app2.ready();
  });

  afterAll(async () => {
    await app2.close();
    try { fs.unlinkSync(DB_PATH2); } catch { /* ignore */ }
  });

  it("#4 POST /api/connectors/minimax/test — 404 CONNECTOR_NOT_FOUND", async () => {
    const res = await app2.inject({ method: "POST", url: "/api/connectors/minimax/test" });
    expect(res.statusCode).toBe(404);
    expect(res.json<{ code: string }>().code).toBe("CONNECTOR_NOT_FOUND");
  });
});
