import { describe, it, expect, afterEach } from "vitest";
import { MockConnector } from "../mock.connector.js";
import fs from "fs";

const connector = new MockConnector();
const writtenFiles: string[] = [];

afterEach(() => {
  for (const f of writtenFiles.splice(0)) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

describe("MockConnector.healthCheck", () => {
  it("returns ok: true with non-negative latencyMs", async () => {
    const result = await connector.healthCheck();
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });
});

describe("MockConnector.generate", () => {
  it("returns a filePath that exists on disk", async () => {
    const output = await connector.generate({ prompt: "cat in space", type: "image" });
    writtenFiles.push(output.filePath);
    expect(fs.existsSync(output.filePath)).toBe(true);
  });

  it("file content contains the prompt", async () => {
    const output = await connector.generate({ prompt: "dog on moon", type: "audio" });
    writtenFiles.push(output.filePath);
    const content = fs.readFileSync(output.filePath, "utf8");
    expect(content).toContain("dog on moon");
  });

  it("two consecutive calls produce different filePaths and different content", async () => {
    const out1 = await connector.generate({ prompt: "same prompt", type: "image" });
    const out2 = await connector.generate({ prompt: "same prompt", type: "image" });
    writtenFiles.push(out1.filePath, out2.filePath);

    expect(out1.filePath).not.toBe(out2.filePath);
    const c1 = fs.readFileSync(out1.filePath, "utf8");
    const c2 = fs.readFileSync(out2.filePath, "utf8");
    expect(c1).not.toBe(c2);
  });

  it("returns correct mimeType and name", async () => {
    const output = await connector.generate({ prompt: "test prompt", type: "image" });
    writtenFiles.push(output.filePath);
    expect(output.mimeType).toBe("text/plain");
    expect(output.name).toBe("test prompt");
    expect(output.meta.model).toBe("mock-v1");
    expect(typeof output.meta.seed).toBe("string");
    expect(output.meta.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
