// Context Orchestrator — top-level context assembly across all modules
//
// recall_context_pack          → Full Agent Context (all 4 modules)
// recall_context_for_task      → Focused task context (related only)
// recall_context_for_worker    → Minimal sub-agent context
// recall_context_for_agent     → Agent-specific context with identity
// recall_context_for_handoff   → Handoff receiving context
// recall_context_for_pair      → Pair collaboration context

import { withPg } from '../../runtime/pg.mjs';
import { withDb } from '../../runtime/db.mjs';
import { memorySearch, memoryGetProfile } from '../memory/index.mjs';
import { searchKnowledge, formatKnowledge } from '../knowledge-base/index.mjs';
import { getCodeGraphContext, searchCodeGraph } from '../codegraph/index.mjs';
import { makePairKey, pairMemoryFormat } from '../agents/index.mjs';
import { resumeContext } from '../session-recorder/index.mjs';

const DEFAULT_PROJECT = 'default';

function extractKeywords(text, symbols = []) {
  const words = String(text || '').split(/\s+/).filter(w => w.length >= 3).slice(0, 15);
  return [...new Set([...words, ...(symbols || [])])];
}

function truncSection(text, max = 3000) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + '\n\n_(truncated)_';
}

async function fetchProjectBrainContext(client, pid, keywords, opts = {}) {
  const sections = [];
  if (opts.includeOverview !== false) {
    const overview = await client.query(
      `SELECT title, content FROM project_docs WHERE project_id = $1 AND doc_type = 'overview' AND status = 'active' ORDER BY updated_at DESC LIMIT 1`, [pid]
    );
    if (overview.rows[0]) sections.push(`## Project Overview\n\n${truncSection(overview.rows[0].content, 2000)}\n`);
  }
  if (opts.includeArchitecture !== false) {
    const arch = await client.query(
      `SELECT title, content FROM project_docs WHERE project_id = $1 AND doc_type = 'architecture' AND status = 'active' ORDER BY updated_at DESC LIMIT 1`, [pid]
    );
    if (arch.rows[0]) sections.push(`## Architecture\n\n${truncSection(arch.rows[0].content, 2000)}\n`);
  }
  const modules = await client.query(
    `SELECT name, purpose, status FROM project_modules WHERE project_id = $1 AND status = 'active' ORDER BY name`, [pid]
  );
  if (modules.rows.length > 0) {
    sections.push(`## Modules (${modules.rows.length})\n`);
    for (const m of modules.rows) sections.push(`- **${m.name}**: ${m.purpose}`);
    sections.push('');
  }
  if (keywords.length > 0) {
    const conds = keywords.map((_, i) => `(title ILIKE $${i + 2} OR decision ILIKE $${i + 2})`);
    const params = [pid, ...keywords.map(k => `%${k}%`)];
    const decisions = await client.query(
      `SELECT title, decision, reason FROM project_decisions WHERE project_id = $1 AND status = 'accepted' AND (${conds.join(' OR ')}) ORDER BY created_at DESC LIMIT 8`, params
    );
    if (decisions.rows.length > 0) {
      sections.push(`## Related Decisions (${decisions.rows.length})\n`);
      for (const d of decisions.rows) sections.push(`- **${d.title}**: ${d.decision}${d.reason ? ` — _${d.reason}_` : ''}`);
      sections.push('');
    }
  }
  const roadmap = await client.query(
    `SELECT title, priority, status, milestone FROM project_roadmap_items WHERE project_id = $1 AND status IN ('doing', 'planned', 'blocked') ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END LIMIT 15`, [pid]
  );
  if (roadmap.rows.length > 0) {
    sections.push(`## Roadmap\n`);
    for (const r of roadmap.rows) sections.push(`- [${r.priority}/${r.status}] ${r.title}${r.milestone ? ` (${r.milestone})` : ''}`);
    sections.push('');
  }
  if (keywords.length > 0) {
    const docConds = keywords.map((_, i) => `(title ILIKE $${i + 2} OR content ILIKE $${i + 2})`);
    const docParams = [pid, ...keywords.map(k => `%${k}%`)];
    const conventions = await client.query(
      `SELECT title, content FROM project_docs WHERE project_id = $1 AND status = 'active' AND doc_type = 'convention' AND (${docConds.join(' OR ')}) ORDER BY updated_at DESC LIMIT 3`, docParams
    );
    if (conventions.rows.length > 0) {
      sections.push(`## Conventions\n`);
      for (const c of conventions.rows) sections.push(`### ${c.title}\n\n${truncSection(c.content, 1000)}\n`);
    }
    const gConds = keywords.map((_, i) => `(term ILIKE $${i + 2} OR definition ILIKE $${i + 2})`);
    const gParams = [pid, ...keywords.map(k => `%${k}%`)];
    const glossary = await client.query(
      `SELECT term, definition FROM project_glossary WHERE project_id = $1 AND (${gConds.join(' OR ')}) LIMIT 10`, gParams
    );
    if (glossary.rows.length > 0) {
      sections.push(`## Glossary\n`);
      for (const g of glossary.rows) sections.push(`- **${g.term}**: ${g.definition}`);
      sections.push('');
    }
  }
  return sections.join('\n');
}

