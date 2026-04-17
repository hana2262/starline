import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../server.js";
import type { GenerationJob } from "@starline/shared";
import type { Connector } from "@starline/connectors";
import path from "path";
import os from "os";
import fs from "fs";
import { randomUUID } from "crypto";

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

const ts = Date.now();
const DB_PATH = path.join(os.tmpdir(), `starline-gen-test-${ts}.db`);
const APP_ASSETS_DIR = path.join(os.tmpdir(), `starline-gen-test-${ts}-assets`);

const app = buildServer(DB_PATH, { retryBaseMs: 10 });

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
  try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
  try { fs.rmSync(APP_ASSETS_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

type AssetBody = {
  id: string;
  name: string;
  filePath: string;
  sourceConnector: string | null;
  generationPrompt: string | null;
  generationMeta: string | null;
  projectId: string | null;
  tags: string[];
  type: string;
};

type EnqueueBody = { job: GenerationJob };

describe("Connector health-check API", () => {
  it("#1 POST /api/connectors/mock/test returns 200", async () => {
    const res = await app.inject({ method: "POST", url: "/api/connectors/mock/test" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ ok: boolean; latencyMs: number; connectorId: string }>();
    expect(body.ok).toBe(true);
    expect(body.connectorId).toBe("mock");
    expect(typeof body.latencyMs).toBe("number");
  });

  it("#2 POST /api/connectors/unknown/test returns 404", async () => {
    const res = await app.inject({ method: "POST", url: "/api/connectors/unknown/test" });
    expect(res.statusCode).toBe(404);
    expect(res.json<{ code: string }>().code).toBe("CONNECTOR_NOT_FOUND");
  });
});

describe("Generation submit API", () => {
  let generatedJobId: string;
  let generatedAssetId: string;
  let generatedFilePath: string;

  it("#3 POST /api/generation/submit returns 202 with queued job", async () => {
    const res = await app.inject({
      method:  "POST",
      url:     "/api/generation/submit",
      payload: { connectorId: "mock", prompt: "a cat in space", type: "image" },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json<EnqueueBody>();
    expect(body.job.status).toBe("queued");
    expect(body.job.connectorId).toBe("mock");
    expect(body.job.attemptCount).toBe(0);
    expect(body.job.maxAttempts).toBe(3);
    generatedJobId = body.job.id;
  });

  it("#4 GET /api/generation/:id completes to succeeded with assetId", async () => {
    const job = await waitForJob(app, generatedJobId);
    expect(job.status).toBe("succeeded");
    expect(job.assetId).toBeTruthy();
    expect(job.finishedAt).not.toBeNull();
    expect(job.attemptCount).toBe(1);
    generatedAssetId = job.assetId!;
  });

  it("#5 GET /api/assets/:id exposes generation metadata", async () => {
    const res = await app.inject({ method: "GET", url: `/api/assets/${generatedAssetId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<AssetBody>();
    expect(body.sourceConnector).toBe("mock");
    expect(body.generationPrompt).toBe("a cat in space");
    expect(() => JSON.parse(body.generationMeta!)).not.toThrow();
    const meta = JSON.parse(body.generationMeta!);
    expect(meta.model).toBe("mock-v1");
    expect(typeof meta.seed).toBe("string");
    expect(typeof meta.latencyMs).toBe("number");
    generatedFilePath = body.filePath;
  });

  it("#6 managed file exists on disk", async () => {
    expect(generatedFilePath).toBeTruthy();
    expect(fs.existsSync(generatedFilePath)).toBe(true);
    expect(generatedFilePath).not.toMatch(/starline-mock-/);
  });

  it("#7 submit with projectId and tags completes successfully", async () => {
    const res = await app.inject({
      method:  "POST",
      url:     "/api/generation/submit",
      payload: { connectorId: "mock", prompt: "dog on moon", type: "audio", projectId: "proj-x", tags: ["foo"] },
    });
    expect(res.statusCode).toBe(202);
    const { job: enqueuedJob } = res.json<EnqueueBody>();
    expect(enqueuedJob.status).toBe("queued");

    const completedJob = await waitForJob(app, enqueuedJob.id);
    expect(completedJob.status).toBe("succeeded");

    const assetRes = await app.inject({ method: "GET", url: `/api/assets/${completedJob.assetId}` });
    const asset = assetRes.json<AssetBody>();
    expect(asset.projectId).toBe("proj-x");
    expect(asset.tags).toEqual(["foo"]);
    expect(asset.type).toBe("audio");
  });

  it("#8 two concurrent submits both complete", async () => {
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
    expect(r1.statusCode).toBe(202);
    expect(r2.statusCode).toBe(202);
    const b1 = r1.json<EnqueueBody>();
    const b2 = r2.json<EnqueueBody>();
    expect(b1.job.id).not.toBe(b2.job.id);

    const [j1, j2] = await Promise.all([
      waitForJob(app, b1.job.id),
      waitForJob(app, b2.job.id),
    ]);
    expect(j1.status).toBe("succeeded");
    expect(j2.status).toBe("succeeded");
  });

  it("#9 unknown connector returns 404", async () => {
    const res = await app.inject({
      method:  "POST",
      url:     "/api/generation/submit",
      payload: { connectorId: "bad", prompt: "x", type: "image" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json<{ code: string }>().code).toBe("CONNECTOR_NOT_FOUND");
  });

  it("#10 missing prompt returns 400", async () => {
    const res = await app.inject({
      method:  "POST",
      url:     "/api/generation/submit",
      payload: { connectorId: "mock", type: "image" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("#11 missing type returns 400", async () => {
    const res = await app.inject({
      method:  "POST",
      url:     "/api/generation/submit",
      payload: { connectorId: "mock", prompt: "x" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("#12 GET /api/generation/:id returns succeeded job fields", async () => {
    const res = await app.inject({ method: "GET", url: `/api/generation/${generatedJobId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ job: GenerationJob }>();
    expect(body.job.id).toBe(generatedJobId);
    expect(body.job.status).toBe("succeeded");
    expect(body.job.assetId).toBe(generatedAssetId);
    expect(body.job.finishedAt).not.toBeNull();
    expect(body.job.attemptCount).toBe(1);
    expect(body.job.maxAttempts).toBe(3);
    expect(body.job.nextRetryAt).toBeNull();
  });

  it("#13 GET /api/generation/<random-uuid> returns 404", async () => {
    const res = await app.inject({ method: "GET", url: `/api/generation/${randomUUID()}` });
    expect(res.statusCode).toBe(404);
  });

  it("#14 GET /api/assets?query=cat finds generated asset", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets?query=cat" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ items: { id: string }[]; total: number }>();
    expect(body.items.some((item) => item.id === generatedAssetId)).toBe(true);
  });
});

describe("Generation submit retry flow", () => {
  const ts2 = Date.now() + 1;
  const DB_PATH2 = path.join(os.tmpdir(), `starline-gen-flaky-${ts2}.db`);

  let callCount = 0;

  const flakyConnector: Connector = {
    id:          "flaky",
    name:        "Flaky Connector",
    healthCheck: async () => ({ ok: true, latencyMs: 1 }),
    generate:    async (input) => {
      callCount++;
      if (callCount === 1) {
        throw new Error("transient provider error");
      }
      const filePath = path.join(os.tmpdir(), `flaky-${randomUUID()}.txt`);
      fs.writeFileSync(filePath, `content: ${input.prompt}`);
      return {
        filePath,
        mimeType: "text/plain",
        name:     "flaky-output",
        meta:     { model: "flaky-v1", seed: "abc", latencyMs: 1 },
      };
    },
  };

  let app2: ReturnType<typeof buildServer>;

  beforeAll(async () => {
    app2 = buildServer(DB_PATH2, {
      extraConnectors: new Map([["flaky", flakyConnector]]),
      retryBaseMs:     10,
    });
    await app2.ready();
  });

  afterAll(async () => {
    await app2.close();
    try { fs.unlinkSync(DB_PATH2); } catch { /* ignore */ }
  });

  it("#15 retryable failure retries once and succeeds", async () => {
    const res = await app2.inject({
      method:  "POST",
      url:     "/api/generation/submit",
      payload: { connectorId: "flaky", prompt: "test retry", type: "image" },
    });
    expect(res.statusCode).toBe(202);
    const { job: enqueuedJob } = res.json<EnqueueBody>();
    expect(enqueuedJob.status).toBe("queued");

    const completedJob = await waitForJob(app2, enqueuedJob.id, 5000);
    expect(completedJob.status).toBe("succeeded");
    expect(completedJob.attemptCount).toBe(2);
    expect(completedJob.assetId).toBeTruthy();
  });
});

describe("Generation submit non-retryable failure", () => {
  const ts3 = Date.now() + 2;
  const DB_PATH3 = path.join(os.tmpdir(), `starline-gen-nretry-${ts3}.db`);

  const nonRetryableConnector: Connector = {
    id:          "non-retryable",
    name:        "Non-Retryable Connector",
    healthCheck: async () => ({ ok: true, latencyMs: 1 }),
    generate:    async () => {
      throw Object.assign(new Error("content policy violation"), { retryable: false });
    },
  };

  let app3: ReturnType<typeof buildServer>;

  beforeAll(async () => {
    app3 = buildServer(DB_PATH3, {
      extraConnectors: new Map([["non-retryable", nonRetryableConnector]]),
      retryBaseMs:     10,
    });
    await app3.ready();
  });

  afterAll(async () => {
    await app3.close();
    try { fs.unlinkSync(DB_PATH3); } catch { /* ignore */ }
  });

  it("#16 non-retryable failure ends terminally with no retry", async () => {
    const res = await app3.inject({
      method:  "POST",
      url:     "/api/generation/submit",
      payload: { connectorId: "non-retryable", prompt: "bad content", type: "image" },
    });
    expect(res.statusCode).toBe(202);
    const { job: enqueuedJob } = res.json<EnqueueBody>();
    expect(enqueuedJob.status).toBe("queued");

    const completedJob = await waitForJob(app3, enqueuedJob.id, 3000);
    expect(completedJob.status).toBe("failed");
    expect(completedJob.errorCode).toBe("GENERATION_FAILED");
    expect(completedJob.errorMessage).toBe("content policy violation");
    expect(completedJob.attemptCount).toBe(1);
    expect(completedJob.nextRetryAt).toBeNull();
  });
});

describe("Generation retry API", () => {
  const ts4 = Date.now() + 3;
  const DB_PATH4 = path.join(os.tmpdir(), `starline-gen-manual-retry-${ts4}.db`);

  let callCount = 0;

  const manualRetryConnector: Connector = {
    id:          "manual-retry",
    name:        "Manual Retry Connector",
    healthCheck: async () => ({ ok: true, latencyMs: 1 }),
    generate:    async (input) => {
      callCount++;
      if (callCount <= 3) {
        throw new Error("temporary outage");
      }
      const filePath = path.join(os.tmpdir(), `manual-retry-${randomUUID()}.txt`);
      fs.writeFileSync(filePath, `content: ${input.prompt}`);
      return {
        filePath,
        mimeType: "text/plain",
        name:     "manual-retry-output",
        meta:     { model: "manual-retry-v1", seed: "abc", latencyMs: 1 },
      };
    },
  };

  const nonRetryableManualConnector: Connector = {
    id:          "non-retryable-manual",
    name:        "Non Retryable Manual Connector",
    healthCheck: async () => ({ ok: true, latencyMs: 1 }),
    generate:    async () => {
      throw Object.assign(new Error("content policy violation"), { retryable: false });
    },
  };

  let app4: ReturnType<typeof buildServer>;

  beforeAll(async () => {
    app4 = buildServer(DB_PATH4, {
      extraConnectors: new Map([
        ["manual-retry", manualRetryConnector],
        ["non-retryable-manual", nonRetryableManualConnector],
      ]),
      retryBaseMs: 10,
    });
    await app4.ready();
  });

  afterAll(async () => {
    await app4.close();
    try { fs.unlinkSync(DB_PATH4); } catch { /* ignore */ }
  });

  it("#17 retry endpoint requeues failed retryable job", async () => {
    const submitRes = await app4.inject({
      method:  "POST",
      url:     "/api/generation/submit",
      payload: { connectorId: "manual-retry", prompt: "try again", type: "image" },
    });
    expect(submitRes.statusCode).toBe(202);

    const { job: enqueuedJob } = submitRes.json<EnqueueBody>();
    const failedJob = await waitForJob(app4, enqueuedJob.id, 3000);
    expect(failedJob.status).toBe("failed");
    expect(failedJob.attemptCount).toBe(3);

    const retryRes = await app4.inject({
      method: "POST",
      url:    `/api/generation/${failedJob.id}/retry`,
    });
    expect(retryRes.statusCode).toBe(202);
    const retryBody = retryRes.json<EnqueueBody>();
    expect(retryBody.job.id).toBe(failedJob.id);
    expect(retryBody.job.status).toBe("queued");
    expect(retryBody.job.attemptCount).toBe(0);

    const completedJob = await waitForJob(app4, failedJob.id, 3000);
    expect(completedJob.status).toBe("succeeded");
    expect(completedJob.attemptCount).toBe(1);
    expect(completedJob.assetId).toBeTruthy();
  });

  it("#18 retry endpoint rejects non-retryable failed job", async () => {
    const submitRes = await app4.inject({
      method:  "POST",
      url:     "/api/generation/submit",
      payload: { connectorId: "non-retryable-manual", prompt: "bad content", type: "image" },
    });
    const { job: enqueuedJob } = submitRes.json<EnqueueBody>();
    const failedJob = await waitForJob(app4, enqueuedJob.id, 3000);
    expect(failedJob.status).toBe("failed");

    const retryRes = await app4.inject({
      method: "POST",
      url:    `/api/generation/${failedJob.id}/retry`,
    });
    expect(retryRes.statusCode).toBe(409);
    expect(retryRes.json<{ code: string }>().code).toBe("JOB_NOT_RETRYABLE");
  });

  it("#19 retry endpoint rejects non-failed job", async () => {
    const submitRes = await app4.inject({
      method:  "POST",
      url:     "/api/generation/submit",
      payload: { connectorId: "mock", prompt: "fresh success", type: "image" },
    });
    const { job } = submitRes.json<EnqueueBody>();

    const retryRes = await app4.inject({
      method: "POST",
      url:    `/api/generation/${job.id}/retry`,
    });
    expect(retryRes.statusCode).toBe(409);
    expect(retryRes.json<{ code: string }>().code).toBe("JOB_NOT_FAILED");
  });

  it("#20 retry endpoint returns 404 for unknown job", async () => {
    const retryRes = await app4.inject({
      method: "POST",
      url:    `/api/generation/${randomUUID()}/retry`,
    });
    expect(retryRes.statusCode).toBe(404);
    expect(retryRes.json<{ code: string }>().code).toBe("JOB_NOT_FOUND");
  });
});
