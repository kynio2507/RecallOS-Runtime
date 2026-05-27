// Memory module core logic — orchestrates all 4 layers

import { withPg } from '../../runtime/pg.mjs';
import { writeEvent, getSessionEvents, searchEvents, createEventChunk } from './layers/raw.mjs';
import { upsertFact, getProfile, searchFacts } from './layers/active.mjs';
import { vectorSearch } from './layers/context.mjs';
import { getWorkingMemory, getSessionId, flushWorkingMemory } from './working-memory.mjs';

// --- Tool implementations ---

export async function memoryWriteEvent(args) {
  return withPg(async (client) => {
    const session_id = args.session_id || getSessionId();
    const event = await writeEvent(client, {
      session_id,
      actor: args.actor,
      event_type: args.event_type,
      content: args.content,
      metadata: args.metadata || {},
    });

    // Auto-embed if requested (default true)
    let chunk = null;
    if (args.embed !== false) {
      chunk = await createEventChunk(client, event.id, args.content);
    }

    // Auto-flush working memory
    await flushWorkingMemory(client);

    return `Event saved: ${event.id} (session: ${session_id})${chunk ? ` + vector chunk: ${chunk.id}` : ''}`;
  });
}

export async function memoryUpsertFact(args) {
  return withPg(async (client) => {
    const fact = await upsertFact(client, {
      scope: args.scope,
      key: args.key,
      value: args.value,
      confidence: args.confidence ?? 1.0,
      source_ids: args.source_ids || [],
    });

    // Auto-flush working memory
    await flushWorkingMemory(client);

    return `Fact saved: ${args.scope}/${args.key} (id: ${fact.id})`;
  });
}

export async function memorySearch(args) {
  return withPg(async (client) => {
    const query = args.query;
    const top_k = args.top_k || 10;
    const layers = args.layers || ['all'];
    const includeAll = layers.includes('all');

    const results = { raw: [], active: [], context: [] };

    // Layer A: SQL search on events
    if (includeAll || layers.includes('raw')) {
      results.raw = await searchEvents(client, query, {
        event_type: args.event_type,
        actor: args.actor,
        limit: top_k,
      });
    }

    // Layer B: SQL search on facts
    if (includeAll || layers.includes('active')) {
      results.active = await searchFacts(client, query, {
        scope: args.scope,
        limit: top_k,
      });
    }

    // Layer C: Vector search on chunks
    if (includeAll || layers.includes('context')) {
      results.context = await vectorSearch(client, query, { top_k });
    }

    // Auto-flush working memory
    await flushWorkingMemory(client);

    // Format output
    const sections = [`# Memory Search: "${query}"\n`];

    if (results.raw.length > 0) {
      sections.push(`## Raw Events (${results.raw.length})\n`);
      for (const row of results.raw) {
        sections.push(`- **[${row.event_type}]** ${row.actor} (${row.session_id}): ${row.content.slice(0, 200)}${row.content.length > 200 ? '...' : ''}`);
      }
    }

    if (results.active.length > 0) {
      sections.push(`\n## Active Facts (${results.active.length})\n`);
      for (const row of results.active) {
        sections.push(`- **${row.scope}/${row.key}** (confidence: ${row.confidence}): ${row.value.slice(0, 200)}${row.value.length > 200 ? '...' : ''}`);
      }
    }

    if (results.context.length > 0) {
      sections.push(`\n## Context Chunks (${results.context.length})\n`);
      for (const row of results.context) {
        const sim = row.similarity !== undefined ? ` (similarity: ${Number(row.similarity).toFixed(4)})` : '';
        sections.push(`- **[${row.source_type}]**${sim}: ${row.text.slice(0, 200)}${row.text.length > 200 ? '...' : ''}`);
      }
    }

    if (results.raw.length === 0 && results.active.length === 0 && results.context.length === 0) {
      sections.push('No results found.');
    }

    return sections.join('\n');
  });
}

