"use client";
import { useState, useCallback } from "react";

interface KBItem { id: string; type: string; title: string; content: string; symbols_json: string; tags_json: string; updated_at: string; }
interface TypeCount { type: string; count: number; }

export default function CodeGraphKBPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [items, setItems] = useState<KBItem[]>([]);
  const [types, setTypes] = useState<TypeCount[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

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
  }, [query, typeFilter]);

  return (
    <div>
      <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-6">CodeGraph + Knowledge Base</h1>

      <div className="card mb-6">
        <h2 className="text-sm font-semibold mb-3 text-zinc-300">Knowledge Base Search</h2>
        <div className="flex gap-2 mb-3">
          <input type="text" placeholder="Search bugs, rules, decisions..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()} className="flex-1" />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-32">
            <option value="">All types</option>
            <option value="bug">bug</option>
            <option value="rule">rule</option>
            <option value="decision">decision</option>
            <option value="note">note</option>
          </select>
          <button onClick={doSearch} className="btn btn-primary">Search</button>
        </div>
        {!searched && <p className="text-xs text-[var(--muted)]">Enter a query or click Search to browse all items.</p>}
      </div>

      {loading && <div className="text-[var(--muted)] animate-pulse">Searching...</div>}

      {searched && !loading && (
        <>
          {/* Type distribution */}
          {types.length > 0 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <span className="text-xs text-[var(--muted)]">Total: {count} |</span>
              {types.map(t => (
                <button key={t.type} onClick={() => { setTypeFilter(t.type); doSearch(); }} className={`badge ${t.type === "bug" ? "red" : t.type === "rule" ? "blue" : t.type === "decision" ? "green" : "gray"}`}>
                  {t.type}: {t.count}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-3">
            {items.map((item) => (
              <div key={item.id} className="card">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`badge ${item.type === "bug" ? "red" : item.type === "rule" ? "blue" : item.type === "decision" ? "green" : "gray"}`}>{item.type}</span>
                  <h3 className="font-semibold text-sm">{item.title}</h3>
                  <span className="text-xs text-[var(--muted)] ml-auto">{new Date(item.updated_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{item.content.slice(0, 500)}{item.content.length > 500 ? "..." : ""}</p>
                {item.symbols_json && item.symbols_json !== "[]" && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {JSON.parse(item.symbols_json).map((s: string) => <span key={s} className="badge blue text-xs">{s}</span>)}
                  </div>
                )}
                {item.tags_json && item.tags_json !== "[]" && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {JSON.parse(item.tags_json).map((t: string) => <span key={t} className="badge gray text-xs">#{t}</span>)}
                  </div>
                )}
              </div>
            ))}
            {items.length === 0 && <p className="text-[var(--muted)]">No results.</p>}
          </div>
        </>
      )}
    </div>
  );
}
