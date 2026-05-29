import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { withPg } from '../../runtime/pg.mjs';
import { recordDecision, recordProjectSnapshot, recordSystemEvent } from '../session-recorder/index.mjs';

const DEFAULT_WORKSPACE = 'default';
const DEFAULT_PROJECT = 'recallos-runtime';
const DEFAULT_AGENTS = [
  'pm_architecture',
  'analyzer',
  'senior_product_designer',
  'senior_product_coder',
  'product_code_reviewer',
];

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS llm_providers (id TEXT PRIMARY KEY, name TEXT NOT NULL, base_url TEXT NOT NULL, api_key_ciphertext TEXT, api_key_masked TEXT, api_key_env_var TEXT, status TEXT DEFAULT 'active', metadata_json JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS llm_model_catalog (id TEXT PRIMARY KEY, provider_id TEXT REFERENCES llm_providers(id) ON DELETE CASCADE, model_id TEXT NOT NULL, prefix TEXT, family TEXT, capabilities_json JSONB DEFAULT '{}'::jsonb, status TEXT DEFAULT 'active', last_seen_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(provider_id, model_id));
CREATE TABLE IF NOT EXISTS agent_model_assignments (id TEXT PRIMARY KEY, workspace_id TEXT DEFAULT 'default', project_id TEXT DEFAULT 'default', agent_id TEXT NOT NULL, provider_id TEXT REFERENCES llm_providers(id) ON DELETE CASCADE, model_id TEXT NOT NULL, purpose TEXT DEFAULT 'primary', status TEXT DEFAULT 'active', metadata_json JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(workspace_id, project_id, agent_id, purpose));
CREATE TABLE IF NOT EXISTS llm_provider_checks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider_id TEXT REFERENCES llm_providers(id) ON DELETE CASCADE, check_type TEXT, ok BOOLEAN, status_code INT, message TEXT, latency_ms INT, created_at TIMESTAMPTZ DEFAULT NOW());
`;

function stableId(...parts) { return createHash('sha1').update(parts.filter(Boolean).join('\n')).digest('hex').slice(0, 24); }
function providerId(name, baseUrl) { return `prov_${stableId(name, baseUrl)}`; }
function modelRowId(provider_id, model_id) { return `model_${stableId(provider_id, model_id)}`; }
function assignmentId(workspace_id, project_id, agent_id, purpose) { return `assign_${stableId(workspace_id, project_id, agent_id, purpose)}`; }
function prefixOf(model_id) { return String(model_id || '').includes('/') ? String(model_id).split('/')[0] + '/' : null; }
function familyOf(model_id) { const s = String(model_id || ''); return s.includes('/') ? s.split('/').slice(1).join('/') : s; }
function maskKey(key = '') { if (!key) return null; const s = String(key); return s.length <= 10 ? `${s.slice(0, 2)}...${s.slice(-2)}` : `${s.slice(0, 4)}...${s.slice(-4)}`; }

function secretKey() {
  const raw = process.env.RECALLOS_SECRET_KEY;
  if (!raw) return null;
  return createHash('sha256').update(raw).digest();
}
function encryptKey(value) {
  if (!value) return null;
  const key = secretKey();
  if (!key) return `plain:${Buffer.from(value, 'utf8').toString('base64')}`;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `aesgcm:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}
function decryptKey(ciphertext) {
  if (!ciphertext) return null;
  if (ciphertext.startsWith('plain:')) return Buffer.from(ciphertext.slice(6), 'base64').toString('utf8');
  if (!ciphertext.startsWith('aesgcm:')) return ciphertext;
  const key = secretKey();
  if (!key) throw new Error('RECALLOS_SECRET_KEY required to decrypt provider key');
  const [, ivB64, tagB64, encB64] = ciphertext.split(':');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encB64, 'base64')), decipher.final()]).toString('utf8');
}
function safeProvider(row) {
  if (!row) return null;
  const { api_key_ciphertext, ...rest } = row;
  return { ...rest, has_api_key: Boolean(api_key_ciphertext || row.api_key_env_var || row.api_key_masked), api_key_storage: row.api_key_env_var ? 'env' : (api_key_ciphertext?.startsWith('aesgcm:') ? 'encrypted' : api_key_ciphertext ? 'local' : row.api_key_masked ? 'masked' : 'none') };
}
async function ensureSchema(client) { await client.query(SCHEMA_SQL); }
async function getApiKey(row) { if (row.api_key_env_var) return process.env[row.api_key_env_var] || null; return decryptKey(row.api_key_ciphertext); }

