import { NextResponse } from "next/server";
import { forgebase9ConfigPack, seedCurrentForgebase9Config } from "../../../src/modules/forgebase9-config/index.mjs";

export async function GET() {
  try { return NextResponse.json(await forgebase9ConfigPack({ project_id: "recallos-runtime" })); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.action === "seed") return NextResponse.json(await seedCurrentForgebase9Config(body));
    return NextResponse.json({ error: "unsupported action" }, { status: 400 });
  } catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
