import { getEmbedding } from '../../../runtime/embedding.mjs';

// Layer C: Context Index — memory_chunks vector search

export async function vectorSearch(client, query, { top_k = 10 } = {}) {
  const queryEmbedding = await getEmbedding(query);
  if (!queryEmbedding) {
    // Fallback: text search on chunks
    const result = await client.query(
      `SELECT *, 0.0 AS similarity FROM memory_chunks WHERE text ILIKE $1 ORDER BY created_at DESC LIMIT $2`,
      [`%${query}%`, top_k]
    );
    return result.rows;
  }

  const result = await client.query(
    `SELECT *, 1 - (embedding <=> $1::vector) AS similarity
     FROM memory_chunks
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [JSON.stringify(queryEmbedding), top_k]
  );
  return result.rows;
}

export async function insertChunk(client, { source_type, source_id, text, metadata = {} }) {
  const embedding = await getEmbedding(text);
  const result = await client.query(
    `INSERT INTO memory_chunks (source_type, source_id, text, embedding, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [source_type, source_id || null, text, embedding ? JSON.stringify(embedding) : null, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

export async function getChunksBySource(client, source_type, source_id) {
  const result = await client.query(
    `SELECT * FROM memory_chunks WHERE source_type = $1 AND source_id = $2 ORDER BY created_at ASC`,
    [source_type, source_id]
  );
  return result.rows;
}
