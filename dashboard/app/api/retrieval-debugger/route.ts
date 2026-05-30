import { NextResponse } from "next/server";
import { queryPg, querySqlite } from "@/lib/db";

type Row = { source:string; rank:number; score?:number; title?:string; snippet:string; file?:string; symbol?:string; metadata:Record<string,unknown> };
const snip = (v: unknown, n = 320) => String(v || "").slice(0, n);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const q = String(body.query || "").trim();
    if (!q) return NextResponse.json({ error: "query required" }, { status: 400 });
    const rows: Row[] = [];

    try {
      const facts = await queryPg(`SELECT scope,key,value,confidence,updated_at FROM memory_facts WHERE key ILIKE $1 OR value ILIKE $1 ORDER BY confidence DESC, updated_at DESC LIMIT 10`, [`%${q}%`]);
      facts.forEach((f:any, i:number)=>rows.push({source:"memory",rank:i+1,score:Number(f.confidence||0),title:f.key,snippet:snip(f.value),metadata:{scope:f.scope,updated_at:f.updated_at,type:"fact"}}));
      const events = await queryPg(`SELECT actor,event_type,content,created_at FROM memory_events WHERE content ILIKE $1 ORDER BY created_at DESC LIMIT 10`, [`%${q}%`]);
      events.forEach((e:any, i:number)=>rows.push({source:"memory",rank:facts.length+i+1,title:`${e.actor}/${e.event_type}`,snippet:snip(e.content),metadata:{created_at:e.created_at,type:"event"}}));
    } catch (e:any) { rows.push({source:"memory",rank:999,title:"Memory error",snippet:e.message,metadata:{error:true}}); }

    try {
      const kb = querySqlite(`SELECT id,type,title,content,symbols_json,files_json,tags_json FROM knowledge_items WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC LIMIT 10`, [`%${q}%`,`%${q}%`]) as any[];
      kb.forEach((k:any, i:number)=>rows.push({source:"kb",rank:i+1,title:k.title,snippet:snip(k.content),metadata:{id:k.id,type:k.type,symbols:k.symbols_json,files:k.files_json,tags:k.tags_json}}));
    } catch (e:any) { rows.push({source:"kb",rank:999,title:"KB error",snippet:e.message,metadata:{error:true}}); }

    try {
      const modules = await queryPg(`SELECT name,purpose,status FROM project_modules WHERE name ILIKE $1 OR purpose ILIKE $1 ORDER BY name LIMIT 10`, [`%${q}%`]);
      modules.forEach((m:any, i:number)=>rows.push({source:"project",rank:i+1,title:m.name,snippet:snip(m.purpose),metadata:{status:m.status,type:"module"}}));
      const docs = await queryPg(`SELECT title,doc_type,content FROM project_docs WHERE title ILIKE $1 OR content ILIKE $1 ORDER BY updated_at DESC LIMIT 10`, [`%${q}%`]);
      docs.forEach((d:any, i:number)=>rows.push({source:"project",rank:modules.length+i+1,title:d.title,snippet:snip(d.content),metadata:{doc_type:d.doc_type,type:"doc"}}));
    } catch (e:any) { rows.push({source:"project",rank:999,title:"Project Brain error",snippet:e.message,metadata:{error:true}}); }

    rows.sort((a,b)=>a.source.localeCompare(b.source)||a.rank-b.rank);
    const counts = rows.reduce((acc:Record<string,number>, r)=>{acc[r.source]=(acc[r.source]||0)+1; return acc;},{});
    return NextResponse.json({ query:q, counts, rows });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
