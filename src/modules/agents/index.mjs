// Agents module — identity, messaging, handoffs, pair memory

import { createHash } from 'node:crypto';
import { withPg } from '../../runtime/pg.mjs';

const DEFAULT_WORKSPACE = 'default';
const DEFAULT_PROJECT = 'default';
const PAIR_TYPES = new Set(['protocol', 'constraint', 'preference', 'issue', 'checklist', 'decision', 'summary']);

// --- Pair key helper ---
function makePairKey(a, b) {
  return [String(a || '').trim(), String(b || '').trim()].sort().join(':');
}

function stablePairMemoryId({ workspace_id, project_id, pair_key, type, title, content }) {
  const raw = [workspace_id, project_id, pair_key, type, title || '', content].join('\n');
  return `pmem_${createHash('sha1').update(raw).digest('hex').slice(0, 24)}`;
}

function normalizePairMemoryArgs(args = {}) {
  const agent_a = args.agent_a || args.agentA;
  const agent_b = args.agent_b || args.agentB;
  if (!agent_a || !agent_b) throw new Error('agent_a and agent_b are required');
  const pair_key = makePairKey(agent_a, agent_b);
  const type = args.type || 'summary';
  if (!PAIR_TYPES.has(type)) throw new Error(`Invalid pair memory type: ${type}`);
  const workspace_id = args.workspace_id || DEFAULT_WORKSPACE;
  const project_id = args.project_id || DEFAULT_PROJECT;
  return { ...args, workspace_id, project_id, agent_a, agent_b, pair_key, type };
}

export function pairMemoryFormat(rows = []) {
  if (!rows.length) return 'No pair memory found.';
  const lines = [`# Pair Memory (${rows.length})\n`];
  for (const r of rows) {
    lines.push(`## ${r.pair_key} · ${r.type}${r.title ? ` · ${r.title}` : ''}`);
    lines.push(`- status: ${r.status} · importance: ${r.importance}`);
    lines.push(`${r.content}\n`);
  }
  return lines.join('\n');
}

export async function pairMemoryUpsert(args) {
  const m = normalizePairMemoryArgs(args);
  if (!m.content) throw new Error('content is required');
  const id = m.id || stablePairMemoryId(m);
  return withPg(async (client) => {
    const result = await client.query(
      `INSERT INTO pair_memories (id, workspace_id, project_id, agent_a, agent_b, pair_key, type, title, content, importance, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         agent_a = EXCLUDED.agent_a,
         agent_b = EXCLUDED.agent_b,
         pair_key = EXCLUDED.pair_key,
         type = EXCLUDED.type,
         title = EXCLUDED.title,
         content = EXCLUDED.content,
         importance = EXCLUDED.importance,
         status = EXCLUDED.status,
         updated_at = NOW()
       RETURNING *`,
      [id, m.workspace_id, m.project_id, m.agent_a, m.agent_b, m.pair_key, m.type,
       m.title || null, m.content, m.importance ?? 0.5, m.status || 'active']
    );
    return `Pair memory upserted: ${result.rows[0].id} (${m.pair_key}/${m.type})`;
  });
}

export async function pairMemorySearch(args = {}) {
  const workspace_id = args.workspace_id || DEFAULT_WORKSPACE;
  const project_id = args.project_id || DEFAULT_PROJECT;
  const limit = Math.min(args.limit || 20, 100);
  const conditions = ['workspace_id = $1', 'project_id = $2'];
  const params = [workspace_id, project_id];
  if (args.agent_a && args.agent_b) {
    conditions.push(`pair_key = $${params.length + 1}`);
    params.push(makePairKey(args.agent_a, args.agent_b));
  } else if (args.pair_key) {
    conditions.push(`pair_key = $${params.length + 1}`);
    params.push(args.pair_key);
  }
  if (args.type) { conditions.push(`type = $${params.length + 1}`); params.push(args.type); }
  if (args.status !== 'all') { conditions.push(`status = $${params.length + 1}`); params.push(args.status || 'active'); }
  if (args.query) {
    conditions.push(`(title ILIKE $${params.length + 1} OR content ILIKE $${params.length + 1})`);
    params.push(`%${args.query}%`);
  }
  return withPg(async (client) => {
    const result = await client.query(
      `SELECT * FROM pair_memories WHERE ${conditions.join(' AND ')} ORDER BY importance DESC, updated_at DESC LIMIT $${params.length + 1}`,
      [...params, limit]
    );
    return pairMemoryFormat(result.rows);
  });
}

