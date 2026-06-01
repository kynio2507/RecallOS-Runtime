"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { DataCard, MetricTile, PageHeader, SectionTitle, StatusPill } from "../components/ui";

type Provider = { id: string; name: string; base_url: string; api_key_masked?: string; api_key_env_var?: string; has_api_key: boolean; api_key_storage: string; status: string };
type Model = { id: string; provider_id: string; provider_name?: string; model_id: string; prefix?: string; family?: string; status: string };
type Assignment = { id: string; agent_id: string; provider_id: string; provider_name: string; model_id: string; purpose: string; base_url: string; api_key_masked?: string };

const AGENTS = ["pm_architecture", "analyzer", "senior_product_designer", "senior_product_coder", "product_code_reviewer"];
const AGENT_META: Record<string, { icon: string; role: string; tone: string }> = {
  pm_architecture: { icon: "◉", role: "PM & Architecture", tone: "blue" },
  analyzer: { icon: "⬡", role: "Code Analyzer", tone: "cyan" },
  senior_product_designer: { icon: "✦", role: "UI/UX Designer", tone: "violet" },
  senior_product_coder: { icon: "◆", role: "Implementation", tone: "green" },
  product_code_reviewer: { icon: "▣", role: "Code Review", tone: "amber" },
};
const TONE_BORDER: Record<string, string> = { blue: "border-blue-500/20", cyan: "border-cyan-500/20", violet: "border-violet-500/20", green: "border-emerald-500/20", amber: "border-amber-500/20" };
const TONE_BG: Record<string, string> = { blue: "bg-blue-500/8", cyan: "bg-cyan-500/8", violet: "bg-violet-500/8", green: "bg-emerald-500/8", amber: "bg-amber-500/8" };
const TONE_TEXT: Record<string, string> = { blue: "text-blue-400", cyan: "text-cyan-400", violet: "text-violet-400", green: "text-emerald-400", amber: "text-amber-400" };
const TONE_GLOW: Record<string, string> = { blue: "glow-blue", cyan: "glow-cyan", violet: "glow-violet", green: "glow-emerald", amber: "" };

