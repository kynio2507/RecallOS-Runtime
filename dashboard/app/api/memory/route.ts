import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") || "";
  const scope = searchParams.get("scope") || "";
  const agent_id = searchParams.get("agent_id") || "";
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    // Events
    let eventSql = `SELECT id, session_id, actor, event_type, LEFT(content, 300) as content, agent_id, task_id, created_at FROM memory_events`;
    const eventConds: string[] = [];
    const eventParams: unknown[] = [];
    let idx = 1;
    if (query) { eventConds.push(`content ILIKE $${idx}`); eventParams.push(`%${query}%`); idx++; }
    if (agent_id) { eventConds.push(`agent_id = $${idx}`); eventParams.push(agent_id); idx++; }
    if (eventConds.length > 0) eventSql += ` WHERE ${eventConds.join(" AND ")}`;
    eventSql += ` ORDER BY created_at DESC LIMIT $${idx}`;
    eventParams.push(limit);
    const events = await queryPg(eventSql, eventParams);

    // Facts
    let factSql = `SELECT id, scope, key, value, confidence, agent_id, pair_key, task_id, updated_at FROM memory_facts`;
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

    // Counts
    const counts = {
      events: (await queryPg("SELECT COUNT(*) as c FROM memory_events"))[0]?.c || 0,
      facts: (await queryPg("SELECT COUNT(*) as c FROM memory_facts"))[0]?.c || 0,
      chunks: (await queryPg("SELECT COUNT(*) as c FROM memory_chunks"))[0]?.c || 0,
      links: (await queryPg("SELECT COUNT(*) as c FROM memory_links"))[0]?.c || 0,
    };

    return NextResponse.json({ events, facts, counts });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
