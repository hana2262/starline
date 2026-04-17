import { describe, it, expect, afterEach } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";
import { randomUUID } from "crypto";
import { buildServer } from "../server.js";
import type { GenerationJob } from "@starline/shared";
import type { Connector } from "@starline/connectors";

type JobBody = { job: GenerationJob };

async function waitForJobState(
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
  throw new Error(`Job ${jobId} did not reach ${statuses.join(",")} within ${timeoutMs}ms`);
}

function makeBlockingConnector(
  id: string,
  onStart: () => void,
  waitForRelease: () => Promise<void>,
): Connector {
  return {
    id,
    name: `${id} connector`,
    healthCheck: async () => ({ ok: true, latencyMs: 1 }),
    generate: async (input) => {
      onStart();
      await waitForRelease();
      const filePath = path.join(os.tmpdir(), `${id}-${randomUUID()}.txt`);
      fs.writeFileSync(filePath, input.prompt);
      return {
        filePath,
        mimeType: "text/plain",
        name: `${id}-output`,
        meta: { model: `${id}-v1`, seed: "abc", latencyMs: 1 },
      };
    },
  };
}

afterEach(() => {
  delete process.env["GENERATION_CONCURRENCY"];
});

describe("Generation concurrency configuration", () => {
  it("uses env concurrency=2 to run two jobs in parallel", async () => {
    process.env["GENERATION_CONCURRENCY"] = "2";
    const ts = Date.now();
    const dbPath = path.join(os.tmpdir(), `starline-gen-concurrency-two-${ts}.db`);
    let started = 0;
    let release!: () => void;
    const releasePromise = new Promise<void>((resolve) => { release = resolve; });
    const connector = makeBlockingConnector("parallel", () => { started++; }, () => releasePromise);
    const app = buildServer(dbPath, {
      extraConnectors: new Map([["parallel", connector]]),
      retryBaseMs: 10,
    });

    await app.ready();
    try {
      const [submit1, submit2] = await Promise.all([
        app.inject({ method: "POST", url: "/api/generation/submit", payload: { connectorId: "parallel", prompt: "job-1", type: "image" } }),
        app.inject({ method: "POST", url: "/api/generation/submit", payload: { connectorId: "parallel", prompt: "job-2", type: "image" } }),
      ]);

      const job1 = submit1.json<JobBody>().job;
      const job2 = submit2.json<JobBody>().job;

      const deadline = Date.now() + 1000;
      while (started < 2 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(started).toBe(2);

      const [running1, running2] = await Promise.all([
        waitForJobState(app, job1.id, ["running"]),
        waitForJobState(app, job2.id, ["running"]),
      ]);
      expect(running1.status).toBe("running");
      expect(running2.status).toBe("running");

      release();
      await Promise.all([
        waitForJobState(app, job1.id, ["succeeded"]),
        waitForJobState(app, job2.id, ["succeeded"]),
      ]);
    } finally {
      await app.close();
      try { fs.unlinkSync(dbPath); } catch { /* ignore */ }
    }
  });

  it("falls back to serial execution for invalid env values", async () => {
    process.env["GENERATION_CONCURRENCY"] = "9";
    const ts = Date.now() + 1;
    const dbPath = path.join(os.tmpdir(), `starline-gen-concurrency-invalid-${ts}.db`);
    let started = 0;
    let release!: () => void;
    const releasePromise = new Promise<void>((resolve) => { release = resolve; });
    const connector = makeBlockingConnector("serial", () => { started++; }, () => releasePromise);
    const app = buildServer(dbPath, {
      extraConnectors: new Map([["serial", connector]]),
      retryBaseMs: 10,
    });

    await app.ready();
    try {
      const [submit1, submit2] = await Promise.all([
        app.inject({ method: "POST", url: "/api/generation/submit", payload: { connectorId: "serial", prompt: "job-1", type: "image" } }),
        app.inject({ method: "POST", url: "/api/generation/submit", payload: { connectorId: "serial", prompt: "job-2", type: "image" } }),
      ]);
      const job1 = submit1.json<JobBody>().job;
      const job2 = submit2.json<JobBody>().job;

      const running1 = await waitForJobState(app, job1.id, ["running"]);
      expect(running1.status).toBe("running");
      expect(started).toBe(1);

      const job2BeforeRelease = await app.inject({ method: "GET", url: `/api/generation/${job2.id}` });
      expect(job2BeforeRelease.json<JobBody>().job.status).toBe("queued");

      release();
      await waitForJobState(app, job2.id, ["running", "failed", "succeeded"], 3000);
    } finally {
      await app.close();
      try { fs.unlinkSync(dbPath); } catch { /* ignore */ }
    }
  });
});