async function fetchMemoryContext(task, depth = 'full', opts = {}) {
  const sections = [];
  try {
    if (depth === 'full') {
      const profile = await memoryGetProfile({ scope: 'user' });
      if (profile && !profile.includes('No facts found')) sections.push(`## User Profile\n\n${truncSection(profile, 1500)}\n`);
    }
    const layers = depth === 'minimal' ? ['active'] : ['active', 'context'];
    const topK = depth === 'full' ? 8 : 5;
    const memResult = await memorySearch({ query: task, top_k: topK, layers, ...opts });
    if (memResult && !memResult.includes('No results found')) sections.push(`## Memory Context\n\n${truncSection(memResult, 2000)}\n`);
  } catch {}
  return sections.join('\n');
}

function fetchKBContext(task, symbols = []) {
  try {
    return withDb((db) => {
      const rows = searchKnowledge(db, task, symbols, 8, null, []);
      if (rows.length === 0) return '';
      return `## Knowledge Base\n\n${truncSection(formatKnowledge(rows), 2000)}\n`;
    });
  } catch { return ''; }
}

async function fetchCodeGraphContext(task, symbols = []) {
  const sections = [];
  try {
    if (symbols.length > 0) {
      for (const sym of symbols.slice(0, 3)) {
        const result = await searchCodeGraph(sym);
        if (result && !result.includes('[CodeGraph Error]')) sections.push(`## CodeGraph: ${sym}\n\n${truncSection(result, 1500)}\n`);
      }
    }
    const ctx = await getCodeGraphContext(task);
    if (ctx && !ctx.includes('[CodeGraph Error]')) sections.push(`## Code Context\n\n${truncSection(ctx, 2000)}\n`);
  } catch {}
  return sections.join('\n');
}

async function fetchPairMemoryContext(client, opts = {}) {
  const workspaceId = opts.workspace_id || 'default';
  const projectId = opts.project_id || DEFAULT_PROJECT;
  const pairs = [];
  if (opts.agent_a && opts.agent_b) pairs.push([opts.agent_a, opts.agent_b]);
  if (Array.isArray(opts.pair_agents)) {
    for (const pair of opts.pair_agents) {
      if (Array.isArray(pair) && pair.length === 2) pairs.push(pair);
      else if (typeof pair === 'string' && pair.includes(':')) pairs.push(pair.split(':'));
    }
  }
  const unique = [...new Map(pairs.map(([a, b]) => [makePairKey(a, b), [a, b]])).values()];
  const sections = [];
  for (const [agentA, agentB] of unique) {
    const pairKey = makePairKey(agentA, agentB);
    const params = [workspaceId, projectId, pairKey, opts.limit || 12];
    const result = await client.query(
      `SELECT * FROM pair_memories WHERE workspace_id = $1 AND project_id = $2 AND pair_key = $3 AND status = 'active' ORDER BY importance DESC, updated_at DESC LIMIT $4`,
      params
    );
    if (result.rows.length > 0) sections.push(`## Pair Memory: ${agentA} ↔ ${agentB}\n\n${truncSection(pairMemoryFormat(result.rows), 2200)}\n`);
  }
  return sections.join('\n');
}

function inferDefaultPairsForAgent(agentId, fromAgentId) {
  const pairs = [];
  if (fromAgentId && agentId) pairs.push([fromAgentId, agentId]);
  if (agentId === 'coder') {
    pairs.push(['pm_architecture', 'coder']);
    pairs.push(['coder', 'reviewer']);
  }
  if (agentId === 'reviewer') pairs.push(['coder', 'reviewer']);
  if (agentId === 'pm_architecture') pairs.push(['assistant', 'pm_architecture']);
  return pairs;
}

