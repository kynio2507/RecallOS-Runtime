import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { DB_PATH, PROJECT_PATH, SCHEMA_VERSION, SERVER_VERSION } from './config.mjs';
import { now, truncate } from './utils.mjs';

export function openDb() {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const database = new Database(DB_PATH);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  ensureSchema(database);
  return database;
}

export function ensureSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      symbols_json TEXT NOT NULL DEFAULT '[]',
      files_json TEXT NOT NULL DEFAULT '[]',
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS symbol_summaries (
      symbol TEXT NOT NULL,
      file_path TEXT NOT NULL,
      summary TEXT NOT NULL,
      known_constraints TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (symbol, file_path)
    );
    CREATE TABLE IF NOT EXISTS runtime_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      related_symbols_json TEXT NOT NULL DEFAULT '[]',
      related_files_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS internal_events (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      event TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_items(type);
    CREATE INDEX IF NOT EXISTS idx_knowledge_updated_at ON knowledge_items(updated_at);
    CREATE INDEX IF NOT EXISTS idx_internal_events_created_at ON internal_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_internal_events_level ON internal_events(level);
  `);
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
