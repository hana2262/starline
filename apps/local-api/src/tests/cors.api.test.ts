import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { buildServer } from "../server.js";

const ts = Date.now();
const DB_PATH = path.join(os.tmpdir(), `starline-cors-api-${ts}.db`);
const app = buildServer(DB_PATH);

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
  try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
});

describe("Local API CORS", () => {
  it("returns CORS headers for health checks", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        origin: "tauri://localhost",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["access-control-allow-methods"]).toContain("GET");
  });

  it("answers preflight requests for JSON APIs", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/agent/query",
      headers: {
        origin: "http://tauri.localhost",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
    expect(res.headers["access-control-allow-headers"]).toContain("Content-Type");
  });
});
