import { NextResponse } from "next/server";
import { queryPg, querySqlite, querySqliteOne } from "@/lib/db";

export async function GET() {
  try {
    // SQLite counts
    const kbCount = querySqliteOne("SELECT COUNT(*) as count FROM knowledge_items") as { count: number };
    const symbolCount = querySqliteOne("SELECT COUNT(*) as count FROM symbol_summaries") as { count: number };

    // PostgreSQL counts
    let pgData = { events: 0, facts: 0, chunks: 0, links: 0, docs: 0, modules: 0, decisions: 0, roadmap: 0, glossary: 0, agents: 0, messages: 0, handoffs: 0 };
    try {
      const tables = [
        ["memory_events", "events"], ["memory_facts", "facts"], ["memory_chunks", "chunks"], ["memory_links", "links"],
        ["project_docs", "docs"], ["project_modules", "modules"], ["project_decisions", "decisions"],
        ["project_roadmap_items", "roadmap"], ["project_glossary", "glossary"],
        ["agents", "agents"], ["agent_messages", "messages"], ["agent_handoffs", "handoffs"],
      ] as const;
      for (const [table, key] of tables) {
        const rows = await queryPg(`SELECT COUNT(*) as count FROM ${table}`);
        pgData = { ...pgData, [key]: parseInt(rows[0]?.count || "0") };
      }
    } catch {}

    return NextResponse.json({
      modules: [
        { name: "Knowledge Base", status: "active", storage: "SQLite + FTS5", count: kbCount?.count || 0, tools: 5 },
        { name: "CodeGraph", status: "active", storage: "MCP Client", count: symbolCount?.count || 0, tools: 5 },
        { name: "Memory", status: "active", storage: "PostgreSQL + pgvector", count: pgData.events + pgData.facts + pgData.chunks, tools: 7 },
        { name: "Project Brain", status: "active", storage: "PostgreSQL", count: pgData.docs + pgData.modules + pgData.decisions + pgData.roadmap, tools: 9 },
        { name: "Context Orchestrator", status: "active", storage: "(no storage)", count: 0, tools: 6 },
        { name: "Agents", status: "active", storage: "PostgreSQL", count: pgData.agents + pgData.messages + pgData.handoffs, tools: 9 },
      ],
      counts: { ...pgData, kb: kbCount?.count || 0, symbols: symbolCount?.count || 0 },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
