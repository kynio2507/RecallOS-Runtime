import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") || "";
  const scope = searchParams.get("scope") || "";
  const agent_id = searchParams.get("agent_id") || "";
  const limit = parseInt(searchParams.get("limit") || "30", 10);

  try {
    let eventSql = `SELECT id, session_id, actor, event_type, LEFT(content, 500) as content, workspace_id, project_id, agent_id, task_id, run_id, created_at FROM memory_events`;
    const eventConds: string[] = [];
    const eventParams: unknown[] = [];
    let idx = 1;
    if (query) { eventConds.push(`content ILIKE $${idx}`); eventParams.push(`%${query}%`); idx++; }
    if (agent_id) { eventConds.push(`agent_id = $${idx}`); eventParams.push(agent_id); idx++; }
    if (eventConds.length > 0) eventSql += ` WHERE ${eventConds.join(" AND ")}`;
    eventSql += ` ORDER BY created_at DESC LIMIT $${idx}`;
    eventParams.push(limit);
    const events = await queryPg(eventSql, eventParams);

    let factSql = `SELECT id, scope, key, value, confidence, workspace_id, project_id, agent_id, pair_key, task_id, session_id, run_id, updated_at FROM memory_facts`;
    const factConds: string[] = [];
    const factParams: unknown[] = [];
    idx = 1;
    if (query) { factConds.push(`(key ILIKE $${idx} OR value ILIKE $${idx})`); factParams.push(`%${query}%`); idx++; }
    if (scope) { factConds.push(`scope = $${idx}`); factParams.push(scope); idx++; }
    if (agent_id) { factConds.push(`agent_id = $${idx}`); factParams.push(agent_id); idx++; }
    if (factConds.length > 0) factSql += ` WHERE ${factConds.join(" AND ")}`;
    factSql += ` ORDER BY confidence DESC, updated_at DESC LIMIT $${idx}`;
    factParams.push(limit);
    const facts = await queryPg(factSql, factParams);

    let chunkSql = `SELECT id, source_type, source_id, LEFT(text, 500) AS text, metadata, created_at, embedding IS NOT NULL AS has_embedding FROM memory_chunks`;
    const chunkParams: unknown[] = [];
    if (query) { chunkSql += ` WHERE text ILIKE $1`; chunkParams.push(`%${query}%`); }
    chunkSql += ` ORDER BY created_at DESC LIMIT $${chunkParams.length + 1}`;
    chunkParams.push(limit);
    const chunks = await queryPg(chunkSql, chunkParams);

    const links = await queryPg(`SELECT id, source_id, target_id, relation, metadata, created_at FROM memory_links ORDER BY created_at DESC LIMIT $1`, [limit]);
    const scopes = await queryPg(`SELECT scope, COUNT(*) AS count FROM memory_facts GROUP BY scope ORDER BY count DESC`);
    const eventTypes = await queryPg(`SELECT event_type, COUNT(*) AS count FROM memory_events GROUP BY event_type ORDER BY count DESC`);
    const actors = await queryPg(`SELECT actor, COUNT(*) AS count FROM memory_events GROUP BY actor ORDER BY count DESC`);
    const sessions = await queryPg(`SELECT session_id, COUNT(*) AS count, MAX(created_at) AS last_seen FROM memory_events GROUP BY session_id ORDER BY last_seen DESC LIMIT 10`);

    const counts = {
      events: parseInt((await queryPg("SELECT COUNT(*) as c FROM memory_events"))[0]?.c || "0", 10),
      facts: parseInt((await queryPg("SELECT COUNT(*) as c FROM memory_facts"))[0]?.c || "0", 10),
      chunks: parseInt((await queryPg("SELECT COUNT(*) as c FROM memory_chunks"))[0]?.c || "0", 10),
      links: parseInt((await queryPg("SELECT COUNT(*) as c FROM memory_links"))[0]?.c || "0", 10),
      embedded_chunks: parseInt((await queryPg("SELECT COUNT(*) as c FROM memory_chunks WHERE embedding IS NOT NULL"))[0]?.c || "0", 10),
    };

    const layers = [
      { id: "raw", name: "Layer A · Raw events", count: counts.events, description: "Append-only event log: user input, agent actions, tool calls, decisions." },
      { id: "active", name: "Layer B · Active facts", count: counts.facts, description: "Current facts by scope/key with confidence and source events." },
      { id: "context", name: "Layer C · Context chunks/vector", count: counts.chunks, description: `${counts.embedded_chunks}/${counts.chunks} chunks have embeddings for semantic retrieval.` },
      { id: "working", name: "Layer D · Working links/state", count: counts.links, description: "Relations across memory items and short-lived working graph state." },
    ];

    return NextResponse.json({ events, facts, chunks, links, counts, layers, scopes, eventTypes, actors, sessions });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
