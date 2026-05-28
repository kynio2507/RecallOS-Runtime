// Context Orchestrator — top-level context assembly across all modules
//
// recall_context_pack        → Full Agent Context (all 4 modules)
// recall_context_for_task    → Focused task context (related only)
// recall_context_for_worker  → Minimal sub-agent context

import { withPg } from '../../runtime/pg.mjs';
import { withDb } from '../../runtime/db.mjs';
import { memorySearch, memoryGetProfile } from '../memory/index.mjs';
import { searchKnowledge, formatKnowledge } from '../knowledge-base/index.mjs';
import { getCodeGraphContext, searchCodeGraph } from '../codegraph/index.mjs';

const DEFAULT_PROJECT = 'default';

// --- Helpers ---

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

  // Overview
  if (opts.includeOverview !== false) {
    const overview = await client.query(
      `SELECT title, content FROM project_docs WHERE project_id = $1 AND doc_type = 'overview' AND status = 'active' ORDER BY updated_at DESC LIMIT 1`, [pid]
    );
    if (overview.rows[0]) {
      sections.push(`## Project Overview\n\n${truncSection(overview.rows[0].content, 2000)}\n`);
    }
  }

  // Architecture
  if (opts.includeArchitecture !== false) {
    const arch = await client.query(
      `SELECT title, content FROM project_docs WHERE project_id = $1 AND doc_type = 'architecture' AND status = 'active' ORDER BY updated_at DESC LIMIT 1`, [pid]
    );
    if (arch.rows[0]) {
      sections.push(`## Architecture\n\n${truncSection(arch.rows[0].content, 2000)}\n`);
    }
  }

  // Active Modules
  const modules = await client.query(
    `SELECT name, purpose, status FROM project_modules WHERE project_id = $1 AND status = 'active' ORDER BY name`, [pid]
  );
  if (modules.rows.length > 0) {
    sections.push(`## Modules (${modules.rows.length})\n`);
    for (const m of modules.rows) sections.push(`- **${m.name}**: ${m.purpose}`);
    sections.push('');
  }

  // Related Decisions
  if (keywords.length > 0) {
    const conds = keywords.map((_, i) => `(title ILIKE $${i + 2} OR decision ILIKE $${i + 2})`);
    const params = [pid, ...keywords.map(k => `%${k}%`)];
    const decisions = await client.query(
      `SELECT title, decision, reason FROM project_decisions
       WHERE project_id = $1 AND status = 'accepted' AND (${conds.join(' OR ')})
       ORDER BY created_at DESC LIMIT 8`, params
    );
    if (decisions.rows.length > 0) {
      sections.push(`## Related Decisions (${decisions.rows.length})\n`);
      for (const d of decisions.rows) {
        sections.push(`- **${d.title}**: ${d.decision}${d.reason ? ` — _${d.reason}_` : ''}`);
      }
      sections.push('');
    }
  }

  // Roadmap (doing + planned + blocked)
  const roadmap = await client.query(
    `SELECT title, priority, status, milestone FROM project_roadmap_items
     WHERE project_id = $1 AND status IN ('doing', 'planned', 'blocked')
     ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
     LIMIT 15`, [pid]
  );
  if (roadmap.rows.length > 0) {
    sections.push(`## Roadmap\n`);
    for (const r of roadmap.rows) sections.push(`- [${r.priority}/${r.status}] ${r.title}${r.milestone ? ` (${r.milestone})` : ''}`);
    sections.push('');
  }

  // Conventions
  if (keywords.length > 0) {
    const docConds = keywords.map((_, i) => `(title ILIKE $${i + 2} OR content ILIKE $${i + 2})`);
    const docParams = [pid, ...keywords.map(k => `%${k}%`)];
    const conventions = await client.query(
      `SELECT title, content FROM project_docs
       WHERE project_id = $1 AND status = 'active' AND doc_type = 'convention'
       AND (${docConds.join(' OR ')})
       ORDER BY updated_at DESC LIMIT 3`, docParams
    );
    if (conventions.rows.length > 0) {
      sections.push(`## Conventions\n`);
      for (const c of conventions.rows) sections.push(`### ${c.title}\n\n${truncSection(c.content, 1000)}\n`);
    }
  }

  // Glossary
  if (keywords.length > 0) {
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

async function fetchMemoryContext(task, depth = 'full') {
  const sections = [];
  try {
    // User profile
    if (depth === 'full') {
      const profile = await memoryGetProfile({ scope: 'user' });
      if (profile && !profile.includes('No facts found')) {
        sections.push(`## User Profile\n\n${truncSection(profile, 1500)}\n`);
      }
    }

    // Search related memory
    const layers = depth === 'minimal' ? ['active'] : ['active', 'context'];
    const topK = depth === 'full' ? 8 : 5;
    const memResult = await memorySearch({ query: task, top_k: topK, layers });
    if (memResult && !memResult.includes('No results found')) {
      sections.push(`## Memory Context\n\n${truncSection(memResult, 2000)}\n`);
    }
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
        if (result && !result.includes('[CodeGraph Error]')) {
          sections.push(`## CodeGraph: ${sym}\n\n${truncSection(result, 1500)}\n`);
        }
      }
    }
    // General code context for task
    const ctx = await getCodeGraphContext(task);
    if (ctx && !ctx.includes('[CodeGraph Error]')) {
      sections.push(`## Code Context\n\n${truncSection(ctx, 2000)}\n`);
    }
  } catch {}
  return sections.join('\n');
}

