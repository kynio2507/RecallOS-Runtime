import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db";

function decodeKey(cipher?: string | null) {
  if (!cipher) return null;
  if (cipher.startsWith("plain:")) return Buffer.from(cipher.slice(6), "base64").toString("utf8");
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provider_id, model_id, prompt } = body;
    if (!provider_id) return NextResponse.json({ error: "provider_id required" }, { status: 400 });
    if (!model_id) return NextResponse.json({ error: "model_id required" }, { status: 400 });
    const rows = await queryPg("SELECT * FROM llm_providers WHERE id=$1", [provider_id]);
    const provider = rows[0] as Record<string, string | null> | undefined;
    if (!provider) return NextResponse.json({ error: "provider not found" }, { status: 404 });
    const apiKey = provider.api_key_env_var ? process.env[provider.api_key_env_var] : decodeKey(provider.api_key_ciphertext);
    if (!apiKey) return NextResponse.json({
      error: "Provider has no raw API key available. Re-save provider with API key or set api_key_env_var before testing.",
      provider: { id: provider.id, name: provider.name, api_key_masked: provider.api_key_masked, api_key_env_var: provider.api_key_env_var }
    }, { status: 400 });
    const started = Date.now();
    const res = await fetch(`${String(provider.base_url).replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model_id,
        messages: [{ role: "user", content: prompt || "Reply with exactly: RecallOS model test OK" }],
        temperature: 0,
        max_tokens: 80,
      }),
    });
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try { json = JSON.parse(text); } catch {}
    if (!res.ok) return NextResponse.json({ ok: false, status: res.status, latency_ms: Date.now() - started, error: text.slice(0, 1000) }, { status: 502 });
    const content = (((json?.choices as any[])?.[0]?.message?.content) || ((json?.choices as any[])?.[0]?.text) || "") as string;
    return NextResponse.json({ ok: true, status: res.status, latency_ms: Date.now() - started, provider_id, model_id, content, raw: json });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
