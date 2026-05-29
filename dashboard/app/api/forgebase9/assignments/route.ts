import { NextResponse } from "next/server";
import { assignmentList, assignmentUpsert, assignmentResolve } from "../../../../src/modules/forgebase9-config/index.mjs";

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    return NextResponse.json({ assignments: await assignmentList({ workspace_id: sp.get("workspace_id") || undefined, project_id: sp.get("project_id") || "recallos-runtime" }) });
  } catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.action === "resolve") return NextResponse.json({ assignment: await assignmentResolve(body) });
    return NextResponse.json({ assignment: await assignmentUpsert(body) });
  } catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
