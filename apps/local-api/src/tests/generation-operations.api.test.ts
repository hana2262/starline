import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import path from "path";
import os from "os";
import fs from "fs";
import { buildServer } from "../server.js";
import type { GenerationJob } from "@starline/shared";
import type { Connector } from "@starline/connectors";
import { createGenerationRepository, getDb, getSqlite } from "@starline/storage";

type JobBody = { job: GenerationJob };
type ListBody = { items: GenerationJob[]; nextCursor: string | null };

async function waitForStatus(
  app: ReturnType<typeof buildServer>,
  jobId: string,
  statuses: GenerationJob["status"][],
  timeoutMs = 3000,
): Promise<GenerationJob> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await app.inject({ method: "GET", url: `/api/generation/${jobId}` });
    const job = res.json<JobBody>().job;
    if (statuses.includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Job ${jobId} did not reach one of [${statuses.join(", ")}] within ${timeoutMs}ms`);
}

const ts = Date.now();
const DB_PATH = path.join(os.tmpdir(), `starline-gen-ops-${ts}.db`);

let releaseSlowGenerate: (() => void) | undefined;

const slowConnector: Connector = {
  id: "slow",
  name: "Slow Connector",
  healthCheck: async () => ({ ok: true, latencyMs: 1 }),
  generate: async (input) => {
    await new Promise<void>((resolve) => {
      releaseSlowGenerate = resolve;
    });
    const filePath = path.join(os.tmpdir(), `slow-${randomUUID()}.txt`);
    fs.writeFileSync(filePath, `content: ${input.prompt}`);
    return {
      filePath,
      mimeType: "text/plain",
      name: "slow-output",
      meta: { model: "slow-v1", seed: "abc", latencyMs: 1 },
    };
  },
};

const app = buildServer(DB_PATH, {
  extraConnectors: new Map([["slow", slowConnector]]),
  retryBaseMs: 10,
});

const repo = createGenerationRepository(getDb(DB_PATH));
const sqlite = getSqlite();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  releaseSlowGenerate?.();
  await app.close();
  try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
});

describe("Generation cancel API", () => {
  it("#1 queued job cancels terminally", async () => {
    const job = repo.create({
      connectorId: "mock",
      prompt: "cancel queued",
      type: "image",
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/generation/${job.id}/cancel`,
    });

    expect(res.statusCode).toBe(202);
    const body = res.json<JobBody>();
    expect(body.job.status).toBe("cancelled");
    expect(body.job.cancelReason).toBe("user_requested");
    expect(body.job.cancelledAt).not.toBeNull();
  });

  it("#2 running job becomes cancelling and later cancelled", async () => {
    const submitRes = await app.inject({
      method: "POST",
      url: "/api/generation/submit",
      payload: { connectorId: "slow", prompt: "cancel running", type: "image" },
    });
    expect(submitRes.statusCode).toBe(202);
    const submitted = submitRes.json<JobBody>().job;

    const runningJob = await waitForStatus(app, submitted.id, ["running"], 3000);
    expect(runningJob.status).toBe("running");

    const cancelRes = await app.inject({
      method: "POST",
      url: `/api/generation/${submitted.id}/cancel`,
    });
    expect(cancelRes.statusCode).toBe(202);
    expect(cancelRes.json<JobBody>().job.status).toBe("cancelling");

    const cancelAgainRes = await app.inject({
      method: "POST",
      url: `/api/generation/${submitted.id}/cancel`,
    });
    expect(cancelAgainRes.statusCode).toBe(202);
    expect(cancelAgainRes.json<JobBody>().job.status).toBe("cancelling");

    releaseSlowGenerate?.();
    releaseSlowGenerate = undefined;

    const cancelledJob = await waitForStatus(app, submitted.id, ["cancelled"], 3000);
    expect(cancelledJob.status).toBe("cancelled");
    expect(cancelledJob.cancelReason).toBe("user_requested");
    expect(cancelledJob.assetId).toBeNull();
  });

  it("#3 terminal job cannot be cancelled", async () => {
    const submitRes = await app.inject({
      method: "POST",
      url: "/api/generation/submit",
      payload: { connectorId: "mock", prompt: "finish first", type: "image" },
    });
    const submitted = submitRes.json<JobBody>().job;
    const completed = await waitForStatus(app, submitted.id, ["succeeded"], 3000);
    expect(completed.status).toBe("succeeded");

    const cancelRes = await app.inject({
      method: "POST",
      url: `/api/generation/${submitted.id}/cancel`,
    });
    expect(cancelRes.statusCode).toBe(409);
    expect(cancelRes.json<{ code: string }>().code).toBe("JOB_NOT_CANCELLABLE");
  });

  it("#4 unknown job returns 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/generation/${randomUUID()}/cancel`,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json<{ code: string }>().code).toBe("JOB_NOT_FOUND");
  });
});

