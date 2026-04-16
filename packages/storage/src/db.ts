import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

export function getDb(dbPath: string) {
  if (_db) return _db;
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  _sqlite = sqlite;
  _db = drizzle(sqlite, { schema });
  return _db;
}

export function getSqlite(): Database.Database {
  if (!_sqlite) throw new Error("Call getDb() first");
  return _sqlite;
}

export type Db = ReturnType<typeof getDb>;
