import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const databasePath = resolve(process.cwd(), process.env.DATABASE_URL ?? "./data/graintrace.db");
let sqlite: InstanceType<typeof Database> | null = null;

export function getDatabasePath() {
  return databasePath;
}

export function getDb() {
  if (!sqlite) {
    mkdirSync(dirname(databasePath), { recursive: true });
    sqlite = new Database(databasePath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
  }

  return drizzle(sqlite, { schema });
}
