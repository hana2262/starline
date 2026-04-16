import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import type { Connector, GenerateInput, GenerateOutput, HealthCheckResult } from "./connector.interface.js";

export class MockConnector implements Connector {
  readonly id   = "mock";
  readonly name = "Mock Connector";

  async healthCheck(): Promise<HealthCheckResult> {
    const t = Date.now();
    await Promise.resolve();
    return { ok: true, latencyMs: Date.now() - t };
  }

  async generate(input: GenerateInput): Promise<GenerateOutput> {
    const t        = Date.now();
    const seed     = randomUUID();
    const filePath = path.join(os.tmpdir(), `starline-mock-${seed}.txt`);
    const content  = `mock:${input.prompt}|seed:${seed}|type:${input.type}`;
    fs.writeFileSync(filePath, content, "utf8");
    return {
      filePath,
      mimeType: "text/plain",
      name:     input.prompt.slice(0, 80).trim() || "mock-output",
      meta: { model: "mock-v1", seed, latencyMs: Date.now() - t },
    };
  }
}
