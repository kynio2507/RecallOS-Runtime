import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { task, agent_id, depth, symbols, project_id, mode } = body;
    if (!task) return NextResponse.json({ error: "task required" }, { status: 400 });

    const pid = project_id || "default";
    const keywords = String(task).split(/\s+/).filter((w: string) => w.length >= 3).slice(0, 15);
    const sections: { source: string; title: string; content: string; tokens: number }[] = [];

    // 1. Project Brain
    const overview = await queryPg(
      `SELECT title, content FROM project_docs WHERE project_id = $1 AND doc_type = 'overview' AND status = 'active' ORDER BY updated_at DESC LIMIT 1`, [pid]
    );
    if (overview[0]) sections.push({ source: "Project Brain", title: "Overview", content: overview[0].content, tokens: Math.ceil(overview[0].content.length / 4) });

    if (depth !== "minimal") {
      const arch = await queryPg(
        `SELECT title, content FROM project_docs WHERE project_id = $1 AND doc_type = 'architecture' AND status = 'active' ORDER BY updated_at DESC LIMIT 1`, [pid]
      );
      if (arch[0]) sections.push({ source: "Project Brain", title: "Architecture", content: arch[0].content, tokens: Math.ceil(arch[0].content.length / 4) });
    }

    const modules = await queryPg(
      `SELECT name, purpose, status FROM project_modules WHERE project_id = $1 AND status = 'active' ORDER BY name`, [pid]
    );
    if (modules.length > 0) {
      const content = modules.map((m: { name: string; purpose: string }) => `- **${m.name}**: ${m.purpose}`).join("\n");
      sections.push({ source: "Project Brain", title: `Modules (${modules.length})`, content, tokens: Math.ceil(content.length / 4) });
    }

    // Decisions
    if (keywords.length > 0) {
      const conds = keywords.map((_: string, i: number) => `(title ILIKE $${i + 2} OR decision ILIKE $${i + 2})`);
      const params = [pid, ...keywords.map((k: string) => `%${k}%`)];
      const decisions = await queryPg(
        `SELECT title, decision, reason FROM project_decisions WHERE project_id = $1 AND status = 'accepted' AND (${conds.join(" OR ")}) ORDER BY created_at DESC LIMIT 5`, params
      );
      if (decisions.length > 0) {
        const content = decisions.map((d: { title: string; decision: string; reason: string }) => `- **${d.title}**: ${d.decision}${d.reason ? ` — ${d.reason}` : ""}`).join("\n");
        sections.push({ source: "Project Brain", title: `Decisions (${decisions.length})`, content, tokens: Math.ceil(content.length / 4) });
      }
    }

    // Roadmap
    const roadmap = await queryPg(
      `SELECT title, priority, status FROM project_roadmap_items WHERE project_id = $1 AND status IN ('doing','planned','blocked') ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END LIMIT 10`, [pid]
    );
    if (roadmap.length > 0) {
      const content = roadmap.map((r: { title: string; priority: string; status: string }) => `- [${r.priority}/${r.status}] ${r.title}`).join("\n");
      sections.push({ source: "Project Brain", title: `Roadmap (${roadmap.length})`, content, tokens: Math.ceil(content.length / 4) });
    }

    // 2. Memory
    if (mode !== "project_only") {
      const memFacts = await queryPg(
        `SELECT scope, key, value FROM memory_facts WHERE (key ILIKE $1 OR value ILIKE $1) ORDER BY confidence DESC LIMIT 5`, [`%${task}%`]
      );
      if (memFacts.length > 0) {
        const content = memFacts.map((f: { scope: string; key: string; value: string }) => `- [${f.scope}] ${f.key}: ${f.value}`).join("\n");
        sections.push({ source: "Memory", title: `Related Facts (${memFacts.length})`, content, tokens: Math.ceil(content.length / 4) });
      }

      const memEvents = await queryPg(
        `SELECT actor, event_type, LEFT(content, 200) as content FROM memory_events WHERE content ILIKE $1 ORDER BY created_at DESC LIMIT 5`, [`%${task}%`]
      );
      if (memEvents.length > 0) {
        const content = memEvents.map((e: { actor: string; event_type: string; content: string }) => `- [${e.actor}/${e.event_type}] ${e.content}`).join("\n");
        sections.push({ source: "Memory", title: `Events (${memEvents.length})`, content, tokens: Math.ceil(content.length / 4) });
      }
    }

    // 3. Agent identity
    if (agent_id) {
      const agent = await queryPg("SELECT * FROM agents WHERE id = $1", [agent_id]);
      if (agent[0]) {
        const a = agent[0];
        const content = `- Name: ${a.name}\n- Role: ${a.role}\n- Model: ${a.model_id || "(none)"}\n- Capabilities: ${JSON.stringify(a.capabilities_json)}`;
        sections.push({ source: "Agents", title: `Agent: ${a.id}`, content, tokens: Math.ceil(content.length / 4) });
      }

      const messages = await queryPg(
        `SELECT from_agent_id, to_agent_id, message_type, LEFT(content, 200) as content FROM agent_messages WHERE (from_agent_id = $1 OR to_agent_id = $1) ORDER BY created_at DESC LIMIT 5`, [agent_id]
      );
      if (messages.length > 0) {
        const content = messages.map((m: { from_agent_id: string; to_agent_id: string; message_type: string; content: string }) => `- ${m.from_agent_id} → ${m.to_agent_id} [${m.message_type}]: ${m.content}`).join("\n");
        sections.push({ source: "Agents", title: `Messages (${messages.length})`, content, tokens: Math.ceil(content.length / 4) });
      }
    }

    // Build final context
    const totalTokens = sections.reduce((sum, s) => sum + s.tokens, 0);
    const sources = [...new Set(sections.map(s => s.source))];
    const finalMarkdown = sections.map(s => `## ${s.title}\n\n${s.content}`).join("\n\n---\n\n");

    return NextResponse.json({
      sections,
      totalTokens,
      sources,
      finalMarkdown: `# Context Pack\n\n**Task:** ${task}\n**Agent:** ${agent_id || "(none)"}\n**Depth:** ${depth || "full"}\n**Sources:** ${sources.join(", ")}\n**Est. Tokens:** ~${totalTokens}\n\n---\n\n${finalMarkdown}`,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
