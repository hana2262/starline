import { describe, it, expect } from "vitest";
import {
  ImportAssetSchema,
  ImportAssetResultSchema,
  AssetResponseSchema,
} from "../asset.schema.js";

const validAsset = {
  id:               "abc",
  projectId:        null,
  name:             "test.png",
  type:             "image" as const,
  filePath:         "/tmp/test.png",
  fileSize:         1024,
  mimeType:         "image/png",
  contentHash:      "abc123",
  tags:             [],
  description:      null,
  status:           "active" as const,
  createdAt:        new Date().toISOString(),
  updatedAt:        new Date().toISOString(),
  sourceConnector:  null,
  generationPrompt: null,
  generationMeta:   null,
};

describe("ImportAssetSchema", () => {
  it("accepts valid input", () => {
    const result = ImportAssetSchema.parse({
      filePath: "/tmp/test.png",
      type: "image",
      name: "My Image",
      projectId: "proj-1",
      tags: ["anime", "bg"],
      description: "A test file",
    });
    expect(result.type).toBe("image");
  });

  it("rejects empty filePath", () => {
    expect(() => ImportAssetSchema.parse({ filePath: "", type: "image" })).toThrow();
  });

  it("rejects invalid type", () => {
    expect(() =>
      ImportAssetSchema.parse({ filePath: "/tmp/x.bin", type: "unknown" }),
    ).toThrow();
  });

  it("rejects tags array exceeding 20 items", () => {
    expect(() =>
      ImportAssetSchema.parse({
        filePath: "/tmp/x.png",
        type: "image",
        tags: Array(21).fill("tag"),
      }),
    ).toThrow();
  });

  it("rejects empty projectId (min(1))", () => {
    expect(() =>
      ImportAssetSchema.parse({ filePath: "/tmp/x.png", type: "image", projectId: "" }),
    ).toThrow();
  });

  it("accepts projectId that is not a UUID", () => {
    const result = ImportAssetSchema.parse({
      filePath: "/tmp/x.png",
      type: "image",
      projectId: "some-arbitrary-id",
    });
    expect(result.projectId).toBe("some-arbitrary-id");
  });

  it("type field is optional when missing — rejects (required)", () => {
    expect(() => ImportAssetSchema.parse({ filePath: "/tmp/x.png" })).toThrow();
  });
});

describe("ImportAssetResultSchema", () => {
  it("parses created:true result", () => {
    const result = ImportAssetResultSchema.parse({ created: true, asset: validAsset });
    expect(result.created).toBe(true);
    expect(result.asset.id).toBe("abc");
  });

  it("parses created:false result", () => {
    const result = ImportAssetResultSchema.parse({ created: false, asset: validAsset });
    expect(result.created).toBe(false);
  });

  it("rejects missing created field", () => {
    expect(() => ImportAssetResultSchema.parse({ asset: validAsset })).toThrow();
  });
});

describe("AssetResponseSchema", () => {
  it("accepts valid asset response", () => {
    const result = AssetResponseSchema.parse(validAsset);
    expect(result.tags).toEqual([]);
  });
});
