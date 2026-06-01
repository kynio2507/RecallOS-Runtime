"use client";
import { useEffect, useState } from "react";
import { DataCard, StatusPill } from "./components/ui";

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
    <div className="grid grid-cols-4 gap-5">
      {[
        { label: "Modules", value: data.modules.length, detail: "Active runtime surfaces", tone: "from-blue-500 to-cyan-400", pct: 88 },
        { label: "Vectors", value: `${embedded}/${chunks}`, detail: "Embedded / total chunks", tone: "from-violet-500 to-fuchsia-400", pct: chunks ? Math.round((embedded / chunks) * 100) : 0 },
        { label: "Graph density", value: density, detail: `${data.counts.codegraph_edges || 0}e / ${data.counts.codegraph_nodes || 0}n`, tone: "from-cyan-500 to-blue-400", pct: Math.min(100, Math.round(density * 35)) },
        { label: "KB entries", value: data.counts.knowledge_items || 0, detail: "Notes, decisions, bugs", tone: "from-amber-500 to-orange-400", pct: 64 },
      ].map((m) => (
        <div key={m.label} className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 shadow-[0_12px_36px_rgba(0,0,0,.20)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-white/[0.055]">
          <div className={`absolute -left-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${m.tone} opacity-10 blur-xl transition-opacity group-hover:opacity-20`} />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${m.tone} opacity-90 shadow-lg shadow-black/20`} />
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-bold text-emerald-300">live</span>
            </div>
            <div className="mt-4 text-[28px] font-black leading-none tracking-[-0.04em] text-white">{m.value}</div>
            <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.1em] text-white/46">{m.label}</div>
            <div className="mt-1 text-[12px] text-white/48">{m.detail}</div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className={`h-full rounded-full bg-gradient-to-r ${m.tone}`} style={{ width: `${m.pct}%` }} /></div>
          </div>
        </div>
      ))}
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

    {/* Bottom intelligence row */}
    <div className="grid grid-cols-3 gap-5">
      <DataCard title="Memory layers" subtitle="Raw → Facts → Vector → Working" accent="green">
        <div className="space-y-2">
          {data.memoryLayers.map((l, i) => (
            <div key={l.name} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="badge violet">L{i + 1}</span>
                  <span className="truncate text-[13px] font-bold text-white/84">{l.name}</span>
                </div>
                <span className="metric-value text-base font-black text-violet-300">{l.count}</span>
              </div>
              <p className="mt-2 truncate text-[12px] text-white/44">{l.description}</p>
            </div>
          ))}
        </div>
      </DataCard>

      <DataCard title="CodeGraph + Brain" subtitle="Source intelligence" accent="cyan">
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Files", data.counts.codegraph_files, "cyan"],
            ["Nodes", data.counts.codegraph_nodes, "violet"],
            ["Docs", data.projectBrain.docs, "green"],
            ["Decisions", data.projectBrain.decisions, "amber"],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.09em] text-white/42">{label}</div>
              <div className={`metric-value mt-2 text-2xl font-black ${tone === "cyan" ? "text-cyan-300" : tone === "violet" ? "text-violet-300" : tone === "green" ? "text-emerald-300" : "text-amber-300"}`}>{value as number}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
          {data.codegraph.languages.slice(0, 4).map(l => <StatusPill key={l.language} tone="cyan">{l.language}: {l.count}</StatusPill>)}
        </div>
      </DataCard>

      <DataCard title="Runtime insights" subtitle="Operational quick facts" accent="amber">
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.09em] text-emerald-200/70">Vector coverage</div>
            <div className="mt-2 flex items-end justify-between gap-3"><span className="metric-value text-2xl font-black text-emerald-300">{chunks ? Math.round((embedded / chunks) * 100) : 0}%</span><span className="text-[12px] text-white/45">{embedded}/{chunks}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><div className="text-[11px] text-white/42">Scopes</div><div className="metric-value mt-1 text-xl font-black text-blue-300">{data.scopes.length}</div></div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><div className="text-[11px] text-white/42">Roadmap</div><div className="metric-value mt-1 text-xl font-black text-violet-300">{data.projectBrain.roadmap}</div></div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {data.projectBrain.roadmapByStatus.map(r => <StatusPill key={r.status} tone="green">{r.status}: {r.count}</StatusPill>)}
          </div>
        </div>
      </DataCard>
    </div>
  </div>;
}