const DEFAULT_PAIR_MEMORIES = [
  ['assistant', 'pm_architecture', 'protocol', 'Assistant ↔ PM routing', 'Assistant asks PM Architecture for plan, architecture, task split, and final gate before major implementation.', 0.8],
  ['assistant', 'pm_architecture', 'preference', 'PM output format', 'PM Architecture should return: plan, files/components, risks, acceptance criteria, and final decision.', 0.75],
  ['pm_architecture', 'analyzer', 'protocol', 'Analysis handoff', 'PM sends Analyzer broad context and questions. Analyzer returns concise facts, relevant files/symbols, uncertainty, and token-saving summary.', 0.8],
  ['pm_architecture', 'analyzer', 'constraint', 'Analyzer stays concise', 'Analyzer should not implement code; it reads many files, extracts context, and summarizes only reusable facts.', 0.7],
  ['pm_architecture', 'designer', 'protocol', 'UI design handoff', 'Designer receives product goal, target pages/components, constraints, current UI issues, and returns design system, layout, interaction states, and CSS/Tailwind guidance.', 0.8],
  ['pm_architecture', 'designer', 'preference', 'Premium dark UI', 'Designer prefers premium dark mode, clear hierarchy, responsive layout, accessible contrast, and reusable components.', 0.7],
  ['pm_architecture', 'coder', 'protocol', 'Implementation handoff', 'Coder only receives task when PM provides target files/components, acceptance criteria, constraints, and test plan.', 0.9],
  ['pm_architecture', 'coder', 'constraint', 'Schema changes need PM approval', 'Coder must not change DB schema or public tool names unless PM Architecture explicitly permits it.', 0.9],
  ['pm_architecture', 'coder', 'checklist', 'Coder output schema', 'Coder must return changed_files, patch_summary, risk_notes, and test_plan.', 0.85],
  ['coder', 'reviewer', 'protocol', 'Review handoff', 'Coder sends changed_files, patch_summary, risk_notes, and test results. Reviewer checks logic, security, performance, and regression.', 0.9],
  ['coder', 'reviewer', 'checklist', 'Reviewer output schema', 'Reviewer returns severity, evidence, required fixes, regression risk, and final approve/request-changes decision.', 0.85],
  ['coder', 'reviewer', 'issue', 'Avoid style-only review noise', 'Reviewer should not nitpick style unless it affects correctness, maintainability, security, or performance.', 0.65],
];

export async function pairMemorySeedDefaults(args = {}) {
  const workspace_id = args.workspace_id || DEFAULT_WORKSPACE;
  const project_id = args.project_id || DEFAULT_PROJECT;
  const results = [];
  for (const [agent_a, agent_b, type, title, content, importance] of DEFAULT_PAIR_MEMORIES) {
    results.push(await pairMemoryUpsert({ workspace_id, project_id, agent_a, agent_b, type, title, content, importance }));
  }
  return `Seeded ${results.length} default pair memories for ${workspace_id}/${project_id}.`;
}

export function pairMemoryExtractCandidates(args = {}) {
  const text = String(args.agent_response || args.content || '');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const candidates = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    let type = null;
    if (/\b(constraint|must not|must|không được|bắt buộc)\b/i.test(lower)) type = 'constraint';
    else if (/\b(format|schema|output)\b/i.test(lower)) type = 'preference';
    else if (/\b(checklist|verify|test plan)\b/i.test(lower)) type = 'checklist';
    else if (/\b(decision|decide|accepted)\b/i.test(lower)) type = 'decision';
    else if (/\b(error|bug|issue|avoid|regression|lỗi)\b/i.test(lower)) type = 'issue';
    if (type) candidates.push({ type, title: line.slice(0, 90), content: line, importance: type === 'constraint' ? 0.8 : 0.6 });
  }
  return candidates;
}

export async function pairMemoryExtract(args = {}) {
  const normalized = normalizePairMemoryArgs({ ...args, type: args.type || 'summary', content: args.agent_response || args.content || 'placeholder' });
  const candidates = pairMemoryExtractCandidates(args);
  if (args.dry_run !== false) {
    return JSON.stringify({ pair_key: normalized.pair_key, candidates }, null, 2);
  }
  const written = [];
  for (const c of candidates) {
    written.push(await pairMemoryUpsert({ ...normalized, ...c }));
  }
  return `Extracted ${candidates.length} candidates for ${normalized.pair_key}.\n${written.join('\n')}`;
}