// --- recall_context_pack ---
export async function contextPack(args) {
  const task = args.task, pid = args.project_id || DEFAULT_PROJECT;
  const symbols = Array.isArray(args.symbols) ? args.symbols : [];
  const depth = args.depth || 'full';
  const keywords = extractKeywords(task, symbols);
  const sections = [`# Full Agent Context\n\n**Task:** ${task}\n**Project:** ${pid}\n**Depth:** ${depth}\n`];
  if (args.include_session_memory !== false) {
    try {
      const resume = await resumeContext({ workspace_id: args.workspace_id, project_id: pid, session_id: args.session_id || args.conversation_id, limit: args.resume_limit || 16 });
      if (resume) sections.push(`## Session Resume Memory\n\n${truncSection(resume, 3500)}\n`);
    } catch {}
  }
  await withPg(async (client) => {
    const brainContext = await fetchProjectBrainContext(client, pid, keywords, { includeOverview: depth !== 'minimal', includeArchitecture: depth !== 'minimal' });
    if (brainContext) sections.push(brainContext);
    if (args.include_pair_memory || args.agent_id || args.from_agent_id || args.pair_agents) {
      const pairAgents = Array.isArray(args.pair_agents) ? args.pair_agents : inferDefaultPairsForAgent(args.agent_id, args.from_agent_id);
      const pairContext = await fetchPairMemoryContext(client, { workspace_id: args.workspace_id, project_id: pid, pair_agents: pairAgents });
      if (pairContext) sections.push(pairContext);
    }
  });
  const memoryContext = await fetchMemoryContext(task, depth);
  if (memoryContext) sections.push(memoryContext);
  const kbContext = fetchKBContext(task, symbols);
  if (kbContext) sections.push(kbContext);
  if (depth !== 'minimal') { const cgContext = await fetchCodeGraphContext(task, symbols); if (cgContext) sections.push(cgContext); }
  return sections.join('\n');
}

// --- recall_context_for_task ---
export async function contextForTask(args) {
  const task = args.task, pid = args.project_id || DEFAULT_PROJECT;
  const symbols = Array.isArray(args.symbols) ? args.symbols : [];
  const keywords = extractKeywords(task, symbols);
  const sections = [`# Task Context\n\n**Task:** ${task}\n`];
  if (args.include_session_memory !== false) {
    try {
      const resume = await resumeContext({ workspace_id: args.workspace_id, project_id: pid, session_id: args.session_id || args.conversation_id, limit: args.resume_limit || 12 });
      if (resume) sections.push(`## Session Resume Memory\n\n${truncSection(resume, 2500)}\n`);
    } catch {}
  }
  const brainContext = await withPg(c => fetchProjectBrainContext(c, pid, keywords, { includeOverview: false, includeArchitecture: false }));
  if (brainContext) sections.push(brainContext);
  const memoryContext = await fetchMemoryContext(task, 'summary');
  if (memoryContext) sections.push(memoryContext);
  const kbContext = fetchKBContext(task, symbols);
  if (kbContext) sections.push(kbContext);
  const cgContext = await fetchCodeGraphContext(task, symbols);
  if (cgContext) sections.push(cgContext);
  return sections.join('\n');
}

// --- recall_context_for_worker ---
export async function contextForWorker(args) {
  const task = args.task, pid = args.project_id || DEFAULT_PROJECT;
  const symbols = Array.isArray(args.symbols) ? args.symbols : [];
  const keywords = extractKeywords(task, symbols);
  const sections = [`# Worker Context\n\n**Task:** ${task}\n`];
  await withPg(async (client) => {
    const modules = await client.query(`SELECT name, purpose FROM project_modules WHERE project_id = $1 AND status = 'active' ORDER BY name`, [pid]);
    if (modules.rows.length > 0) { sections.push(`## Modules\n`); for (const m of modules.rows) sections.push(`- **${m.name}**: ${m.purpose}`); sections.push(''); }
    if (keywords.length > 0) {
      const conds = keywords.map((_, i) => `(title ILIKE $${i + 2} OR content ILIKE $${i + 2})`);
      const params = [pid, ...keywords.map(k => `%${k}%`)];
      const conventions = await client.query(`SELECT title, content FROM project_docs WHERE project_id = $1 AND status = 'active' AND doc_type = 'convention' AND (${conds.join(' OR ')}) LIMIT 3`, params);
      if (conventions.rows.length > 0) { sections.push(`## Conventions\n`); for (const c of conventions.rows) sections.push(`- **${c.title}**: ${truncSection(c.content, 500)}`); sections.push(''); }
    }
  });
  try { const profile = await memoryGetProfile({ scope: 'user' }); if (profile && !profile.includes('No facts found')) sections.push(`## User Preferences\n\n${truncSection(profile, 800)}\n`); } catch {}
  try { const rulesCtx = withDb((db) => { const rows = searchKnowledge(db, task, symbols, 5, 'rule', []); return rows.length === 0 ? '' : `## Rules\n\n${truncSection(formatKnowledge(rows), 1000)}\n`; }); if (rulesCtx) sections.push(rulesCtx); } catch {}
  return sections.join('\n');
}

