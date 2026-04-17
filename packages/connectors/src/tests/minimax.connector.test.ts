import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "fs";
import { MinimaxConnector } from "../minimax.connector.js";

const writtenFiles: string[] = [];

afterEach(() => {
  for (const f of writtenFiles.splice(0)) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
  vi.restoreAllMocks();
});

// ── fetch mock helpers ─────────────────────────────────────────────────────────

type MockResponse = Partial<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  headers: { get: (key: string) => string | null };
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

function makeGenFetch(imgFetch: MockResponse = {}): ReturnType<typeof vi.fn> {
  const genResponse: MockResponse = {
    ok: true, status: 200,
    json: () => Promise.resolve({
      data:      { image_urls: ["http://fake-cdn/img.png"] },
      base_resp: { status_code: 0, status_msg: "success" },
    }),
  };
  const imgResponse: MockResponse = {
    ok: true,
    headers: { get: (k: string) => k === "content-type" ? "image/png" : null },
    arrayBuffer: () => Promise.resolve(new Uint8Array([137, 80, 78, 71]).buffer),
    ...imgFetch,
  };
  return vi.fn()
    .mockResolvedValueOnce(genResponse)
    .mockResolvedValueOnce(imgResponse);
}

// ── healthCheck ────────────────────────────────────────────────────────────────

describe("MinimaxConnector.healthCheck", () => {
  it("returns ok:true when models endpoint returns HTTP 200", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const c     = new MinimaxConnector("key", fetch as typeof globalThis.fetch);
    const r     = await c.healthCheck();
    expect(r.ok).toBe(true);
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("returns ok:false when models endpoint returns HTTP 401", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    const c     = new MinimaxConnector("key", fetch as typeof globalThis.fetch);
    const r     = await c.healthCheck();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/authentication/i);
  });

  it("returns ok:false when fetch throws (network error)", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const c     = new MinimaxConnector("key", fetch as typeof globalThis.fetch);
    const r     = await c.healthCheck();
    expect(r.ok).toBe(false);
    expect(r.error).toContain("ECONNREFUSED");
  });

  it("falls back to key-presence when models endpoint returns 404", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const c     = new MinimaxConnector("non-empty-key", fetch as typeof globalThis.fetch);
    const r     = await c.healthCheck();
    expect(r.ok).toBe(true); // key is present → ok
  });
});

// ── generate ──────────────────────────────────────────────────────────────────

describe("MinimaxConnector.generate", () => {
  it("calls the generation endpoint with correct URL and headers", async () => {
    const fetch = makeGenFetch();
    const c = new MinimaxConnector("my-api-key", fetch as typeof globalThis.fetch);
    const out = await c.generate({ prompt: "a glowing neon cat", type: "image" });
    writtenFiles.push(out.filePath);

    expect(fetch).toHaveBeenCalledWith(
      "https://api.minimax.io/v1/image_generation",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer my-api-key" }),
      }),
    );
    const body = JSON.parse((fetch.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.model).toBe("image-01");
    expect(body.prompt).toBe("a glowing neon cat");
  });

  it("downloads the image_urls[0] URL and writes a file to tmpdir", async () => {
    const fetch = makeGenFetch();
    const c = new MinimaxConnector("key", fetch as typeof globalThis.fetch);
    const out = await c.generate({ prompt: "test", type: "image" });
    writtenFiles.push(out.filePath);

    // Second fetch call should be the image download
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]![0]).toBe("http://fake-cdn/img.png");
  });

  it("written file exists on disk", async () => {
    const fetch = makeGenFetch();
    const c = new MinimaxConnector("key", fetch as typeof globalThis.fetch);
    const out = await c.generate({ prompt: "test", type: "image" });
    writtenFiles.push(out.filePath);

    expect(fs.existsSync(out.filePath)).toBe(true);
  });

  it("returns correct meta (model, seed, latencyMs)", async () => {
    const fetch = makeGenFetch();
    const c = new MinimaxConnector("key", fetch as typeof globalThis.fetch);
    const out = await c.generate({ prompt: "test", type: "image" });
    writtenFiles.push(out.filePath);

    expect(out.meta.model).toBe("image-01");
    expect(typeof out.meta.seed).toBe("string");
    expect(out.meta.seed.length).toBeGreaterThan(0);
    expect(out.meta.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("throws when base_resp.status_code is non-zero", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({
        data:      { image_urls: [] },
        base_resp: { status_code: 1004, status_msg: "Invalid API key" },
      }),
    });
    const c = new MinimaxConnector("bad-key", fetch as typeof globalThis.fetch);
    await expect(c.generate({ prompt: "x", type: "image" })).rejects.toThrow("1004");
  });

  it("throws when downloaded image content-type is non-image (e.g. text/html)", async () => {
    const fetch = makeGenFetch({
      headers: { get: (k: string) => k === "content-type" ? "text/html" : null },
      arrayBuffer: () => Promise.resolve(new Uint8Array([]).buffer),
    });
    const c = new MinimaxConnector("key", fetch as typeof globalThis.fetch);
    await expect(c.generate({ prompt: "x", type: "image" })).rejects.toThrow(/content-type/i);
  });
});