// --- Agent Identity ---

export async function agentRegister(args) {
  return withPg(async (client) => {
    const result = await client.query(
      `INSERT INTO agents (id, name, role, model_id, system_prompt, capabilities_json)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         model_id = COALESCE(EXCLUDED.model_id, agents.model_id),
         system_prompt = COALESCE(EXCLUDED.system_prompt, agents.system_prompt),
         capabilities_json = COALESCE(EXCLUDED.capabilities_json, agents.capabilities_json)
       RETURNING id, name, role, created_at`,
      [args.id, args.name, args.role, args.model_id || null,
       args.system_prompt || null, JSON.stringify(args.capabilities || [])]
    );
    const a = result.rows[0];
    return `Agent registered: ${a.id} (${a.name}, ${a.role})`;
  });
}

export async function agentList(args = {}) {
  return withPg(async (client) => {
    const conditions = [];
    const params = [];
    if (args.role) { conditions.push(`role = $${params.length + 1}`); params.push(args.role); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await client.query(`SELECT * FROM agents ${where} ORDER BY id`, params);
    if (result.rows.length === 0) return 'No agents registered.';
    const lines = [`# Registered Agents (${result.rows.length})\n`];
    for (const a of result.rows) {
      lines.push(`- **${a.id}** (${a.name}) — role: ${a.role}, model: ${a.model_id || '(none)'}, capabilities: ${JSON.stringify(a.capabilities_json)}`);
    }
    return lines.join('\n');
  });
}

export async function agentGet(args) {
  return withPg(async (client) => {
    const result = await client.query('SELECT * FROM agents WHERE id = $1', [args.agent_id]);
    if (result.rows.length === 0) return `Agent not found: ${args.agent_id}`;
    const a = result.rows[0];
    return `# Agent: ${a.id}\n\n- Name: ${a.name}\n- Role: ${a.role}\n- Model: ${a.model_id || '(none)'}\n- System Prompt: ${a.system_prompt || '(none)'}\n- Capabilities: ${JSON.stringify(a.capabilities_json)}\n- Created: ${a.created_at}`;
  });
}

// --- Agent Messages ---

export async function agentSendMessage(args) {
  return withPg(async (client) => {
    const result = await client.query(
      `INSERT INTO agent_messages (workspace_id, project_id, run_id, task_id, from_agent_id, to_agent_id, message_type, content, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, created_at`,
      [args.workspace_id || null, args.project_id || 'default', args.run_id || null,
       args.task_id || null, args.from_agent_id, args.to_agent_id,
       args.message_type || 'message', args.content, args.summary || null]
    );
    return `Message sent: ${result.rows[0].id} (${args.from_agent_id} → ${args.to_agent_id})`;
  });
}

export async function agentGetMessages(args) {
  return withPg(async (client) => {
    const conditions = [];
    const params = [];
    if (args.agent_id) { conditions.push(`(from_agent_id = $${params.length + 1} OR to_agent_id = $${params.length + 1})`); params.push(args.agent_id); }
    if (args.task_id) { conditions.push(`task_id = $${params.length + 1}`); params.push(args.task_id); }
    if (args.run_id) { conditions.push(`run_id = $${params.length + 1}`); params.push(args.run_id); }
    if (args.message_type) { conditions.push(`message_type = $${params.length + 1}`); params.push(args.message_type); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = args.limit || 20;
    const result = await client.query(`SELECT * FROM agent_messages ${where} ORDER BY created_at DESC LIMIT $${params.length + 1}`, [...params, limit]);
    if (result.rows.length === 0) return 'No messages found.';
    const lines = [`# Agent Messages (${result.rows.length})\n`];
    for (const m of result.rows) {
      lines.push(`**[${m.message_type}]** ${m.from_agent_id} → ${m.to_agent_id} (${m.created_at})`);
      lines.push(`${m.content.slice(0, 300)}${m.content.length > 300 ? '...' : ''}\n`);
    }
    return lines.join('\n');
  });
}

export async function agentGetConversation(args) {
  return withPg(async (client) => {
    const conditions = [`((from_agent_id = $1 AND to_agent_id = $2) OR (from_agent_id = $2 AND to_agent_id = $1))`];
    const params = [args.agent_a, args.agent_b];
    if (args.task_id) { conditions.push(`task_id = $${params.length + 1}`); params.push(args.task_id); }
    if (args.run_id) { conditions.push(`run_id = $${params.length + 1}`); params.push(args.run_id); }
    const limit = args.limit || 30;
    const result = await client.query(`SELECT * FROM agent_messages WHERE ${conditions.join(' AND ')} ORDER BY created_at ASC LIMIT $${params.length + 1}`, [...params, limit]);
    if (result.rows.length === 0) return `No conversation between ${args.agent_a} and ${args.agent_b}.`;
    const lines = [`# Conversation: ${args.agent_a} ↔ ${args.agent_b} (${result.rows.length} messages)\n`];
    for (const m of result.rows) {
      lines.push(`**${m.from_agent_id}** (${m.message_type}, ${m.created_at}):`);
      lines.push(`${m.content}\n`);
    }
    return lines.join('\n');
  });
}

// --- Agent Handoffs ---

export async function agentHandoff(args) {
  return withPg(async (client) => {
    const from = args.from_agent_id || args.from_agent;
    const to = args.to_agent_id || args.to_agent;
    const objective = args.objective || args.task_title;
    const payload = {
      ...(args.task_payload || {}),
      ...(args.task_type ? { task_type: args.task_type } : {}),
      ...(args.workspace_id ? { workspace_id: args.workspace_id } : {}),
      project_id: args.project_id || 'default',
      ...(args.objective ? { objective: args.objective } : {}),
      ...(args.required_context ? { required_context: args.required_context } : {}),
      ...(args.constraints ? { constraints: args.constraints } : {}),
      ...(args.expected_output ? { expected_output: args.expected_output } : {}),
      pair_key: makePairKey(from, to),
    };
    const result = await client.query(
      `INSERT INTO agent_handoffs (from_agent_id, to_agent_id, project_id, task_title, task_payload_json)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [from, to, args.project_id || 'default', objective, JSON.stringify(payload)]
    );
    return `Handoff created: ${result.rows[0].id} (${from} → ${to}: ${objective})`;
  });
}

export async function agentHandoffUpdate(args) {
  return withPg(async (client) => {
    const sets = ['updated_at = NOW()'];
    const params = [args.handoff_id];
    if (args.status) { sets.push(`status = $${params.length + 1}`); params.push(args.status); }
    if (args.result_summary) { sets.push(`result_summary = $${params.length + 1}`); params.push(args.result_summary); }
    const result = await client.query(`UPDATE agent_handoffs SET ${sets.join(', ')} WHERE id = $1 RETURNING id, status, updated_at`, params);
    if (result.rows.length === 0) return `Handoff not found: ${args.handoff_id}`;
    return `Handoff updated: ${result.rows[0].id} (status: ${result.rows[0].status})`;
  });
}

export async function agentHandoffList(args) {
  return withPg(async (client) => {
    const conditions = [];
    const params = [];
    if (args.agent_id) {
      const dir = args.direction || 'both';
      if (dir === 'incoming') { conditions.push(`to_agent_id = $${params.length + 1}`); params.push(args.agent_id); }
      else if (dir === 'outgoing') { conditions.push(`from_agent_id = $${params.length + 1}`); params.push(args.agent_id); }
      else { conditions.push(`(from_agent_id = $${params.length + 1} OR to_agent_id = $${params.length + 1})`); params.push(args.agent_id); }
    }
    if (args.status) { conditions.push(`status = $${params.length + 1}`); params.push(args.status); }
    if (args.project_id) { conditions.push(`project_id = $${params.length + 1}`); params.push(args.project_id); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await client.query(`SELECT * FROM agent_handoffs ${where} ORDER BY created_at DESC LIMIT 20`, params);
    if (result.rows.length === 0) return 'No handoffs found.';
    const lines = [`# Agent Handoffs (${result.rows.length})\n`];
    for (const h of result.rows) lines.push(`- **${h.task_title}** (${h.status}): ${h.from_agent_id} → ${h.to_agent_id}${h.result_summary ? ` — result: ${h.result_summary.slice(0, 100)}` : ''}`);
    return lines.join('\n');
  });
}

export { makePairKey };
