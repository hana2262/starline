import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../server.js";
import path from "path";
import os from "os";
import fs from "fs";

const DB_PATH = path.join(os.tmpdir(), `starline-test-${Date.now()}.db`);
const app = buildServer(DB_PATH);

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
  try { fs.unlinkSync(DB_PATH); } catch {}
});

describe("Project API", () => {
  let projectId: string;

  it("POST /api/projects — creates a project", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { name: "Test Project", description: "A test" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ id: string; name: string; status: string }>();
    expect(body.name).toBe("Test Project");
    expect(body.status).toBe("active");
    projectId = body.id;
  });

  it("GET /api/projects — lists projects", async () => {
    const res = await app.inject({ method: "GET", url: "/api/projects" });
    expect(res.statusCode).toBe(200);
    const body = res.json<unknown[]>();
    expect(body.length).toBeGreaterThan(0);
  });

  it("GET /api/projects/:id — returns project", async () => {
    const res = await app.inject({ method: "GET", url: `/api/projects/${projectId}` });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ id: string }>().id).toBe(projectId);
  });

  it("PATCH /api/projects/:id — updates project", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/projects/${projectId}`,
      payload: { name: "Renamed" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ name: string }>().name).toBe("Renamed");
  });

  it("POST /api/projects/:id/archive — archives project", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/archive`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ status: string }>().status).toBe("archived");
  });

  it("GET /api/projects/:id — 404 for missing", async () => {
    const res = await app.inject({ method: "GET", url: "/api/projects/no-such-id" });
    expect(res.statusCode).toBe(404);
  });

  it("POST /api/projects — 400 on invalid input", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { name: "" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /health — returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ status: string }>().status).toBe("ok");
  });
});
