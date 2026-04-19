import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { buildServer } from "../server.js";
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

function createTempFile(name: string, contents: string): string {
  const filePath = path.join(os.tmpdir(), `${Date.now()}-${name}`);
  fs.writeFileSync(filePath, contents);
  return filePath;
}

const ts = Date.now();
const DB_PATH = path.join(os.tmpdir(), `starline-analytics-api-${ts}.db`);
const APP_ASSETS_DIR = path.join(os.tmpdir(), `starline-analytics-api-${ts}-assets`);
const TEMP_FILES: string[] = [];
const app = buildServer(DB_PATH, { retryBaseMs: 10 });

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
  for (const filePath of TEMP_FILES) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }
  try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
  try { fs.rmSync(APP_ASSETS_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe("Analytics API", () => {
  it("returns overview and usage aggregates from local events", async () => {
    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { name: "Analytics API", description: "usage and overview" },
    });
    expect(projectRes.statusCode).toBe(201);
    const projectId = projectRes.json<{ id: string }>().id;

    const promptFile = createTempFile("analytics-api-prompt.txt", "futuristic skyline");
    TEMP_FILES.push(promptFile);

    const assetRes = await app.inject({
      method: "POST",
      url: "/api/assets/import",
      payload: {
        filePath: promptFile,
        type: "prompt",
        projectId,
      },
    });
    expect(assetRes.statusCode).toBe(201);

    const agentRes = await app.inject({
      method: "POST",
      url: "/api/agent/query",
      payload: {
        projectId,
        query: "Suggest a better skyline composition",
      },
    });
    expect(agentRes.statusCode).toBe(200);

    const generationRes = await app.inject({
      method: "POST",
      url: "/api/generation/submit",
      payload: {
        connectorId: "mock",
        prompt: "generate skyline concept art",
        type: "image",
        projectId,
      },
    });
    expect(generationRes.statusCode).toBe(202);
    const jobId = generationRes.json<{ job: GenerationJob }>().job.id;
    await waitForJob(app, jobId);

    const overviewRes = await app.inject({
      method: "GET",
      url: "/api/analytics/overview",
    });
    expect(overviewRes.statusCode).toBe(200);
    const overview = overviewRes.json<{
      totals: {
        projectsCreated: number;
        assetsImported: number;
        agentQueries: number;
        generationSubmitted: number;
        generationCompleted: number;
      };
      generationByConnector: Record<string, { submitted: number; completed: number }>;
      latestEventAt: string | null;
    }>();
    expect(overview.totals.projectsCreated).toBe(1);
    expect(overview.totals.assetsImported).toBe(1);
    expect(overview.totals.agentQueries).toBe(1);
    expect(overview.totals.generationSubmitted).toBe(1);
    expect(overview.totals.generationCompleted).toBe(1);
    expect(overview.generationByConnector["mock"]).toMatchObject({
      submitted: 1,
      completed: 1,
    });
    expect(overview.latestEventAt).not.toBeNull();

    const usageRes = await app.inject({
      method: "GET",
      url: "/api/analytics/usage?from=2026-04-01T00:00:00.000Z&to=2026-04-30T23:59:59.999Z",
    });
    expect(usageRes.statusCode).toBe(200);
    const usage = usageRes.json<{
      from: string;
      to: string;
      points: Array<{
        date: string;
        projectsCreated: number;
        assetsImported: number;
        agentQueries: number;
        generationSubmitted: number;
        generationCompleted: number;
      }>;
    }>();
    expect(usage.from).toBe("2026-04-01T00:00:00.000Z");
    expect(usage.to).toBe("2026-04-30T23:59:59.999Z");
    const activePoint = usage.points.find((point) => (
      point.projectsCreated > 0
      || point.assetsImported > 0
      || point.agentQueries > 0
      || point.generationSubmitted > 0
      || point.generationCompleted > 0
    ));
    expect(activePoint).toMatchObject({
      projectsCreated: 1,
      assetsImported: 1,
      agentQueries: 1,
      generationSubmitted: 1,
      generationCompleted: 1,
    });
  });

  it("returns 400 for invalid analytics usage ranges", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/analytics/usage?from=2026-04-20T00:00:00.000Z&to=2026-04-01T00:00:00.000Z",
    });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ code: string }>().code).toBe("INVALID_RANGE");
  });
});
