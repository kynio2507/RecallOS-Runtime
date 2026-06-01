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

  const runTest = async () => {
    setBusy(true); setError(""); setTestResult(null);
    try {
      const r = await fetch("/api/forgebase9/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(test) }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      setTestResult(r);
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };

  const saveAssignment = async (agent_id: string) => {
    const v = aForm[agent_id];
    if (!v?.provider_id || !v?.model_id) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/forgebase9/assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: "default", project_id: "recallos-runtime", agent_id, provider_id: v.provider_id, model_id: v.model_id }) }).then(r => r.json());
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

      {/* Providers + Models — balanced proportions */}
      <div className="grid gap-3 xl:grid-cols-[1fr_1.5fr]">
        {/* Providers — compact */}
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

        {/* Model catalog — more space */}
        <DataCard title="Model catalog" subtitle={`${models.length} models · ${prefixes.length} prefixes`} accent="violet">
          <div className="flex gap-2 mb-2">
            <select className="w-36" value={mForm.provider_id} onChange={e => setMForm({ ...mForm, provider_id: e.target.value })}>
              <option value="">Provider</option>
              {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="text" className="flex-1" placeholder="model id, e.g. ag/claude-sonnet-4-6" value={mForm.model_id} onChange={e => setMForm({ ...mForm, model_id: e.target.value })} />
            <button className="btn btn-primary !py-1 !px-3 !text-[11px]" onClick={addModel} disabled={busy || !mForm.provider_id || !mForm.model_id}>Add</button>
          </div>
          {prefixes.length > 0 && <div className="flex flex-wrap gap-1 mb-2">{prefixes.map(p => <StatusPill key={p} tone="cyan">{p}</StatusPill>)}</div>}
          <div className="grid gap-1.5 md:grid-cols-2 max-h-[240px] overflow-auto">
            {models.map((m, i) => (
              <div key={m.id} className="flex items-center gap-1.5 rounded-md border border-white/[0.04] bg-white/[0.015] px-2.5 py-1.5 animate-fade-up" style={{ animationDelay: `${i * 25}ms` }}>
                <span className="badge violet !text-[9px]">{m.provider_name || "?"}</span>
                {m.prefix && <span className="badge cyan !text-[9px]">{m.prefix}</span>}
                <span className="font-mono text-[11px] text-white/55 truncate">{m.model_id}</span>
              </div>
            ))}
          </div>
        </DataCard>
      </div>

      {/* Agent assignment cards */}
      <SectionTitle title="Agent assignments" subtitle="Model routing for each pipeline agent" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {AGENTS.map((agent, i) => {
          const meta = AGENT_META[agent] || { icon: "●", role: agent, tone: "blue" };
          const current = assignments.find(a => a.agent_id === agent);
          const draft = aForm[agent] || { provider_id: current?.provider_id || providers[0]?.id || "", model_id: current?.model_id || "" };
          return (
            <div
              key={agent}
              className={`relative overflow-hidden rounded-lg border ${TONE_BORDER[meta.tone]} bg-gradient-to-br from-white/[0.03] to-transparent p-4 animate-fade-up transition-all hover:border-white/[0.12] hover:bg-white/[0.04]`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Accent top line */}
              <div className={`absolute inset-x-0 top-0 h-[2px] ${TONE_BG[meta.tone]} opacity-60`} />

              {/* Header */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`grid h-9 w-9 place-items-center rounded-lg ${TONE_BG[meta.tone]} text-base ${TONE_TEXT[meta.tone]}`}>{meta.icon}</div>
                <div>
                  <div className={`text-xs font-bold ${TONE_TEXT[meta.tone]} ${TONE_GLOW[meta.tone]}`}>{meta.role}</div>
                  <div className="font-mono text-[10px] text-white/25">{agent}</div>
                </div>
              </div>

              {/* Current assignment */}
              {current ? (
                <div className="mb-3 rounded-md border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="pulse-dot bg-emerald-400" />
                    <span className="text-[11px] font-medium text-white/60">{current.provider_name}</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-white/40 truncate">{current.model_id}</div>
                </div>
              ) : (
                <div className="mb-3 rounded-md border border-white/[0.04] bg-white/[0.01] px-2.5 py-2 text-center text-[11px] text-white/20">Not assigned</div>
              )}

              {/* Assignment controls */}
              <div className="space-y-1.5">
                <select className="!py-1 !text-[11px] w-full" value={draft.provider_id} onChange={e => { const pid = e.target.value; setAForm({ ...aForm, [agent]: { provider_id: pid, model_id: modelsFor(pid)[0]?.model_id || "" } }); }}>
                  <option value="">Select provider</option>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="!py-1 !text-[11px] w-full" value={draft.model_id} onChange={e => setAForm({ ...aForm, [agent]: { ...draft, model_id: e.target.value } })}>
                  <option value="">Select model</option>
                  {modelsFor(draft.provider_id).map(m => <option key={m.model_id} value={m.model_id}>{m.model_id}</option>)}
                </select>
                <button className={`btn btn-primary w-full !py-1 !text-[11px]`} disabled={busy || !draft.provider_id || !draft.model_id} onClick={() => saveAssignment(agent)}>
                  {current ? "Update assignment" : "Assign model"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Direct model test — compact inline */}
      <DataCard title="Direct model test" subtitle="Test any model through RecallOS registry" accent="cyan">
        <div className="flex gap-2 flex-wrap">
          <select className="w-36" value={test.provider_id} onChange={e => setTest({ ...test, provider_id: e.target.value, model_id: modelsFor(e.target.value)[0]?.model_id || "" })}>
            <option value="">Provider</option>
            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="w-56" value={test.model_id} onChange={e => setTest({ ...test, model_id: e.target.value })}>
            <option value="">Model</option>
            {modelsFor(test.provider_id).map(m => <option key={m.model_id} value={m.model_id}>{m.model_id}</option>)}
          </select>
          <input type="text" className="flex-1 min-w-[200px]" value={test.prompt} onChange={e => setTest({ ...test, prompt: e.target.value })} placeholder="Test prompt" />
          <button className="btn btn-primary" disabled={busy || !test.provider_id || !test.model_id} onClick={runTest}>Test</button>
        </div>
        {tr && (
          <div className="mt-3 animate-fade-up rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <StatusPill tone={tr.ok ? "green" : "red"}>{tr.ok ? "Success" : "Warning"}</StatusPill>
              <span className="font-mono text-[11px] text-white/50">{tr.model_id}</span>
              <span className="text-[10px] text-white/25">{tr.latency_ms}ms</span>
              {tr.finish_reason && <span className="badge gray">{tr.finish_reason as string}</span>}
              {tr.usage && <span className="text-[10px] text-white/20">{(tr.usage as any).total_tokens} tok</span>}
            </div>
            {(tr.warnings as string[])?.length > 0 && (
              <div className="mb-2">{(tr.warnings as string[]).map((w, i) => <div key={i} className="text-[10px] text-amber-400/60">⚠ {w}</div>)}</div>
            )}
            {tr.content && (
              <div className="text-xs text-white/65 whitespace-pre-wrap max-h-[120px] overflow-auto">{tr.content as string}</div>
            )}
          </div>
        )}
      </DataCard>
    </div>
  );
}
