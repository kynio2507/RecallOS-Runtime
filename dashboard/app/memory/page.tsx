"use client";
import { useEffect, useState, useCallback } from "react";

interface MemEvent { id: string; session_id: string; actor: string; event_type: string; content: string; agent_id?: string; task_id?: string; run_id?: string; created_at: string; }
interface MemFact { id: string; scope: string; key: string; value: string; confidence: number; agent_id?: string; pair_key?: string; task_id?: string; session_id?: string; run_id?: string; updated_at: string; }
interface Chunk { id: string; source_type: string; source_id?: string; text: string; metadata: Record<string, unknown>; created_at: string; has_embedding: boolean; }
interface Link { id: string; source_id: string; target_id: string; relation: string; metadata: Record<string, unknown>; created_at: string; }
interface Counts { events: number; facts: number; chunks: number; links: number; embedded_chunks: number; }
interface Layer { id: string; name: string; count: number; description: string; }
interface Dist { scope?: string; event_type?: string; actor?: string; session_id?: string; count: number; last_seen?: string; }

const TABS = ["Raw Events", "Active Facts", "Context Chunks", "Working Memory", "Search"];

export default function MemoryPage() {
  const [tab, setTab] = useState("Raw Events");
  const [events, setEvents] = useState<MemEvent[]>([]);
  const [facts, setFacts] = useState<MemFact[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [counts, setCounts] = useState<Counts>({ events: 0, facts: 0, chunks: 0, links: 0, embedded_chunks: 0 });
  const [layers, setLayers] = useState<Layer[]>([]);
  const [scopes, setScopes] = useState<Dist[]>([]);
  const [eventTypes, setEventTypes] = useState<Dist[]>([]);
  const [actors, setActors] = useState<Dist[]>([]);
  const [sessions, setSessions] = useState<Dist[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback((q = "") => {
    setLoading(true); setError("");
    const params = new URLSearchParams();
    if (q) params.set("query", q);
    fetch(`/api/memory?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        setEvents(d.events || []); setFacts(d.facts || []); setChunks(d.chunks || []); setLinks(d.links || []);
        setCounts(d.counts || {}); setLayers(d.layers || []); setScopes(d.scopes || []); setEventTypes(d.eventTypes || []); setActors(d.actors || []); setSessions(d.sessions || []);
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const handleSearch = () => { setTab("Search"); fetchData(query); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Memory</h1>
        <p className="text-sm text-[var(--muted)] mt-2">Four-layer agent memory: raw events, active facts, vector context, working relations.</p>
      </div>

      {error && <div className="card border border-rose-500/40 text-rose-300">{error}</div>}

      <div className="grid md:grid-cols-4 gap-3">
        {layers.map((l, i) => <div key={l.id} className="card bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/5"><div className="flex items-center justify-between"><span className="badge blue">L{i+1}</span><span className="text-2xl font-bold text-indigo-300">{l.count}</span></div><h3 className="font-semibold mt-3">{l.name}</h3><p className="text-xs text-[var(--muted)] mt-2">{l.description}</p></div>)}
      </div>

      <div className="grid xl:grid-cols-4 gap-3">
        <div className="card"><h3 className="text-sm font-semibold mb-2">Scopes</h3><div className="flex gap-2 flex-wrap">{scopes.map(s => <span key={s.scope} className="badge blue">{s.scope}: {s.count}</span>)}</div></div>
        <div className="card"><h3 className="text-sm font-semibold mb-2">Event types</h3><div className="flex gap-2 flex-wrap">{eventTypes.map(e => <span key={e.event_type} className="badge gray">{e.event_type}: {e.count}</span>)}</div></div>
        <div className="card"><h3 className="text-sm font-semibold mb-2">Actors</h3><div className="flex gap-2 flex-wrap">{actors.map(a => <span key={a.actor} className="badge green">{a.actor}: {a.count}</span>)}</div></div>
        <div className="card"><h3 className="text-sm font-semibold mb-2">Sessions</h3><div className="space-y-1 text-xs text-[var(--muted)]">{sessions.map(s => <div key={s.session_id} className="truncate">{s.session_id}: {s.count}</div>)}</div></div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 p-1 bg-[var(--surface)] rounded-lg w-fit">
          {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? "active" : ""}`}>{t}</button>)}
        </div>
        <div className="flex gap-2 ml-auto">
          <input type="text" placeholder="Search memory..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} className="max-w-md" />
          <button onClick={handleSearch} className="btn btn-primary">Search</button>
        </div>
      </div>

      {loading ? <div className="text-[var(--muted)] animate-pulse">Loading...</div> : (
        <>
          {(tab === "Raw Events" || tab === "Search") && <div className="grid gap-2"><h2 className="font-semibold">Layer A · Raw Events ({counts.events})</h2>{events.map(e => <div key={e.id} className="card py-3"><div className="flex items-center gap-2 mb-1"><span className="badge blue">{e.event_type}</span><span className="badge gray">{e.actor}</span>{e.agent_id && <span className="badge green">{e.agent_id}</span>}<span className="text-xs text-[var(--muted)] ml-auto">{new Date(e.created_at).toLocaleString()}</span></div><p className="text-sm text-zinc-300 whitespace-pre-wrap">{e.content}</p><div className="text-xs text-[var(--muted)] mt-2">session={e.session_id} task={e.task_id || "-"} run={e.run_id || "-"}</div></div>)}</div>}

          {(tab === "Active Facts" || tab === "Search") && <div className="grid gap-2"><h2 className="font-semibold">Layer B · Active Facts ({counts.facts})</h2>{facts.map(f => <div key={f.id} className="card py-3"><div className="flex items-center gap-2 mb-1"><span className="badge blue">{f.scope}</span><span className="font-mono text-sm text-indigo-400">{f.key}</span>{f.agent_id && <span className="badge green">{f.agent_id}</span>}{f.pair_key && <span className="badge yellow">{f.pair_key}</span>}<span className="text-xs text-[var(--muted)] ml-auto">conf: {f.confidence}</span></div><p className="text-sm text-zinc-300 whitespace-pre-wrap">{f.value}</p><div className="text-xs text-[var(--muted)] mt-2">project={f.project_id || "-"} task={f.task_id || "-"} session={f.session_id || "-"}</div></div>)}</div>}

          {(tab === "Context Chunks" || tab === "Search") && <div className="grid gap-2"><h2 className="font-semibold">Layer C · Context Chunks / Vector ({counts.chunks}, embedded {counts.embedded_chunks})</h2>{chunks.map(c => <div key={c.id} className="card py-3"><div className="flex items-center gap-2 mb-1"><span className="badge blue">{c.source_type}</span><span className={c.has_embedding ? "badge green" : "badge red"}>{c.has_embedding ? "embedded" : "no vector"}</span><span className="text-xs text-[var(--muted)] ml-auto">{new Date(c.created_at).toLocaleString()}</span></div><p className="text-sm text-zinc-300 whitespace-pre-wrap">{c.text}</p></div>)}</div>}

          {(tab === "Working Memory" || tab === "Search") && <div className="grid gap-2"><h2 className="font-semibold">Layer D · Working Links / State ({counts.links})</h2>{links.map(l => <div key={l.id} className="card py-3"><div className="flex items-center gap-2"><span className="badge green">{l.relation}</span><span className="text-xs text-[var(--muted)]">{new Date(l.created_at).toLocaleString()}</span></div><div className="text-xs text-zinc-300 mt-2 font-mono break-all">{l.source_id} → {l.target_id}</div></div>)}{links.length === 0 && <div className="card text-[var(--muted)]">No links yet. Working memory graph empty.</div>}</div>}
        </>
      )}
    </div>
  );
}
