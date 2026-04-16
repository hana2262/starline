import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import { fileURLToPath } from "url";
import { getDb, getSqlite } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function runMigrations(dbPath: string) {
  const db = getDb(dbPath);
  const migrationsFolder = path.join(__dirname, "..", "migrations");
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
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dbPath = process.env["DB_PATH"] ?? "./starline-dev.db";
  runMigrations(dbPath);
  console.log("Migrations applied to", dbPath);
}
