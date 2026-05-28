import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { DB_PATH, PROJECT_PATH, SCHEMA_VERSION, SERVER_VERSION } from './config.mjs';
import { now, truncate } from './utils.mjs';
import { runMigrations } from './migrator.mjs';

export function openDb() {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const database = new Database(DB_PATH);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  runMigrations(database);
  updateMeta(database);
  return database;
}

function updateMeta(database) {
  const setMeta = database.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
  setMeta.run('schema_version', SCHEMA_VERSION);
  setMeta.run('server_version', SERVER_VERSION);
  setMeta.run('project_path', PROJECT_PATH);
  setMeta.run('db_path', DB_PATH);
  setMeta.run('sqlite_driver', 'better-sqlite3');
  setMeta.run('mcp_transport', 'sdk-stdio');
}

export function withDb(fn) {
  const database = openDb();
  try {
    return fn(database);
  } catch (error) {
    logEvent(database, 'error', 'db_error', error?.stack || error?.message || String(error));
    throw error;
  } finally {
    database.close();
  }
}

export function logEvent(database, level, event, detail = '') {
  try {
    database.prepare('INSERT INTO internal_events (id, level, event, detail, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), level, event, truncate(String(detail), 4000), now());
  } catch {}
}
