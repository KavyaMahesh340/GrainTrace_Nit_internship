import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const databasePath = resolve(process.cwd(), process.env.DATABASE_URL ?? "./data/graintrace.db");
const migrationsFolder = resolve(process.cwd(), "drizzle");

mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite);
migrate(db, { migrationsFolder });
sqlite.close();

process.stdout.write(`GrainTrace migrations applied to ${databasePath}\n`);
