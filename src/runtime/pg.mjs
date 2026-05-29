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

    // --- Project Brain tables ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_docs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id TEXT NOT NULL DEFAULT 'default',
        doc_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_docs_project ON project_docs(project_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_docs_type ON project_docs(doc_type)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_docs_status ON project_docs(status)');

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_modules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id TEXT NOT NULL DEFAULT 'default',
        name TEXT NOT NULL,
        purpose TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        owner TEXT,
        metadata JSONB DEFAULT '{}',
        UNIQUE(project_id, name)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_decisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id TEXT NOT NULL DEFAULT 'default',
        title TEXT NOT NULL,
        decision TEXT NOT NULL,
        reason TEXT,
        alternatives TEXT,
        impact TEXT,
        status TEXT NOT NULL DEFAULT 'accepted',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_decisions_project ON project_decisions(project_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_decisions_status ON project_decisions(status)');

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_roadmap_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id TEXT NOT NULL DEFAULT 'default',
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'planned',
        milestone TEXT,
        due_date TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_roadmap_project ON project_roadmap_items(project_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_roadmap_status ON project_roadmap_items(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_roadmap_priority ON project_roadmap_items(priority)');

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_glossary (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id TEXT NOT NULL DEFAULT 'default',
        term TEXT NOT NULL,
        definition TEXT NOT NULL,
        aliases TEXT[] DEFAULT '{}',
        UNIQUE(project_id, term)
      )
    `);

    // --- Multi-Agent tables ---

    // Agent Identity
    await client.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        model_id TEXT,
        system_prompt TEXT,
        capabilities_json JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Agent Messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id TEXT,
        project_id TEXT DEFAULT 'default',
        run_id TEXT,
        task_id TEXT,
        from_agent_id TEXT NOT NULL,
        to_agent_id TEXT NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'message',
        content TEXT NOT NULL,
        summary TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_from ON agent_messages(from_agent_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_to ON agent_messages(to_agent_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_task ON agent_messages(task_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_run ON agent_messages(run_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_created ON agent_messages(created_at DESC)');

    // Agent Handoffs
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_handoffs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_agent_id TEXT NOT NULL,
        to_agent_id TEXT NOT NULL,
        project_id TEXT DEFAULT 'default',
        task_title TEXT NOT NULL,
        task_payload_json JSONB DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        result_summary TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_handoffs_from ON agent_handoffs(from_agent_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_handoffs_to ON agent_handoffs(to_agent_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_handoffs_status ON agent_handoffs(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_handoffs_project ON agent_handoffs(project_id)');

    // Pair Memory: collaboration protocols, constraints, preferences, issues, checklists, decisions
    await client.query(`
      CREATE TABLE IF NOT EXISTS pair_memories (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        agent_a TEXT NOT NULL,
        agent_b TEXT NOT NULL,
        pair_key TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        importance REAL DEFAULT 0.5,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_pair_memories_scope ON pair_memories(workspace_id, project_id, pair_key)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_pair_memories_type ON pair_memories(pair_key, type, status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_pair_memories_updated ON pair_memories(updated_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_pair_memories_status ON pair_memories(status)');

    // --- Expand memory_events scope ---
    const eventCols = ['workspace_id TEXT', 'project_id TEXT', 'agent_id TEXT', 'task_id TEXT', 'run_id TEXT'];
    for (const col of eventCols) {
      const name = col.split(' ')[0];
      try { await client.query(`ALTER TABLE memory_events ADD COLUMN ${col}`); } catch {}
      try { await client.query(`CREATE INDEX IF NOT EXISTS idx_events_${name} ON memory_events(${name})`); } catch {}
    }

    // --- Expand memory_facts scope ---
    const factCols = ['workspace_id TEXT', 'project_id TEXT', 'agent_id TEXT', 'pair_key TEXT', 'task_id TEXT', 'session_id TEXT', 'run_id TEXT'];
    for (const col of factCols) {
      const name = col.split(' ')[0];
      try { await client.query(`ALTER TABLE memory_facts ADD COLUMN ${col}`); } catch {}
      try { await client.query(`CREATE INDEX IF NOT EXISTS idx_facts_${name} ON memory_facts(${name})`); } catch {}
    }

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
