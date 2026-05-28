import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

// PostgreSQL pool — same config as RecallOS runtime
const pool = new pg.Pool({
  host: process.env.RECALLOS_PG_HOST || "localhost",
  port: parseInt(process.env.RECALLOS_PG_PORT || "5432", 10),
  user: process.env.RECALLOS_PG_USER || "recallos",
  password: process.env.RECALLOS_PG_PASSWORD || "recallos",
  database: process.env.RECALLOS_PG_DATABASE || "recallos_memory",
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function queryPg(sql: string, params: unknown[] = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// SQLite — better-sqlite3
let _db: ReturnType<typeof import("better-sqlite3")> | null = null;

function getDbPath(): string {
  const root = process.env.RECALLOS_ROOT || path.resolve(process.cwd(), "..");
  return process.env.RECALLOS_DB_PATH || path.join(root, "data", "recallos_runtime.sqlite");
}

export function querySqlite(sql: string, params: unknown[] = []): unknown[] {
  if (!_db) {
    // Dynamic require for better-sqlite3
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    _db = new Database(getDbPath(), { readonly: true });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stmt = (_db as any).prepare(sql);
  return params.length > 0 ? stmt.all(...params) : stmt.all();
}

export function querySqliteOne(sql: string, params: unknown[] = []): unknown {
  if (!_db) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    _db = new Database(getDbPath(), { readonly: true });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stmt = (_db as any).prepare(sql);
  return params.length > 0 ? stmt.get(...params) : stmt.get();
}
