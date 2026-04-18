import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";
import { buildServer } from "../server.js";
import { StableDiffusionConnector } from "@starline/connectors";
import type { GenerationJob } from "@starline/shared";

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
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
}

describe("Stable Diffusion connector API", () => {
  const ts = Date.now();
  const dbPath = path.join(os.tmpdir(), `starline-stable-diffusion-${ts}.db`);
  const pngBase64 = Buffer.from(new Uint8Array([137, 80, 78, 71])).toString("base64");
  const fetch = vi.fn()
    .mockResolvedValueOnce({ status: 200 })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        images: [pngBase64],
        info: JSON.stringify({ seed: 99, sd_model_name: "dreamshaper" }),
      }),
    });

  const connector = new StableDiffusionConnector("http://127.0.0.1:7860", fetch as typeof globalThis.fetch);
  const app = buildServer(dbPath, {
    extraConnectors: new Map([["stable-diffusion", connector]]),
  });

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    try { fs.unlinkSync(dbPath); } catch { /* ignore */ }
  });

  it("POST /api/connectors/stable-diffusion/test returns 200", async () => {
    const res = await app.inject({ method: "POST", url: "/api/connectors/stable-diffusion/test" });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ ok: boolean; connectorId: string }>().ok).toBe(true);
  });

  it("POST /api/generation/submit with stable-diffusion succeeds and persists asset", async () => {
    const submitRes = await app.inject({
      method: "POST",
      url: "/api/generation/submit",
      payload: { connectorId: "stable-diffusion", prompt: "city skyline", type: "image", projectId: "proj-sd" },
    });
    expect(submitRes.statusCode).toBe(202);

    const { job } = submitRes.json<{ job: GenerationJob }>();
    const completedJob = await waitForJob(app, job.id);
    expect(completedJob.status).toBe("succeeded");

    const assetRes = await app.inject({ method: "GET", url: `/api/assets/${completedJob.assetId}` });
    expect(assetRes.statusCode).toBe(200);
    const asset = assetRes.json<{
      sourceConnector: string | null;
      generationPrompt: string | null;
      projectId: string | null;
      generationMeta: string | null;
    }>();
    expect(asset.sourceConnector).toBe("stable-diffusion");
    expect(asset.generationPrompt).toBe("city skyline");
    expect(asset.projectId).toBe("proj-sd");
    expect(asset.generationMeta).toContain("dreamshaper");
  });
});

