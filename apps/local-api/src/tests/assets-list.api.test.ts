import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../server.js";
import { runMigrations } from "@starline/storage/src/migrate.js";
import { getDb, getSqlite } from "@starline/storage";
import path from "path";
import os from "os";
import fs from "fs";

const ts      = Date.now();
const DB_PATH = path.join(os.tmpdir(), `starline-list-test-${ts}.db`);

// Four temp files with distinct content so content_hash dedup doesn't merge them
const fileA = path.join(os.tmpdir(), `starline-list-${ts}-a.txt`);
const fileB = path.join(os.tmpdir(), `starline-list-${ts}-b.txt`);
const fileC = path.join(os.tmpdir(), `starline-list-${ts}-c.txt`);
const fileD = path.join(os.tmpdir(), `starline-list-${ts}-d.txt`);

const app = buildServer(DB_PATH);

let idA: string;
let idB: string;
let idC: string;
let idD: string;

beforeAll(async () => {
  fs.writeFileSync(fileA, `cat sketch content ${ts}-A`);
  fs.writeFileSync(fileB, `dog photo content ${ts}-B`);
  fs.writeFileSync(fileC, `piano loop content ${ts}-C`);
  fs.writeFileSync(fileD, `cat prompt content ${ts}-D`);

  await app.ready();

  // Import A: name="cat sketch", type=image, projectId=proj-1, tags=[cat,sketch]
  const rA = await app.inject({
    method: "POST", url: "/api/assets/import",
    payload: { filePath: fileA, type: "image", name: "cat sketch", projectId: "proj-1", tags: ["cat", "sketch"] },
  });
  idA = rA.json<{ asset: { id: string } }>().asset.id;

  // Import B: name="dog photo", type=image, projectId=proj-1, tags=[dog]
  const rB = await app.inject({
    method: "POST", url: "/api/assets/import",
    payload: { filePath: fileB, type: "image", name: "dog photo", projectId: "proj-1", tags: ["dog"] },
  });
  idB = rB.json<{ asset: { id: string } }>().asset.id;

  // Import C: name="piano loop", type=audio, projectId=proj-2, tags=[music]
  const rC = await app.inject({
    method: "POST", url: "/api/assets/import",
    payload: { filePath: fileC, type: "audio", name: "piano loop", projectId: "proj-2", tags: ["music"] },
  });
  idC = rC.json<{ asset: { id: string } }>().asset.id;

  // Import D: name="cat prompt", type=prompt, projectId=proj-2, tags=[cat,ai]
  const rD = await app.inject({
    method: "POST", url: "/api/assets/import",
    payload: { filePath: fileD, type: "prompt", name: "cat prompt", projectId: "proj-2", tags: ["cat", "ai"] },
  });
  idD = rD.json<{ asset: { id: string } }>().asset.id;
  it("#15 trashed assets are hidden from the default list but visible via trash/all filters", async () => {
    const trashRes = await app.inject({ method: "POST", url: `/api/assets/${idB}/trash` });
    expect(trashRes.statusCode).toBe(200);

    const activeRes = await app.inject({ method: "GET", url: "/api/assets" });
    expect(activeRes.statusCode).toBe(200);
    const activeBody = activeRes.json<ListBody>();
    expect(activeBody.total).toBe(3);
    expect(activeBody.items.some((item) => item.id === idB)).toBe(false);

    const trashListRes = await app.inject({ method: "GET", url: "/api/assets?status=trashed" });
    expect(trashListRes.statusCode).toBe(200);
    const trashBody = trashListRes.json<ListBody>();
    expect(trashBody.total).toBe(1);
    expect(trashBody.items[0]?.id).toBe(idB);

    const allRes = await app.inject({ method: "GET", url: "/api/assets?status=all" });
    expect(allRes.statusCode).toBe(200);
    const allBody = allRes.json<ListBody>();
    expect(allBody.total).toBe(4);
  });
});

