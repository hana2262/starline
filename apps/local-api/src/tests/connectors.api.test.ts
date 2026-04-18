import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { buildServer } from "../server.js";

describe("Connector config API", () => {
  const tempPaths: string[] = [];

  afterEach(() => {
    delete process.env["MINIMAX_API_KEY"];
    delete process.env["STABLE_DIFFUSION_BASE_URL"];
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    for (const dbPath of tempPaths) {
      try {
        fs.unlinkSync(dbPath);
      } catch {
        // ignore
      }
    }
  });

  it("persists stable-diffusion config across restart and registers connector from db", async () => {
    const dbPath = path.join(os.tmpdir(), `starline-connectors-${Date.now()}.db`);
    tempPaths.push(dbPath);
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal("fetch", fetchMock as typeof globalThis.fetch);

    let app = buildServer(dbPath);
    await app.ready();

    const saveRes = await app.inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        connectorId: "stable-diffusion",
        enabled: true,
        config: { baseUrl: "http://127.0.0.1:7860" },
      },
    });
    expect(saveRes.statusCode).toBe(200);
    expect(saveRes.json<{ item: { connectorId: string; source: string; config: { baseUrl: string } } }>().item).toMatchObject({
      connectorId: "stable-diffusion",
      source: "db",
      config: { baseUrl: "http://127.0.0.1:7860" },
    });

    await app.close();

    app = buildServer(dbPath);
    await app.ready();

    const listRes = await app.inject({ method: "GET", url: "/api/connectors" });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json<{ items: Array<{ connectorId: string; source: string; enabled: boolean }> }>().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          connectorId: "stable-diffusion",
          source: "db",
          enabled: true,
        }),
      ]),
    );

    const healthRes = await app.inject({ method: "POST", url: "/api/connectors/stable-diffusion/test" });
    expect(healthRes.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:7860/sdapi/v1/options",
      expect.objectContaining({ method: "GET" }),
    );

    await app.close();
  });

  it("lists env-backed minimax config without exposing the api key", async () => {
    const dbPath = path.join(os.tmpdir(), `starline-connectors-env-${Date.now()}.db`);
    tempPaths.push(dbPath);
    process.env["MINIMAX_API_KEY"] = "env-test-key";

    const app = buildServer(dbPath);
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/api/connectors" });
    expect(res.statusCode).toBe(200);
    expect(res.json<{
      items: Array<{
        connectorId: string;
        source: string;
        enabled: boolean;
        config: Record<string, unknown>;
        hasSensitiveConfig: boolean;
        hasStoredSecret: boolean;
      }>;
    }>().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        connectorId: "minimax",
        source: "env",
        enabled: true,
        config: {},
        hasSensitiveConfig: true,
        hasStoredSecret: true,
      }),
    ]));

    await app.close();
  });

  it("persists minimax api key without returning plaintext and uses it for connector test", async () => {
    const dbPath = path.join(os.tmpdir(), `starline-connectors-minimax-${Date.now()}.db`);
    tempPaths.push(dbPath);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock as typeof globalThis.fetch);

    let app = buildServer(dbPath);
    await app.ready();

    const saveRes = await app.inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        connectorId: "minimax",
        enabled: true,
        config: { apiKey: "saved-api-key" },
      },
    });
    expect(saveRes.statusCode).toBe(200);
    expect(saveRes.json<{
      item: {
        connectorId: string;
        source: string;
        config: Record<string, unknown>;
        hasSensitiveConfig: boolean;
        hasStoredSecret: boolean;
      };
    }>().item).toMatchObject({
      connectorId: "minimax",
      source: "db",
      config: {},
      hasSensitiveConfig: true,
      hasStoredSecret: true,
    });

    await app.close();

    app = buildServer(dbPath);
    await app.ready();

    const listRes = await app.inject({ method: "GET", url: "/api/connectors" });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json<{
      items: Array<{
        connectorId: string;
        source: string;
        config: Record<string, unknown>;
        hasStoredSecret: boolean;
      }>;
    }>().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        connectorId: "minimax",
        source: "db",
        config: {},
        hasStoredSecret: true,
      }),
    ]));

    const healthRes = await app.inject({ method: "POST", url: "/api/connectors/minimax/test" });
    expect(healthRes.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.minimax.io/v1/models",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer saved-api-key",
        }),
      }),
    );

    await app.close();
  });

  it("keeps stored minimax secret when saving enabled state without a new api key", async () => {
    const dbPath = path.join(os.tmpdir(), `starline-connectors-minimax-toggle-${Date.now()}.db`);
    tempPaths.push(dbPath);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock as typeof globalThis.fetch);

    let app = buildServer(dbPath);
    await app.ready();

    const initialSave = await app.inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        connectorId: "minimax",
        enabled: true,
        config: { apiKey: "persist-me" },
      },
    });
    expect(initialSave.statusCode).toBe(200);

    const toggleSave = await app.inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        connectorId: "minimax",
        enabled: false,
        config: {},
      },
    });
    expect(toggleSave.statusCode).toBe(200);
    await app.close();

    app = buildServer(dbPath);
    await app.ready();

    const listRes = await app.inject({ method: "GET", url: "/api/connectors" });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json<{
      items: Array<{
        connectorId: string;
        enabled: boolean;
        hasStoredSecret: boolean;
      }>;
    }>().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        connectorId: "minimax",
        enabled: false,
        hasStoredSecret: true,
      }),
    ]));

    const healthRes = await app.inject({ method: "POST", url: "/api/connectors/minimax/test" });
    expect(healthRes.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();

    await app.close();
  });

  it("lets persisted disabled state override env fallback registration", async () => {
    const dbPath = path.join(os.tmpdir(), `starline-connectors-disabled-${Date.now()}.db`);
    tempPaths.push(dbPath);
    process.env["STABLE_DIFFUSION_BASE_URL"] = "http://127.0.0.1:7860";
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal("fetch", fetchMock as typeof globalThis.fetch);

    let app = buildServer(dbPath);
    await app.ready();
    const saveRes = await app.inject({
      method: "POST",
      url: "/api/connectors",
      payload: {
        connectorId: "stable-diffusion",
        enabled: false,
        config: { baseUrl: "http://127.0.0.1:7860" },
      },
    });
    expect(saveRes.statusCode).toBe(200);
    await app.close();

    app = buildServer(dbPath);
    await app.ready();

    const listRes = await app.inject({ method: "GET", url: "/api/connectors" });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json<{ items: Array<{ connectorId: string; source: string; enabled: boolean }> }>().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          connectorId: "stable-diffusion",
          source: "db",
          enabled: false,
        }),
      ]),
    );

    const healthRes = await app.inject({ method: "POST", url: "/api/connectors/stable-diffusion/test" });
    expect(healthRes.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();

    await app.close();
  });
});
