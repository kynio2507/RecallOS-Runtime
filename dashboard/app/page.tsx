"use client";
import { useEffect, useState } from "react";

interface Module { name: string; status: string; storage: string; count: number; tools: number; }
interface Counts { kb: number; symbols: number; events: number; facts: number; chunks: number; links: number; docs: number; modules: number; decisions: number; roadmap: number; glossary: number; agents: number; messages: number; handoffs: number; }

export default function OverviewPage() {
  const [data, setData] = useState<{ modules: Module[]; counts: Counts } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/overview")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="text-[var(--muted)] animate-pulse text-lg">Loading...</div></div>;
  if (error) return <div className="card border-red-500/30"><p className="text-red-400">Error: {error}</p></div>;
  if (!data) return null;

  const storageIcons: Record<string, string> = {
    "SQLite + FTS5": "🗄️", "MCP Client": "🔌", "PostgreSQL + pgvector": "🐘",
    "PostgreSQL": "🐘", "(no storage)": "⚡",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          RecallOS Overview
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">6 modules · 41 tools · Multi-agent runtime</p>
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {data.modules.map(m => (
          <div key={m.name} className="card group">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{storageIcons[m.storage] || "📦"}</span>
                <h3 className="font-semibold text-sm">{m.name}</h3>
              </div>
              <span className={`badge ${m.status === "active" ? "green" : "gray"}`}>{m.status}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span>{m.storage}</span>
              <span>{m.tools} tools</span>
            </div>
            <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
              <div className="text-2xl font-bold text-indigo-400">{m.count.toLocaleString()}</div>
              <div className="text-xs text-[var(--muted)]">records</div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats Grid */}
      <h2 className="text-lg font-semibold mb-4 text-zinc-300">Database Counts</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {Object.entries(data.counts).map(([key, val]) => (
          <div key={key} className="card text-center py-4">
            <div className="text-lg font-bold text-zinc-200">{Number(val).toLocaleString()}</div>
            <div className="text-xs text-[var(--muted)] mt-1">{key}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
