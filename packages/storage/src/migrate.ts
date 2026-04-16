import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function runMigrations(dbPath: string) {
  const db = getDb(dbPath);
  const migrationsFolder = path.join(__dirname, "..", "migrations");
  migrate(db, { migrationsFolder });
}

// Allow running directly: tsx src/migrate.ts
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dbPath = process.env["DB_PATH"] ?? "./starline-dev.db";
  runMigrations(dbPath);
  console.log("Migrations applied to", dbPath);
}
