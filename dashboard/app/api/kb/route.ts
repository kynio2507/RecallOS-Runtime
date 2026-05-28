import { NextResponse } from "next/server";
import { querySqlite } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") || "";
  const type = searchParams.get("type") || "";
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    let sql = `SELECT id, type, title, content, symbols_json, files_json, tags_json, created_at, updated_at FROM knowledge_items`;
    const conds: string[] = [];
    const params: unknown[] = [];
    if (query) { conds.push(`(title LIKE ? OR content LIKE ?)`); params.push(`%${query}%`, `%${query}%`); }
    if (type) { conds.push(`type = ?`); params.push(type); }
    if (conds.length > 0) sql += ` WHERE ${conds.join(" AND ")}`;
    sql += ` ORDER BY updated_at DESC LIMIT ?`;
    params.push(limit);
    const items = querySqlite(sql, params);

    const countRow = querySqlite("SELECT COUNT(*) as c FROM knowledge_items")[0] as { c: number };

    // Type distribution
    const types = querySqlite("SELECT type, COUNT(*) as count FROM knowledge_items GROUP BY type ORDER BY count DESC") as { type: string; count: number }[];

    return NextResponse.json({ items, count: countRow?.c || 0, types });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
