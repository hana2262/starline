import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";
import { randomUUID } from "crypto";
import { buildServer } from "../server.js";
import type { Connector } from "@starline/connectors";
import type { GenerationJob, GenerationMetricsResult } from "@starline/shared";

type JobBody = { job: GenerationJob };

async function waitForJob(
  app: ReturnType<typeof buildServer>,
  jobId: string,
  timeoutMs = 3000,
): Promise<GenerationJob> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await app.inject({ method: "GET", url: `/api/generation/${jobId}` });
    const job = res.json<JobBody>().job;
    if (job.status !== "queued" && job.status !== "running") return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
}

const ts = Date.now();
const DB_PATH = path.join(os.tmpdir(), `starline-gen-metrics-${ts}.db`);

let manualRetryCallCount = 0;
const manualRetryConnector: Connector = {
  id: "manual-metrics",
  name: "Manual Metrics Connector",
  healthCheck: async () => ({ ok: true, latencyMs: 1 }),
  generate: async (input) => {
    manualRetryCallCount++;
    if (manualRetryCallCount <= 3) {
      throw new Error("temporary outage");
    }
    const filePath = path.join(os.tmpdir(), `manual-metrics-${randomUUID()}.txt`);
    fs.writeFileSync(filePath, input.prompt);
    return {
      filePath,
      mimeType: "text/plain",
      name: "manual-metrics-output",
      meta: { model: "manual-metrics-v1", seed: "abc", latencyMs: 1 },
    };
  },
};

const nonRetryableConnector: Connector = {
  id: "non-retryable-metrics",
  name: "Non Retryable Metrics Connector",
  healthCheck: async () => ({ ok: true, latencyMs: 1 }),
  generate: async () => {
    throw Object.assign(new Error("content policy violation"), { retryable: false });
  },
};

const app = buildServer(DB_PATH, {
  extraConnectors: new Map([
    ["manual-metrics", manualRetryConnector],
    ["non-retryable-metrics", nonRetryableConnector],
  ]),
  retryBaseMs: 10,
});

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
  try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
});

describe("Generation metrics API", () => {
  it("#1 returns zeroed process metrics initially", async () => {
    const res = await app.inject({ method: "GET", url: "/api/generation/metrics" });
    expect(res.statusCode).toBe(200);
    const body = res.json<GenerationMetricsResult>();
    expect(body.scope).toBe("process");
    expect(body.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.metrics.submitted).toBe(0);
    expect(body.metrics.succeeded).toBe(0);
    expect(body.metrics.failed).toBe(0);
    expect(body.metrics.cancelled).toBe(0);
    expect(body.metrics.autoRetryCount).toBe(0);
    expect(body.metrics.manualRetryCount).toBe(0);
    expect(body.metrics.failureCodeCounts).toEqual({});
  });

  it("#2 reflects success, failure, auto retry and manual retry counts", async () => {
    const successRes = await app.inject({
      method: "POST",
      url: "/api/generation/submit",
      payload: { connectorId: "mock", prompt: "success", type: "image" },
    });
    const successJob = successRes.json<JobBody>().job;
    await waitForJob(app, successJob.id, 3000);

    const failRes = await app.inject({
      method: "POST",
      url: "/api/generation/submit",
      payload: { connectorId: "non-retryable-metrics", prompt: "fail", type: "image" },
    });
    const failedJob = await waitForJob(app, failRes.json<JobBody>().job.id, 3000);
    expect(failedJob.status).toBe("failed");

    const retryRes = await app.inject({
      method: "POST",
      url: "/api/generation/submit",
      payload: { connectorId: "manual-metrics", prompt: "retry me", type: "image" },
    });
    const retryJob = await waitForJob(app, retryRes.json<JobBody>().job.id, 3000);
    expect(retryJob.status).toBe("failed");

    const manualRetryRes = await app.inject({
      method: "POST",
      url: `/api/generation/${retryJob.id}/retry`,
    });
    expect(manualRetryRes.statusCode).toBe(202);
    await waitForJob(app, retryJob.id, 3000);

    const metricsRes = await app.inject({ method: "GET", url: "/api/generation/metrics" });
    expect(metricsRes.statusCode).toBe(200);
    const body = metricsRes.json<GenerationMetricsResult>();
    expect(body.metrics.submitted).toBe(3);
    expect(body.metrics.succeeded).toBe(2);
    expect(body.metrics.failed).toBe(2);
    expect(body.metrics.autoRetryCount).toBe(2);
    expect(body.metrics.manualRetryCount).toBe(1);
    expect(body.metrics.cancelled).toBe(0);
    expect(body.metrics.failureCodeCounts.GENERATION_FAILED).toBe(2);
    expect(body.metrics.successRate).toBeCloseTo(0.6667, 4);
    expect(body.metrics.avgDurationMs).not.toBeNull();
  });
});