// --- recall_context_pack: Full Agent Context ---

export async function contextPack(args) {
  const task = args.task;
  const pid = args.project_id || DEFAULT_PROJECT;
  const symbols = Array.isArray(args.symbols) ? args.symbols : [];
  const depth = args.depth || 'full';
  const keywords = extractKeywords(task, symbols);

  const sections = [`# Full Agent Context\n\n**Task:** ${task}\n**Project:** ${pid}\n**Depth:** ${depth}\n`];

  // 1. Project Brain (parallel-safe: uses its own PG connection)
  const brainContext = await withPg(async (client) => {
    return fetchProjectBrainContext(client, pid, keywords, {
      includeOverview: depth !== 'minimal',
      includeArchitecture: depth !== 'minimal',
    });
  });
  if (brainContext) sections.push(brainContext);

  // 2. Memory
  const memoryContext = await fetchMemoryContext(task, depth);
  if (memoryContext) sections.push(memoryContext);

  // 3. Knowledge Base (SQLite — sync)
  const kbContext = fetchKBContext(task, symbols);
  if (kbContext) sections.push(kbContext);

  // 4. CodeGraph (async MCP client)
  if (depth !== 'minimal') {
    const cgContext = await fetchCodeGraphContext(task, symbols);
    if (cgContext) sections.push(cgContext);
  }

  return sections.join('\n');
}

// --- recall_context_for_task: Focused Task Context ---

export async function contextForTask(args) {
  const task = args.task;
  const pid = args.project_id || DEFAULT_PROJECT;
  const symbols = Array.isArray(args.symbols) ? args.symbols : [];
  const keywords = extractKeywords(task, symbols);

  const sections = [`# Task Context\n\n**Task:** ${task}\n`];

  // Project Brain — only related (skip overview/architecture)
  const brainContext = await withPg(async (client) => {
    return fetchProjectBrainContext(client, pid, keywords, {
      includeOverview: false,
      includeArchitecture: false,
    });
  });
  if (brainContext) sections.push(brainContext);

  // Memory — related facts
  const memoryContext = await fetchMemoryContext(task, 'summary');
  if (memoryContext) sections.push(memoryContext);

  // KB — related bugs/rules
  const kbContext = fetchKBContext(task, symbols);
  if (kbContext) sections.push(kbContext);

  // CodeGraph — code context
  const cgContext = await fetchCodeGraphContext(task, symbols);
  if (cgContext) sections.push(cgContext);

  return sections.join('\n');
}

// --- recall_context_for_worker: Minimal Worker Context ---

export async function contextForWorker(args) {
  const task = args.task;
  const pid = args.project_id || DEFAULT_PROJECT;
  const symbols = Array.isArray(args.symbols) ? args.symbols : [];
  const keywords = extractKeywords(task, symbols);

  const sections = [`# Worker Context\n\n**Task:** ${task}\n`];

  // Project Brain — modules + conventions only
  await withPg(async (client) => {
    const modules = await client.query(
      `SELECT name, purpose FROM project_modules WHERE project_id = $1 AND status = 'active' ORDER BY name`, [pid]
    );
    if (modules.rows.length > 0) {
      sections.push(`## Modules\n`);
      for (const m of modules.rows) sections.push(`- **${m.name}**: ${m.purpose}`);
      sections.push('');
    }

    // Conventions
    if (keywords.length > 0) {
      const conds = keywords.map((_, i) => `(title ILIKE $${i + 2} OR content ILIKE $${i + 2})`);
      const params = [pid, ...keywords.map(k => `%${k}%`)];
      const conventions = await client.query(
        `SELECT title, content FROM project_docs
         WHERE project_id = $1 AND status = 'active' AND doc_type = 'convention'
         AND (${conds.join(' OR ')}) LIMIT 3`, params
      );
      if (conventions.rows.length > 0) {
        sections.push(`## Conventions\n`);
        for (const c of conventions.rows) sections.push(`- **${c.title}**: ${truncSection(c.content, 500)}`);
        sections.push('');
      }
    }
  });

  // Memory — constraints + user preferences only
  try {
    const profile = await memoryGetProfile({ scope: 'user' });
    if (profile && !profile.includes('No facts found')) {
      sections.push(`## User Preferences\n\n${truncSection(profile, 800)}\n`);
    }
  } catch {}

  // KB — rules only
  try {
    const rulesContext = withDb((db) => {
      const rows = searchKnowledge(db, task, symbols, 5, 'rule', []);
      if (rows.length === 0) return '';
      return `## Rules\n\n${truncSection(formatKnowledge(rows), 1000)}\n`;
    });
    if (rulesContext) sections.push(rulesContext);
  } catch {}

  // No CodeGraph — worker uses directly if needed

  return sections.join('\n');
}
