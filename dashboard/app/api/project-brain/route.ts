import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pid = searchParams.get("project_id") || "default";
  try {
    const overview = await queryPg(
      `SELECT title, content FROM project_docs WHERE project_id = $1 AND doc_type = 'overview' AND status = 'active' ORDER BY updated_at DESC LIMIT 1`, [pid]
    );
    const modules = await queryPg(
      `SELECT name, purpose, status, owner FROM project_modules WHERE project_id = $1 ORDER BY name`, [pid]
    );
    const decisions = await queryPg(
      `SELECT id, title, decision, reason, status, created_at FROM project_decisions WHERE project_id = $1 ORDER BY created_at DESC LIMIT 20`, [pid]
    );
    const roadmap = await queryPg(
      `SELECT id, title, description, priority, status, milestone, due_date FROM project_roadmap_items WHERE project_id = $1 ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`, [pid]
    );
    const glossary = await queryPg(
      `SELECT term, definition, aliases FROM project_glossary WHERE project_id = $1 ORDER BY term`, [pid]
    );
    const docs = await queryPg(
      `SELECT id, doc_type, title, LEFT(content, 200) as snippet, version, status, updated_at FROM project_docs WHERE project_id = $1 ORDER BY updated_at DESC LIMIT 20`, [pid]
    );
    return NextResponse.json({ overview: overview[0] || null, modules, decisions, roadmap, glossary, docs });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
