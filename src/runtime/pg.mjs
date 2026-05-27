import pg from 'pg';
import pgvector from 'pgvector/pg';
import { normalizePath } from './config.mjs';

const PG_CONFIG = {
  host: process.env.RECALLOS_PG_HOST || 'localhost',
  port: parseInt(process.env.RECALLOS_PG_PORT || '5432', 10),
  user: process.env.RECALLOS_PG_USER || 'recallos',
  password: process.env.RECALLOS_PG_PASSWORD || 'recallos',
  database: process.env.RECALLOS_PG_DATABASE || 'recallos_memory',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

const EMBEDDING_DIM = parseInt(process.env.RECALLOS_EMBEDDING_DIM || '3072', 10);

let _pool = null;
let _schemaReady = false;

export function getPool() {
  if (!_pool) {
    _pool = new pg.Pool(PG_CONFIG);
    _pool.on('error', (err) => {
      console.error('[RecallOS PG] Pool error:', err.message);
    });
  }
  return _pool;
}

export async function ensureMemorySchema() {
  if (_schemaReady) return;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await pgvector.registerTypes(client);

    // Layer A: Raw Memory
    await client.query(`
      CREATE TABLE IF NOT EXISTS memory_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id TEXT NOT NULL,
        actor TEXT NOT NULL,
        event_type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_events_session ON memory_events(session_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_events_actor ON memory_events(actor)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_events_type ON memory_events(event_type)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_events_created ON memory_events(created_at DESC)');

    // Layer B: Active Memory
    await client.query(`
      CREATE TABLE IF NOT EXISTS memory_facts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scope TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        source_event_ids UUID[] DEFAULT '{}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(scope, key)
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_facts_scope ON memory_facts(scope)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_facts_key ON memory_facts(key)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_facts_updated ON memory_facts(updated_at DESC)');

    // Layer C: Context Index
    await client.query(`
      CREATE TABLE IF NOT EXISTS memory_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_type TEXT NOT NULL,
        source_id UUID,
        text TEXT NOT NULL,
        embedding vector(${EMBEDDING_DIM}),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_chunks_source ON memory_chunks(source_type, source_id)');
    // IVFFlat index needs data to build lists; create after sufficient data
    // await client.query(`CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON memory_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`);

    // Link table
    await client.query(`
      CREATE TABLE IF NOT EXISTS memory_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID NOT NULL,
        target_id UUID NOT NULL,
        relation TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_links_source ON memory_links(source_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_links_target ON memory_links(target_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_links_relation ON memory_links(relation)');

    _schemaReady = true;
  } finally {
    client.release();
  }
}

export async function withPg(fn) {
  await ensureMemorySchema();
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closePg() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _schemaReady = false;
  }
}
