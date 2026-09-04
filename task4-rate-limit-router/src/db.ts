import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function openDatabase(filePath: string): Database.Database {
  mkdirSync(dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_key TEXT NOT NULL,
      tokens INTEGER NOT NULL,
      requested_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_token_usage_tenant_time ON token_usage (tenant_key, requested_at);
  `);
  return db;
}
