import { NextResponse } from "next/server";
import { providerList, providerUpsert, providerCheck } from "../../../../src/modules/forgebase9-config/index.mjs";

export async function GET() {
  try { return NextResponse.json({ providers: await providerList({}) }); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.action === "check") return NextResponse.json({ check: await providerCheck(body) });
    return NextResponse.json({ provider: await providerUpsert(body) });
  } catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
