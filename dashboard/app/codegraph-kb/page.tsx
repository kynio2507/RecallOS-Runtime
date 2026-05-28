"use client";
import { useEffect, useState, useCallback } from "react";

interface KBItem { id: string; type: string; title: string; content: string; symbols_json: string; tags_json: string; updated_at: string; }
interface TypeCount { type: string; count: number; }
interface CodeGraphNode { id: string; kind: string; name: string; qualified_name: string; file_path: string; language: string; start_line: number; end_line: number; signature?: string; docstring?: string; is_exported: number; is_async: number; }
interface CodeGraphEdge { kind: string; source_name: string; source_file: string; target_name: string; target_file: string; line: number; col: number; }
interface CountRow { files: number; nodes: number; edges: number; unresolved_refs: number; }
interface Distribution { kind?: string; language?: string; type?: string; count: number; }
interface TopFile { path: string; language: string; size: number; node_count: number; errors?: string | null; }

function badgeTone(value: string) {
  if (["bug", "error", "unresolved_refs"].includes(value)) return "red";
  if (["function", "calls", "rule"].includes(value)) return "blue";
  if (["decision", "imports", "interface"].includes(value)) return "green";
  return "gray";
}

export default function CodeGraphKBPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [items, setItems] = useState<KBItem[]>([]);
  const [types, setTypes] = useState<TypeCount[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [codeCounts, setCodeCounts] = useState<CountRow | null>(null);
  const [kinds, setKinds] = useState<Distribution[]>([]);
  const [languages, setLanguages] = useState<Distribution[]>([]);
  const [edgeKinds, setEdgeKinds] = useState<Distribution[]>([]);
  const [topFiles, setTopFiles] = useState<TopFile[]>([]);
  const [nodes, setNodes] = useState<CodeGraphNode[]>([]);
  const [edges, setEdges] = useState<CodeGraphEdge[]>([]);
  const [dbPath, setDbPath] = useState("");

  const loadCodeGraph = useCallback(() => {
    setCodeLoading(true);
    setCodeError("");
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (kindFilter) params.set("kind", kindFilter);
    fetch(`/api/codegraph?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setCodeError(d.error);
        setDbPath(d.dbPath || "");
        setCodeCounts(d.counts || null);
        setKinds(d.kinds || []);
        setLanguages(d.languages || []);
        setEdgeKinds(d.edgeKinds || []);
        setTopFiles(d.topFiles || []);
        setNodes(d.nodes || []);
        setEdges(d.relatedEdges || []);
        setCodeLoading(false);
      })
      .catch(e => { setCodeError(String(e)); setCodeLoading(false); });
  }, [query, kindFilter]);

  const doSearch = useCallback(() => {
    setLoading(true);
    setSearched(true);
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (typeFilter) params.set("type", typeFilter);
    fetch(`/api/kb?${params}`)
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setTypes(d.types || []); setCount(d.count || 0); setLoading(false); })
      .catch(() => setLoading(false));
    loadCodeGraph();
  }, [query, typeFilter, loadCodeGraph]);

  useEffect(() => { loadCodeGraph(); }, [loadCodeGraph]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">CodeGraph + Knowledge Base</h1>
          <p className="text-sm text-[var(--muted)] mt-2">Source intelligence + bug/fix/rule history. CodeGraph reads indexed DB directly.</p>
        </div>
        {dbPath && <span className="badge gray max-w-md truncate">{dbPath}</span>}
      </div>

      {codeCounts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card"><div className="text-xs text-[var(--muted)]">Files indexed</div><div className="text-3xl font-bold text-cyan-300">{codeCounts.files}</div></div>
          <div className="card"><div className="text-xs text-[var(--muted)]">Symbols / nodes</div><div className="text-3xl font-bold text-violet-300">{codeCounts.nodes}</div></div>
          <div className="card"><div className="text-xs text-[var(--muted)]">Graph edges</div><div className="text-3xl font-bold text-emerald-300">{codeCounts.edges}</div></div>
          <div className="card"><div className="text-xs text-[var(--muted)]">Unresolved refs</div><div className="text-3xl font-bold text-rose-300">{codeCounts.unresolved_refs}</div></div>
        </div>
      )}

      {codeError && <div className="card border border-rose-500/40 text-rose-300">CodeGraph error: {codeError}</div>}

      <div className="card">
        <h2 className="text-sm font-semibold mb-3 text-zinc-300">Unified Search</h2>
        <div className="grid md:grid-cols-[1fr_160px_160px_auto] gap-2">
          <input type="text" placeholder="Search symbols, files, bugs, rules, decisions..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()} />
          <select value={kindFilter} onChange={e => setKindFilter(e.target.value)}>
            <option value="">All symbol kinds</option>
            {kinds.map(k => <option key={k.kind} value={k.kind}>{k.kind}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All KB types</option>
            <option value="bug">bug</option><option value="rule">rule</option><option value="decision">decision</option><option value="note">note</option>
          </select>
          <button onClick={doSearch} className="btn btn-primary">Search</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="font-semibold mb-3">Symbol kinds</h3>
          <div className="flex gap-2 flex-wrap">{kinds.map(k => <button key={k.kind} onClick={() => setKindFilter(k.kind || "")} className={`badge ${badgeTone(k.kind || "")}`}>{k.kind}: {k.count}</button>)}</div>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-3">Languages</h3>
          <div className="flex gap-2 flex-wrap">{languages.map(l => <span key={l.language} className="badge blue">{l.language}: {l.count}</span>)}</div>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-3">Edge types</h3>
          <div className="flex gap-2 flex-wrap">{edgeKinds.map(e => <span key={e.kind} className={`badge ${badgeTone(e.kind || "")}`}>{e.kind}: {e.count}</span>)}</div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1.2fr_.8fr] gap-4">
        <div className="card">
          <h2 className="font-semibold mb-4">CodeGraph symbols</h2>
          {codeLoading && <div className="text-[var(--muted)] animate-pulse">Loading CodeGraph...</div>}
          <div className="space-y-3 max-h-[720px] overflow-auto pr-1">
            {nodes.map(n => (
              <div key={n.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06] transition">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`badge ${badgeTone(n.kind)}`}>{n.kind}</span>
                  {n.is_async ? <span className="badge blue">async</span> : null}
                  {n.is_exported ? <span className="badge green">export</span> : null}
                  <span className="text-xs text-[var(--muted)] ml-auto">L{n.start_line}-{n.end_line}</span>
                </div>
                <div className="font-semibold text-sm text-zinc-100">{n.qualified_name || n.name}</div>
                <div className="text-xs text-cyan-300 mt-1">{n.file_path}</div>
                {n.signature && <pre className="mt-2 text-xs text-zinc-300 whitespace-pre-wrap overflow-auto">{n.signature}</pre>}
                {n.docstring && <p className="mt-2 text-xs text-[var(--muted)] line-clamp-3">{n.docstring}</p>}
              </div>
            ))}
            {!codeLoading && nodes.length === 0 && <p className="text-[var(--muted)]">No CodeGraph symbols.</p>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold mb-4">Top indexed files</h2>
            <div className="space-y-2 max-h-[340px] overflow-auto">
              {topFiles.map(f => <div key={f.path} className="text-xs border-b border-white/5 pb-2"><div className="text-zinc-200">{f.path}</div><div className="text-[var(--muted)]">{f.language} · {f.node_count} nodes · {Math.round(f.size/1024)}KB</div></div>)}
            </div>
          </div>
          <div className="card">
            <h2 className="font-semibold mb-4">Related graph edges</h2>
            <div className="space-y-2 max-h-[340px] overflow-auto">
              {edges.map((e, i) => <div key={i} className="text-xs border-b border-white/5 pb-2"><span className={`badge ${badgeTone(e.kind)}`}>{e.kind}</span><div className="mt-1 text-zinc-300">{e.source_name} → {e.target_name}</div><div className="text-[var(--muted)]">{e.source_file || e.target_file}</div></div>)}
              {edges.length === 0 && <p className="text-[var(--muted)] text-sm">Search symbol to see graph edges.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Knowledge Base Search</h2>
        {!searched && <p className="text-xs text-[var(--muted)]">Unified search also queries KB. Click Search to browse all KB items.</p>}
        {loading && <div className="text-[var(--muted)] animate-pulse">Searching KB...</div>}
        {searched && !loading && (
          <>
            {types.length > 0 && <div className="flex gap-2 mb-4 flex-wrap"><span className="text-xs text-[var(--muted)]">Total: {count}</span>{types.map(t => <span key={t.type} className={`badge ${badgeTone(t.type)}`}>{t.type}: {t.count}</span>)}</div>}
            <div className="grid gap-3">
              {items.map(item => <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="flex items-center gap-2 mb-2"><span className={`badge ${badgeTone(item.type)}`}>{item.type}</span><h3 className="font-semibold text-sm">{item.title}</h3><span className="text-xs text-[var(--muted)] ml-auto">{new Date(item.updated_at).toLocaleDateString()}</span></div><p className="text-sm text-zinc-300 whitespace-pre-wrap">{item.content.slice(0, 700)}{item.content.length > 700 ? "..." : ""}</p></div>)}
              {items.length === 0 && <p className="text-[var(--muted)]">No KB results.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