export async function providerUpsert(args = {}) {
  if (!args.name) throw new Error('name is required');
  if (!args.base_url) throw new Error('base_url is required');
  const id = args.id || providerId(args.name, args.base_url);
  const masked = args.api_key ? maskKey(args.api_key) : args.api_key_masked || null;
  const encrypted = args.api_key ? encryptKey(args.api_key) : null;
  return withPg(async (client) => {
    await ensureSchema(client);
    const existing = await client.query('SELECT * FROM llm_providers WHERE id = $1', [id]);
    const apiCipher = encrypted || existing.rows[0]?.api_key_ciphertext || null;
    const apiMasked = masked || existing.rows[0]?.api_key_masked || null;
    const result = await client.query(
      `INSERT INTO llm_providers (id, name, base_url, api_key_ciphertext, api_key_masked, api_key_env_var, status, metadata_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, base_url=EXCLUDED.base_url, api_key_ciphertext=EXCLUDED.api_key_ciphertext,
       api_key_masked=EXCLUDED.api_key_masked, api_key_env_var=EXCLUDED.api_key_env_var, status=EXCLUDED.status, metadata_json=EXCLUDED.metadata_json, updated_at=NOW()
       RETURNING *`,
      [id, args.name, args.base_url.replace(/\/$/, ''), apiCipher, apiMasked, args.api_key_env_var || null, args.status || 'active', args.metadata || {}]
    );
    await recordProjectSnapshot({ workspace_id: args.workspace_id, project_id: args.project_id || DEFAULT_PROJECT, content: `ForgeBase9 provider configured: ${args.name} at ${args.base_url} key=${apiMasked || args.api_key_env_var || 'none'}`, fact_key: `forge_provider:${id}` }).catch(() => {});
    return safeProvider(result.rows[0]);
  });
}

export async function providerList(args = {}) {
  return withPg(async (client) => {
    await ensureSchema(client);
    const rows = await client.query('SELECT * FROM llm_providers ORDER BY updated_at DESC');
    return rows.rows.map(safeProvider);
  });
}

export async function providerGet(id) {
  return withPg(async (client) => {
    await ensureSchema(client);
    const rows = await client.query('SELECT * FROM llm_providers WHERE id = $1', [id]);
    return rows.rows[0] || null;
  });
}

export async function providerCheck(args = {}) {
  if (!args.provider_id) throw new Error('provider_id is required');
  return withPg(async (client) => {
    await ensureSchema(client);
    const p = (await client.query('SELECT * FROM llm_providers WHERE id = $1', [args.provider_id])).rows[0];
    if (!p) throw new Error('provider not found');
    const apiKey = await getApiKey(p);
    const start = Date.now();
    let ok = false, status = 0, message = '';
    try {
      const res = await fetch(`${p.base_url.replace(/\/$/, '')}/models`, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} });
      status = res.status;
      ok = res.ok;
      message = res.ok ? 'models endpoint reachable' : await res.text().then(t => t.slice(0, 400)).catch(() => res.statusText);
    } catch (e) { message = e.message; }
    const latency = Date.now() - start;
    await client.query('INSERT INTO llm_provider_checks (provider_id, check_type, ok, status_code, message, latency_ms) VALUES ($1,$2,$3,$4,$5,$6)', [p.id, 'models', ok, status, message, latency]);
    return { provider_id: p.id, ok, status_code: status, message, latency_ms: latency };
  });
}

