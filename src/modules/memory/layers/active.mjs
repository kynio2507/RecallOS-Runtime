import { getEmbedding } from '../../../runtime/embedding.mjs';

// Layer B: Active Memory — memory_facts upsert/query

export async function upsertFact(client, { scope, key, value, confidence = 1.0, source_ids = [] }) {
  const result = await client.query(
    `INSERT INTO memory_facts (scope, key, value, confidence, source_event_ids, updated_at)
     VALUES ($1, $2, $3, $4, $5::uuid[], NOW())
     ON CONFLICT (scope, key) DO UPDATE SET
       value = EXCLUDED.value,
       confidence = EXCLUDED.confidence,
       source_event_ids = EXCLUDED.source_event_ids,
       updated_at = NOW()
     RETURNING id, updated_at`,
    [scope, key, value, confidence, source_ids]
  );
  const fact = result.rows[0];

  // Auto-vectorize fact
  const embedding = await getEmbedding(`${scope}/${key}: ${value}`);
  if (embedding) {
    // Upsert chunk for this fact
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

export async function getProfile(client, scope) {
  const result = await client.query(
    `SELECT * FROM memory_facts WHERE scope = $1 ORDER BY confidence DESC, updated_at DESC`,
    [scope]
  );
  return result.rows;
}

export async function searchFacts(client, query, { scope, limit = 20 } = {}) {
  const conditions = [`(key ILIKE $1 OR value ILIKE $1)`];
  const params = [`%${query}%`];
  let idx = 2;
  if (scope) { conditions.push(`scope = $${idx}`); params.push(scope); idx++; }
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
