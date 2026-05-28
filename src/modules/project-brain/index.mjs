// Project Brain module — core logic

import { withPg } from '../../runtime/pg.mjs';
import { memorySearch } from '../memory/index.mjs';

const DEFAULT_PROJECT = 'default';

// --- Overview ---

export async function projectOverview(args = {}) {
  const pid = args.project_id || DEFAULT_PROJECT;
  return withPg(async (client) => {
    const overview = await client.query(
      `SELECT * FROM project_docs WHERE project_id = $1 AND doc_type = 'overview' AND status = 'active' ORDER BY updated_at DESC LIMIT 1`, [pid]
    );
    const modules = await client.query(
      `SELECT name, purpose, status FROM project_modules WHERE project_id = $1 ORDER BY name`, [pid]
    );
    const counts = {};
    for (const t of ['project_docs', 'project_modules', 'project_decisions', 'project_roadmap_items', 'project_glossary']) {
      const r = await client.query(`SELECT COUNT(*) AS count FROM ${t} WHERE project_id = $1`, [pid]);
      counts[t] = r.rows[0].count;
    }
    const doing = await client.query(
      `SELECT title, priority FROM project_roadmap_items WHERE project_id = $1 AND status = 'doing' ORDER BY priority DESC`, [pid]
    );

    const lines = [`# Project Overview (${pid})\n`];
    if (overview.rows[0]) {
      lines.push(`## ${overview.rows[0].title}\n\n${overview.rows[0].content}\n`);
    } else {
      lines.push(`_No overview doc yet. Use recall_project_upsert_doc to create one._\n`);
    }
    lines.push(`## Modules (${modules.rows.length})\n`);
    for (const m of modules.rows) lines.push(`- **${m.name}** (${m.status}): ${m.purpose}`);
    lines.push(`\n## Stats\n`);
    for (const [k, v] of Object.entries(counts)) lines.push(`- ${k}: ${v}`);
    if (doing.rows.length > 0) {
      lines.push(`\n## Currently Doing\n`);
      for (const r of doing.rows) lines.push(`- [${r.priority}] ${r.title}`);
    }
    return lines.join('\n');
  });
}

// --- Modules ---

export async function projectModules(args = {}) {
  const pid = args.project_id || DEFAULT_PROJECT;
  return withPg(async (client) => {
    const conditions = ['project_id = $1'];
    const params = [pid];
    if (args.status) { conditions.push(`status = $${params.length + 1}`); params.push(args.status); }
    const result = await client.query(
      `SELECT * FROM project_modules WHERE ${conditions.join(' AND ')} ORDER BY name`, params
    );
    if (result.rows.length === 0) return `No modules found for project: ${pid}`;
    const lines = [`# Project Modules (${pid})\n`];
    for (const m of result.rows) {
      lines.push(`## ${m.name} (${m.status})\n\nPurpose: ${m.purpose}\nOwner: ${m.owner || '(none)'}\nMetadata: ${JSON.stringify(m.metadata)}\n`);
    }
    return lines.join('\n');
  });
}

export async function upsertModule(client, { project_id, name, purpose, status, owner, metadata }) {
  const result = await client.query(
    `INSERT INTO project_modules (project_id, name, purpose, status, owner, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (project_id, name) DO UPDATE SET
       purpose = EXCLUDED.purpose,
       status = COALESCE(EXCLUDED.status, project_modules.status),
       owner = COALESCE(EXCLUDED.owner, project_modules.owner),
       metadata = COALESCE(EXCLUDED.metadata, project_modules.metadata)
     RETURNING id`,
    [project_id || DEFAULT_PROJECT, name, purpose, status || 'active', owner || null, JSON.stringify(metadata || {})]
  );
  return result.rows[0];
}

// --- Docs ---

