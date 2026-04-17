import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../server.js";
import type { GenerationJob } from "@starline/shared";
import { createGenerationRepository, getDb } from "@starline/storage";
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
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
}

describe("Generation startup recovery API", () => {
  const ts = Date.now();
  const DB_PATH = path.join(os.tmpdir(), `starline-gen-recovery-${ts}.db`);
  const ASSETS_DIR = path.join(os.tmpdir(), `starline-gen-recovery-${ts}-assets`);

  let app: ReturnType<typeof buildServer> | null = null;

  beforeAll(async () => {
    app = buildServer(DB_PATH, { retryBaseMs: 10 });
    await app.ready();
    await app.close();
    app = null;
  });

  afterAll(async () => {
    if (app) await app.close();
    try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
    try { fs.rmSync(ASSETS_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("#1 startup resumes queued job left in storage", async () => {
    const repo = createGenerationRepository(getDb(DB_PATH));
    const queuedJob = repo.create({
      connectorId: "mock",
      prompt:      "resume me",
      type:        "image",
      settings:    JSON.stringify({ tags: [], settings: undefined }),
    });

    app = buildServer(DB_PATH, { retryBaseMs: 10 });
    await app.ready();

    const completedJob = await waitForJob(app, queuedJob.id, 3000);
    expect(completedJob.status).toBe("succeeded");
    expect(completedJob.attemptCount).toBe(1);
    expect(completedJob.assetId).toBeTruthy();

    await app.close();
    app = null;
  });

  it("#2 startup marks stale running job failed and keeps it manually retryable", async () => {
    const repo = createGenerationRepository(getDb(DB_PATH));
    const runningJob = repo.create({
      connectorId: "mock",
      prompt:      "was running",
      type:        "image",
      settings:    JSON.stringify({ tags: [], settings: undefined }),
    });
    repo.markRunning(runningJob.id);

    app = buildServer(DB_PATH, { retryBaseMs: 10 });
    await app.ready();

    const res = await app.inject({ method: "GET", url: `/api/generation/${runningJob.id}` });
    expect(res.statusCode).toBe(200);
    const recovered = res.json<{ job: GenerationJob }>().job;
    expect(recovered.status).toBe("failed");
    expect(recovered.errorCode).toBe("WORKER_RECOVERY_FAILED");
    expect(recovered.errorMessage).toContain("manual retry");
    expect(recovered.assetId).toBeNull();
    expect(recovered.attemptCount).toBe(1);

    const retryRes = await app.inject({
      method: "POST",
      url:    `/api/generation/${runningJob.id}/retry`,
    });
    expect(retryRes.statusCode).toBe(202);

    const completedJob = await waitForJob(app, runningJob.id, 3000);
    expect(completedJob.status).toBe("succeeded");
    expect(completedJob.attemptCount).toBe(1);

    await app.close();
    app = null;
  });
});
