-- ForgeBase9 provider/model registry
--
-- This SQLite migration is intentionally a compatibility marker.
-- The ForgeBase9/Multi Agent registry is PostgreSQL-backed and its schema is
-- created by src/modules/forgebase9-config/index.mjs plus dashboard APIs.
--
-- Do not put PostgreSQL-only types here. SQLite migrations are applied by
-- runtime/openDb() for Knowledge Base operations. PostgreSQL syntax such as
-- JSONB, TIMESTAMPTZ, UUID, and ON DELETE CASCADE can break all KB tools.

CREATE TABLE IF NOT EXISTS forgebase9_registry_sqlite_marker (
  id TEXT PRIMARY KEY,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO forgebase9_registry_sqlite_marker (id, note)
VALUES ('003', 'ForgeBase9 registry schema lives in PostgreSQL');
