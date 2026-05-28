const EMBEDDING_ENABLED = String(process.env.RECALLOS_EMBEDDING_ENABLED || '').toLowerCase() === 'true';
const EMBEDDING_ENDPOINT = process.env.RECALLOS_EMBEDDING_ENDPOINT || '';
const EMBEDDING_MODEL = process.env.RECALLOS_EMBEDDING_MODEL || 'gemini/gemini-embedding-2-preview';
const EMBEDDING_API_KEY = process.env.RECALLOS_EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || '';

let _warnedDisabled = false;

export async function getEmbedding(text) {
  if (!EMBEDDING_ENABLED) {
    if (!_warnedDisabled && process.env.RECALLOS_EMBEDDING_DEBUG === 'true') {
      console.error('[RecallOS Embedding] Disabled. Set RECALLOS_EMBEDDING_ENABLED=true to allow external embedding calls.');
      _warnedDisabled = true;
    }
    return null;
  }
  if (!EMBEDDING_ENDPOINT || !EMBEDDING_API_KEY) return null;
  try {
    if (process.env.RECALLOS_EMBEDDING_DEBUG === 'true') {
      console.error(`[RecallOS Embedding] Calling ${EMBEDDING_ENDPOINT} model=${EMBEDDING_MODEL}`);
    }
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

export function isEmbeddingEnabled() {
  return EMBEDDING_ENABLED;
}
