import { getEmbedding } from '../../../runtime/embedding.mjs';

// Layer A: Raw Memory — memory_events CRUD

export async function writeEvent(client, { session_id, actor, event_type, content, metadata = {},
  workspace_id, project_id, agent_id, task_id, run_id }) {
  const result = await client.query(
    `INSERT INTO memory_events (session_id, actor, event_type, content, metadata, workspace_id, project_id, agent_id, task_id, run_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, created_at`,
    [session_id, actor, event_type, content, JSON.stringify(metadata),
     workspace_id || null, project_id || null, agent_id || null, task_id || null, run_id || null]
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

export async function searchEvents(client, query, { event_type, actor, agent_id, task_id, run_id, workspace_id, project_id, limit = 20 } = {}) {
  const conditions = [`content ILIKE $1`];
  const params = [`%${query}%`];
  let idx = 2;
  if (event_type) { conditions.push(`event_type = $${idx}`); params.push(event_type); idx++; }
  if (actor) { conditions.push(`actor = $${idx}`); params.push(actor); idx++; }
  if (agent_id) { conditions.push(`agent_id = $${idx}`); params.push(agent_id); idx++; }
  if (task_id) { conditions.push(`task_id = $${idx}`); params.push(task_id); idx++; }
  if (run_id) { conditions.push(`run_id = $${idx}`); params.push(run_id); idx++; }
  if (workspace_id) { conditions.push(`workspace_id = $${idx}`); params.push(workspace_id); idx++; }
  if (project_id) { conditions.push(`project_id = $${idx}`); params.push(project_id); idx++; }
  params.push(limit);
  const result = await client.query(
    `SELECT * FROM memory_events WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${idx}`,
    params
  );
  return result.rows;
}

export async function createEventChunk(client, event_id, content) {
  const embedding = await getEmbedding(content);
  const result = await client.query(
    `INSERT INTO memory_chunks (source_type, source_id, text, embedding)
     VALUES ('raw_event', $1, $2, $3)
     RETURNING id`,
    [event_id, content, embedding ? JSON.stringify(embedding) : null]
  );
  return result.rows[0];
}
