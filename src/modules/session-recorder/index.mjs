import fs from 'node:fs/promises';
import { withPg } from '../../runtime/pg.mjs';
import { writeEvent, createEventChunk } from '../memory/layers/raw.mjs';
import { upsertFact } from '../memory/layers/active.mjs';

const DEFAULT_WORKSPACE = 'default';
const DEFAULT_PROJECT = 'recallos-runtime';
const EVENT_TYPES = new Set([
  'user_request', 'assistant_action', 'assistant_response', 'file_change', 'command_result',
  'decision', 'error', 'build_result', 'git_event', 'system_event', 'tool_call', 'mcp_call',
  'artifact_update', 'project_snapshot', 'session_summary', 'workflow_event'
]);

function safeJson(value) {
  try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return value; }
}

function truncate(text = '', max = 8000) {
  const s = String(text || '');
  return s.length > max ? `${s.slice(0, max)}\n...[truncated ${s.length - max} chars]` : s;
}

function factKey(eventType, content, explicit) {
  if (explicit) return explicit;
  const basis = `${eventType}:${content}`.slice(0, 160).replace(/\s+/g, ' ').trim();
  return `${eventType}:${basis}`.replace(/[^a-zA-Z0-9:_\-. ]/g, '').slice(0, 180);
}

export async function recordSessionEvent(args = {}) {
  return withPg(async (client) => {
    const workspace_id = args.workspace_id || DEFAULT_WORKSPACE;
    const project_id = args.project_id || DEFAULT_PROJECT;
    const event_type = args.event_type || 'system_event';
    if (!EVENT_TYPES.has(event_type)) throw new Error(`Invalid session event_type: ${event_type}`);
    const actor = args.actor || 'assistant';
    const content = truncate(args.content || args.summary || '');
    const metadata = args.metadata || {};
    const session_id = args.session_id || args.conversation_id || args.run_id || 'antigravity-session';
    const event = await writeEvent(client, {
      session_id,
      actor,
      event_type,
      content,
      metadata,
      workspace_id,
      project_id,
      agent_id: args.agent_id || null,
      task_id: args.task_id || null,
      run_id: args.run_id || null,
    });
    await createEventChunk(client, event.id, content);
    let fact = null;
    if (args.promote_to_fact !== false) {
      fact = await upsertFact(client, {
        scope: args.fact_scope || scopeForEvent(event_type),
        key: factKey(event_type, content, args.fact_key),
        value: truncate(args.fact_value || content, 2500),
        confidence: args.confidence ?? confidenceForEvent(event_type),
        source_ids: [event.id],
        workspace_id,
        project_id,
        agent_id: args.agent_id || null,
        pair_key: args.pair_key || null,
        task_id: args.task_id || null,
        session_id,
        run_id: args.run_id || null,
      });
    }
    return { event_id: event.id, fact_id: fact?.id || null };
  });
}

function scopeForEvent(eventType) {
  if (eventType === 'user_request') return 'user_request';
  if (eventType === 'decision') return 'decision';
  if (eventType === 'file_change') return 'implementation';
  if (eventType === 'command_result' || eventType === 'build_result') return 'validation';
  if (eventType === 'git_event') return 'git';
  if (eventType === 'error') return 'issue';
  if (eventType === 'project_snapshot') return 'project_state';
  return 'session';
}

function confidenceForEvent(eventType) {
  if (['user_request', 'decision', 'build_result', 'git_event', 'project_snapshot'].includes(eventType)) return 1;
  if (['file_change', 'command_result', 'error'].includes(eventType)) return 0.9;
  return 0.75;
}

export const recordUserRequest = (args) => recordSessionEvent({ ...args, event_type: 'user_request', actor: 'user', fact_scope: 'user_request' });
export const recordAssistantAction = (args) => recordSessionEvent({ ...args, event_type: 'assistant_action', actor: args.actor || 'assistant' });
export const recordFileChange = (args) => recordSessionEvent({ ...args, event_type: 'file_change', actor: args.actor || 'assistant', fact_scope: 'implementation' });
export const recordCommandResult = (args) => recordSessionEvent({ ...args, event_type: 'command_result', actor: args.actor || 'assistant', fact_scope: 'validation' });
export const recordDecision = (args) => recordSessionEvent({ ...args, event_type: 'decision', actor: args.actor || 'assistant', fact_scope: 'decision' });
export const recordError = (args) => recordSessionEvent({ ...args, event_type: 'error', actor: args.actor || 'system', fact_scope: 'issue' });
export const recordBuildResult = (args) => recordSessionEvent({ ...args, event_type: 'build_result', actor: args.actor || 'assistant', fact_scope: 'validation' });
export const recordGitEvent = (args) => recordSessionEvent({ ...args, event_type: 'git_event', actor: args.actor || 'assistant', fact_scope: 'git' });
export const recordSystemEvent = (args) => recordSessionEvent({ ...args, event_type: 'system_event', actor: args.actor || 'system' });
export const recordProjectSnapshot = (args) => recordSessionEvent({ ...args, event_type: 'project_snapshot', actor: args.actor || 'assistant', fact_scope: 'project_state', confidence: 1 });

function contentFromStep(step) {
  if (typeof step?.content === 'string') return step.content;
  if (step?.content?.text) return step.content.text;
  if (step?.tool_calls) return JSON.stringify(step.tool_calls).slice(0, 6000);
  return JSON.stringify(step || {}).slice(0, 6000);
}