export async function memoryGetProfile(args) {
  return withPg(async (client) => {
    const facts = await getProfile(client, args.scope);

    await flushWorkingMemory(client);

    if (facts.length === 0) return `No facts found for scope: ${args.scope}`;

    const lines = [`# Profile: ${args.scope}\n\nTotal facts: ${facts.length}\n`];
    for (const fact of facts) {
      lines.push(`- **${fact.key}** (confidence: ${fact.confidence}): ${fact.value}`);
    }
    return lines.join('\n');
  });
}

export async function memorySummarizeSession(args) {
  return withPg(async (client) => {
    const events = await getSessionEvents(client, args.session_id);

    if (events.length === 0) return `No events found for session: ${args.session_id}`;

    // Extract facts by heuristic rules
    const decisions = events.filter(e => e.event_type === 'decision');
    const tasks = events.filter(e => e.event_type === 'task');
    const bugs = events.filter(e => e.event_type === 'bug' || e.event_type === 'fix');
    const observations = events.filter(e => e.event_type === 'observation');
    const commands = events.filter(e => e.event_type === 'command');

    const factsCreated = [];

    // Auto-create session summary fact
    await upsertFact(client, {
      scope: 'session',
      key: `session_summary:${args.session_id}`,
      value: `Session with ${events.length} events: ${decisions.length} decisions, ${tasks.length} tasks, ${bugs.length} bugs/fixes, ${observations.length} observations, ${commands.length} commands`,
      confidence: 1.0,
      source_ids: events.slice(0, 10).map(e => e.id),
    });
    factsCreated.push('session_summary');

    // Extract individual decisions as project-scoped facts
    for (const d of decisions) {
      await upsertFact(client, {
        scope: 'project',
        key: `decision:${d.id}`,
        value: d.content,
        confidence: 0.9,
        source_ids: [d.id],
      });
      factsCreated.push(`decision:${d.id}`);
    }

    // Extract bug/fix pairs
    for (const b of bugs) {
      await upsertFact(client, {
        scope: 'project',
        key: `bugfix:${b.id}`,
        value: b.content,
        confidence: 0.9,
        source_ids: [b.id],
      });
      factsCreated.push(`bugfix:${b.id}`);
    }

    await flushWorkingMemory(client);

    const lines = [
      `# Session Summary: ${args.session_id}\n`,
      `Total events: ${events.length}`,
      `Decisions: ${decisions.length}`,
      `Tasks: ${tasks.length}`,
      `Bugs/Fixes: ${bugs.length}`,
      `Observations: ${observations.length}`,
      `Commands: ${commands.length}`,
      `\nFacts created: ${factsCreated.length}`,
    ];
    return lines.join('\n');
  });
}

export async function memoryLink(args) {
  return withPg(async (client) => {
    const result = await client.query(
      `INSERT INTO memory_links (source_id, target_id, relation, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [args.source_id, args.target_id, args.relation, JSON.stringify(args.metadata || {})]
    );
    const link = result.rows[0];

    await flushWorkingMemory(client);

    return `Link created: ${link.id} (${args.source_id} --[${args.relation}]--> ${args.target_id})`;
  });
}

export async function memoryStatus() {
  return withPg(async (client) => {
    const events = await client.query('SELECT COUNT(*) AS count FROM memory_events');
    const facts = await client.query('SELECT COUNT(*) AS count FROM memory_facts');
    const chunks = await client.query('SELECT COUNT(*) AS count FROM memory_chunks');
    const links = await client.query('SELECT COUNT(*) AS count FROM memory_links');
    const wm = getWorkingMemory();

    return `# Memory Module Status\n\n## PostgreSQL Counts\n\n- memory_events: ${events.rows[0].count}\n- memory_facts: ${facts.rows[0].count}\n- memory_chunks: ${chunks.rows[0].count}\n- memory_links: ${links.rows[0].count}\n\n## Working Memory\n\n- session_id: ${wm.session_id}\n- current_goal: ${wm.current_goal || '(none)'}\n- current_task: ${wm.current_task || '(none)'}\n- open_files: ${wm.open_files.length}\n- recent_decisions: ${wm.recent_decisions.length}\n- active_constraints: ${wm.active_constraints.length}\n- pending_questions: ${wm.pending_questions.length}`;
  });
}
