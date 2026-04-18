import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "fs";
import { StableDiffusionConnector } from "../stable-diffusion.connector.js";

const writtenFiles: string[] = [];

afterEach(() => {
  for (const file of writtenFiles.splice(0)) {
    try { fs.unlinkSync(file); } catch { /* ignore */ }
  }
  vi.restoreAllMocks();
});

describe("StableDiffusionConnector.healthCheck", () => {
  it("returns ok:true when /sdapi/v1/options returns HTTP 200", async () => {
    const fetch = vi.fn().mockResolvedValue({ status: 200 });
    const connector = new StableDiffusionConnector("http://127.0.0.1:7860", fetch as typeof globalThis.fetch);
    const result = await connector.healthCheck();

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:7860/sdapi/v1/options", expect.any(Object));
  });

  it("returns ok:false when health check returns non-200", async () => {
    const fetch = vi.fn().mockResolvedValue({ status: 503 });
    const connector = new StableDiffusionConnector("http://127.0.0.1:7860", fetch as typeof globalThis.fetch);
    const result = await connector.healthCheck();

    expect(result.ok).toBe(false);
    expect(result.error).toContain("503");
  });
});

describe("StableDiffusionConnector.generate", () => {
  it("calls AUTOMATIC1111 txt2img endpoint and writes PNG output", async () => {
    const pngBase64 = Buffer.from(new Uint8Array([137, 80, 78, 71])).toString("base64");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        images: [pngBase64],
        info: JSON.stringify({ seed: 123, sd_model_name: "dreamshaper" }),
      }),
    });

    const connector = new StableDiffusionConnector("http://127.0.0.1:7860", fetch as typeof globalThis.fetch);
    const output = await connector.generate({
      prompt: "anime city at night",
      type: "image",
      settings: { width: 512, height: 768, steps: 25, sampler_name: "Euler a" },
    });
    writtenFiles.push(output.filePath);

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:7860/sdapi/v1/txt2img",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fs.existsSync(output.filePath)).toBe(true);
    expect(output.mimeType).toBe("image/png");
    expect(output.meta.model).toBe("dreamshaper");
    expect(output.meta.seed).toBe("123");
  });

  it("rejects non-image generation types", async () => {
    const connector = new StableDiffusionConnector("http://127.0.0.1:7860", vi.fn() as typeof globalThis.fetch);
    await expect(connector.generate({ prompt: "x", type: "audio" })).rejects.toThrow(/only supports image/i);
  });

  it("throws when AUTOMATIC1111 returns no images", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ images: [] }),
    });
    const connector = new StableDiffusionConnector("http://127.0.0.1:7860", fetch as typeof globalThis.fetch);
    await expect(connector.generate({ prompt: "x", type: "image" })).rejects.toThrow(/no images/i);
  });
});