// --- recall_context_for_agent ---
export async function contextForAgent(args) {
  const agentId = args.agent_id, task = args.task, pid = args.project_id || DEFAULT_PROJECT;
  const symbols = Array.isArray(args.symbols) ? args.symbols : [];
  const keywords = extractKeywords(task, symbols);
  const sections = [`# Agent Context Pack\n\n**Agent:** ${agentId}\n**Task:** ${task}\n`];
  if (args.include_session_memory !== false) {
    try {
      const resume = await resumeContext({ workspace_id: args.workspace_id, project_id: pid, session_id: args.session_id || args.conversation_id, limit: args.resume_limit || 14 });
      if (resume) sections.push(`## Session Resume Memory\n\n${truncSection(resume, 3200)}\n`);
    } catch {}
  }

  await withPg(async (client) => {
    const agent = await client.query('SELECT * FROM agents WHERE id = $1', [agentId]);
    if (agent.rows[0]) {
      const a = agent.rows[0];
      sections.push(`## Agent Identity\n\n- Name: ${a.name}\n- Role: ${a.role}\n- Model: ${a.model_id || '(none)'}\n- Capabilities: ${JSON.stringify(a.capabilities_json)}\n`);
    }
    if (args.include_pair_memory !== false) {
      const pairAgents = Array.isArray(args.pair_agents) ? args.pair_agents : inferDefaultPairsForAgent(agentId, args.from_agent_id);
      const pairContext = await fetchPairMemoryContext(client, { workspace_id: args.workspace_id, project_id: pid, pair_agents: pairAgents });
      if (pairContext) sections.push(pairContext);
    }
    const messages = await client.query(
      `SELECT from_agent_id, to_agent_id, message_type, content, created_at FROM agent_messages WHERE (from_agent_id = $1 OR to_agent_id = $1) ORDER BY created_at DESC LIMIT 10`, [agentId]
    );
    if (messages.rows.length > 0) {
      sections.push(`## Recent Messages (${messages.rows.length})\n`);
      for (const m of messages.rows) sections.push(`**${m.from_agent_id} → ${m.to_agent_id}** [${m.message_type}]: ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}\n`);
    }
  });

  try { const profile = await memoryGetProfile({ scope: 'agent_private', agent_id: agentId }); if (profile && !profile.includes('No facts found')) sections.push(`## Agent Private Memory\n\n${truncSection(profile, 1500)}\n`); } catch {}
  const brainContext = await withPg(c => fetchProjectBrainContext(c, pid, keywords));
  if (brainContext) sections.push(brainContext);
  const kbContext = fetchKBContext(task, symbols);
  if (kbContext) sections.push(kbContext);
  const cgContext = await fetchCodeGraphContext(task, symbols);
  if (cgContext) sections.push(cgContext);
  try { const constraints = await memorySearch({ query: 'constraint', scope: 'agent_private', agent_id: agentId, top_k: 5, layers: ['active'] }); if (constraints && !constraints.includes('No results found')) sections.push(`## Constraints\n\n${truncSection(constraints, 800)}\n`); } catch {}
  return sections.join('\n');
}

