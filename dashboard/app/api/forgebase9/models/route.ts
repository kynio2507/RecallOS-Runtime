import { NextResponse } from "next/server";
import { modelList, modelUpsert, modelDiscover } from "../../../../src/modules/forgebase9-config/index.mjs";

export async function GET(req: Request) {
  try {
    const provider_id = new URL(req.url).searchParams.get("provider_id") || undefined;
    return NextResponse.json({ models: await modelList({ provider_id }) });
  } catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.action === "discover") return NextResponse.json({ discovery: await modelDiscover(body) });
    return NextResponse.json({ model: await modelUpsert(body) });
  } catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
