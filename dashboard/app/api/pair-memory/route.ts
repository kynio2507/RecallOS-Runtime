import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db";

function pairKey(a: string, b: string) { return [a, b].sort().join(":"); }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const workspace_id = searchParams.get("workspace_id") || "default";
  const project_id = searchParams.get("project_id") || "recallos-runtime";
  const agent_a = searchParams.get("agent_a") || "";
  const agent_b = searchParams.get("agent_b") || "";
  const pair_key = searchParams.get("pair_key") || (agent_a && agent_b ? pairKey(agent_a, agent_b) : "");
  const type = searchParams.get("type") || "";
  const status = searchParams.get("status") || "active";
  const query = searchParams.get("query") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 200);
  try {
    const conds = ["workspace_id = $1", "project_id = $2"];
    const params: unknown[] = [workspace_id, project_id];
    let idx = 3;
    if (pair_key) { conds.push(`pair_key = $${idx}`); params.push(pair_key); idx++; }
    if (type) { conds.push(`type = $${idx}`); params.push(type); idx++; }
    if (status !== "all") { conds.push(`status = $${idx}`); params.push(status); idx++; }
    if (query) { conds.push(`(title ILIKE $${idx} OR content ILIKE $${idx})`); params.push(`%${query}%`); idx++; }
    const memories = await queryPg(
      `SELECT * FROM pair_memories WHERE ${conds.join(" AND ")} ORDER BY importance DESC, updated_at DESC LIMIT $${idx}`,
      [...params, limit]
    );
    const pairs = await queryPg(
      `SELECT pair_key, agent_a, agent_b, COUNT(*) AS count, MAX(updated_at) AS last_updated
       FROM pair_memories WHERE workspace_id = $1 AND project_id = $2
       GROUP BY pair_key, agent_a, agent_b ORDER BY last_updated DESC`,
      [workspace_id, project_id]
    );
    const types = await queryPg(
      `SELECT type, COUNT(*) AS count FROM pair_memories WHERE workspace_id = $1 AND project_id = $2 GROUP BY type ORDER BY count DESC`,
      [workspace_id, project_id]
    );
    return NextResponse.json({ memories, pairs, types });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
