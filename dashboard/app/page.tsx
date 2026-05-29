"use client";
import { useEffect, useState } from "react";
import { DataCard, MetricTile, PageHeader, SectionTitle, StatusPill } from "./components/ui";

interface Module { name: string; status: string; storage: string; count: number; tools: number; detail: string; }
interface Counts { [key: string]: number; }
interface Layer { name: string; count: number; description: string; }
interface RecentItem { [key: string]: string | number | null; }
interface OverviewData {
  modules: Module[]; counts: Counts; memoryLayers: Layer[];
  codegraph: { ok: boolean; dbPath: string; counts: Counts; languages: { language: string; count: number }[]; kinds: { kind: string; count: number }[]; error?: string };
  projectBrain: { docs: number; modules: number; decisions: number; roadmap: number; glossary: number; roadmapByStatus: { status: string; count: number }[] };
  scopes: { scope: string; count: number }[]; recent: Record<string, RecentItem[]>;
}

const moduleTone: Record<string, "blue" | "violet" | "cyan" | "green" | "amber" | "rose"> = {
  "Memory": "violet", "CodeGraph": "cyan", "Project Brain": "green", "Knowledge Base": "amber", "Context Pack": "blue"
};
function tone(name: string) { return Object.entries(moduleTone).find(([k]) => name.includes(k))?.[1] || "blue"; }

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/overview").then(r => r.json()).then(d => { if (d.error) setError(d.error); setData(d); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); }); }, []);
  if (loading) return <div className="grid h-[60vh] place-items-center"><div className="skeleton h-32 w-full max-w-2xl" /></div>;
  if (error) return <DataCard className="border-rose-500/30 text-rose-300">Error: {error}</DataCard>;
  if (!data) return null;
  const embedded = Number(data.counts.embedded_chunks || 0);
  const chunks = Number(data.counts.memory_chunks || 0);
  const density = data.counts.codegraph_nodes ? Math.round((Number(data.counts.codegraph_edges || 0) / Number(data.counts.codegraph_nodes || 1)) * 100) / 100 : 0;

  return <div className="space-y-6">
    <PageHeader eyebrow="AI runtime telemetry" title="RecallOS Command Center" description="Live operational view across Project Brain, four-layer memory, CodeGraph, Knowledge Base, and Context Pack assembly." actions={<><StatusPill tone="green">Postgres online</StatusPill><StatusPill tone={data.codegraph.ok ? "cyan" : "red"}>CodeGraph {data.codegraph.ok ? "indexed" : "error"}</StatusPill></>} />

    <div className="grid gap-4 md:grid-cols-3">
      <MetricTile label="Active modules" value={data.modules.length} detail="Runtime surfaces connected" tone="blue" />
      <MetricTile label="Memory vectors" value={`${embedded}/${chunks}`} detail="Embedded chunks ready for semantic recall" tone="violet" />
      <MetricTile label="Graph density" value={density} detail={`${data.counts.codegraph_edges || 0} edges / ${data.counts.codegraph_nodes || 0} nodes`} tone="cyan" />
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <DataCard glow>
        <SectionTitle title="System pulse" subtitle="Subsystem health rings and live counts" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.modules.map(m => <div key={m.name} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center justify-between"><StatusPill tone={m.status === "active" ? "green" : "gray"}>{m.status}</StatusPill><span className="kicker">{m.tools} tools</span></div>
            <div className="mt-4 metric-value text-4xl font-black text-slate-100">{Number(m.count).toLocaleString()}</div>
            <h3 className={`mt-2 font-black text-${tone(m.name)}-200`}>{m.name}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">{m.detail}</p>
          </div>)}
        </div>
      </DataCard>
      <DataCard>
        <SectionTitle title="Activity stream" subtitle="Newest runtime facts/events" />
        <div className="space-y-3 max-h-[480px] overflow-auto pr-1">
          {(data.recent.events || []).map((e,i) => <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><div className="mb-2 flex gap-2"><StatusPill tone="blue">{String(e.event_type)}</StatusPill><StatusPill tone="gray">{String(e.actor)}</StatusPill></div><p className="text-xs leading-5 text-slate-300">{String(e.content)}</p></div>)}
          {(data.recent.facts || []).map((f,i) => <div key={`f-${i}`} className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] p-3"><div className="mb-2 flex gap-2"><StatusPill tone="green">{String(f.scope)}</StatusPill><span className="font-mono text-xs text-blue-300">{String(f.key)}</span></div><p className="text-xs leading-5 text-slate-300">{String(f.value)}</p></div>)}
        </div>
      </DataCard>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <DataCard><SectionTitle title="Memory 4 layers" subtitle="Raw → Facts → Vector → Working graph" /><div className="grid gap-3">{data.memoryLayers.map((l,i)=><div key={l.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center gap-3"><StatusPill tone="violet">L{i+1}</StatusPill><div className="font-bold">{l.name}</div><div className="ml-auto metric-value text-2xl font-black text-violet-200">{l.count}</div></div><p className="mt-2 text-xs text-slate-400">{l.description}</p></div>)}</div><div className="mt-4 flex flex-wrap gap-2">{data.scopes.map(s=><StatusPill key={s.scope} tone="blue">{s.scope}: {s.count}</StatusPill>)}</div></DataCard>
      <DataCard><SectionTitle title="CodeGraph + Project Brain" subtitle="Source map and persistent project intelligence" /><div className="grid grid-cols-2 gap-3"><MetricTile label="Files" value={data.counts.codegraph_files} tone="cyan"/><MetricTile label="Nodes" value={data.counts.codegraph_nodes} tone="violet"/><MetricTile label="Docs" value={data.projectBrain.docs} tone="green"/><MetricTile label="Decisions" value={data.projectBrain.decisions} tone="amber"/></div><div className="mt-4 flex flex-wrap gap-2">{data.codegraph.languages.map(l=><StatusPill key={l.language} tone="cyan">{l.language}: {l.count}</StatusPill>)}{data.projectBrain.roadmapByStatus.map(r=><StatusPill key={r.status} tone="green">{r.status}: {r.count}</StatusPill>)}</div></DataCard>
    </div>
  </div>;
}