export async function projectGetDoc(args = {}) {
  const pid = args.project_id || DEFAULT_PROJECT;
  return withPg(async (client) => {
    const conditions = ['project_id = $1'];
    const params = [pid];
    if (args.title) { conditions.push(`title ILIKE $${params.length + 1}`); params.push(`%${args.title}%`); }
    if (args.doc_type) { conditions.push(`doc_type = $${params.length + 1}`); params.push(args.doc_type); }
    const result = await client.query(
      `SELECT * FROM project_docs WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC LIMIT 10`, params
    );
    if (result.rows.length === 0) return `No docs found.`;
    const lines = [];
    for (const d of result.rows) {
      lines.push(`# [${d.doc_type}] ${d.title} (v${d.version}, ${d.status})\n\n${d.content}\n\n---\n`);
    }
    return lines.join('\n');
  });
}

export async function projectUpsertDoc(args) {
  const pid = args.project_id || DEFAULT_PROJECT;
  return withPg(async (client) => {
    // Check existing by title + project_id
    const existing = await client.query(
      `SELECT id, version FROM project_docs WHERE project_id = $1 AND title = $2 ORDER BY version DESC LIMIT 1`,
      [pid, args.title]
    );
    let result;
    if (existing.rows.length > 0) {
      const newVersion = existing.rows[0].version + 1;
      result = await client.query(
        `UPDATE project_docs SET content = $1, doc_type = $2, status = $3, version = $4, updated_at = NOW()
         WHERE id = $5 RETURNING id, version`,
        [args.content, args.doc_type, args.status || 'active', newVersion, existing.rows[0].id]
      );
    } else {
      result = await client.query(
        `INSERT INTO project_docs (project_id, doc_type, title, content, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, version`,
        [pid, args.doc_type, args.title, args.content, args.status || 'active']
      );
    }
    return `Doc saved: ${args.title} (id: ${result.rows[0].id}, v${result.rows[0].version})`;
  });
}

// --- Roadmap ---

export async function projectRoadmap(args = {}) {
  const pid = args.project_id || DEFAULT_PROJECT;
  return withPg(async (client) => {
    const conditions = ['project_id = $1'];
    const params = [pid];
    if (args.status) { conditions.push(`status = $${params.length + 1}`); params.push(args.status); }
    if (args.priority) { conditions.push(`priority = $${params.length + 1}`); params.push(args.priority); }
    const result = await client.query(
      `SELECT * FROM project_roadmap_items WHERE ${conditions.join(' AND ')}
       ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC`,
      params
    );
    if (result.rows.length === 0) return `No roadmap items found.`;
    const lines = [`# Project Roadmap (${pid})\n`];
    for (const r of result.rows) {
      lines.push(`- **[${r.priority}] ${r.title}** (${r.status})${r.milestone ? ` — milestone: ${r.milestone}` : ''}${r.due_date ? ` — due: ${r.due_date}` : ''}`);
      if (r.description) lines.push(`  ${r.description}`);
    }
    return lines.join('\n');
  });
}

export async function addRoadmapItem(client, args) {
  const result = await client.query(
    `INSERT INTO project_roadmap_items (project_id, title, description, priority, status, milestone, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [args.project_id || DEFAULT_PROJECT, args.title, args.description || null, args.priority || 'medium',
     args.status || 'planned', args.milestone || null, args.due_date || null]
  );
  return result.rows[0];
}

// --- Decisions ---

export async function projectAddDecision(args) {
  return withPg(async (client) => {
    const result = await client.query(
      `INSERT INTO project_decisions (project_id, title, decision, reason, alternatives, impact, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
      [args.project_id || DEFAULT_PROJECT, args.title, args.decision,
       args.reason || null, args.alternatives || null, args.impact || null, args.status || 'accepted']
    );
    return `Decision saved: ${args.title} (id: ${result.rows[0].id})`;
  });
}

// --- Search ---

