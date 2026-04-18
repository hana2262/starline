import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import { fileURLToPath } from "url";
import { getDb, getSqlite } from "./db.js";

function resolveModuleFilename(): string {
  if (typeof __filename === "string") {
    return __filename;
  }

  const stack = new Error().stack;
  if (!stack) {
    throw new Error("Unable to resolve migration module filename from stack");
  }

  const frames = stack.split("\n").slice(1);
  for (const frame of frames) {
    const fileUrlMatch = frame.match(/(file:\/\/\/[^\s)]+):\d+:\d+/);
    if (fileUrlMatch) {
      return fileURLToPath(fileUrlMatch[1]);
    }

    const windowsPathMatch = frame.match(/([A-Za-z]:\\[^():]+):\d+:\d+/);
    if (windowsPathMatch) {
      return windowsPathMatch[1];
    }
  }

  throw new Error("Unable to resolve migration module filename from stack");
}

const moduleFilename = resolveModuleFilename();
const moduleDirname = path.dirname(moduleFilename);

export function runMigrations(dbPath: string) {
  const db = getDb(dbPath);
  const migrationsFolder = path.join(moduleDirname, "..", "migrations");
  migrate(db, { migrationsFolder });

  const sqlite = getSqlite();

  // Create FTS5 virtual table (idempotent)
  sqlite.prepare(`
    CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts
    USING fts5(id UNINDEXED, name, tags, description)
  `).run();

  // Backfill: sync any pre-existing assets rows not yet in FTS (idempotent)
  sqlite.prepare(`
    INSERT INTO assets_fts(id, name, tags, description)
    SELECT a.id, a.name, a.tags, COALESCE(a.description, '')
    FROM assets a
    WHERE a.id NOT IN (SELECT id FROM assets_fts)
  `).run();
}

// Allow running directly: tsx src/migrate.ts
if (process.argv[1] === moduleFilename) {
  const dbPath = process.env["DB_PATH"] ?? "./starline-dev.db";
  runMigrations(dbPath);
  console.log("Migrations applied to", dbPath);
}