afterAll(async () => {
  await app.close();
  for (const f of [fileA, fileB, fileC, fileD, DB_PATH]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

type ListBody = { items: { id: string }[]; total: number; limit: number; offset: number };

describe("Asset List API", () => {
  it("#1 GET /api/assets — returns all 4 assets", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets" });
    expect(res.statusCode).toBe(200);
    const body = res.json<ListBody>();
    expect(body.total).toBe(4);
    expect(body.items).toHaveLength(4);
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
  });

  it("#2 GET /api/assets?projectId=proj-1 — returns A and B only", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets?projectId=proj-1" });
    expect(res.statusCode).toBe(200);
    const body = res.json<ListBody>();
    expect(body.total).toBe(2);
    const ids = body.items.map(i => i.id).sort();
    expect(ids).toEqual([idA, idB].sort());
  });

  it("#3 GET /api/assets?type=audio — returns C only", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets?type=audio" });
    expect(res.statusCode).toBe(200);
    const body = res.json<ListBody>();
    expect(body.total).toBe(1);
    expect(body.items[0]!.id).toBe(idC);
  });

  it("#4 GET /api/assets?projectId=proj-1&type=image — returns A and B", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets?projectId=proj-1&type=image" });
    expect(res.statusCode).toBe(200);
    const body = res.json<ListBody>();
    expect(body.total).toBe(2);
    const ids = body.items.map(i => i.id).sort();
    expect(ids).toEqual([idA, idB].sort());
  });

  it("#5 GET /api/assets?query=cat — returns A and D (FTS on name+tags)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets?query=cat" });
    expect(res.statusCode).toBe(200);
    const body = res.json<ListBody>();
    expect(body.total).toBe(2);
    const ids = body.items.map(i => i.id).sort();
    expect(ids).toEqual([idA, idD].sort());
  });

  it("#6 GET /api/assets?query=cat&type=image — returns A only", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets?query=cat&type=image" });
    expect(res.statusCode).toBe(200);
    const body = res.json<ListBody>();
    expect(body.total).toBe(1);
    expect(body.items[0]!.id).toBe(idA);
  });

  it("#7 GET /api/assets?limit=2&offset=0 — 2 items, total 4", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets?limit=2&offset=0" });
    expect(res.statusCode).toBe(200);
    const body = res.json<ListBody>();
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(4);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(0);
  });

  it("#8 GET /api/assets?limit=2&offset=2 — next 2 items, total 4", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets?limit=2&offset=2" });
    expect(res.statusCode).toBe(200);
    const body = res.json<ListBody>();
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(4);
  });

  it("#9 GET /api/assets?limit=2&offset=4 — 0 items, total 4", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets?limit=2&offset=4" });
    expect(res.statusCode).toBe(200);
    const body = res.json<ListBody>();
    expect(body.items).toHaveLength(0);
    expect(body.total).toBe(4);
  });

  it("#10 GET /api/assets?query=nonexistentxyz — empty result", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets?query=nonexistentxyz" });
    expect(res.statusCode).toBe(200);
    const body = res.json<ListBody>();
    expect(body.items).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("#11 GET /api/assets?query=cat* — strips *, same as query=cat (A and D)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets?query=cat*" });
    expect(res.statusCode).toBe(200);
    const body = res.json<ListBody>();
    expect(body.total).toBe(2);
    const ids = body.items.map(i => i.id).sort();
    expect(ids).toEqual([idA, idD].sort());
  });

  it("#12 GET /api/assets?query=* — all operators → no FTS predicate → all 4", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets?query=*" });
    expect(res.statusCode).toBe(200);
    const body = res.json<ListBody>();
    expect(body.total).toBe(4);
  });

  it("#13 GET /api/assets?limit=0 — 400 validation error", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets?limit=0" });
    expect(res.statusCode).toBe(400);
  });

  it("#14 GET /api/assets?limit=201 — 400 validation error", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets?limit=201" });
    expect(res.statusCode).toBe(400);
  });
});

describe("Asset trash filters", () => {
  it("hides trashed assets from the default list but exposes them in trash/all filters", async () => {
    const trashRes = await app.inject({ method: "POST", url: `/api/assets/${idB}/trash` });
    expect(trashRes.statusCode).toBe(200);

    const activeRes = await app.inject({ method: "GET", url: "/api/assets" });
    expect(activeRes.statusCode).toBe(200);
    const activeBody = activeRes.json<ListBody>();
    expect(activeBody.total).toBe(3);
    expect(activeBody.items.some((item) => item.id === idB)).toBe(false);

    const trashListRes = await app.inject({ method: "GET", url: "/api/assets?status=trashed" });
    expect(trashListRes.statusCode).toBe(200);
    const trashBody = trashListRes.json<ListBody>();
    expect(trashBody.total).toBe(1);
    expect(trashBody.items[0]?.id).toBe(idB);

    const allRes = await app.inject({ method: "GET", url: "/api/assets?status=all" });
    expect(allRes.statusCode).toBe(200);
    const allBody = allRes.json<ListBody>();
    expect(allBody.total).toBe(4);
  });
});

describe("Asset FTS backfill", () => {
  it("runMigrations() backfills a row that was inserted directly into assets", async () => {
    // Insert a row into assets bypassing the repo (so assets_fts is not updated)
    const sqlite = getSqlite();
    const db     = getDb(DB_PATH);
    void db; // accessed above; kept for clarity

    const backfillId   = `backfill-${ts}`;
    const backfillName = `backfill-unique-${ts}`;
    const nowIso       = new Date().toISOString();

    sqlite.prepare(`
      INSERT INTO assets
        (id, project_id, name, type, file_path, file_size, content_hash, tags, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      backfillId, null, backfillName,
      "other", `/tmp/backfill-${ts}.txt`, 1,
      `hash-backfill-${ts}`, "[]", "active", nowIso, nowIso,
    );

    // Confirm it's not yet in FTS
    const before = sqlite.prepare(`SELECT id FROM assets_fts WHERE id = ?`).get(backfillId);
    expect(before).toBeUndefined();

    // Run migrations (triggers backfill)
    runMigrations(DB_PATH);

    // Now it should appear in FTS
    const after = sqlite.prepare(`SELECT id FROM assets_fts WHERE id = ?`).get(backfillId) as { id: string } | undefined;
    expect(after?.id).toBe(backfillId);

    // And be searchable via the API
    const res = await app.inject({
      method: "GET",
      url:    `/api/assets?query=${encodeURIComponent(backfillName)}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<ListBody>();
    expect(body.items.some(i => i.id === backfillId)).toBe(true);
  });
});