export async function projectSearch(args) {
  const pid = args.project_id || DEFAULT_PROJECT;
  const q = `%${args.query}%`;
  return withPg(async (client) => {
    const sections = [`# Project Search: "${args.query}"\n`];

    const docs = await client.query(
      `SELECT id, doc_type, title, LEFT(content, 200) AS snippet FROM project_docs
       WHERE project_id = $1 AND (title ILIKE $2 OR content ILIKE $2) LIMIT 10`, [pid, q]
    );
    if (docs.rows.length > 0) {
      sections.push(`## Docs (${docs.rows.length})\n`);
      for (const d of docs.rows) sections.push(`- **[${d.doc_type}] ${d.title}**: ${d.snippet}...`);
    }

    const decisions = await client.query(
      `SELECT id, title, LEFT(decision, 200) AS snippet, status FROM project_decisions
       WHERE project_id = $1 AND (title ILIKE $2 OR decision ILIKE $2 OR reason ILIKE $2) LIMIT 10`, [pid, q]
    );
    if (decisions.rows.length > 0) {
      sections.push(`\n## Decisions (${decisions.rows.length})\n`);
      for (const d of decisions.rows) sections.push(`- **${d.title}** (${d.status}): ${d.snippet}...`);
    }

    const modules = await client.query(
      `SELECT name, purpose, status FROM project_modules
       WHERE project_id = $1 AND (name ILIKE $2 OR purpose ILIKE $2) LIMIT 10`, [pid, q]
    );
    if (modules.rows.length > 0) {
      sections.push(`\n## Modules (${modules.rows.length})\n`);
      for (const m of modules.rows) sections.push(`- **${m.name}** (${m.status}): ${m.purpose}`);
    }

    const roadmap = await client.query(
      `SELECT title, description, priority, status FROM project_roadmap_items
       WHERE project_id = $1 AND (title ILIKE $2 OR description ILIKE $2) LIMIT 10`, [pid, q]
    );
    if (roadmap.rows.length > 0) {
      sections.push(`\n## Roadmap (${roadmap.rows.length})\n`);
      for (const r of roadmap.rows) sections.push(`- **[${r.priority}] ${r.title}** (${r.status})`);
    }

    const glossary = await client.query(
      `SELECT term, definition FROM project_glossary
       WHERE project_id = $1 AND (term ILIKE $2 OR definition ILIKE $2) LIMIT 10`, [pid, q]
    );
    if (glossary.rows.length > 0) {
      sections.push(`\n## Glossary (${glossary.rows.length})\n`);
      for (const g of glossary.rows) sections.push(`- **${g.term}**: ${g.definition}`);
    }

    if (sections.length === 1) sections.push('No results found.');
    return sections.join('\n');
  });
}

// --- Context Pack (CRITICAL) ---

