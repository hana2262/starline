import { writeFileSync } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import type { Connector, GenerateInput, GenerateOutput, HealthCheckResult } from "./connector.interface.js";

const API_BASE     = "https://api.minimax.io/v1";
const MODELS_URL   = `${API_BASE}/models`;
const GENERATE_URL = `${API_BASE}/image_generation`;

type FetchFn = typeof globalThis.fetch;

const MIME_EXT: Record<string, string> = {
  "image/png":  "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function extFor(mime: string): string {
  return MIME_EXT[mime] ?? "bin";
}

interface MinimaxGenerateResponse {
  data:      { image_urls: string[] };
  base_resp: { status_code: number; status_msg: string };
}

export class MinimaxConnector implements Connector {
  readonly id   = "minimax";
  readonly name = "MiniMax Image";

  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: FetchFn = globalThis.fetch,
  ) {}

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    const latencyMs = () => Date.now() - start;

    try {
      const res = await this.fetchFn(MODELS_URL, {
        method:  "GET",
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (res.status === 200) {
        return { ok: true, latencyMs: latencyMs() };
      }
      if (res.status === 401 || res.status === 403) {
        return { ok: false, latencyMs: latencyMs(), error: "Authentication failed — check MINIMAX_API_KEY" };
      }
      // 404/405: models endpoint doesn't exist; fall back to key-presence check
      if (res.status === 404 || res.status === 405) {
        return this.apiKey
          ? { ok: true,  latencyMs: latencyMs() }
          : { ok: false, latencyMs: latencyMs(), error: "No API key configured" };
      }
      // Other unexpected status — treat as reachable
      return { ok: true, latencyMs: latencyMs() };
    } catch (err) {
      return { ok: false, latencyMs: latencyMs(), error: (err as Error).message };
    }
  }

  async generate(input: GenerateInput): Promise<GenerateOutput> {
    const start = Date.now();
    const seed  = randomUUID();

    // 1. Call MiniMax image generation API
    const genRes = await this.fetchFn(GENERATE_URL, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:           "image-01",
        prompt:          input.prompt,
        n:               1,
        response_format: "url",
        aspect_ratio:    (input.settings?.["aspect_ratio"] as string | undefined) ?? "1:1",
        seed,
      }),
    });

    const json = await genRes.json() as MinimaxGenerateResponse;

    if (json.base_resp.status_code !== 0) {
      throw new Error(
        `MiniMax API error: ${json.base_resp.status_msg} (code ${json.base_resp.status_code})`,
      );
    }

    const imageUrl = json.data.image_urls[0];
    if (!imageUrl) {
      throw new Error("MiniMax returned no image URLs");
    }

    // 2. Download the image
    const imgRes  = await this.fetchFn(imageUrl);
    const rawMime = imgRes.headers.get("content-type") ?? "image/png";
    const mimeType = rawMime.split(";")[0]?.trim() ?? "image/png";

    if (!mimeType.startsWith("image/")) {
      throw new Error(`Unexpected content-type from image URL: ${mimeType}`);
    }

    const buffer   = Buffer.from(await imgRes.arrayBuffer());
    const ext      = extFor(mimeType);
    const filePath = path.join(os.tmpdir(), `minimax-${randomUUID()}.${ext}`);

    writeFileSync(filePath, buffer);

    return {
      filePath,
      mimeType,
      name: input.prompt.slice(0, 80).trim() || "minimax-output",
      meta: { model: "image-01", seed, latencyMs: Date.now() - start },
    };
  }
}