// --- recall_context_for_handoff ---
export async function contextForHandoff(args) {
  const handoffId = args.handoff_id, pid = args.project_id || DEFAULT_PROJECT;
  const sections = [`# Handoff Context\n`];

  await withPg(async (client) => {
    const handoff = await client.query('SELECT * FROM agent_handoffs WHERE id = $1', [handoffId]);
    if (handoff.rows.length === 0) { sections.push('_Handoff not found._'); return; }
    const h = handoff.rows[0];
    const payload = h.task_payload_json || {};
    sections.push(`## Handoff Details\n\n- **Task:** ${h.task_title}\n- **From:** ${h.from_agent_id}\n- **To:** ${h.to_agent_id}\n- **Status:** ${h.status}\n- **Task Type:** ${payload.task_type || '(unspecified)'}\n- **Objective:** ${payload.objective || h.task_title}\n- **Required Context:** ${JSON.stringify(payload.required_context || [])}\n- **Constraints:** ${JSON.stringify(payload.constraints || [])}\n- **Expected Output:** ${JSON.stringify(payload.expected_output || {})}\n`);
    const pairContext = await fetchPairMemoryContext(client, { workspace_id: payload.workspace_id || args.workspace_id, project_id: h.project_id || pid, agent_a: h.from_agent_id, agent_b: h.to_agent_id });
    if (pairContext) sections.push(pairContext);
    const sender = await client.query('SELECT * FROM agents WHERE id = $1', [h.from_agent_id]);
    if (sender.rows[0]) sections.push(`## Sender: ${sender.rows[0].name} (${sender.rows[0].role})\n`);
    const messages = await client.query(
      `SELECT from_agent_id, to_agent_id, message_type, content FROM agent_messages WHERE from_agent_id = $1 ORDER BY created_at DESC LIMIT 10`, [h.from_agent_id]
    );
    if (messages.rows.length > 0) {
      sections.push(`## Sender's Recent Work (${messages.rows.length})\n`);
      for (const m of messages.rows) sections.push(`**[${m.message_type}]** ${m.content.slice(0, 300)}${m.content.length > 300 ? '...' : ''}\n`);
    }
    const chain = await client.query(
      `SELECT from_agent_id, to_agent_id, task_title, status, result_summary FROM agent_handoffs WHERE project_id = $1 AND task_title = $2 AND id != $3 ORDER BY created_at ASC LIMIT 10`,
      [h.project_id, h.task_title, handoffId]
    );
    if (chain.rows.length > 0) {
      sections.push(`## Task History (${chain.rows.length})\n`);
      for (const c of chain.rows) sections.push(`- ${c.from_agent_id} → ${c.to_agent_id}: ${c.task_title} (${c.status})${c.result_summary ? ` — ${c.result_summary.slice(0, 100)}` : ''}`);
      sections.push('');
    }
    const keywords = extractKeywords(h.task_title);
    const brainCtx = await fetchProjectBrainContext(client, pid, keywords, { includeOverview: false, includeArchitecture: false });
    if (brainCtx) sections.push(brainCtx);
  });

  const kbContext = fetchKBContext(args.task || '', []);
  if (kbContext) sections.push(kbContext);
  return sections.join('\n');
}

// --- recall_context_for_pair ---
export async function contextForPair(args) {
  const agentA = args.agent_a, agentB = args.agent_b, task = args.task || '';
  const pid = args.project_id || DEFAULT_PROJECT;
  const pairKey = makePairKey(agentA, agentB);
  const keywords = extractKeywords(task);
  const sections = [`# Pair Context\n\n**Agents:** ${agentA} ↔ ${agentB}\n**Pair Key:** ${pairKey}\n**Task:** ${task || '(general)'}\n`];

  await withPg(async (client) => {
    const agents = await client.query('SELECT * FROM agents WHERE id = ANY($1)', [[agentA, agentB]]);
    if (agents.rows.length > 0) {
      sections.push(`## Agents\n`);
      for (const a of agents.rows) sections.push(`- **${a.id}** (${a.name}): ${a.role}`);
      sections.push('');
    }
    const messages = await client.query(
      `SELECT from_agent_id, to_agent_id, message_type, content FROM agent_messages WHERE ((from_agent_id = $1 AND to_agent_id = $2) OR (from_agent_id = $2 AND to_agent_id = $1)) ORDER BY created_at DESC LIMIT 15`,
      [agentA, agentB]
    );
    if (messages.rows.length > 0) {
      sections.push(`## Conversation History (${messages.rows.length})\n`);
      for (const m of messages.rows) sections.push(`**${m.from_agent_id}** [${m.message_type}]: ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}\n`);
    }
    const pairMemory = await fetchPairMemoryContext(client, { workspace_id: args.workspace_id, project_id: pid, agent_a: agentA, agent_b: agentB, limit: args.limit || 15 });
    if (pairMemory) sections.push(pairMemory);
  });

  if (keywords.length > 0) {
    const brainCtx = await withPg(c => fetchProjectBrainContext(c, pid, keywords, { includeOverview: false, includeArchitecture: false }));
    if (brainCtx) sections.push(brainCtx);
  }
  return sections.join('\n');
}