export default function ForgeBase9Page() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [pForm, setPForm] = useState({ id: "", name: "9router", base_url: "https://9router.may365.cloud/v1", api_key: "", api_key_env_var: "" });
  const [mForm, setMForm] = useState({ provider_id: "", model_id: "" });
  const [test, setTest] = useState({ provider_id: "", model_id: "", prompt: "Reply with exactly: RecallOS model test OK" });
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [aForm, setAForm] = useState<Record<string, { provider_id: string; model_id: string }>>({});
  const [dragOverAgent, setDragOverAgent] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [p, m, a] = await Promise.all([
        fetch("/api/forgebase9/providers").then(r => r.json()),
        fetch("/api/forgebase9/models").then(r => r.json()),
        fetch("/api/forgebase9/assignments?project_id=recallos-runtime").then(r => r.json()),
      ]);
      if (p.error || m.error || a.error) throw new Error(p.error || m.error || a.error);
      setProviders(p.providers || []);
      setModels(m.models || []);
      setAssignments(a.assignments || []);
    } catch (e) { setError(String(e)); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const prefixes = useMemo(() => [...new Set(models.map(m => m.prefix).filter(Boolean))], [models]);

  const saveProvider = async () => {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/forgebase9/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pForm) }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      setPForm({ id: "", name: "9router", base_url: "https://9router.may365.cloud/v1", api_key: "", api_key_env_var: "" });
      setShowProviderForm(false);
      await load();
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };

  const seed = async () => {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/forgebase9", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "seed" }) }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      await load();
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };

  const editProvider = (p: Provider) => {
    setPForm({ id: p.id, name: p.name, base_url: p.base_url, api_key: "", api_key_env_var: p.api_key_env_var || "" });
    setShowProviderForm(true);
  };

  const cancelEdit = () => {
    setPForm({ id: "", name: "9router", base_url: "https://9router.may365.cloud/v1", api_key: "", api_key_env_var: "" });
    setShowProviderForm(false);
  };

  const deleteProvider = async (provider_id: string, name: string) => {
    if (!confirm(`Delete provider ${name}? This also deletes its models and agent assignments.`)) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/forgebase9/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", provider_id }) }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      await load();
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };

  const discover = async (provider_id: string) => {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/forgebase9/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "discover", provider_id }) }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      await load();
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };

  const addModel = async () => {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/forgebase9/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mForm) }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      setMForm({ ...mForm, model_id: "" });
      await load();
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };

  const runTest = async (customProviderId?: string, customModelId?: string) => {
    const pid = customProviderId || test.provider_id;
    const mid = customModelId || test.model_id;
    if (!pid || !mid) return;
    setBusy(true); setError(""); setTestResult(null);
    try {
      const r = await fetch("/api/forgebase9/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: pid, model_id: mid, prompt: "Reply with exactly: RecallOS model test OK" })
      }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      setTestResult({ ...r, model_id: mid });
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };

  const saveAssignment = async (agent_id: string, customProviderId?: string, customModelId?: string) => {
    const pid = customProviderId || aForm[agent_id]?.provider_id;
    const mid = customModelId || aForm[agent_id]?.model_id;
    if (!pid || !mid) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/forgebase9/assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: "default", project_id: "recallos-runtime", agent_id, provider_id: pid, model_id: mid }) }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      await load();
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };

  const modelsFor = (pid: string) => models.filter(m => m.provider_id === pid);
  const tr = testResult as Record<string, any> | null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Multi Agent"
        description="Provider registry, model catalog, and agent assignments."
        actions={
          <div className="flex gap-1.5">
            <button className="btn btn-ghost" onClick={() => { setShowProviderForm(!showProviderForm); if (showProviderForm) cancelEdit(); }}>{showProviderForm ? "Cancel" : "+ Provider"}</button>
            <button className="btn btn-primary" onClick={seed} disabled={busy}>Seed config</button>
          </div>
        }
      />

      {error && <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">{error}</div>}

      {/* Metrics */}
      <div className="grid gap-2 grid-cols-4">
        <MetricTile label="Providers" value={providers.length} tone="blue" />
        <MetricTile label="Models" value={models.length} tone="violet" />
        <MetricTile label="Prefixes" value={prefixes.length} tone="cyan" />
        <MetricTile label="Assignments" value={assignments.length} tone="green" />
      </div>

      {/* Provider form (collapsible) */}
      {showProviderForm && (
        <DataCard title={pForm.id ? "Edit provider" : "Add provider"} subtitle={pForm.id ? "Re-enter API key to enable testing" : "Register a new LLM endpoint"} accent="blue">
          <div className="grid gap-2 md:grid-cols-2">
            <input type="text" placeholder="Name" value={pForm.name} onChange={e => setPForm({ ...pForm, name: e.target.value })} />
            <input type="text" placeholder="Base URL" value={pForm.base_url} onChange={e => setPForm({ ...pForm, base_url: e.target.value })} />
            <input type="text" placeholder="API key (optional)" value={pForm.api_key} onChange={e => setPForm({ ...pForm, api_key: e.target.value })} />
            <input type="text" placeholder="Env var (optional)" value={pForm.api_key_env_var} onChange={e => setPForm({ ...pForm, api_key_env_var: e.target.value })} />
          </div>
          <div className="mt-2 flex gap-1.5">
            <button className="btn btn-primary" disabled={busy || !pForm.name || !pForm.base_url} onClick={saveProvider}>{pForm.id ? "Update" : "Save"}</button>
            <button className="btn btn-ghost" onClick={cancelEdit}>Cancel</button>
          </div>
        </DataCard>
      )}

      {/* Balanced layout: sidebar & agent panel */}
      <div className="grid gap-4 lg:grid-cols-[1fr_2.2fr]">
        {/* Left Column: Providers + Catalog */}
        <div className="space-y-4">
          <DataCard title="Providers" accent="blue">
            <div className="space-y-2">
              {providers.map((p, i) => (
                <div key={p.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="flex items-center gap-2">
                    <span className={`pulse-dot ${p.has_api_key ? "bg-emerald-400" : "bg-amber-400"}`} />
                    <span className="text-xs font-semibold text-white/80">{p.name}</span>
                    <span className="badge blue ml-auto">{p.api_key_storage}</span>
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] text-white/25 truncate">{p.base_url}</div>
                  <div className="mt-2 flex gap-1">
                    <button className="btn btn-ghost !py-0.5 !px-2 !text-[10px] !rounded-md" onClick={() => discover(p.id)} disabled={busy}>Discover</button>
                    <button className="btn btn-ghost !py-0.5 !px-2 !text-[10px] !rounded-md" onClick={() => editProvider(p)} disabled={busy}>Edit</button>
                    <button className="btn btn-ghost !py-0.5 !px-2 !text-[10px] !rounded-md !text-rose-400" onClick={() => deleteProvider(p.id, p.name)} disabled={busy}>Delete</button>
                  </div>
                </div>
              ))}
              {!providers.length && <div className="py-3 text-center text-xs text-white/20">No providers</div>}
            </div>
          </DataCard>

          <DataCard title="Model catalog" subtitle={`${models.length} models · ${prefixes.length} prefixes`} accent="violet">
            {/* Split inputs into two rows and make them larger */}
            <div className="space-y-2.5 mb-3 border-b border-white/[0.04] pb-3">
              <div>
                <label className="text-[10px] text-white/40 block mb-1">Provider</label>
                <select className="w-full text-xs !py-1 !px-2 bg-black/40 border border-white/[0.08] rounded-md text-white/80" value={mForm.provider_id} onChange={e => setMForm({ ...mForm, provider_id: e.target.value })}>
                  <option value="">Select Provider</option>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/40 block mb-1">Model ID</label>
                <input type="text" className="w-full text-xs !py-1 !px-2 bg-black/40 border border-white/[0.08] rounded-md text-white/80 placeholder:text-white/25" placeholder="e.g. ag/claude-sonnet-4-6" value={mForm.model_id} onChange={e => setMForm({ ...mForm, model_id: e.target.value })} />
              </div>
              <button className="btn btn-primary w-full !py-1 !text-xs" onClick={addModel} disabled={busy || !mForm.provider_id || !mForm.model_id}>Add Model to Catalog</button>
            </div>

            {prefixes.length > 0 && <div className="flex flex-wrap gap-1 mb-2.5">{prefixes.map(p => <StatusPill key={p} tone="cyan">{p}</StatusPill>)}</div>}
            
            <div className="text-[10px] text-white/40 mb-2 italic">Drag models to Agent cards on the right. Press ▶ to run a quick test.</div>
            <div className="space-y-1.5 max-h-[280px] overflow-auto pr-1">
              {models.map((m, i) => (
                <div
                  key={m.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/json", JSON.stringify({ provider_id: m.provider_id, model_id: m.model_id }));
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className="flex items-center gap-1.5 rounded-md border border-white/[0.04] bg-white/[0.015] px-2.5 py-1.5 cursor-grab active:cursor-grabbing hover:bg-white/[0.05] hover:border-white/[0.1] transition-all select-none animate-fade-up"
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  <span className="text-[11px] text-white/30 mr-0.5 select-none font-bold">⋮⋮</span>
                  <span className="badge violet !text-[8px] !px-1">{m.provider_name || "?"}</span>
                  {m.prefix && <span className="badge cyan !text-[8px] !px-1">{m.prefix}</span>}
                  <span className="font-mono text-[11px] text-white/60 truncate flex-1">{m.model_id}</span>
                  <button
                    title="Test model"
                    className="btn btn-ghost !p-1 !h-6 !w-6 flex items-center justify-center text-cyan-400 hover:bg-cyan-500/10 rounded-md ml-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      runTest(m.provider_id, m.model_id);
                    }}
                    disabled={busy}
                  >
                    ▶
                  </button>
                </div>
              ))}
              {!models.length && <div className="py-3 text-center text-xs text-white/20">No models in catalog</div>}
            </div>

            {/* Inline Test Result Box */}
            {tr && (
              <div className="mt-3 animate-fade-up rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 relative">
                <button className="absolute top-2 right-2 text-white/30 hover:text-white/60 text-xs font-bold" onClick={() => setTestResult(null)}>✕</button>
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  <StatusPill tone={tr.ok ? "green" : "red"}>{tr.ok ? "Success" : "Warning"}</StatusPill>
                  <span className="text-[10px] text-white/25">{tr.latency_ms}ms</span>
                </div>
                <div className="font-mono text-[10px] text-white/50 truncate mb-1">{tr.model_id}</div>
                {tr.content && (
                  <div className="text-[10px] text-white/65 whitespace-pre-wrap max-h-[100px] overflow-auto border-t border-white/[0.04] pt-1 mt-1">{tr.content as string}</div>
                )}
              </div>
            )}
          </DataCard>
        </div>

        {/* Right Column: Agent Assignments */}
        <div className="space-y-3">
          <SectionTitle title="Agent assignments" subtitle="Model routing for pipeline agents (Drag & drop to map)" />
          
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {AGENTS.map((agent, i) => {
              const meta = AGENT_META[agent] || { icon: "●", role: agent, tone: "blue" };
              const current = assignments.find(a => a.agent_id === agent);
              const draft = aForm[agent] || { provider_id: current?.provider_id || providers[0]?.id || "", model_id: current?.model_id || "" };
              const isDragOver = dragOverAgent === agent;

              return (
                <div
                  key={agent}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverAgent !== agent) setDragOverAgent(agent);
                  }}
                  onDragLeave={() => {
                    if (dragOverAgent === agent) setDragOverAgent(null);
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setDragOverAgent(null);
                    try {
                      const dataStr = e.dataTransfer.getData("application/json");
                      if (!dataStr) return;
                      const parsed = JSON.parse(dataStr);
                      if (parsed.provider_id && parsed.model_id) {
                        await saveAssignment(agent, parsed.provider_id, parsed.model_id);
                      }
                    } catch (err) {
                      setError("Invalid drop item data");
                    }
                  }}
                  className={`relative flex flex-col justify-between overflow-hidden rounded-lg border min-h-[260px] p-4 transition-all duration-300 animate-fade-up ${
                    isDragOver 
                      ? "border-emerald-500 bg-emerald-500/10 scale-[1.03] shadow-lg shadow-emerald-500/10" 
                      : `${TONE_BORDER[meta.tone]} bg-gradient-to-b from-white/[0.03] to-transparent hover:border-white/[0.12] hover:bg-white/[0.04]`
                  }`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {/* Glowing header accent */}
                  <div className={`absolute inset-x-0 top-0 h-[2px] ${isDragOver ? "bg-emerald-400" : TONE_BG[meta.tone]} opacity-80`} />

                  <div>
                    {/* Header */}
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className={`grid h-8 w-8 place-items-center rounded-lg text-base ${isDragOver ? "bg-emerald-500/20 text-emerald-400" : `${TONE_BG[meta.tone]} ${TONE_TEXT[meta.tone]}`}`}>{meta.icon}</div>
                      <div>
                        <div className={`text-xs font-bold ${isDragOver ? "text-emerald-400" : TONE_TEXT[meta.tone]} ${TONE_GLOW[meta.tone]}`}>{meta.role}</div>
                        <div className="font-mono text-[9px] text-white/25">{agent}</div>
                      </div>
                    </div>

                    {/* Current assignment state */}
                    {current ? (
                      <div className="mb-4 rounded-md border border-white/[0.05] bg-white/[0.02] p-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="pulse-dot bg-emerald-400" />
                          <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Active Model</span>
                        </div>
                        <div className="mt-1 font-semibold text-xs text-white/85 truncate">{current.model_id}</div>
                        <div className="mt-0.5 text-[10px] text-white/45">via <span className="text-white/60 font-medium">{current.provider_name}</span></div>
                      </div>
                    ) : (
                      <div className="mb-4 rounded-md border border-dashed border-white/[0.08] bg-white/[0.005] p-4 text-center">
                        <span className="text-[10px] text-white/20 uppercase tracking-wider font-medium">Unassigned</span>
                      </div>
                    )}
                  </div>

                  {/* Drop zone visual or fallback selector */}
                  <div className="space-y-2 mt-auto">
                    
                    {/* Drag-n-drop hint */}
                    <div className={`rounded border border-dashed text-center p-2 transition-all duration-200 ${
                      isDragOver 
                        ? "border-emerald-400/40 bg-emerald-500/5 text-emerald-400" 
                        : "border-white/[0.04] bg-white/[0.005] text-white/25"
                    }`}>
                      <span className="text-[10px] font-mono select-none block">
                        {isDragOver ? "✓ Drop to assign" : "⬇ Drag model here"}
                      </span>
                    </div>

                    {/* Manual Override dropdown (collapsible) */}
                    <div className="border-t border-white/[0.04] pt-2">
                      <details className="group">
                        <summary className="text-[9px] text-white/30 cursor-pointer select-none hover:text-white/50 transition-colors list-none flex items-center justify-between">
                          <span>Manual override</span>
                          <span className="transition-transform group-open:rotate-180">▾</span>
                        </summary>
                        <div className="space-y-1 mt-1.5 animate-fade-in">
                          <select className="!py-0.5 !px-1.5 !text-[10px] w-full" value={draft.provider_id} onChange={e => { const pid = e.target.value; setAForm({ ...aForm, [agent]: { provider_id: pid, model_id: modelsFor(pid)[0]?.model_id || "" } }); }}>
                            <option value="">Select provider</option>
                            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <select className="!py-0.5 !px-1.5 !text-[10px] w-full" value={draft.model_id} onChange={e => setAForm({ ...aForm, [agent]: { ...draft, model_id: e.target.value } })}>
                            <option value="">Select model</option>
                            {modelsFor(draft.provider_id).map(m => <option key={m.model_id} value={m.model_id}>{m.model_id}</option>)}
                          </select>
                          <button className="btn btn-ghost w-full !py-0.5 !text-[10px] !rounded-md" disabled={busy || !draft.provider_id || !draft.model_id} onClick={() => saveAssignment(agent)}>
                            Apply assignment
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
