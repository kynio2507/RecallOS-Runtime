"use client";
import { useEffect, useState } from "react";

interface Module { name: string; status: string; storage: string; count: number; tools: number; detail: string; }
interface Counts { [key: string]: number; }
interface Layer { name: string; count: number; description: string; }
interface RecentItem { [key: string]: string | number | null; }
interface OverviewData {
  modules: Module[];
  counts: Counts;
  memoryLayers: Layer[];
  codegraph: { ok: boolean; dbPath: string; counts: Counts; languages: { language: string; count: number }[]; kinds: { kind: string; count: number }[]; error?: string };
  projectBrain: { docs: number; modules: number; decisions: number; roadmap: number; glossary: number; roadmapByStatus: { status: string; count: number }[] };
  scopes: { scope: string; count: number }[];
  recent: Record<string, RecentItem[]>;
}

function tone(name: string) {
  if (name.includes("CodeGraph")) return "from-cyan-500/20 to-blue-500/10 border-cyan-400/20";
  if (name.includes("Memory")) return "from-fuchsia-500/20 to-violet-500/10 border-fuchsia-400/20";
  if (name.includes("Project")) return "from-emerald-500/20 to-teal-500/10 border-emerald-400/20";
  if (name.includes("Knowledge")) return "from-amber-500/20 to-orange-500/10 border-amber-400/20";
  return "from-white/10 to-white/[0.03] border-white/10";
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/overview")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="text-[var(--muted)] animate-pulse text-lg">Loading runtime state...</div></div>;
  if (error) return <div className="card border-red-500/30"><p className="text-red-400">Error: {error}</p></div>;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-cyan-500/10 p-8">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,.35),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(34,211,238,.22),transparent_30%)]" />
        <div className="relative">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">RecallOS Runtime Dashboard</h1>
          <p className="text-sm text-zinc-300 mt-2">Live module health · Project truth · 4-layer memory · CodeGraph index · Multi-agent runtime</p>
          <div className="flex flex-wrap gap-2 mt-4 text-xs">
            <span className="badge green">6 modules</span><span className="badge blue">41 MCP tools</span><span className="badge green">PostgreSQL online</span><span className={data.codegraph.ok ? "badge green" : "badge red"}>CodeGraph {data.codegraph.ok ? "indexed" : "error"}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.modules.map(m => (
          <div key={m.name} className={`card group bg-gradient-to-br ${tone(m.name)} hover:scale-[1.01] transition`}> 
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-base">{m.name}</h3><span className={`badge ${m.status === "active" ? "green" : m.status === "error" ? "red" : "gray"}`}>{m.status}</span></div>
            <div className="text-xs text-[var(--muted)] mb-4">{m.storage} · {m.tools} tools</div>
            <div className="text-4xl font-bold text-zinc-100">{Number(m.count).toLocaleString()}</div>
            <div className="text-xs text-zinc-300 mt-2">{m.detail}</div>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Memory 4 layers</h2>
          <div className="grid gap-3">
            {data.memoryLayers.map((l, i) => <div key={l.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center gap-3"><span className="text-xs rounded-full bg-indigo-500/20 text-indigo-200 px-2 py-1">L{i+1}</span><div className="font-semibold">{l.name}</div><div className="ml-auto text-2xl font-bold text-indigo-300">{l.count}</div></div><p className="text-xs text-[var(--muted)] mt-2">{l.description}</p></div>)}
          </div>
          <div className="flex gap-2 mt-4 flex-wrap">{data.scopes.map(s => <span key={s.scope} className="badge blue">{s.scope}: {s.count}</span>)}</div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">CodeGraph index</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl bg-cyan-400/10 p-4"><div className="text-xs text-[var(--muted)]">Files</div><div className="text-3xl font-bold text-cyan-300">{data.counts.codegraph_files}</div></div>
            <div className="rounded-xl bg-violet-400/10 p-4"><div className="text-xs text-[var(--muted)]">Nodes</div><div className="text-3xl font-bold text-violet-300">{data.counts.codegraph_nodes}</div></div>
            <div className="rounded-xl bg-emerald-400/10 p-4"><div className="text-xs text-[var(--muted)]">Edges</div><div className="text-3xl font-bold text-emerald-300">{data.counts.codegraph_edges}</div></div>
            <div className="rounded-xl bg-rose-400/10 p-4"><div className="text-xs text-[var(--muted)]">Unresolved refs</div><div className="text-3xl font-bold text-rose-300">{data.counts.unresolved_refs}</div></div>
          </div>
          <div className="text-xs text-[var(--muted)] truncate mb-3">{data.codegraph.dbPath}</div>
          <div className="flex gap-2 flex-wrap mb-3">{data.codegraph.languages.map(l => <span key={l.language} className="badge blue">{l.language}: {l.count}</span>)}</div>
          <div className="flex gap-2 flex-wrap">{data.codegraph.kinds.slice(0,8).map(k => <span key={k.kind} className="badge gray">{k.kind}: {k.count}</span>)}</div>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Project Brain</h2>
          <div className="grid grid-cols-5 gap-2 mb-4">{[["Docs",data.projectBrain.docs],["Modules",data.projectBrain.modules],["Decisions",data.projectBrain.decisions],["Roadmap",data.projectBrain.roadmap],["Glossary",data.projectBrain.glossary]].map(([k,v]) => <div key={String(k)} className="rounded-xl bg-white/[0.04] p-3 text-center"><div className="font-bold text-xl">{Number(v).toLocaleString()}</div><div className="text-xs text-[var(--muted)]">{k}</div></div>)}</div>
          <div className="flex gap-2 flex-wrap mb-4">{data.projectBrain.roadmapByStatus.map(r => <span key={r.status} className="badge green">{r.status}: {r.count}</span>)}</div>
          <h3 className="text-sm font-semibold text-[var(--muted)] mb-2">Recent project docs</h3>
          <div className="space-y-2">{(data.recent.docs || []).map((d,i) => <div key={i} className="text-sm border-b border-white/5 pb-2"><span className="badge blue">{String(d.doc_type)}</span> <span>{String(d.title)}</span></div>)}</div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Recent runtime activity</h2>
          <div className="space-y-3">
            {(data.recent.events || []).map((e,i) => <div key={i} className="rounded-xl bg-white/[0.03] p-3"><div className="flex gap-2 mb-1"><span className="badge blue">{String(e.event_type)}</span><span className="badge gray">{String(e.actor)}</span></div><p className="text-xs text-zinc-300">{String(e.content)}</p></div>)}
            {(data.recent.facts || []).map((f,i) => <div key={`f-${i}`} className="rounded-xl bg-white/[0.03] p-3"><div className="flex gap-2 mb-1"><span className="badge green">{String(f.scope)}</span><span className="font-mono text-xs text-indigo-300">{String(f.key)}</span></div><p className="text-xs text-zinc-300">{String(f.value)}</p></div>)}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Raw database counts</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {Object.entries(data.counts).map(([key, val]) => <div key={key} className="rounded-xl bg-white/[0.03] p-3 text-center"><div className="text-lg font-bold text-zinc-200">{Number(val).toLocaleString()}</div><div className="text-xs text-[var(--muted)] mt-1">{key}</div></div>)}
        </div>
      </div>
    </div>
  );
}
