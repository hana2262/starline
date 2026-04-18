import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { buildServer } from "../server.js";

const DB_PATH = path.join(os.tmpdir(), `starline-agent-${Date.now()}.db`);
const TEMP_FILES: string[] = [];
const app = buildServer(DB_PATH);

function createTempFile(name: string, contents: string): string {
  const filePath = path.join(os.tmpdir(), `${Date.now()}-${name}`);
  fs.writeFileSync(filePath, contents);
  TEMP_FILES.push(filePath);
  return filePath;
}

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
  for (const filePath of TEMP_FILES) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore cleanup failures in temp files
    }
  }
  try {
    fs.unlinkSync(DB_PATH);
  } catch {
    // ignore db cleanup failures
  }
});

describe("Agent API", () => {
  it("creates an agent session, persists messages, and returns related assets", async () => {
    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: {
        name: "Campaign Planner",
        description: "Planning assets for a sci-fi poster drop",
      },
    });
    expect(projectRes.statusCode).toBe(201);
    const projectId = projectRes.json<{ id: string }>().id;

    const promptFile = createTempFile("launch-prompt.txt", "neon astronaut cinematic poster prompt");
    const importRes = await app.inject({
      method: "POST",
      url: "/api/assets/import",
      payload: {
        filePath: promptFile,
        type: "prompt",
        projectId,
        tags: ["astronaut", "neon", "poster"],
        description: "Primary launch prompt",
      },
    });
    expect(importRes.statusCode).toBe(201);

    const queryRes = await app.inject({
      method: "POST",
      url: "/api/agent/query",
      payload: {
        projectId,
        query: "Help me refine the neon astronaut poster direction",
      },
    });

    expect(queryRes.statusCode).toBe(200);
    const queryBody = queryRes.json<{
      session: { id: string; projectId: string | null };
      userMessage: { role: string; content: string };
      assistantMessage: { role: string; relatedAssetIds: string[]; content: string };
      relatedAssets: Array<{ id: string; name: string; type: string }>;
      project: { id: string; name: string } | null;
    }>();
    expect(queryBody.session.projectId).toBe(projectId);
    expect(queryBody.userMessage.role).toBe("user");
    expect(queryBody.assistantMessage.role).toBe("assistant");
    expect(queryBody.relatedAssets).toHaveLength(1);
    expect(queryBody.assistantMessage.relatedAssetIds).toEqual([queryBody.relatedAssets[0]?.id]);
    expect(queryBody.project).toMatchObject({
      id: projectId,
      name: "Campaign Planner",
    });
    expect(queryBody.assistantMessage.content).toContain("Campaign Planner");
    expect(queryBody.assistantMessage.content).toContain("launch-prompt.txt");

    const sessionRes = await app.inject({
      method: "GET",
      url: `/api/agent/sessions/${queryBody.session.id}`,
    });
    expect(sessionRes.statusCode).toBe(200);
    const sessionBody = sessionRes.json<{
      session: { id: string };
      messages: Array<{ role: string }>;
      relatedAssets: Array<{ id: string }>;
    }>();
    expect(sessionBody.session.id).toBe(queryBody.session.id);
    expect(sessionBody.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(sessionBody.relatedAssets).toHaveLength(1);
  });

  it("returns 404 when querying against an unknown project", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agent/query",
      payload: {
        projectId: "missing-project",
        query: "Need help",
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json<{ code: string }>().code).toBe("PROJECT_NOT_FOUND");
  });

  it("returns 404 for an unknown agent session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/agent/sessions/no-such-session",
    });

    expect(res.statusCode).toBe(404);
  });
});
