"use client";
import { useState } from "react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface Section { source: string; title: string; content: string; tokens: number; }

const AGENTS = ["", "assistant", "architect", "secretary", "coder", "designer", "reviewer"];
const DEPTHS = ["full", "summary", "minimal"];

const sourceColors: Record<string, string> = {
  "Project Brain": "#6366f1",
  "Memory": "#22c55e",
  "Knowledge Base": "#f59e0b",
  "CodeGraph": "#06b6d4",
  "Agents": "#ec4899",
};

export default function ContextPackPage() {
  const [task, setTask] = useState("");
  const [agentId, setAgentId] = useState("");
  const [depth, setDepth] = useState("full");
  const [symbols, setSymbols] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ sections: Section[]; totalTokens: number; sources: string[]; finalMarkdown: string } | null>(null);

  const buildContext = async () => {
    if (!task.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/context-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task, agent_id: agentId || undefined, depth,
          symbols: symbols ? symbols.split(",").map(s => s.trim()) : undefined,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch {}
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col">
      <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-6">Context Pack Viewer</h1>

      {/* Input */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">Task</label>
            <input type="text" placeholder="e.g. fix memory recall bug" value={task} onChange={e => setTask(e.target.value)} onKeyDown={e => e.key === "Enter" && buildContext()} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Agent</label>
              <select value={agentId} onChange={e => setAgentId(e.target.value)}>
                <option value="">(none)</option>
                {AGENTS.filter(Boolean).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Depth</label>
              <select value={depth} onChange={e => setDepth(e.target.value)}>
                {DEPTHS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Symbols</label>
              <input type="text" placeholder="sym1, sym2" value={symbols} onChange={e => setSymbols(e.target.value)} />
            </div>
          </div>
        </div>
        <button onClick={buildContext} disabled={!task.trim() || loading} className="btn btn-primary">
          {loading ? "Building..." : "⚡ Build Context Pack"}
        </button>
      </div>

      {result && (
        <>
          {/* Source Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {result.sources.map(src => {
              const srcSections = result.sections.filter(s => s.source === src);
              const srcTokens = srcSections.reduce((sum, s) => sum + s.tokens, 0);
              return (
                <div key={src} className="card text-center py-3" style={{ borderColor: `${sourceColors[src]}33` }}>
                  <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ background: sourceColors[src], boxShadow: `0 0 8px ${sourceColors[src]}` }} />
                  <div className="text-xs font-semibold" style={{ color: sourceColors[src] }}>{src}</div>
                  <div className="text-lg font-bold text-zinc-200 mt-1">{srcSections.length}</div>
                  <div className="text-xs text-[var(--muted)]">sections · ~{srcTokens} tokens</div>
                </div>
              );
            })}
            <div className="card text-center py-3 border-zinc-600">
              <div className="w-3 h-3 rounded-full mx-auto mb-2 bg-zinc-400" />
              <div className="text-xs font-semibold text-zinc-400">Total</div>
              <div className="text-lg font-bold text-zinc-200 mt-1">{result.sections.length}</div>
              <div className="text-xs text-[var(--muted)]">sections · ~{result.totalTokens} tokens</div>
            </div>
          </div>

          {/* Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[var(--muted)] mb-3">Sections ({result.sections.length})</h2>
              <div className="grid gap-2 max-h-[500px] overflow-y-auto pr-2">
                {result.sections.map((s, i) => (
                  <div key={i} className="card py-3" style={{ borderLeftWidth: 3, borderLeftColor: sourceColors[s.source] || "#666" }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: sourceColors[s.source] }}>{s.source}</span>
                        <span className="text-sm font-medium">{s.title}</span>
                      </div>
                      <span className="text-xs text-[var(--muted)]">~{s.tokens} tok</span>
                    </div>
                    <p className="text-xs text-zinc-400 whitespace-pre-wrap">{s.content.slice(0, 200)}{s.content.length > 200 ? "..." : ""}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Final Markdown */}
            <div>
              <h2 className="text-sm font-semibold text-[var(--muted)] mb-3">Final Context (Markdown)</h2>
              <div className="rounded-lg overflow-hidden border border-[var(--border-color)]" style={{ height: 500 }}>
                <MonacoEditor
                  height="100%"
                  defaultLanguage="markdown"
                  value={result.finalMarkdown}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    wordWrap: "on",
                    lineNumbers: "off",
                    scrollBeyondLastLine: false,
                    padding: { top: 12 },
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="card flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-3">⚡</div>
            <h2 className="text-lg font-semibold text-zinc-300 mb-2">Context Pack Viewer</h2>
            <p className="text-sm text-[var(--muted)] max-w-md">
              Enter a task and click &quot;Build Context Pack&quot; to see how RecallOS assembles context from all modules for an agent.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
