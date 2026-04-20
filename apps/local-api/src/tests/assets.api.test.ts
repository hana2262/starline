import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../server.js";
import path from "path";
import os from "os";
import fs from "fs";

const ts = Date.now();
const DB_PATH = path.join(os.tmpdir(), `starline-assets-test-${ts}.db`);
const tempFile = path.join(os.tmpdir(), `starline-asset-${ts}.txt`);
const tempFile2 = path.join(os.tmpdir(), `starline-asset-${ts}-2.txt`);

const app = buildServer(DB_PATH);

beforeAll(async () => {
  fs.writeFileSync(tempFile, "hello starline");
  fs.writeFileSync(tempFile2, "world starline");
  await app.ready();
});

afterAll(async () => {
  await app.close();
  for (const f of [tempFile, tempFile2, DB_PATH]) {
    try {
      fs.unlinkSync(f);
    } catch {}
  }
});

describe("Asset Import API", () => {
  let assetId: string;

  it("POST /api/assets/import returns 201 on new file", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/assets/import",
      payload: {
        filePath: tempFile,
        type: "other",
        name: "My Asset",
        tags: ["test"],
        visibility: "private",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{
      created: boolean;
      asset: { id: string; name: string; tags: string[]; visibility: string };
    }>();
    expect(body.created).toBe(true);
    expect(body.asset.name).toBe("My Asset");
    expect(body.asset.tags).toEqual(["test"]);
    expect(body.asset.visibility).toBe("private");
    assetId = body.asset.id;
  });

  it("POST /api/assets/import returns 200 on same file content dedup", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/assets/import",
      payload: { filePath: tempFile, type: "other" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ created: boolean; asset: { id: string } }>();
    expect(body.created).toBe(false);
    expect(body.asset.id).toBe(assetId);
  });

  it("POST /api/assets/import returns 409 path conflict after content changes", async () => {
    fs.writeFileSync(tempFile, `completely different content ${Date.now()}`);

    const res = await app.inject({
      method: "POST",
      url: "/api/assets/import",
      payload: { filePath: tempFile, type: "other" },
    });
    expect(res.statusCode).toBe(409);
    const body = res.json<{ code: string; existingAssetId: string }>();
    expect(body.code).toBe("PATH_CONFLICT");
    expect(body.existingAssetId).toBe(assetId);
  });

  it("POST /api/assets/import returns 201 for distinct content", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/assets/import",
      payload: { filePath: tempFile2, type: "other" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ created: boolean; asset: { id: string } }>();
    expect(body.created).toBe(true);
    expect(body.asset.id).not.toBe(assetId);
  });

  it("POST /api/assets/import returns 422 file not found", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/assets/import",
      payload: { filePath: "/no/such/file-xyz.txt", type: "other" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json<{ code: string }>().code).toBe("FILE_NOT_FOUND");
  });

  it("POST /api/assets/import returns 400 on invalid body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/assets/import",
      payload: { filePath: tempFile2 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /api/assets/:id returns the asset with visibility", async () => {
    const res = await app.inject({ method: "GET", url: `/api/assets/${assetId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string; name: string; contentHash: string; visibility: string }>();
    expect(body.id).toBe(assetId);
    expect(body.name).toBe("My Asset");
    expect(body.contentHash).toBeTruthy();
    expect(body.visibility).toBe("private");
  });

  it("GET /api/assets/:id returns 404 for unknown id", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets/no-such-id" });
    expect(res.statusCode).toBe(404);
  });

  it("PATCH /api/assets/:id updates asset visibility", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/assets/${assetId}`,
      payload: { visibility: "public" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string; visibility: string }>();
    expect(body.id).toBe(assetId);
    expect(body.visibility).toBe("public");
  });

  it("PATCH /api/assets/:id returns 400 on empty update", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/assets/${assetId}`,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});
