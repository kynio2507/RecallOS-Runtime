"use client";
import { useEffect, useState, useCallback } from "react";

interface MemEvent { id: string; session_id: string; actor: string; event_type: string; content: string; agent_id: string; task_id: string; created_at: string; }
interface MemFact { id: string; scope: string; key: string; value: string; confidence: number; agent_id: string; pair_key: string; task_id: string; updated_at: string; }
interface Counts { events: number; facts: number; chunks: number; links: number; }

const TABS = ["Events", "Facts", "Search"];

export default function MemoryPage() {
  const [tab, setTab] = useState("Events");
  const [events, setEvents] = useState<MemEvent[]>([]);
  const [facts, setFacts] = useState<MemFact[]>([]);
  const [counts, setCounts] = useState<Counts>({ events: 0, facts: 0, chunks: 0, links: 0 });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback((q = "") => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("query", q);
    fetch(`/api/memory?${params}`)
      .then(r => r.json())
      .then(d => { setEvents(d.events || []); setFacts(d.facts || []); setCounts(d.counts || {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = () => fetchData(query);

  return (
    <div>
      <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">Memory</h1>
      <div className="flex gap-4 mb-6 text-sm text-[var(--muted)]">
        <span>Events: {counts.events}</span> <span>Facts: {counts.facts}</span>
        <span>Chunks: {counts.chunks}</span> <span>Links: {counts.links}</span>
      </div>

      <div className="flex gap-1 mb-4 p-1 bg-[var(--surface)] rounded-lg w-fit">
        {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? "active" : ""}`}>{t}</button>)}
      </div>

      {tab === "Search" && (
        <div className="flex gap-2 mb-4">
          <input type="text" placeholder="Search memory..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} className="max-w-md" />
          <button onClick={handleSearch} className="btn btn-primary">Search</button>
        </div>
      )}

      {loading ? (
        <div className="text-[var(--muted)] animate-pulse">Loading...</div>
      ) : (
        <>
          {(tab === "Events" || tab === "Search") && (
            <div className="grid gap-2">
              <h2 className="text-sm font-semibold text-[var(--muted)]">Events ({events.length})</h2>
              {events.map(e => (
                <div key={e.id} className="card py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge blue">{e.event_type}</span>
                    <span className="badge gray">{e.actor}</span>
                    {e.agent_id && <span className="badge green">{e.agent_id}</span>}
                    <span className="text-xs text-[var(--muted)] ml-auto">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-zinc-300">{e.content}</p>
                </div>
              ))}
              {events.length === 0 && <p className="text-[var(--muted)]">No events.</p>}
            </div>
          )}

          {(tab === "Facts" || tab === "Search") && (
            <div className="grid gap-2 mt-4">
              <h2 className="text-sm font-semibold text-[var(--muted)]">Facts ({facts.length})</h2>
              {facts.map(f => (
                <div key={f.id} className="card py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge blue">{f.scope}</span>
                    <span className="font-mono text-sm text-indigo-400">{f.key}</span>
                    {f.agent_id && <span className="badge green">{f.agent_id}</span>}
                    {f.pair_key && <span className="badge yellow">{f.pair_key}</span>}
                    <span className="text-xs text-[var(--muted)] ml-auto">conf: {f.confidence}</span>
                  </div>
                  <p className="text-sm text-zinc-300">{f.value}</p>
                </div>
              ))}
              {facts.length === 0 && <p className="text-[var(--muted)]">No facts.</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
