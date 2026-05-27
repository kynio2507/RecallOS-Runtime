import { getEmbedding } from '../../../runtime/embedding.mjs';

// Layer A: Raw Memory — memory_events CRUD

export async function writeEvent(client, { session_id, actor, event_type, content, metadata = {} }) {
  const result = await client.query(
    `INSERT INTO memory_events (session_id, actor, event_type, content, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [session_id, actor, event_type, content, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

export async function getSessionEvents(client, session_id, limit = 100) {
  const result = await client.query(
    `SELECT * FROM memory_events WHERE session_id = $1 ORDER BY created_at ASC LIMIT $2`,
    [session_id, limit]
  );
  return result.rows;
}

export async function searchEvents(client, query, { event_type, actor, limit = 20 } = {}) {
  const conditions = [`content ILIKE $1`];
  const params = [`%${query}%`];
  let idx = 2;
  if (event_type) { conditions.push(`event_type = $${idx}`); params.push(event_type); idx++; }
  if (actor) { conditions.push(`actor = $${idx}`); params.push(actor); idx++; }
  params.push(limit);
  const result = await client.query(
    `SELECT * FROM memory_events WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${idx}`,
    params
  );
  return result.rows;
}

export async function createEventChunk(client, event_id, content) {
  const embedding = await getEmbedding(content);
  if (!embedding) return null;
  const result = await client.query(
    `INSERT INTO memory_chunks (source_type, source_id, text, embedding)
     VALUES ('raw_event', $1, $2, $3)
     RETURNING id`,
    [event_id, content, JSON.stringify(embedding)]
  );
  return result.rows[0];
}