describe("Generation list API", () => {
  it("#5 defaults to limit=20 and filters by status/connectorId/projectId", async () => {
    const createdIds: string[] = [];
    for (let index = 0; index < 22; index++) {
      const job = repo.create({
        connectorId: index % 2 === 0 ? "mock" : "alt",
        prompt: `list-${index}`,
        type: "image",
        projectId: index % 3 === 0 ? "proj-a" : "proj-b",
      });
      createdIds.push(job.id);
      if (index % 4 === 0) {
        repo.markFailed(job.id, "GENERATION_FAILED", "boom", true);
      }
    }

    const defaultRes = await app.inject({
      method: "GET",
      url: "/api/generation",
    });
    expect(defaultRes.statusCode).toBe(200);
    const defaultBody = defaultRes.json<ListBody>();
    expect(defaultBody.items).toHaveLength(20);
    expect(defaultBody.nextCursor).toBeTruthy();

    const filteredRes = await app.inject({
      method: "GET",
      url: "/api/generation?status=failed&connectorId=mock&projectId=proj-a&limit=100",
    });
    expect(filteredRes.statusCode).toBe(200);
    const filteredBody = filteredRes.json<ListBody>();
    expect(filteredBody.items.length).toBeGreaterThan(0);
    expect(filteredBody.items.every((item) =>
      item.status === "failed" && item.connectorId === "mock" && item.projectId === "proj-a"
    )).toBe(true);
  });

  it("#6 paginates stably by createdAt desc with id tie-breaker", async () => {
    const sameCreatedAt = "2026-04-17T12:00:00.000Z";
    const jobA = repo.create({
      id: "job-a",
      connectorId: "stable",
      prompt: "stable-a",
      type: "image",
    });
    const jobB = repo.create({
      id: "job-b",
      connectorId: "stable",
      prompt: "stable-b",
      type: "image",
    });

    sqlite.prepare("update generations set created_at = ? where id = ?").run(sameCreatedAt, jobA.id);
    sqlite.prepare("update generations set created_at = ? where id = ?").run(sameCreatedAt, jobB.id);

    const firstRes = await app.inject({
      method: "GET",
      url: "/api/generation?connectorId=stable&limit=1",
    });
    expect(firstRes.statusCode).toBe(200);
    const firstBody = firstRes.json<ListBody>();
    expect(firstBody.items).toHaveLength(1);
    expect(firstBody.nextCursor).toBeTruthy();

    const secondRes = await app.inject({
      method: "GET",
      url: `/api/generation?connectorId=stable&limit=1&cursor=${encodeURIComponent(firstBody.nextCursor!)}`,
    });
    expect(secondRes.statusCode).toBe(200);
    const secondBody = secondRes.json<ListBody>();
    expect([firstBody.items[0]!.id, secondBody.items[0]!.id]).toContain("job-a");
    expect([firstBody.items[0]!.id, secondBody.items[0]!.id]).toContain("job-b");
    expect(firstBody.items[0]!.id).toBe("job-b");
    expect(secondBody.items[0]!.id).toBe("job-a");
  });

  it("#7 rejects invalid list queries", async () => {
    const tooLargeRes = await app.inject({
      method: "GET",
      url: "/api/generation?limit=101",
    });
    expect(tooLargeRes.statusCode).toBe(400);

    const badCursorRes = await app.inject({
      method: "GET",
      url: "/api/generation?cursor=not-valid",
    });
    expect(badCursorRes.statusCode).toBe(400);
    expect(badCursorRes.json<{ code: string }>().code).toBe("INVALID_QUERY");
  });
});
