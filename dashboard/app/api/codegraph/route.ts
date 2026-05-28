import { NextResponse } from "next/server";
import path from "path";

function getCodeGraphDbPath(): string {
  const projectPath = process.env.RECALLOS_PROJECT_PATH || path.resolve(process.cwd(), "..", "..", "scratch", "9base-ai-infra");
  return process.env.RECALLOS_CODEGRAPH_DB_PATH || path.join(projectPath, ".codegraph", "codegraph.db");
}

function openCodeGraphDb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  return new Database(getCodeGraphDbPath(), { readonly: true });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") || "";
  const kind = searchParams.get("kind") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  try {
    const db = openCodeGraphDb();
    const counts = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM files) AS files,
        (SELECT COUNT(*) FROM nodes) AS nodes,
        (SELECT COUNT(*) FROM edges) AS edges,
        (SELECT COUNT(*) FROM unresolved_refs) AS unresolved_refs
    `).get();

    const kinds = db.prepare(`SELECT kind, COUNT(*) AS count FROM nodes GROUP BY kind ORDER BY count DESC`).all();
    const languages = db.prepare(`SELECT language, COUNT(*) AS count FROM files GROUP BY language ORDER BY count DESC`).all();
    const edgeKinds = db.prepare(`SELECT kind, COUNT(*) AS count FROM edges GROUP BY kind ORDER BY count DESC`).all();
    const topFiles = db.prepare(`
      SELECT path, language, size, node_count, errors
      FROM files
      ORDER BY node_count DESC, size DESC
      LIMIT 20
    `).all();

    const params: unknown[] = [];
    let nodeSql = `
      SELECT id, kind, name, qualified_name, file_path, language, start_line, end_line,
             signature, docstring, is_exported, is_async, updated_at
      FROM nodes
    `;
    const conds: string[] = [];
    if (query) {
      conds.push(`(name LIKE ? OR qualified_name LIKE ? OR file_path LIKE ? OR signature LIKE ? OR docstring LIKE ?)`);
      const q = `%${query}%`;
      params.push(q, q, q, q, q);
    }
    if (kind) {
      conds.push(`kind = ?`);
      params.push(kind);
    }
    if (conds.length > 0) nodeSql += ` WHERE ${conds.join(" AND ")}`;
    nodeSql += ` ORDER BY updated_at DESC LIMIT ?`;
    params.push(limit);
    const nodes = db.prepare(nodeSql).all(...params);

    let relatedEdges: unknown[] = [];
    if (nodes.length > 0) {
      const ids = nodes.slice(0, 20).map((n: { id: string }) => n.id);
      const placeholders = ids.map(() => "?").join(",");
      relatedEdges = db.prepare(`
        SELECT e.kind, s.name AS source_name, s.file_path AS source_file,
               t.name AS target_name, t.file_path AS target_file, e.line, e.col
        FROM edges e
        LEFT JOIN nodes s ON s.id = e.source
        LEFT JOIN nodes t ON t.id = e.target
        WHERE e.source IN (${placeholders}) OR e.target IN (${placeholders})
        ORDER BY e.kind, e.line
        LIMIT 80
      `).all(...ids, ...ids);
    }

    db.close();
    return NextResponse.json({ dbPath: getCodeGraphDbPath(), counts, kinds, languages, edgeKinds, topFiles, nodes, relatedEdges });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message, dbPath: getCodeGraphDbPath() }, { status: 500 });
  }
}
