"use client";
import { useEffect, useState, useCallback } from "react";

interface Node { id: string; kind: string; name: string; qualified_name: string; file_path: string; language: string; start_line: number; end_line: number; signature?: string; docstring?: string; is_exported: number; is_async: number; }
interface Edge { kind: string; source_name: string; source_file: string; target_name: string; target_file: string; line: number; col: number; }
interface CountRow { files: number; nodes: number; edges: number; unresolved_refs: number; }
interface Dist { kind?: string; language?: string; count: number; }
interface TopFile { path: string; language: string; size: number; node_count: number; errors?: string | null; }

function tone(value: string) { if (["function", "calls"].includes(value)) return "blue"; if (["interface", "imports"].includes(value)) return "green"; if (value.includes("unresolved")) return "red"; return "gray"; }

export default function CodeGraphPage() {
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dbPath, setDbPath] = useState("");
  const [counts, setCounts] = useState<CountRow | null>(null);
  const [kinds, setKinds] = useState<Dist[]>([]);
  const [languages, setLanguages] = useState<Dist[]>([]);
  const [edgeKinds, setEdgeKinds] = useState<Dist[]>([]);
  const [topFiles, setTopFiles] = useState<TopFile[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const load = useCallback(() => {
    setLoading(true); setError("");
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (kindFilter) params.set("kind", kindFilter);
    fetch(`/api/codegraph?${params}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); setDbPath(d.dbPath || ""); setCounts(d.counts || null); setKinds(d.kinds || []); setLanguages(d.languages || []); setEdgeKinds(d.edgeKinds || []); setTopFiles(d.topFiles || []); setNodes(d.nodes || []); setEdges(d.relatedEdges || []); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [query, kindFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">CodeGraph</h1><p className="text-sm text-[var(--muted)] mt-2">Source code graph: files, symbols, imports, calls, references, impact surface.</p></div>
      {error && <div className="card border border-rose-500/40 text-rose-300">{error}</div>}
      {counts && <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><div className="card"><div className="text-xs text-[var(--muted)]">Files</div><div className="text-3xl font-bold text-cyan-300">{counts.files}</div></div><div className="card"><div className="text-xs text-[var(--muted)]">Nodes</div><div className="text-3xl font-bold text-violet-300">{counts.nodes}</div></div><div className="card"><div className="text-xs text-[var(--muted)]">Edges</div><div className="text-3xl font-bold text-emerald-300">{counts.edges}</div></div><div className="card"><div className="text-xs text-[var(--muted)]">Unresolved refs</div><div className="text-3xl font-bold text-rose-300">{counts.unresolved_refs}</div></div></div>}
      <div className="card"><div className="grid md:grid-cols-[1fr_180px_auto] gap-2"><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()} placeholder="Search symbols, files, signatures..." /><select value={kindFilter} onChange={e=>setKindFilter(e.target.value)}><option value="">All kinds</option>{kinds.map(k=><option key={k.kind} value={k.kind}>{k.kind}</option>)}</select><button onClick={load} className="btn btn-primary">Search</button></div><div className="text-xs text-[var(--muted)] truncate mt-3">{dbPath}</div></div>
      <div className="grid lg:grid-cols-3 gap-4"><div className="card"><h3 className="font-semibold mb-3">Symbol kinds</h3><div className="flex gap-2 flex-wrap">{kinds.map(k=><button key={k.kind} onClick={()=>setKindFilter(k.kind||"")} className={`badge ${tone(k.kind||"")}`}>{k.kind}: {k.count}</button>)}</div></div><div className="card"><h3 className="font-semibold mb-3">Languages</h3><div className="flex gap-2 flex-wrap">{languages.map(l=><span key={l.language} className="badge blue">{l.language}: {l.count}</span>)}</div></div><div className="card"><h3 className="font-semibold mb-3">Edge types</h3><div className="flex gap-2 flex-wrap">{edgeKinds.map(e=><span key={e.kind} className={`badge ${tone(e.kind||"")}`}>{e.kind}: {e.count}</span>)}</div></div></div>
      <div className="grid xl:grid-cols-[1.2fr_.8fr] gap-4"><div className="card"><h2 className="font-semibold mb-4">Symbols</h2>{loading && <div className="text-[var(--muted)] animate-pulse">Loading...</div>}<div className="space-y-3 max-h-[720px] overflow-auto pr-1">{nodes.map(n=><div key={n.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="flex items-center gap-2 mb-2"><span className={`badge ${tone(n.kind)}`}>{n.kind}</span>{n.is_async?<span className="badge blue">async</span>:null}{n.is_exported?<span className="badge green">export</span>:null}<span className="text-xs text-[var(--muted)] ml-auto">L{n.start_line}-{n.end_line}</span></div><div className="font-semibold text-sm">{n.qualified_name || n.name}</div><div className="text-xs text-cyan-300 mt-1">{n.file_path}</div>{n.signature && <pre className="mt-2 text-xs text-zinc-300 whitespace-pre-wrap overflow-auto">{n.signature}</pre>}</div>)}</div></div><div className="space-y-4"><div className="card"><h2 className="font-semibold mb-4">Top files</h2><div className="space-y-2 max-h-[340px] overflow-auto">{topFiles.map(f=><div key={f.path} className="text-xs border-b border-white/5 pb-2"><div className="text-zinc-200">{f.path}</div><div className="text-[var(--muted)]">{f.language} · {f.node_count} nodes · {Math.round(f.size/1024)}KB</div></div>)}</div></div><div className="card"><h2 className="font-semibold mb-4">Related edges</h2><div className="space-y-2 max-h-[340px] overflow-auto">{edges.map((e,i)=><div key={i} className="text-xs border-b border-white/5 pb-2"><span className={`badge ${tone(e.kind)}`}>{e.kind}</span><div className="mt-1 text-zinc-300">{e.source_name} → {e.target_name}</div><div className="text-[var(--muted)]">{e.source_file || e.target_file}</div></div>)}</div></div></div></div>
    </div>
  );
}