export async function modelUpsert(args = {}) {
  if (!args.provider_id) throw new Error('provider_id is required');
  if (!args.model_id) throw new Error('model_id is required');
  return withPg(async (client) => {
    await ensureSchema(client);
    const id = args.id || modelRowId(args.provider_id, args.model_id);
    const result = await client.query(
      `INSERT INTO llm_model_catalog (id, provider_id, model_id, prefix, family, capabilities_json, status, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (provider_id, model_id) DO UPDATE SET prefix=EXCLUDED.prefix, family=EXCLUDED.family, capabilities_json=EXCLUDED.capabilities_json, status=EXCLUDED.status, last_seen_at=NOW(), updated_at=NOW()
       RETURNING *`,
      [id, args.provider_id, args.model_id, args.prefix || prefixOf(args.model_id), args.family || familyOf(args.model_id), args.capabilities || {}, args.status || 'active']
    );
    return result.rows[0];
  });
}

export async function modelList(args = {}) {
  return withPg(async (client) => {
    await ensureSchema(client);
    const rows = await client.query(`SELECT m.*, p.name AS provider_name FROM llm_model_catalog m JOIN llm_providers p ON p.id=m.provider_id WHERE ($1::text IS NULL OR m.provider_id=$1) ORDER BY m.provider_id, m.model_id`, [args.provider_id || null]);
    return rows.rows;
  });
}

export async function modelDiscover(args = {}) {
  if (!args.provider_id) throw new Error('provider_id is required');
  return withPg(async (client) => {
    await ensureSchema(client);
    const p = (await client.query('SELECT * FROM llm_providers WHERE id = $1', [args.provider_id])).rows[0];
    if (!p) throw new Error('provider not found');
    const apiKey = await getApiKey(p);
    const res = await fetch(`${p.base_url.replace(/\/$/, '')}/models`, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} });
    if (!res.ok) throw new Error(`model discovery failed ${res.status}: ${(await res.text()).slice(0, 400)}`);
    const json = await res.json();
    const ids = Array.isArray(json.data) ? json.data.map(x => x.id || x.name).filter(Boolean) : Array.isArray(json.models) ? json.models.map(x => x.id || x.name || x).filter(Boolean) : [];
    const saved = [];
    for (const model_id of ids) saved.push(await modelUpsert({ provider_id: p.id, model_id, capabilities: { discovered: true } }));
    await providerCheck({ provider_id: p.id }).catch(() => {});
    return { provider_id: p.id, discovered: saved.length, models: saved };
  });
}

export async function assignmentUpsert(args = {}) {
  const workspace_id = args.workspace_id || DEFAULT_WORKSPACE;
  const project_id = args.project_id || DEFAULT_PROJECT;
  const purpose = args.purpose || 'primary';
  if (!args.agent_id) throw new Error('agent_id is required');
  if (!args.provider_id) throw new Error('provider_id is required');
  if (!args.model_id) throw new Error('model_id is required');
  return withPg(async (client) => {
    await ensureSchema(client);
    const id = args.id || assignmentId(workspace_id, project_id, args.agent_id, purpose);
    const result = await client.query(
      `INSERT INTO agent_model_assignments (id, workspace_id, project_id, agent_id, provider_id, model_id, purpose, status, metadata_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (workspace_id, project_id, agent_id, purpose) DO UPDATE SET provider_id=EXCLUDED.provider_id, model_id=EXCLUDED.model_id, status=EXCLUDED.status, metadata_json=EXCLUDED.metadata_json, updated_at=NOW()
       RETURNING *`,
      [id, workspace_id, project_id, args.agent_id, args.provider_id, args.model_id, purpose, args.status || 'active', args.metadata || {}]
    );
    await recordDecision({ workspace_id, project_id, content: `ForgeBase9 agent model assignment: ${args.agent_id}/${purpose} -> ${args.provider_id} ${args.model_id}`, fact_key: `forge_assignment:${project_id}:${args.agent_id}:${purpose}` }).catch(() => {});
    return result.rows[0];
  });
}

