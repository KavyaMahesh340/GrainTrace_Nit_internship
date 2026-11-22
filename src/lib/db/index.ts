import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const configuredPath = process.env.DATABASE_URL ?? "./data/graintrace.db";
const databasePath = configuredPath === ":memory:" ? ":memory:" : resolve(process.cwd(), configuredPath);
let sqlite: InstanceType<typeof Database> | null = null;

export function getDatabasePath() {
  return databasePath;
}

export function getDb() {
  if (!sqlite) {
    if (databasePath !== ":memory:") {
      mkdirSync(dirname(databasePath), { recursive: true });
    }
    sqlite = new Database(databasePath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
  }

  return drizzle(sqlite, { schema });
}
