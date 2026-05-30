import { withPg } from '../../runtime/pg.mjs';
import { withDb } from '../../runtime/db.mjs';
import { memoryWriteEvent, memoryUpsertFact } from '../memory/index.mjs';
import { rememberKnowledge } from '../knowledge-base/index.mjs';
const q = (sql, params = []) => withPg((client) => client.query(sql, params).then((r) => r.rows));

export async function ensureMemoryCaptureSchema() {
  await q(`CREATE TABLE IF NOT EXISTS memory_capture_policy (
    id TEXT PRIMARY KEY DEFAULT 'default',
    mode TEXT DEFAULT 'review_first',
    min_confidence NUMERIC DEFAULT 0.75,
    auto_commit_types TEXT[] DEFAULT ARRAY[]::TEXT[],
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await q(`CREATE TABLE IF NOT EXISTS memory_capture_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL,
    source_id TEXT,
    candidate_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence NUMERIC DEFAULT 0.7,
    suggested_tool TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    reason TEXT,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    decided_at TIMESTAMPTZ
  )`);
  await q(`INSERT INTO memory_capture_policy (id) VALUES ('default') ON CONFLICT (id) DO NOTHING`);
}

function candidate(type, title, content, confidence, tool, reason, metadata = {}) { return { candidate_type:type, title, content, confidence, suggested_tool:tool, reason, metadata }; }
function lines(text) { return String(text || '').split(/\r?\n/).map(l=>l.trim()).filter(Boolean); }

export function analyzeText({ text = '', source_type = 'assistant_response', source_id = null, metadata = {} }) {
  const out = [];
  const ls = lines(text);
  for (const l of ls) {
    const low = l.toLowerCase();
    if (/decision|quyết định|đã chọn|chọn hướng/.test(low)) out.push(candidate('decision','Decision candidate',l,0.82,'recall_kb_decision','decision keyword',metadata));
    if (/root cause|nguyên nhân|bug|error|lỗi/.test(low)) out.push(candidate('bug','Bug/error candidate',l,0.78,'recall_kb_bug','bug/error keyword',metadata));
    if (/constraint|must|must not|không được|bắt buộc|rule/.test(low)) out.push(candidate('constraint','Constraint candidate',l,0.76,'recall_kb_remember','constraint keyword',metadata));
    if (/fact|hiện tại|current|status|đang|đã/.test(low)) out.push(candidate('fact','Fact candidate',l,0.68,'recall_memory_upsert_fact','fact/status keyword',metadata));
    if (/handoff|bàn giao|from .* to |→/.test(low)) out.push(candidate('handoff','Handoff candidate',l,0.74,'recall_agent_handoff_update','handoff keyword',metadata));
  }
  if (out.length === 0 && text.length > 80) out.push(candidate('event','Session event candidate',String(text).slice(0,80),String(text).slice(0,1200),0.55,'recall_memory_write_event','fallback event summary',metadata));
  return out.map(c => ({ ...c, source_type, source_id }));
}

export async function memoryCaptureAnalyze(args) {
  await ensureMemoryCaptureSchema();
  const candidates = analyzeText(args);
  const inserted = [];
  for (const c of candidates) {
    const rows = await q(`INSERT INTO memory_capture_candidates (source_type,source_id,candidate_type,title,content,confidence,suggested_tool,reason,metadata_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [c.source_type,c.source_id,c.candidate_type,c.title,c.content,c.confidence,c.suggested_tool,c.reason,c.metadata]);
    inserted.push(rows[0]);
  }
  return JSON.stringify({ candidates: inserted }, null, 2);
}

export async function memoryCapturePolicy(args = {}) {
  await ensureMemoryCaptureSchema();
  if (args.mode || args.min_confidence || args.auto_commit_types) await q(`UPDATE memory_capture_policy SET mode=COALESCE($1,mode), min_confidence=COALESCE($2,min_confidence), auto_commit_types=COALESCE($3,auto_commit_types), updated_at=NOW() WHERE id='default'`, [args.mode || null, args.min_confidence || null, args.auto_commit_types || null]);
  const rows = await q(`SELECT * FROM memory_capture_policy WHERE id='default'`);
  return JSON.stringify(rows[0], null, 2);
}

export async function memoryCaptureList(args = {}) {
  await ensureMemoryCaptureSchema();
  const rows = await q(`SELECT * FROM memory_capture_candidates WHERE status=$1 ORDER BY created_at DESC LIMIT $2`, [args.status || 'pending', args.limit || 50]);
  return JSON.stringify({ candidates: rows }, null, 2);
}

export async function memoryCaptureCommit(args) {
  await ensureMemoryCaptureSchema();
  const rows = await q(`SELECT * FROM memory_capture_candidates WHERE id=$1`, [args.id]);
  const c = rows[0];
  if (!c) throw new Error('candidate not found');
  if (args.decision === 'reject') { await q(`UPDATE memory_capture_candidates SET status='rejected', decided_at=NOW() WHERE id=$1`, [args.id]); return JSON.stringify({ ok:true, status:'rejected', id:args.id }); }
  let result = null;
  if (c.suggested_tool === 'recall_memory_upsert_fact') result = await memoryUpsertFact({ scope: args.scope || 'project', key: args.key || c.title.toLowerCase().replace(/\W+/g,'_').slice(0,80), value: c.content, confidence: Number(c.confidence || 0.7), project_id: args.project_id, agent_id: args.agent_id });
  else if (c.suggested_tool === 'recall_memory_write_event') result = await memoryWriteEvent({ actor:'main_agent', event_type:'observation', content:c.content, metadata:c.metadata_json, embed:true, project_id:args.project_id, agent_id:args.agent_id });
  else if (c.suggested_tool === 'recall_kb_decision') result = withDb((database) => rememberKnowledge(database, { title:c.title, type:'decision', content:`Decision: ${c.content}\n\nReason: ${c.reason || 'memory capture candidate'}`, tags:['memory-capture','decision'] }));
  else if (c.suggested_tool === 'recall_kb_bug') result = withDb((database) => rememberKnowledge(database, { title:c.title, type:'bug', content:`Root cause: ${c.content}\n\nFix: Captured for follow-up review`, tags:['memory-capture','bug','fix'] }));
  else result = withDb((database) => rememberKnowledge(database, { type:'note', title:c.title, content:c.content, tags:['memory-capture', c.candidate_type] }));
  await q(`UPDATE memory_capture_candidates SET status='committed', decided_at=NOW() WHERE id=$1`, [args.id]);
  return JSON.stringify({ ok:true, status:'committed', id:args.id, result }, null, 2);
}