export async function assignmentList(args = {}) {
  const workspace_id = args.workspace_id || DEFAULT_WORKSPACE;
  const project_id = args.project_id || DEFAULT_PROJECT;
  return withPg(async (client) => {
    await ensureSchema(client);
    const rows = await client.query(`SELECT a.*, p.name AS provider_name, p.base_url, p.api_key_masked, p.api_key_env_var FROM agent_model_assignments a JOIN llm_providers p ON p.id=a.provider_id WHERE a.workspace_id=$1 AND a.project_id=$2 ORDER BY a.agent_id`, [workspace_id, project_id]);
    return rows.rows.map(r => ({ ...r, has_api_key: Boolean(r.api_key_masked || r.api_key_env_var) }));
  });
}

export async function assignmentResolve(args = {}) {
  const workspace_id = args.workspace_id || DEFAULT_WORKSPACE;
  const project_id = args.project_id || DEFAULT_PROJECT;
  const purpose = args.purpose || 'primary';
  if (!args.agent_id) throw new Error('agent_id is required');
  return withPg(async (client) => {
    await ensureSchema(client);
    const rows = await client.query(`SELECT a.*, p.name AS provider_name, p.base_url, p.api_key_ciphertext, p.api_key_masked, p.api_key_env_var FROM agent_model_assignments a JOIN llm_providers p ON p.id=a.provider_id WHERE a.workspace_id=$1 AND a.project_id=$2 AND a.agent_id=$3 AND a.purpose=$4 AND a.status='active' LIMIT 1`, [workspace_id, project_id, args.agent_id, purpose]);
    const row = rows.rows[0];
    if (!row) return null;
    const api_key = args.include_api_key ? await getApiKey(row) : undefined;
    const { api_key_ciphertext, ...safe } = row;
    return { ...safe, has_api_key: Boolean(row.api_key_ciphertext || row.api_key_env_var), ...(args.include_api_key ? { api_key } : {}) };
  });
}

export async function forgebase9ConfigPack(args = {}) {
  const providers = await providerList(args);
  const models = await modelList(args);
  const assignments = await assignmentList(args);
  return { providers, models, assignments, agents: DEFAULT_AGENTS };
}

export async function seedCurrentForgebase9Config(args = {}) {
  const api_key = args.api_key || process.env.FORGEBASE9_API_KEY || process.env.OPENAI_API_KEY || null;
  const provider = await providerUpsert({ name: '9router', base_url: 'https://9router.may365.cloud/v1', api_key, api_key_masked: args.api_key_masked || 'sk-6...b8f3', workspace_id: DEFAULT_WORKSPACE, project_id: DEFAULT_PROJECT });
  const modelIds = ['cx/gpt-5.5','gemini/gemini-3-flash-preview','ag/claude-sonnet-4-6','cmc/deepseek/deepseek-v4-pro','ag/claude-opus-4-6-thinking'];
  for (const model_id of modelIds) await modelUpsert({ provider_id: provider.id, model_id });
  const map = {
    pm_architecture: 'cx/gpt-5.5',
    analyzer: 'gemini/gemini-3-flash-preview',
    senior_product_designer: 'ag/claude-sonnet-4-6',
    senior_product_coder: 'cmc/deepseek/deepseek-v4-pro',
    product_code_reviewer: 'ag/claude-opus-4-6-thinking',
  };
  for (const [agent_id, model_id] of Object.entries(map)) await assignmentUpsert({ workspace_id: DEFAULT_WORKSPACE, project_id: DEFAULT_PROJECT, agent_id, provider_id: provider.id, model_id });
  await recordSystemEvent({ workspace_id: DEFAULT_WORKSPACE, project_id: DEFAULT_PROJECT, event_type: 'system_event', content: 'Seeded ForgeBase9 provider/model registry with current 9router models and agent assignments.', fact_key: 'forge_registry:seeded_current_config' }).catch(() => {});
  return forgebase9ConfigPack({});
}