export async function projectContextPack(args) {
  const pid = args.project_id || DEFAULT_PROJECT;
  const task = args.task;
  const q = `%${task}%`;
  const includeMemory = args.include_memory !== false;

  return withPg(async (client) => {
    const sections = [`# Project Context Pack\n\n**Task:** ${task}\n**Project:** ${pid}\n`];

    // 1. Overview
    const overview = await client.query(
      `SELECT title, content FROM project_docs WHERE project_id = $1 AND doc_type = 'overview' AND status = 'active' ORDER BY updated_at DESC LIMIT 1`, [pid]
    );
    if (overview.rows[0]) {
      sections.push(`## Project Overview\n\n${overview.rows[0].content}\n`);
    }

    // 2. Architecture
    const arch = await client.query(
      `SELECT title, content FROM project_docs WHERE project_id = $1 AND doc_type = 'architecture' AND status = 'active' ORDER BY updated_at DESC LIMIT 1`, [pid]
    );
    if (arch.rows[0]) {
      sections.push(`## Architecture\n\n${arch.rows[0].content}\n`);
    }

    // 3. Active Modules
    const modules = await client.query(
      `SELECT name, purpose, status, owner FROM project_modules WHERE project_id = $1 AND status = 'active' ORDER BY name`, [pid]
    );
    if (modules.rows.length > 0) {
      sections.push(`## Current Modules (${modules.rows.length})\n`);
      for (const m of modules.rows) sections.push(`- **${m.name}**: ${m.purpose}${m.owner ? ` (owner: ${m.owner})` : ''}`);
      sections.push('');
    }

    // 4. Related Decisions (search by task keywords)
    const taskKeywords = task.split(/\s+/).filter(w => w.length >= 3).slice(0, 10);
    const decisionConditions = taskKeywords.map((_, i) => `(title ILIKE $${i + 2} OR decision ILIKE $${i + 2})`);
    if (decisionConditions.length > 0) {
      const decisionParams = [pid, ...taskKeywords.map(k => `%${k}%`)];
      const decisions = await client.query(
        `SELECT title, decision, reason, status FROM project_decisions
         WHERE project_id = $1 AND status = 'accepted' AND (${decisionConditions.join(' OR ')})
         ORDER BY created_at DESC LIMIT 10`, decisionParams
      );
      if (decisions.rows.length > 0) {
        sections.push(`## Related Decisions (${decisions.rows.length})\n`);
        for (const d of decisions.rows) {
          sections.push(`### ${d.title}\n\n${d.decision}${d.reason ? `\n\n**Reason:** ${d.reason}` : ''}\n`);
        }
      }
    }

    // 5. Roadmap Context (doing + planned + blocked)
    const roadmap = await client.query(
      `SELECT title, description, priority, status, milestone FROM project_roadmap_items
       WHERE project_id = $1 AND status IN ('doing', 'planned', 'blocked')
       ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
       LIMIT 20`, [pid]
    );
    if (roadmap.rows.length > 0) {
      sections.push(`## Roadmap Context (${roadmap.rows.length})\n`);
      for (const r of roadmap.rows) {
        sections.push(`- **[${r.priority}/${r.status}] ${r.title}**${r.milestone ? ` (${r.milestone})` : ''}`);
        if (r.description) sections.push(`  ${r.description}`);
      }
      sections.push('');
    }

    // 6. Relevant Docs (search by task keywords)
    if (decisionConditions.length > 0) {
      const docConditions = taskKeywords.map((_, i) => `(title ILIKE $${i + 2} OR content ILIKE $${i + 2})`);
      const docParams = [pid, ...taskKeywords.map(k => `%${k}%`)];
      const docs = await client.query(
        `SELECT doc_type, title, content FROM project_docs
         WHERE project_id = $1 AND status = 'active' AND doc_type NOT IN ('overview','architecture')
         AND (${docConditions.join(' OR ')})
         ORDER BY updated_at DESC LIMIT 5`, docParams
      );
      if (docs.rows.length > 0) {
        sections.push(`## Relevant Docs (${docs.rows.length})\n`);
        for (const d of docs.rows) {
          sections.push(`### [${d.doc_type}] ${d.title}\n\n${d.content}\n`);
        }
      }
    }

    // 7. Glossary
    if (taskKeywords.length > 0) {
      const glossaryConditions = taskKeywords.map((_, i) => `(term ILIKE $${i + 2} OR definition ILIKE $${i + 2})`);
      const glossaryParams = [pid, ...taskKeywords.map(k => `%${k}%`)];
      const glossary = await client.query(
        `SELECT term, definition FROM project_glossary
         WHERE project_id = $1 AND (${glossaryConditions.join(' OR ')})
         LIMIT 20`, glossaryParams
      );
      if (glossary.rows.length > 0) {
        sections.push(`## Glossary\n`);
        for (const g of glossary.rows) sections.push(`- **${g.term}**: ${g.definition}`);
        sections.push('');
      }
    }

    // 8. Memory Context (cross-module)
    if (includeMemory) {
      try {
        const memoryResult = await memorySearch({ query: task, top_k: 5, layers: ['active', 'context'] });
        if (memoryResult && !memoryResult.includes('No results found')) {
          sections.push(`## Memory Context\n\n${memoryResult}\n`);
        }
      } catch {}
    }

    return sections.join('\n');
  });
}

// --- Status ---

export async function projectBrainStatus(args = {}) {
  const pid = args.project_id || DEFAULT_PROJECT;
  return withPg(async (client) => {
    const counts = {};
    for (const t of ['project_docs', 'project_modules', 'project_decisions', 'project_roadmap_items', 'project_glossary']) {
      const r = await client.query(`SELECT COUNT(*) AS count FROM ${t} WHERE project_id = $1`, [pid]);
      counts[t] = r.rows[0].count;
    }
    const lines = [`# Project Brain Status (${pid})\n`];
    for (const [k, v] of Object.entries(counts)) lines.push(`- ${k}: ${v}`);
    return lines.join('\n');
  });
}
