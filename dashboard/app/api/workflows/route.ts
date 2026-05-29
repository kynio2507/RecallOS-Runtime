import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id") || "recallos-runtime";
  const run_id = searchParams.get("run_id") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "80", 10), 200);
  try {
    const handoffConds = ["project_id = $1"];
    const handoffParams: unknown[] = [project_id];
    if (run_id) { handoffConds.push("task_payload_json->>'run_id' = $2"); handoffParams.push(run_id); }
    const handoffs = await queryPg(
      `SELECT id, from_agent_id, to_agent_id, project_id, task_title, task_payload_json, status, result_summary, created_at, updated_at
       FROM agent_handoffs WHERE ${handoffConds.join(" AND ")} ORDER BY created_at DESC LIMIT $${handoffParams.length + 1}`,
      [...handoffParams, limit]
    );

    const messageConds = ["project_id = $1"];
    const messageParams: unknown[] = [project_id];
    if (run_id) { messageConds.push("run_id = $2"); messageParams.push(run_id); }
    const messages = await queryPg(
      `SELECT id, workspace_id, project_id, run_id, task_id, from_agent_id, to_agent_id, message_type, LEFT(content, 900) AS content, summary, created_at
       FROM agent_messages WHERE ${messageConds.join(" AND ")} ORDER BY created_at DESC LIMIT $${messageParams.length + 1}`,
      [...messageParams, limit]
    );

    const runs = await queryPg(
      `SELECT COALESCE(task_payload_json->>'run_id', 'no-run') AS run_id, COUNT(*) AS handoffs, MAX(created_at) AS last_seen
       FROM agent_handoffs WHERE project_id = $1 GROUP BY COALESCE(task_payload_json->>'run_id', 'no-run') ORDER BY last_seen DESC LIMIT 30`,
      [project_id]
    );

    return NextResponse.json({ runs, handoffs, messages });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
