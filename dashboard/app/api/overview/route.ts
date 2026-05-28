import { NextResponse } from "next/server";
import path from "path";
import { queryPg, querySqlite, querySqliteOne } from "@/lib/db";

function getCodeGraphDbPath(): string {
  const projectPath = process.env.RECALLOS_PROJECT_PATH || path.resolve(process.cwd(), "..", "..", "scratch", "9base-ai-infra");
  return process.env.RECALLOS_CODEGRAPH_DB_PATH || path.join(projectPath, ".codegraph", "codegraph.db");
}

function getCodeGraphCounts() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    const db = new Database(getCodeGraphDbPath(), { readonly: true });
    const counts = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM files) AS files,
        (SELECT COUNT(*) FROM nodes) AS nodes,
        (SELECT COUNT(*) FROM edges) AS edges,
        (SELECT COUNT(*) FROM unresolved_refs) AS unresolved_refs
    `).get();
    const languages = db.prepare(`SELECT language, COUNT(*) AS count FROM files GROUP BY language ORDER BY count DESC`).all();
    const kinds = db.prepare(`SELECT kind, COUNT(*) AS count FROM nodes GROUP BY kind ORDER BY count DESC`).all();
    db.close();
    return { ok: true, dbPath: getCodeGraphDbPath(), counts, languages, kinds, error: null };
  } catch (e: unknown) {
    return { ok: false, dbPath: getCodeGraphDbPath(), counts: { files: 0, nodes: 0, edges: 0, unresolved_refs: 0 }, languages: [], kinds: [], error: (e as Error).message };
  }
}

export async function GET() {
  try {
    const kbCount = querySqliteOne("SELECT COUNT(*) as count FROM knowledge_items") as { count: number };
    const codegraph = getCodeGraphCounts();

    let pgData = {
      events: 0, facts: 0, chunks: 0, links: 0,
      docs: 0, modules: 0, decisions: 0, roadmap: 0, glossary: 0,
      agents: 0, messages: 0, handoffs: 0,
    };
    let recent: Record<string, unknown[]> = { events: [], facts: [], docs: [], decisions: [], roadmap: [] };
    let scopes: unknown[] = [];
    let roadmapByStatus: unknown[] = [];
    try {
      const tables = [
        ["memory_events", "events"], ["memory_facts", "facts"], ["memory_chunks", "chunks"], ["memory_links", "links"],
        ["project_docs", "docs"], ["project_modules", "modules"], ["project_decisions", "decisions"],
        ["project_roadmap_items", "roadmap"], ["project_glossary", "glossary"],
        ["agents", "agents"], ["agent_messages", "messages"], ["agent_handoffs", "handoffs"],
      ] as const;
      for (const [table, key] of tables) {
        const rows = await queryPg(`SELECT COUNT(*) as count FROM ${table}`);
        pgData = { ...pgData, [key]: parseInt(rows[0]?.count || "0", 10) };
      }
      recent = {
        events: await queryPg(`SELECT event_type, actor, LEFT(content, 120) AS content, created_at FROM memory_events ORDER BY created_at DESC LIMIT 5`),
        facts: await queryPg(`SELECT scope, key, LEFT(value, 120) AS value, confidence, updated_at FROM memory_facts ORDER BY updated_at DESC LIMIT 5`),
        docs: await queryPg(`SELECT doc_type, title, updated_at FROM project_docs ORDER BY updated_at DESC LIMIT 5`),
        decisions: await queryPg(`SELECT title, status, created_at FROM project_decisions ORDER BY created_at DESC LIMIT 5`),
        roadmap: await queryPg(`SELECT title, priority, status, milestone FROM project_roadmap_items ORDER BY created_at DESC LIMIT 5`),
      };
      scopes = await queryPg(`SELECT scope, COUNT(*) AS count FROM memory_facts GROUP BY scope ORDER BY count DESC`);
      roadmapByStatus = await queryPg(`SELECT status, COUNT(*) AS count FROM project_roadmap_items GROUP BY status ORDER BY status`);
    } catch {}

    const memoryTotal = pgData.events + pgData.facts + pgData.chunks + pgData.links;
    const brainTotal = pgData.docs + pgData.modules + pgData.decisions + pgData.roadmap + pgData.glossary;
    const codeTotal = Number((codegraph.counts as { nodes: number }).nodes || 0) + Number((codegraph.counts as { edges: number }).edges || 0);

    return NextResponse.json({
      modules: [
        { name: "Knowledge Base", status: "active", storage: "SQLite + FTS5", count: kbCount?.count || 0, tools: 5, detail: "bug/fix/rule/technical notes" },
        { name: "CodeGraph", status: codegraph.ok ? "active" : "error", storage: "SQLite CodeGraph DB", count: codeTotal, tools: 5, detail: `${(codegraph.counts as { files: number }).files} files · ${(codegraph.counts as { nodes: number }).nodes} nodes · ${(codegraph.counts as { edges: number }).edges} edges` },
        { name: "Memory", status: "active", storage: "PostgreSQL + pgvector", count: memoryTotal, tools: 7, detail: "4 layers: raw, active, context/vector, working links" },
        { name: "Project Brain", status: brainTotal > 0 ? "active" : "empty", storage: "PostgreSQL", count: brainTotal, tools: 9, detail: `${pgData.docs} docs · ${pgData.modules} modules · ${pgData.decisions} decisions · ${pgData.roadmap} roadmap` },
        { name: "Context Orchestrator", status: "active", storage: "runtime assembly", count: 0, tools: 6, detail: "Project Truth + Full Agent Context packs" },
        { name: "Agents", status: "active", storage: "PostgreSQL", count: pgData.agents + pgData.messages + pgData.handoffs, tools: 9, detail: "identity/messages/handoffs" },
      ],
      counts: {
        ...pgData,
        kb: kbCount?.count || 0,
        codegraph_files: (codegraph.counts as { files: number }).files || 0,
        codegraph_nodes: (codegraph.counts as { nodes: number }).nodes || 0,
        codegraph_edges: (codegraph.counts as { edges: number }).edges || 0,
        unresolved_refs: (codegraph.counts as { unresolved_refs: number }).unresolved_refs || 0,
      },
      memoryLayers: [
        { name: "Layer A · Raw events", count: pgData.events, description: "Append-only user/agent/session events" },
        { name: "Layer B · Active facts", count: pgData.facts, description: "Current profile/project/task facts by scope" },
        { name: "Layer C · Context chunks/vector", count: pgData.chunks, description: "Embeddable semantic retrieval chunks" },
        { name: "Layer D · Working links/state", count: pgData.links, description: "Relations and working memory graph" },
      ],
      codegraph,
      projectBrain: {
        docs: pgData.docs, modules: pgData.modules, decisions: pgData.decisions,
        roadmap: pgData.roadmap, glossary: pgData.glossary, roadmapByStatus,
      },
      scopes,
      recent,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
