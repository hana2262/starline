import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { buildServer } from "../server.js";
import { createEventRepository, getDb } from "@starline/storage";
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
const DB_PATH = path.join(os.tmpdir(), `starline-events-${ts}.db`);
const APP_ASSETS_DIR = path.join(os.tmpdir(), `starline-events-${ts}-assets`);
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

describe("Analytics event ingestion", () => {
  it("records project, asset, agent, and generation events in the local events table", async () => {
    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { name: "Event Coverage", description: "Validate analytics writes" },
    });
    expect(projectRes.statusCode).toBe(201);
    const project = projectRes.json<{ id: string }>();

    const promptFile = createTempFile("event-prompt.txt", "neon skyline prompt");
    TEMP_FILES.push(promptFile);

    const assetRes = await app.inject({
      method: "POST",
      url: "/api/assets/import",
      payload: {
        filePath: promptFile,
        type: "prompt",
        projectId: project.id,
        tags: ["neon", "skyline"],
      },
    });
    expect(assetRes.statusCode).toBe(201);
    const importedAsset = assetRes.json<{ asset: { id: string } }>().asset;

    const agentRes = await app.inject({
      method: "POST",
      url: "/api/agent/query",
      payload: {
        projectId: project.id,
        query: "Help me refine the neon skyline prompt",
      },
    });
    expect(agentRes.statusCode).toBe(200);
    const agentBody = agentRes.json<{ session: { id: string } }>();

    const generationRes = await app.inject({
      method: "POST",
      url: "/api/generation/submit",
      payload: {
        connectorId: "mock",
        prompt: "generate a neon skyline poster",
        type: "image",
        projectId: project.id,
      },
    });
    expect(generationRes.statusCode).toBe(202);
    const generationJob = generationRes.json<{ job: GenerationJob }>().job;

    const completedJob = await waitForJob(app, generationJob.id);
    expect(completedJob.status).toBe("succeeded");

    const eventRepo = createEventRepository(getDb(DB_PATH));
    const events = eventRepo.list();
    const eventTypes = events.map((event) => event.eventType);

    expect(eventTypes).toEqual(expect.arrayContaining([
      "project.created",
      "asset.imported",
      "agent.queried",
      "generation.submitted",
      "generation.completed",
    ]));

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventType: "project.created",
        entityType: "project",
        entityId: project.id,
        projectId: project.id,
      }),
      expect.objectContaining({
        eventType: "asset.imported",
        entityType: "asset",
        entityId: importedAsset.id,
        projectId: project.id,
        payload: expect.objectContaining({
          source: "manual_import",
          type: "prompt",
        }),
      }),
      expect.objectContaining({
        eventType: "agent.queried",
        entityType: "agent_session",
        entityId: agentBody.session.id,
        projectId: project.id,
      }),
      expect.objectContaining({
        eventType: "generation.submitted",
        entityType: "generation",
        entityId: generationJob.id,
        projectId: project.id,
        payload: expect.objectContaining({
          connectorId: "mock",
          type: "image",
        }),
      }),
      expect.objectContaining({
        eventType: "generation.completed",
        entityType: "generation",
        entityId: generationJob.id,
        projectId: project.id,
        payload: expect.objectContaining({
          connectorId: "mock",
          assetId: completedJob.assetId,
        }),
      }),
    ]));
  });
});
