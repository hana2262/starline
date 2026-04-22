import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { buildServer } from "../server.js";

const DB_PATH = path.join(os.tmpdir(), `starline-agent-providers-${Date.now()}.db`);
const app = buildServer(DB_PATH);

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
  try {
    fs.unlinkSync(DB_PATH);
  } catch {}
});

describe("Agent provider APIs", () => {
  it("saves provider configs, masks secrets, and exposes the active runtime", async () => {
    const saveRes = await app.inject({
      method: "POST",
      url: "/api/agent/providers",
      payload: {
        slug: "custom-openai-compatible",
        vendor: "custom",
        protocol: "openai-compatible",
        label: "OpenAI Compatible",
        note: "",
        website: "",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-5.4-mini",
        apiKey: "secret-key",
        temperature: "0.2",
        maxOutputTokens: 512,
        isActive: true,
      },
    });

    expect(saveRes.statusCode).toBe(200);
    const saved = saveRes.json<{ item: { id: string; hasApiKey: boolean; isActive: boolean } }>().item;
    expect(saved.hasApiKey).toBe(true);
    expect(saved.isActive).toBe(true);

    const listRes = await app.inject({
      method: "GET",
      url: "/api/agent/providers",
    });

    expect(listRes.statusCode).toBe(200);
    const listed = listRes.json<{ items: Array<{ id: string; hasApiKey: boolean; isActive: boolean; apiKey?: string }> }>().items;
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(saved.id);
    expect(listed[0]?.hasApiKey).toBe(true);
    expect("apiKey" in (listed[0] ?? {})).toBe(false);

    const runtimeRes = await app.inject({
      method: "GET",
      url: "/api/agent/runtime",
    });

    expect(runtimeRes.statusCode).toBe(200);
    expect(runtimeRes.json()).toEqual({
      mode: "llm",
      vendor: "custom",
      protocol: "openai-compatible",
      model: "gpt-5.4-mini",
    });
  });

  it("tests the mock provider successfully", async () => {
    const saveRes = await app.inject({
      method: "POST",
      url: "/api/agent/providers",
      payload: {
        slug: "mock-provider",
        vendor: "mock",
        protocol: "mock",
        label: "Mock",
        note: "",
        website: "",
        baseUrl: "",
        model: "mock-agent-v1",
        temperature: "0.2",
        maxOutputTokens: 256,
        isActive: false,
      },
    });

    expect(saveRes.statusCode).toBe(200);
    const id = saveRes.json<{ item: { id: string } }>().item.id;

    const testRes = await app.inject({
      method: "POST",
      url: `/api/agent/providers/${id}/test`,
    });

    expect(testRes.statusCode).toBe(200);
    expect(testRes.json()).toMatchObject({
      ok: true,
      vendor: "mock",
      protocol: "mock",
      model: "mock-agent-v1",
    });
  });

  it("returns a configuration error when a real provider is saved without a key", async () => {
    const saveRes = await app.inject({
      method: "POST",
      url: "/api/agent/providers",
      payload: {
        slug: "missing-key",
        vendor: "custom",
        protocol: "openai-compatible",
        label: "Missing Key",
        note: "",
        website: "",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-5.4-mini",
        temperature: "0.2",
        maxOutputTokens: 256,
        isActive: false,
      },
    });

    expect(saveRes.statusCode).toBe(400);
    expect(saveRes.json<{ code: string }>().code).toBe("SECRET_REQUIRED");
  });

  it("surfaces provider test failures without exposing the secret", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("unauthorized", { status: 401 }),
    );
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", fetchMock);

    try {
      const saveRes = await app.inject({
        method: "POST",
        url: "/api/agent/providers",
        payload: {
          slug: "broken-openai-compatible",
          vendor: "custom",
          protocol: "openai-compatible",
          label: "Broken OpenAI Compatible",
          note: "",
          website: "",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-5.4-mini",
          apiKey: "super-secret",
          temperature: "0.2",
          maxOutputTokens: 256,
          isActive: false,
        },
      });

      expect(saveRes.statusCode).toBe(200);
      const id = saveRes.json<{ item: { id: string } }>().item.id;

      const testRes = await app.inject({
        method: "POST",
        url: `/api/agent/providers/${id}/test`,
      });

      expect(testRes.statusCode).toBe(200);
      const body = testRes.json<{ ok: boolean; error?: string }>();
      expect(body.ok).toBe(false);
      expect(body.error).toContain("request failed");
      expect(body.error).not.toContain("super-secret");
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }
  });

  it("deletes a non-active provider", async () => {
    const saveRes = await app.inject({
      method: "POST",
      url: "/api/agent/providers",
      payload: {
        slug: "delete-me",
        vendor: "custom",
        protocol: "openai-compatible",
        label: "Delete Me",
        note: "",
        website: "",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-5.4-mini",
        apiKey: "secret-key",
        temperature: "0.2",
        maxOutputTokens: 128,
        isActive: false,
      },
    });

    expect(saveRes.statusCode).toBe(200);
    const id = saveRes.json<{ item: { id: string } }>().item.id;

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/agent/providers/${id}`,
    });

    expect(deleteRes.statusCode).toBe(204);

    const listRes = await app.inject({
      method: "GET",
      url: "/api/agent/providers",
    });
    expect(listRes.statusCode).toBe(200);
    const items = listRes.json<{ items: Array<{ id: string }> }>().items;
    expect(items.some((item) => item.id === id)).toBe(false);
  });

  it("blocks deleting the active provider", async () => {
    const saveRes = await app.inject({
      method: "POST",
      url: "/api/agent/providers",
      payload: {
        slug: "active-provider",
        vendor: "mock",
        protocol: "mock",
        label: "Active Mock",
        note: "",
        website: "",
        baseUrl: "",
        model: "mock-agent-v1",
        temperature: "0.2",
        maxOutputTokens: 128,
        isActive: true,
      },
    });

    expect(saveRes.statusCode).toBe(200);
    const id = saveRes.json<{ item: { id: string } }>().item.id;

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/agent/providers/${id}`,
    });

    expect(deleteRes.statusCode).toBe(409);
    expect(deleteRes.json<{ code: string }>().code).toBe("ACTIVE_PROVIDER_DELETE_BLOCKED");
  });
});
