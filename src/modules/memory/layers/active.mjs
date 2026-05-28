import { getEmbedding } from '../../../runtime/embedding.mjs';

// Layer B: Active Memory — memory_facts upsert/query

export async function upsertFact(client, { scope, key, value, confidence = 1.0, source_ids = [],
  workspace_id, project_id, agent_id, pair_key, task_id, session_id, run_id }) {
  const result = await client.query(
    `INSERT INTO memory_facts (scope, key, value, confidence, source_event_ids, workspace_id, project_id, agent_id, pair_key, task_id, session_id, run_id, updated_at)
     VALUES ($1, $2, $3, $4, $5::uuid[], $6, $7, $8, $9, $10, $11, $12, NOW())
     ON CONFLICT (scope, key) DO UPDATE SET
       value = EXCLUDED.value,
       confidence = EXCLUDED.confidence,
       source_event_ids = EXCLUDED.source_event_ids,
       workspace_id = COALESCE(EXCLUDED.workspace_id, memory_facts.workspace_id),
       project_id = COALESCE(EXCLUDED.project_id, memory_facts.project_id),
       agent_id = COALESCE(EXCLUDED.agent_id, memory_facts.agent_id),
       pair_key = COALESCE(EXCLUDED.pair_key, memory_facts.pair_key),
       task_id = COALESCE(EXCLUDED.task_id, memory_facts.task_id),
       session_id = COALESCE(EXCLUDED.session_id, memory_facts.session_id),
       run_id = COALESCE(EXCLUDED.run_id, memory_facts.run_id),
       updated_at = NOW()
     RETURNING id, updated_at`,
    [scope, key, value, confidence, source_ids,
     workspace_id || null, project_id || null, agent_id || null,
     pair_key || null, task_id || null, session_id || null, run_id || null]
  );
  const fact = result.rows[0];

  // Auto-vectorize fact
  const embedding = await getEmbedding(`${scope}/${key}: ${value}`);
  if (embedding) {
    await client.query(
      `INSERT INTO memory_chunks (source_type, source_id, text, embedding)
       VALUES ('fact', $1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [fact.id, `${scope}/${key}: ${value}`, JSON.stringify(embedding)]
    );
  }

  return fact;
}

export async function getFact(client, scope, key) {
  const result = await client.query(
    `SELECT * FROM memory_facts WHERE scope = $1 AND key = $2`,
    [scope, key]
  );
  return result.rows[0] || null;
}

export async function getProfile(client, scope, { agent_id, pair_key } = {}) {
  const conditions = ['scope = $1'];
  const params = [scope];
  let idx = 2;
  if (agent_id) { conditions.push(`agent_id = $${idx}`); params.push(agent_id); idx++; }
  if (pair_key) { conditions.push(`pair_key = $${idx}`); params.push(pair_key); idx++; }
  const result = await client.query(
    `SELECT * FROM memory_facts WHERE ${conditions.join(' AND ')} ORDER BY confidence DESC, updated_at DESC`,
    params
  );
  return result.rows;
}

export async function searchFacts(client, query, { scope, agent_id, pair_key, task_id, workspace_id, project_id, limit = 20 } = {}) {
  const conditions = [`(key ILIKE $1 OR value ILIKE $1)`];
  const params = [`%${query}%`];
  let idx = 2;
  if (scope) { conditions.push(`scope = $${idx}`); params.push(scope); idx++; }
  if (agent_id) { conditions.push(`agent_id = $${idx}`); params.push(agent_id); idx++; }
  if (pair_key) { conditions.push(`pair_key = $${idx}`); params.push(pair_key); idx++; }
  if (task_id) { conditions.push(`task_id = $${idx}`); params.push(task_id); idx++; }
  if (workspace_id) { conditions.push(`workspace_id = $${idx}`); params.push(workspace_id); idx++; }
  if (project_id) { conditions.push(`project_id = $${idx}`); params.push(project_id); idx++; }
  params.push(limit);
  const result = await client.query(
    `SELECT * FROM memory_facts WHERE ${conditions.join(' AND ')} ORDER BY confidence DESC, updated_at DESC LIMIT $${idx}`,
    params
  );
  return result.rows;
}

export async function deleteFact(client, scope, key) {
  const result = await client.query(
    `DELETE FROM memory_facts WHERE scope = $1 AND key = $2 RETURNING id`,
    [scope, key]
  );
  return result.rowCount > 0;
}
