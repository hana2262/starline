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
    } catch {}
  }
  try {
    fs.unlinkSync(DB_PATH);
  } catch {}
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
      agentRuntime: { mode: string; vendor: string | null; protocol: string | null; model: string | null };
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
    expect(queryBody.agentRuntime).toEqual({
      mode: "llm",
      vendor: "mock",
      protocol: "mock",
      model: "mock-agent-v1",
    });
    expect(queryBody.assistantMessage.content).toContain("Help me refine the neon astronaut poster direction");

    const sessionRes = await app.inject({
      method: "GET",
      url: `/api/agent/sessions/${queryBody.session.id}`,
    });
    expect(sessionRes.statusCode).toBe(200);
    const sessionBody = sessionRes.json<{
      session: { id: string };
      messages: Array<{ role: string }>;
      relatedAssets: Array<{ id: string }>;
      agentRuntime: { mode: string; vendor: string | null; protocol: string | null; model: string | null };
    }>();
    expect(sessionBody.session.id).toBe(queryBody.session.id);
    expect(sessionBody.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(sessionBody.relatedAssets).toHaveLength(1);
    expect(sessionBody.agentRuntime.mode).toBe("llm");
  });

  it("filters private assets and private projects out of default agent retrieval", async () => {
    const privateProjectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: {
        name: "Private Lab",
        description: "Sensitive iteration space",
        visibility: "private",
      },
    });
    expect(privateProjectRes.statusCode).toBe(201);
    const privateProjectId = privateProjectRes.json<{ id: string }>().id;

    const privateAssetFile = createTempFile("private-notes.txt", "secret cinematic prompt notes");
    const privateImportRes = await app.inject({
      method: "POST",
      url: "/api/assets/import",
      payload: {
        filePath: privateAssetFile,
        type: "prompt",
        projectId: privateProjectId,
        visibility: "private",
        tags: ["secret", "cinematic"],
        description: "Private prompt notes",
      },
    });
    expect(privateImportRes.statusCode).toBe(201);

    const publicAssetFile = createTempFile("public-brief.txt", "public skyline prompt brief");
    const publicImportRes = await app.inject({
      method: "POST",
      url: "/api/assets/import",
      payload: {
        filePath: publicAssetFile,
        type: "prompt",
        tags: ["skyline", "public"],
        description: "Public prompt notes",
      },
    });
    expect(publicImportRes.statusCode).toBe(201);

    const res = await app.inject({
      method: "POST",
      url: "/api/agent/query",
      payload: {
        projectId: privateProjectId,
        query: "Need help with secret cinematic prompt notes",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      relatedAssets: Array<{ name: string }>;
      project: { id: string } | null;
      assistantMessage: { content: string };
    }>();
    expect(body.project).toBeNull();
    expect(body.relatedAssets.some((asset) => asset.name.includes("private-notes"))).toBe(false);
    expect(body.assistantMessage.content).not.toContain("Private Lab");
  });

  it("allows private retrieval only for the current query when explicitly authorized", async () => {
    const privateProjectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: {
        name: "Authorized Lab",
        description: "Private project for temporary agent access",
        visibility: "private",
      },
    });
    expect(privateProjectRes.statusCode).toBe(201);
    const privateProjectId = privateProjectRes.json<{ id: string }>().id;

    const privateAssetFile = createTempFile("authorized-private.txt", "hidden prompt material for authorized query");
    const privateImportRes = await app.inject({
      method: "POST",
      url: "/api/assets/import",
      payload: {
        filePath: privateAssetFile,
        type: "prompt",
        projectId: privateProjectId,
        visibility: "private",
        tags: ["authorized", "hidden"],
        description: "Hidden prompt material",
      },
    });
    expect(privateImportRes.statusCode).toBe(201);

    const authorizedRes = await app.inject({
      method: "POST",
      url: "/api/agent/query",
      payload: {
        projectId: privateProjectId,
        allowPrivateForThisQuery: true,
        query: "Use the hidden prompt material",
      },
    });

    expect(authorizedRes.statusCode).toBe(200);
    const authorizedBody = authorizedRes.json<{
      relatedAssets: Array<{ name: string }>;
      project: { id: string; name: string } | null;
      assistantMessage: { content: string };
    }>();
    expect(authorizedBody.project).toMatchObject({
      id: privateProjectId,
      name: "Authorized Lab",
    });
    expect(authorizedBody.relatedAssets.some((asset) => asset.name.includes("authorized-private"))).toBe(true);
    expect(authorizedBody.assistantMessage.content).toContain("Authorized Lab");

    const defaultRes = await app.inject({
      method: "POST",
      url: "/api/agent/query",
      payload: {
        projectId: privateProjectId,
        query: "Use the hidden prompt material",
      },
    });

    expect(defaultRes.statusCode).toBe(200);
    const defaultBody = defaultRes.json<{
      relatedAssets: Array<{ name: string }>;
      project: { id: string; name: string } | null;
      assistantMessage: { content: string };
    }>();
    expect(defaultBody.project).toBeNull();
    expect(defaultBody.relatedAssets.some((asset) => asset.name.includes("authorized-private"))).toBe(false);
    expect(defaultBody.assistantMessage.content).not.toContain("Authorized Lab");
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

  it("lists persisted sessions ordered by most recent update", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/api/agent/query",
      payload: {
        query: "first session",
      },
    });
    expect(first.statusCode).toBe(200);
    const firstSessionId = first.json<{ session: { id: string } }>().session.id;

    const second = await app.inject({
      method: "POST",
      url: "/api/agent/query",
      payload: {
        query: "second session",
      },
    });
    expect(second.statusCode).toBe(200);
    const secondSessionId = second.json<{ session: { id: string } }>().session.id;

    const listRes = await app.inject({
      method: "GET",
      url: "/api/agent/sessions",
    });

    expect(listRes.statusCode).toBe(200);
    const body = listRes.json<{ sessions: Array<{ id: string }> }>();
    expect(body.sessions.length).toBeGreaterThanOrEqual(2);
    expect(body.sessions[0]?.id).toBe(secondSessionId);
    expect(body.sessions.some((session) => session.id === firstSessionId)).toBe(true);
  });
});
