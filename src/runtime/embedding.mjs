const EMBEDDING_ENDPOINT = process.env.RECALLOS_EMBEDDING_ENDPOINT || '';
const EMBEDDING_MODEL = process.env.RECALLOS_EMBEDDING_MODEL || 'gemini/gemini-embedding-2-preview';
const EMBEDDING_API_KEY = process.env.RECALLOS_EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || '';

export async function getEmbedding(text) {
  if (!EMBEDDING_ENDPOINT || !EMBEDDING_API_KEY) return null;
  try {
    const response = await fetch(EMBEDDING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EMBEDDING_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      console.error(`[RecallOS Embedding] HTTP ${response.status}: ${await response.text()}`);
      return null;
    }
    const json = await response.json();
    const embedding = json?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      console.error('[RecallOS Embedding] Invalid response shape');
      return null;
    }
    return embedding;
  } catch (error) {
    console.error('[RecallOS Embedding] Error:', error.message);
    return null;
  }
}

export function getEmbeddingDim() {
  return parseInt(process.env.RECALLOS_EMBEDDING_DIM || '3072', 10);
}
