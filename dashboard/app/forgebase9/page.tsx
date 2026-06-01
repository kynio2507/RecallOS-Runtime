"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { DataCard, MetricTile, PageHeader, SectionTitle, StatusPill } from "../components/ui";

type Provider = { id: string; name: string; base_url: string; api_key_masked?: string; api_key_env_var?: string; has_api_key: boolean; api_key_storage: string; status: string };
type Model = { id: string; provider_id: string; provider_name?: string; model_id: string; prefix?: string; family?: string; status: string };
type Assignment = { id: string; agent_id: string; provider_id: string; provider_name: string; model_id: string; purpose: string; base_url: string; api_key_masked?: string };

const AGENTS = ["pm_architecture", "analyzer", "senior_product_designer", "senior_product_coder", "product_code_reviewer"];

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

      {/* Providers + Models side by side */}
      <div className="grid gap-3 xl:grid-cols-2">
        {/* Providers table */}
        <DataCard title="Providers" subtitle={`${providers.length} registered endpoints`} accent="blue">
          <div className="divide-y divide-white/[0.04]">
            {providers.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 py-2 animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                <span className={`pulse-dot ${p.has_api_key ? "bg-emerald-400" : "bg-amber-400"}`} />
                <span className="text-xs font-semibold text-white/80 w-20 truncate">{p.name}</span>
                <span className="flex-1 truncate font-mono text-[11px] text-white/30">{p.base_url}</span>
                <span className="text-[10px] text-white/20 w-20 truncate">{p.api_key_masked || p.api_key_env_var || "no key"}</span>
                <div className="flex gap-1 shrink-0">
                  <button className="btn btn-ghost !py-1 !px-2 !text-[10px]" onClick={() => discover(p.id)} disabled={busy}>Discover</button>
                  <button className="btn btn-ghost !py-1 !px-2 !text-[10px]" onClick={() => editProvider(p)} disabled={busy}>Edit</button>
                  <button className="btn btn-ghost !py-1 !px-2 !text-[10px] !text-rose-400" onClick={() => deleteProvider(p.id, p.name)} disabled={busy}>×</button>
                </div>
              </div>
            ))}
            {!providers.length && <div className="py-4 text-center text-xs text-white/25">No providers registered</div>}
          </div>
        </DataCard>

        {/* Model catalog */}
        <DataCard title="Model catalog" subtitle={`${models.length} models · ${prefixes.length} prefixes`} accent="violet">
          <div className="flex gap-2 mb-2">
            <select className="flex-1" value={mForm.provider_id} onChange={e => setMForm({ ...mForm, provider_id: e.target.value })}>
              <option value="">Provider</option>
              {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="text" className="flex-1" placeholder="model id" value={mForm.model_id} onChange={e => setMForm({ ...mForm, model_id: e.target.value })} />
            <button className="btn btn-primary !py-1 !px-2.5 !text-[11px]" onClick={addModel} disabled={busy || !mForm.provider_id || !mForm.model_id}>Add</button>
          </div>
          {prefixes.length > 0 && <div className="flex flex-wrap gap-1 mb-2">{prefixes.map(p => <StatusPill key={p} tone="cyan">{p}</StatusPill>)}</div>}
          <div className="max-h-[280px] overflow-auto divide-y divide-white/[0.04]">
            {models.map((m, i) => (
              <div key={m.id} className="flex items-center gap-2 py-1.5 animate-fade-up" style={{ animationDelay: `${i * 20}ms` }}>
                <span className="badge violet">{m.provider_name || m.provider_id}</span>
                {m.prefix && <span className="badge cyan">{m.prefix}</span>}
                <span className="font-mono text-xs text-white/60 truncate">{m.model_id}</span>
              </div>
            ))}
          </div>
        </DataCard>
      </div>

      {/* Direct model test */}
      <DataCard title="Direct model test" subtitle="Calls provider directly through RecallOS registry" accent="cyan">
        <div className="flex gap-2 flex-wrap">
          <select className="w-32" value={test.provider_id} onChange={e => setTest({ ...test, provider_id: e.target.value, model_id: modelsFor(e.target.value)[0]?.model_id || "" })}>
            <option value="">Provider</option>
            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="w-48" value={test.model_id} onChange={e => setTest({ ...test, model_id: e.target.value })}>
            <option value="">Model</option>
            {modelsFor(test.provider_id).map(m => <option key={m.model_id} value={m.model_id}>{m.model_id}</option>)}
          </select>
          <input type="text" className="flex-1 min-w-[200px]" value={test.prompt} onChange={e => setTest({ ...test, prompt: e.target.value })} placeholder="Test prompt" />
          <button className="btn btn-primary" disabled={busy || !test.provider_id || !test.model_id} onClick={runTest}>Test</button>
        </div>
        {tr && (
          <div className="mt-3 animate-fade-up">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <StatusPill tone={tr.ok ? "green" : "red"}>{tr.ok ? "OK" : "Warning"}</StatusPill>
              <span className="font-mono text-xs text-white/50">{tr.model_id}</span>
              <span className="text-[11px] text-white/25">{tr.latency_ms}ms</span>
              {tr.finish_reason && <span className="badge gray">{tr.finish_reason as string}</span>}
              {tr.usage && <span className="text-[10px] text-white/20">{(tr.usage as any).total_tokens} tokens</span>}
            </div>
            {(tr.warnings as string[])?.length > 0 && (
              <div className="mb-2 space-y-1">{(tr.warnings as string[]).map((w, i) => <div key={i} className="text-[11px] text-amber-400/70">⚠ {w}</div>)}</div>
            )}
            {tr.content && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs text-white/70 whitespace-pre-wrap max-h-[160px] overflow-auto">{tr.content as string}</div>
            )}
          </div>
        )}
      </DataCard>

      {/* Agent assignments */}
      <DataCard title="Agent assignments" subtitle="Model routing for each ForgeBase9 agent" accent="green" glow>
        <div className="divide-y divide-white/[0.04]">
          {AGENTS.map((agent, i) => {
            const current = assignments.find(a => a.agent_id === agent);
            const draft = aForm[agent] || { provider_id: current?.provider_id || providers[0]?.id || "", model_id: current?.model_id || "" };
            return (
              <div key={agent} className="flex items-center gap-3 py-2.5 animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="w-44 shrink-0">
                  <div className="text-xs font-semibold text-white/80">{agent}</div>
                  <div className="text-[10px] text-white/25 truncate">{current ? `${current.provider_name} · ${current.model_id}` : "not assigned"}</div>
                </div>
                <select className="w-28 !py-1 !text-xs" value={draft.provider_id} onChange={e => { const pid = e.target.value; setAForm({ ...aForm, [agent]: { provider_id: pid, model_id: modelsFor(pid)[0]?.model_id || "" } }); }}>
                  <option value="">Provider</option>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="flex-1 !py-1 !text-xs" value={draft.model_id} onChange={e => setAForm({ ...aForm, [agent]: { ...draft, model_id: e.target.value } })}>
                  <option value="">Model</option>
                  {modelsFor(draft.provider_id).map(m => <option key={m.model_id} value={m.model_id}>{m.model_id}</option>)}
                </select>
                <button className="btn btn-primary !py-1 !px-2.5 !text-[11px]" disabled={busy || !draft.provider_id || !draft.model_id} onClick={() => saveAssignment(agent)}>Save</button>
              </div>
            );
          })}
        </div>
      </DataCard>
    </div>
  );
}
