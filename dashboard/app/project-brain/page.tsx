"use client";
import { useEffect, useState } from "react";

interface Decision { id: string; title: string; decision: string; reason: string; status: string; created_at: string; }
interface RoadmapItem { id: string; title: string; description: string; priority: string; status: string; milestone: string; }
interface Module { name: string; purpose: string; status: string; owner: string; }
interface Doc { id: string; doc_type: string; title: string; snippet: string; version: number; status: string; updated_at: string; }
interface GlossaryItem { term: string; definition: string; aliases: string[]; }

const TABS = ["Overview", "Roadmap", "Decisions", "Modules", "Docs", "Glossary"];
const priorityColor: Record<string, string> = { critical: "red", high: "yellow", medium: "blue", low: "gray" };
const statusColor: Record<string, string> = { doing: "green", planned: "blue", blocked: "red", done: "gray" };

export default function ProjectBrainPage() {
  const [tab, setTab] = useState("Overview");
  const [data, setData] = useState<{ overview: { title: string; content: string } | null; modules: Module[]; decisions: Decision[]; roadmap: RoadmapItem[]; glossary: GlossaryItem[]; docs: Doc[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/project-brain")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="text-[var(--muted)] animate-pulse">Loading...</div></div>;
  if (!data) return <div className="card"><p className="text-[var(--muted)]">No data</p></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-6">Project Brain</h1>
      <div className="flex gap-1 mb-6 p-1 bg-[var(--surface)] rounded-lg w-fit">
        {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? "active" : ""}`}>{t}</button>)}
      </div>

      {tab === "Overview" && (
        <div className="card">
          {data.overview ? (
            <div className="markdown-view">
              <h2>{data.overview.title}</h2>
              <p style={{ whiteSpace: "pre-wrap" }}>{data.overview.content}</p>
            </div>
          ) : <p className="text-[var(--muted)]">No overview doc. Use recall_project_upsert_doc to create one.</p>}
        </div>
      )}

      {tab === "Roadmap" && (
        <div className="grid gap-3">
          {["doing", "planned", "blocked", "done"].map(status => {
            const items = data.roadmap.filter(r => r.status === status);
            if (items.length === 0) return null;
            return (
              <div key={status}>
                <h3 className="text-sm font-semibold text-[var(--muted)] mb-2 uppercase">{status} ({items.length})</h3>
                <div className="grid gap-2">
                  {items.map(r => (
                    <div key={r.id} className="card flex items-center justify-between">
                      <div>
                        <span className="font-medium">{r.title}</span>
                        {r.description && <p className="text-xs text-[var(--muted)] mt-1">{r.description}</p>}
                        {r.milestone && <span className="text-xs text-[var(--muted)]"> · {r.milestone}</span>}
                      </div>
                      <div className="flex gap-2">
                        <span className={`badge ${priorityColor[r.priority] || "gray"}`}>{r.priority}</span>
                        <span className={`badge ${statusColor[r.status] || "gray"}`}>{r.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {data.roadmap.length === 0 && <p className="text-[var(--muted)]">No roadmap items.</p>}
        </div>
      )}

      {tab === "Decisions" && (
        <div className="grid gap-3">
          {data.decisions.map(d => (
            <div key={d.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{d.title}</h3>
                <span className={`badge ${d.status === "accepted" ? "green" : "gray"}`}>{d.status}</span>
              </div>
              <p className="text-sm text-zinc-300">{d.decision}</p>
              {d.reason && <p className="text-xs text-[var(--muted)] mt-2">Reason: {d.reason}</p>}
              <p className="text-xs text-[var(--muted)] mt-1">{new Date(d.created_at).toLocaleDateString()}</p>
            </div>
          ))}
          {data.decisions.length === 0 && <p className="text-[var(--muted)]">No decisions.</p>}
        </div>
      )}

      {tab === "Modules" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.modules.map(m => (
            <div key={m.name} className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{m.name}</h3>
                <span className={`badge ${m.status === "active" ? "green" : "gray"}`}>{m.status}</span>
              </div>
              <p className="text-sm text-zinc-300">{m.purpose}</p>
              {m.owner && <p className="text-xs text-[var(--muted)] mt-1">Owner: {m.owner}</p>}
            </div>
          ))}
          {data.modules.length === 0 && <p className="text-[var(--muted)]">No modules.</p>}
        </div>
      )}

      {tab === "Docs" && (
        <div className="grid gap-3">
          {data.docs.map(d => (
            <div key={d.id} className="card">
              <div className="flex items-center gap-2 mb-1">
                <span className="badge blue">{d.doc_type}</span>
                <h3 className="font-semibold">{d.title}</h3>
                <span className="text-xs text-[var(--muted)]">v{d.version}</span>
              </div>
              <p className="text-sm text-zinc-400">{d.snippet}...</p>
              <p className="text-xs text-[var(--muted)] mt-1">{new Date(d.updated_at).toLocaleDateString()}</p>
            </div>
          ))}
          {data.docs.length === 0 && <p className="text-[var(--muted)]">No docs.</p>}
        </div>
      )}

      {tab === "Glossary" && (
        <div className="grid gap-2">
          {data.glossary.map(g => (
            <div key={g.term} className="card flex items-start gap-4">
              <span className="font-mono text-indigo-400 font-semibold min-w-[120px]">{g.term}</span>
              <span className="text-sm text-zinc-300">{g.definition}</span>
            </div>
          ))}
          {data.glossary.length === 0 && <p className="text-[var(--muted)]">No glossary terms.</p>}
        </div>
      )}
    </div>
  );
}
