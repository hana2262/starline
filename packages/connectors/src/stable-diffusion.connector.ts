import { writeFileSync } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import type { Connector, GenerateInput, GenerateOutput, HealthCheckResult } from "./connector.interface.js";

type FetchFn = typeof globalThis.fetch;

interface StableDiffusionTxt2ImgResponse {
  images?: string[];
  info?: string;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function parseInfo(info: string | undefined): { seed?: string; model?: string } {
  if (!info) return {};

  try {
    const parsed = JSON.parse(info) as Record<string, unknown>;
    return {
      seed: parsed["seed"] !== undefined ? String(parsed["seed"]) : undefined,
      model:
        typeof parsed["sd_model_name"] === "string"
          ? parsed["sd_model_name"]
          : typeof parsed["model"] === "string"
            ? parsed["model"]
            : undefined,
    };
  } catch {
    return {};
  }
}

export class StableDiffusionConnector implements Connector {
  readonly id = "stable-diffusion";
  readonly name = "Stable Diffusion WebUI";

  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly fetchFn: FetchFn = globalThis.fetch,
  ) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    const latencyMs = () => Date.now() - start;

    try {
      const response = await this.fetchFn(`${this.baseUrl}/sdapi/v1/options`, {
        method: "GET",
      });

      if (response.status === 200) {
        return { ok: true, latencyMs: latencyMs() };
      }

      return {
        ok: false,
        latencyMs: latencyMs(),
        error: `Stable Diffusion health check failed with status ${response.status}`,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: latencyMs(),
        error: (error as Error).message,
      };
    }
  }

  async generate(input: GenerateInput): Promise<GenerateOutput> {
    if (input.type !== "image") {
      throw Object.assign(
        new Error("Stable Diffusion connector only supports image generation"),
        { retryable: false },
      );
    }

    const start = Date.now();
    const response = await this.fetchFn(`${this.baseUrl}/sdapi/v1/txt2img`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: input.prompt,
        steps: typeof input.settings?.["steps"] === "number" ? input.settings["steps"] : 20,
        width: typeof input.settings?.["width"] === "number" ? input.settings["width"] : 1024,
        height: typeof input.settings?.["height"] === "number" ? input.settings["height"] : 1024,
        sampler_name:
          typeof input.settings?.["sampler_name"] === "string"
            ? input.settings["sampler_name"]
            : "Euler a",
      }),
    });

    if (!response.ok) {
      throw new Error(`Stable Diffusion generation failed with status ${response.status}`);
    }

    const json = (await response.json()) as StableDiffusionTxt2ImgResponse;
    const base64Image = json.images?.[0];
    if (!base64Image) {
      throw new Error("Stable Diffusion returned no images");
    }

    const buffer = Buffer.from(base64Image, "base64");
    const filePath = path.join(os.tmpdir(), `stable-diffusion-${randomUUID()}.png`);
    writeFileSync(filePath, buffer);

    const info = parseInfo(json.info);

    return {
      filePath,
      mimeType: "image/png",
      name: input.prompt.slice(0, 80).trim() || "stable-diffusion-output",
      meta: {
        model: info.model ?? "automatic1111-webui",
        seed: info.seed ?? randomUUID(),
        latencyMs: Date.now() - start,
      },
    };
  }
}