function classifyTranscriptStep(step) {
  const type = String(step?.type || '').toLowerCase();
  const source = String(step?.source || '').toLowerCase();
  const content = contentFromStep(step);
  if (type.includes('user_input') || source.includes('user_explicit')) return { event_type: 'user_request', actor: 'user', promote: true };
  if (type.includes('run_command') || content.includes('CommandLine')) return { event_type: 'command_result', actor: 'assistant', promote: true };
  if (type.includes('write') || type.includes('replace') || type.includes('file')) return { event_type: 'file_change', actor: 'assistant', promote: true };
  if (type.includes('mcp') || content.includes('call_mcp_tool')) return { event_type: 'mcp_call', actor: 'assistant', promote: true };
  if (type.includes('final') || source.includes('model')) return { event_type: 'assistant_response', actor: 'assistant', promote: false };
  if (String(step?.status || '').toLowerCase().includes('error')) return { event_type: 'error', actor: 'system', promote: true };
  return { event_type: 'system_event', actor: 'system', promote: false };
}

export async function importTranscript(args = {}) {
  const transcript_path = args.transcript_path;
  if (!transcript_path) throw new Error('transcript_path is required');
  const raw = await fs.readFile(transcript_path, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  let imported = 0;
  let skipped = 0;
  for (const line of lines) {
    let step;
    try { step = JSON.parse(line); } catch { skipped++; continue; }
    const cls = classifyTranscriptStep(step);
    const content = truncate(contentFromStep(step), args.max_content_chars || 6000);
    if (!content.trim()) { skipped++; continue; }
    await recordSessionEvent({
      workspace_id: args.workspace_id,
      project_id: args.project_id,
      session_id: args.session_id || args.conversation_id,
      conversation_id: args.conversation_id,
      event_type: cls.event_type,
      actor: cls.actor,
      content,
      metadata: { step_index: step.step_index, type: step.type, source: step.source, status: step.status },
      promote_to_fact: cls.promote,
      fact_key: `transcript:${args.conversation_id || 'conversation'}:${step.step_index}`,
    });
    imported++;
    if (args.limit && imported >= args.limit) break;
  }
  await summarizeSessionToFacts({ workspace_id: args.workspace_id, project_id: args.project_id, session_id: args.session_id || args.conversation_id });
  return { imported, skipped, total: lines.length };
}

export async function summarizeSessionToFacts(args = {}) {
  return withPg(async (client) => {
    const workspace_id = args.workspace_id || DEFAULT_WORKSPACE;
    const project_id = args.project_id || DEFAULT_PROJECT;
    const session_id = args.session_id || 'antigravity-session';
    const events = await client.query(
      `SELECT event_type, actor, LEFT(content, 600) AS content, created_at FROM memory_events
       WHERE session_id = $1 AND project_id = $2 ORDER BY created_at DESC LIMIT 80`,
      [session_id, project_id]
    );
    const counts = events.rows.reduce((acc, e) => { acc[e.event_type] = (acc[e.event_type] || 0) + 1; return acc; }, {});
    const summary = [`Session ${session_id}: ${events.rows.length} recent events`, JSON.stringify(counts), ...events.rows.slice(0, 20).map(e => `- [${e.event_type}] ${e.actor}: ${e.content}`)].join('\n');
    const fact = await upsertFact(client, {
      scope: 'session_summary',
      key: `session:${session_id}`,
      value: truncate(summary, 4000),
      confidence: 1,
      source_ids: [],
      workspace_id,
      project_id,
      session_id,
    });
    return { fact_id: fact.id, events: events.rows.length, counts };
  });
}

export async function resumeContext(args = {}) {
  return withPg(async (client) => {
    const workspace_id = args.workspace_id || DEFAULT_WORKSPACE;
    const project_id = args.project_id || DEFAULT_PROJECT;
    const session_id = args.session_id || args.conversation_id || null;
    const limit = args.limit || 20;
    const sessCond = session_id ? 'AND session_id = $3' : '';
    const params = session_id ? [workspace_id, project_id, session_id, limit] : [workspace_id, project_id, limit];
    const limIdx = session_id ? 4 : 3;
    const events = await client.query(
      `SELECT event_type, actor, content, created_at, run_id, task_id FROM memory_events
       WHERE workspace_id = $1 AND project_id = $2 ${sessCond}
       ORDER BY created_at DESC LIMIT $${limIdx}`,
      params
    );
    const facts = await client.query(
      `SELECT scope, key, value, confidence, updated_at FROM memory_facts
       WHERE workspace_id = $1 AND project_id = $2 ${session_id ? 'AND (session_id = $3 OR session_id IS NULL)' : ''}
       ORDER BY confidence DESC, updated_at DESC LIMIT $${limIdx}`,
      params
    );
    const chunks = await client.query(
      `SELECT source_type, LEFT(text, 700) AS text, created_at, embedding IS NOT NULL AS has_embedding FROM memory_chunks ORDER BY created_at DESC LIMIT $1`,
      [Math.min(limit, 12)]
    );
    const sections = ['# RecallOS Session Resume Context'];
    sections.push(`\n## Project\nworkspace_id=${workspace_id}\nproject_id=${project_id}${session_id ? `\nsession_id=${session_id}` : ''}`);
    sections.push(`\n## Current Facts (${facts.rows.length})`);
    for (const f of facts.rows) sections.push(`- **${f.scope}/${f.key}** (${f.confidence}): ${f.value}`);
    sections.push(`\n## Recent Events (${events.rows.length})`);
    for (const e of events.rows) sections.push(`- **[${e.event_type}]** ${e.actor} (${e.created_at}): ${String(e.content).slice(0, 600)}`);
    sections.push(`\n## Recent Context Chunks (${chunks.rows.length})`);
    for (const c of chunks.rows) sections.push(`- **${c.source_type}** vector=${c.has_embedding}: ${c.text}`);
    return sections.join('\n');
  });
}
