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

const toneBg: Record<string, string> = {
  "Memory": "text-emerald-400", "CodeGraph": "text-cyan-400", "Project Brain": "text-violet-400",
  "Knowledge Base": "text-amber-400", "Context Pack": "text-blue-400", "Agents": "text-violet-400",
};
function moduleColor(name: string) { return Object.entries(toneBg).find(([k]) => name.includes(k))?.[1] || "text-blue-400"; }

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/overview").then(r => r.json()).then(d => { if (d.error) setError(d.error); setData(d); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); }); }, []);
  if (loading) return <div className="grid h-[60vh] place-items-center"><div className="skeleton h-20 w-full max-w-xl" /></div>;
  if (error) return <DataCard className="border-rose-500/20 text-rose-300">Error: {error}</DataCard>;
  if (!data) return null;
  const embedded = Number(data.counts.embedded_chunks || 0);
  const chunks = Number(data.counts.memory_chunks || 0);
  const density = data.counts.codegraph_nodes ? Math.round((Number(data.counts.codegraph_edges || 0) / Number(data.counts.codegraph_nodes || 1)) * 100) / 100 : 0;

  return <div className="space-y-5 px-7 py-6">
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-blue-950/35 p-6 shadow-[0_18px_60px_rgba(0,0,0,.28)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(59,130,246,.22),transparent_28%),radial-gradient(circle_at_82%_20%,rgba(139,92,246,.18),transparent_26%)]" />
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <div className="kicker mb-2 text-blue-200/60">RecallOS Runtime</div>
          <h1 className="text-[32px] font-black leading-tight tracking-[-0.04em] text-white">Command Center</h1>
          <p className="mt-2 text-[14px] leading-6 text-slate-300/85">Runtime telemetry across memory, CodeGraph, Knowledge Base, and context assembly. Overview built for fast operational reading.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="green">Postgres</StatusPill>
          <StatusPill tone={data.codegraph.ok ? "cyan" : "red"}>CodeGraph {data.codegraph.ok ? "ok" : "err"}</StatusPill>
        </div>
      </div>
    </section>

    {/* Primary metrics row */}
    <div className="grid grid-cols-4 gap-4">
      <MetricTile label="Modules" value={data.modules.length} detail="Active runtime surfaces" tone="blue" />
      <MetricTile label="Vectors" value={`${embedded}/${chunks}`} detail="Embedded / total chunks" tone="violet" />
      <MetricTile label="Graph density" value={density} detail={`${data.counts.codegraph_edges || 0}e / ${data.counts.codegraph_nodes || 0}n`} tone="cyan" />
      <MetricTile label="KB entries" value={data.counts.knowledge_items || 0} detail="Notes, decisions, bugs" tone="amber" />
    </div>

    {/* Module table + Activity */}
    <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(380px,.9fr)] gap-4 items-start">
      <DataCard title="System modules" subtitle="Runtime subsystem status" accent="blue">
        <div className="divide-y divide-white/[0.05]">
          {data.modules.map((m, i) => (
            <div key={m.name} className="flex items-center gap-4 rounded-xl px-3 py-3 hover:bg-white/[0.035] animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex w-6 items-center justify-center">
                <span className={`pulse-dot ${m.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              </div>
              <span className={`w-44 truncate text-[13px] font-bold ${moduleColor(m.name)}`}>{m.name}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-white/56">{m.detail}</span>
              <span className="font-mono text-[13px] text-white/78">{Number(m.count).toLocaleString()}</span>
              <span className="badge blue">{m.tools}t</span>
              <span className="badge gray">{m.storage}</span>
            </div>
          ))}
        </div>
      </DataCard>

      <DataCard title="Activity stream" subtitle="Recent runtime events" accent="violet">
        <div className="max-h-[420px] space-y-1 overflow-auto scroll-area divide-y divide-white/[0.05] pr-1">
          {(data.recent.events || []).slice(0, 12).map((e, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-white/[0.035] animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
              <span className="mt-1 pulse-dot bg-blue-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white/78">{String(e.content).slice(0, 130)}</p>
                <p className="mt-1 text-[11px] text-white/42">{String(e.actor)} · {String(e.event_type)}</p>
              </div>
            </div>
          ))}
          {(data.recent.facts || []).slice(0, 6).map((f, i) => (
            <div key={`f-${i}`} className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-white/[0.035] animate-fade-up" style={{ animationDelay: `${(i + 12) * 30}ms` }}>
              <span className="mt-1 pulse-dot bg-emerald-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white/78">{String(f.value).slice(0, 130)}</p>
                <p className="mt-1 text-[11px] text-white/42">{String(f.scope)} · {String(f.key)}</p>
              </div>
            </div>
          ))}
        </div>
      </DataCard>
    </div>

    {/* Memory layers + CodeGraph/Brain */}
    <div className="grid grid-cols-2 gap-4">
      <DataCard title="Memory 4 layers" subtitle="Raw → Facts → Vector → Working" accent="green">
        <div className="divide-y divide-white/[0.05]">
          {data.memoryLayers.map((l, i) => (
            <div key={l.name} className="flex items-center justify-between gap-4 rounded-xl px-3 py-3 hover:bg-white/[0.035] animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="badge violet">L{i + 1}</span>
                <span className="text-[13px] font-semibold text-white/82 truncate">{l.name}</span>
              </div>
              <div className="flex items-center gap-3 min-w-0">
                <span className="truncate text-[12px] text-white/46">{l.description}</span>
                <span className="metric-value text-base font-bold text-violet-300 glow-violet">{l.count}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-white/[0.06]">
          {data.scopes.map(s => <StatusPill key={s.scope} tone="blue">{s.scope}: {s.count}</StatusPill>)}
        </div>
      </DataCard>

      <DataCard title="CodeGraph + Project Brain" subtitle="Source map and project intelligence" accent="cyan">
        <div className="grid grid-cols-2 gap-3">
          <MetricTile label="Files" value={data.counts.codegraph_files} tone="cyan" />
          <MetricTile label="Nodes" value={data.counts.codegraph_nodes} tone="violet" />
          <MetricTile label="Docs" value={data.projectBrain.docs} tone="green" />
          <MetricTile label="Decisions" value={data.projectBrain.decisions} tone="amber" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-white/[0.06]">
          {data.codegraph.languages.map(l => <StatusPill key={l.language} tone="cyan">{l.language}: {l.count}</StatusPill>)}
          {data.projectBrain.roadmapByStatus.map(r => <StatusPill key={r.status} tone="green">{r.status}: {r.count}</StatusPill>)}
        </div>
      </DataCard>
    </div>
  </div>;
}
