import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db";

type Section = { source: string; title: string; content: string; tokens: number; count?: number; status?: string };
type SourceMeta = { name: string; count: number; tokens: number; status: "hit" | "empty" | "skipped"; warnings: string[] };
const tokenCount = (content: string) => Math.ceil(String(content || "").length / 4);
function add(sections: Section[], source: string, title: string, content: string, count = 1) { sections.push({ source, title, content, tokens: tokenCount(content), count, status: "hit" }); }
function sourceSummary(sections: Section[], expected: string[]): SourceMeta[] { return expected.map(name => { const secs = sections.filter(s => s.source === name); const tokens = secs.reduce((n, s) => n + s.tokens, 0); return { name, count: secs.length, tokens, status: secs.length ? "hit" : "empty", warnings: secs.length ? [] : [`No ${name} context matched request`] }; }); }

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { task, agent_id, depth, project_id, mode, handoff_id, from_agent_id, to_agent_id } = body;
    if (!task) return NextResponse.json({ error: "task required" }, { status: 400 });

    const pid = project_id || "default";
    const viewerMode = mode || "pack";
    const keywords = String(task).split(/\s+/).filter((w: string) => w.length >= 3).slice(0, 15);
    const sections: Section[] = [];
    const expected = ["Project Brain", "Memory", "Agents", "Handoff", "Pair Memory"];

    const overview = await queryPg(`SELECT title, content FROM project_docs WHERE project_id = $1 AND doc_type = 'overview' AND status = 'active' ORDER BY updated_at DESC LIMIT 1`, [pid]);
    if (overview[0]) add(sections, "Project Brain", "Overview", overview[0].content);

    if (depth !== "minimal") {
      const arch = await queryPg(`SELECT title, content FROM project_docs WHERE project_id = $1 AND doc_type = 'architecture' AND status = 'active' ORDER BY updated_at DESC LIMIT 1`, [pid]);
      if (arch[0]) add(sections, "Project Brain", "Architecture", arch[0].content);
    }

    const modules = await queryPg(`SELECT name, purpose, status FROM project_modules WHERE project_id = $1 AND status = 'active' ORDER BY name`, [pid]);
    if (modules.length) add(sections, "Project Brain", `Modules (${modules.length})`, modules.map((m: { name: string; purpose: string }) => `- **${m.name}**: ${m.purpose}`).join("\n"), modules.length);

    if (keywords.length) {
      const conds = keywords.map((_: string, i: number) => `(title ILIKE $${i + 2} OR decision ILIKE $${i + 2})`);
      const params = [pid, ...keywords.map((k: string) => `%${k}%`)];
      const decisions = await queryPg(`SELECT title, decision, reason FROM project_decisions WHERE project_id = $1 AND status = 'accepted' AND (${conds.join(" OR ")}) ORDER BY created_at DESC LIMIT 5`, params);
      if (decisions.length) add(sections, "Project Brain", `Decisions (${decisions.length})`, decisions.map((d: { title: string; decision: string; reason: string }) => `- **${d.title}**: ${d.decision}${d.reason ? ` — ${d.reason}` : ""}`).join("\n"), decisions.length);
    }

    const roadmap = await queryPg(`SELECT title, priority, status FROM project_roadmap_items WHERE project_id = $1 AND status IN ('doing','planned','blocked') ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END LIMIT 10`, [pid]);
    if (roadmap.length) add(sections, "Project Brain", `Roadmap (${roadmap.length})`, roadmap.map((r: { title: string; priority: string; status: string }) => `- [${r.priority}/${r.status}] ${r.title}`).join("\n"), roadmap.length);

    if (viewerMode !== "project_only") {
      const memFacts = await queryPg(`SELECT scope, key, value FROM memory_facts WHERE (key ILIKE $1 OR value ILIKE $1) ORDER BY confidence DESC LIMIT 8`, [`%${task}%`]);
      if (memFacts.length) add(sections, "Memory", `Related Facts (${memFacts.length})`, memFacts.map((f: { scope: string; key: string; value: string }) => `- [${f.scope}] ${f.key}: ${f.value}`).join("\n"), memFacts.length);

      const memEvents = await queryPg(`SELECT actor, event_type, LEFT(content, 240) as content FROM memory_events WHERE content ILIKE $1 ORDER BY created_at DESC LIMIT 8`, [`%${task}%`]);
      if (memEvents.length) add(sections, "Memory", `Events (${memEvents.length})`, memEvents.map((e: { actor: string; event_type: string; content: string }) => `- [${e.actor}/${e.event_type}] ${e.content}`).join("\n"), memEvents.length);
    }

    if (viewerMode === "agent" || agent_id) {
      const aid = agent_id || "assistant";
      const agent = await queryPg("SELECT * FROM agents WHERE id = $1", [aid]);
      if (agent[0]) { const a = agent[0]; add(sections, "Agents", `Agent: ${a.id}`, `- Name: ${a.name}\n- Role: ${a.role}\n- Model: ${a.model_id || "(none)"}\n- Capabilities: ${JSON.stringify(a.capabilities_json)}`); }
      const messages = await queryPg(`SELECT from_agent_id, to_agent_id, message_type, LEFT(content, 240) as content FROM agent_messages WHERE (from_agent_id = $1 OR to_agent_id = $1) ORDER BY created_at DESC LIMIT 8`, [aid]);
      if (messages.length) add(sections, "Agents", `Messages (${messages.length})`, messages.map((m: { from_agent_id: string; to_agent_id: string; message_type: string; content: string }) => `- ${m.from_agent_id} → ${m.to_agent_id} [${m.message_type}]: ${m.content}`).join("\n"), messages.length);
    }

    if (viewerMode === "handoff" || handoff_id) {
      const handoffs = handoff_id ? await queryPg(`SELECT * FROM agent_handoffs WHERE id=$1 LIMIT 1`, [handoff_id]) : await queryPg(`SELECT * FROM agent_handoffs ORDER BY created_at DESC LIMIT 5`);
      if (handoffs.length) add(sections, "Handoff", `Handoffs (${handoffs.length})`, handoffs.map((h: any) => `- ${h.from_agent_id} → ${h.to_agent_id} [${h.status}]: ${h.task_title || h.task_id || h.id}`).join("\n"), handoffs.length);
    }

    if (viewerMode === "pair" || (from_agent_id && to_agent_id)) {
      const a = from_agent_id || "pm_architecture"; const b = to_agent_id || "senior_product_coder"; const pair = [a, b].sort().join(":");
      const facts = await queryPg(`SELECT key, value FROM memory_facts WHERE pair_key=$1 OR key ILIKE $2 OR value ILIKE $2 ORDER BY updated_at DESC LIMIT 8`, [pair, `%${pair}%`]);
      if (facts.length) add(sections, "Pair Memory", `Pair Memory (${pair})`, facts.map((f: { key: string; value: string }) => `- ${f.key}: ${f.value}`).join("\n"), facts.length);
    }

    const totalTokens = sections.reduce((sum, s) => sum + s.tokens, 0);
    const sources = [...new Set(sections.map(s => s.source))];
    const finalMarkdown = sections.map(s => `## ${s.title}\n\n${s.content}`).join("\n\n---\n\n");
    const sourceDetails = sourceSummary(sections, expected);

    return NextResponse.json({
      mode: viewerMode,
      sections,
      totalTokens,
      sources,
      sourceDetails,
      finalMarkdown: `# Context Pack\n\n**Mode:** ${viewerMode}\n**Task:** ${task}\n**Agent:** ${agent_id || "(none)"}\n**Depth:** ${depth || "full"}\n**Sources:** ${sources.join(", ") || "none"}\n**Est. Tokens:** ~${totalTokens}\n\n---\n\n${finalMarkdown || "No matching context found."}`,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
