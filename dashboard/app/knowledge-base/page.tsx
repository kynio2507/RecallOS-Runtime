"use client";
import { useState, useCallback } from "react";

interface KBItem { id: string; type: string; title: string; content: string; symbols_json: string; files_json: string; tags_json: string; updated_at: string; }
interface TypeCount { type: string; count: number; }

function tone(type: string) { if (type === "bug") return "red"; if (type === "rule") return "blue"; if (type === "decision") return "green"; return "gray"; }
function safeJsonArray(value: string | undefined) { try { const v = JSON.parse(value || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }

export default function KnowledgeBasePage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [items, setItems] = useState<KBItem[]>([]);
  const [types, setTypes] = useState<TypeCount[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(() => {
    setLoading(true); setSearched(true);
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (typeFilter) params.set("type", typeFilter);
    params.set("limit", "50");
    fetch(`/api/kb?${params}`)
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setTypes(d.types || []); setCount(d.count || 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [query, typeFilter]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Knowledge Base</h1><p className="text-sm text-[var(--muted)] mt-2">Reusable bug/fix/rule/technical notes. No source graph here.</p></div>
      <div className="card"><h2 className="text-sm font-semibold mb-3 text-zinc-300">KB Search</h2><div className="grid md:grid-cols-[1fr_160px_auto] gap-2"><input type="text" placeholder="Search bugs, fixes, rules, decisions, notes..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()} /><select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="">All types</option><option value="bug">bug</option><option value="rule">rule</option><option value="decision">decision</option><option value="note">note</option></select><button onClick={doSearch} className="btn btn-primary">Search</button></div>{!searched && <p className="text-xs text-[var(--muted)] mt-3">Click Search to browse all knowledge items.</p>}</div>
      <div className="card"><div className="flex items-center justify-between mb-4"><h2 className="font-semibold">Distribution</h2><span className="text-sm text-[var(--muted)]">Total: {count}</span></div><div className="flex gap-2 flex-wrap">{types.map(t => <button key={t.type} onClick={() => setTypeFilter(t.type)} className={`badge ${tone(t.type)}`}>{t.type}: {t.count}</button>)}</div></div>
      {loading && <div className="text-[var(--muted)] animate-pulse">Searching...</div>}
      {searched && !loading && <div className="grid gap-3">{items.map(item => <div key={item.id} className="card"><div className="flex items-center gap-2 mb-2"><span className={`badge ${tone(item.type)}`}>{item.type}</span><h3 className="font-semibold text-sm">{item.title}</h3><span className="text-xs text-[var(--muted)] ml-auto">{new Date(item.updated_at).toLocaleDateString()}</span></div><p className="text-sm text-zinc-300 whitespace-pre-wrap">{item.content}</p><div className="flex gap-1 mt-3 flex-wrap">{safeJsonArray(item.symbols_json).map((s: string) => <span key={s} className="badge blue text-xs">{s}</span>)}{safeJsonArray(item.tags_json).map((t: string) => <span key={t} className="badge gray text-xs">#{t}</span>)}{safeJsonArray(item.files_json).map((f: string) => <span key={f} className="badge green text-xs">{f}</span>)}</div></div>)}{items.length === 0 && <p className="text-[var(--muted)]">No KB results.</p>}</div>}
    </div>
  );
}
