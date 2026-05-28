import { randomUUID } from 'node:crypto';
import { DB_PATH, PROJECT_PATH, SERVER_NAME, SERVER_VERSION } from '../../runtime/config.mjs';
import { logEvent } from '../../runtime/db.mjs';
import { now, safeJson } from '../../runtime/utils.mjs';

export function scoreRow(row, keywords, symbols) {
  const title = row.title.toLowerCase();
  const content = row.content.toLowerCase();
  const tags = row.tags_json.toLowerCase();
  const rowSymbols = row.symbols_json.toLowerCase();
  let score = 0;
  for (const symbol of symbols) if (rowSymbols.includes(symbol.toLowerCase())) score += 100;
  for (const keyword of keywords) {
    const k = keyword.toLowerCase();
    if (title.includes(k)) score += 50;
    if (tags.includes(k)) score += 30;
    if (rowSymbols.includes(k)) score += 40;
    if (content.includes(k)) score += 10;
  }
  if (['bug', 'decision', 'rule'].includes(row.type)) score += 10;
  return score;
}

function hasFts5(database) {
  try {
    database.prepare("SELECT 1 FROM knowledge_items_fts LIMIT 0").run();
    return true;
  } catch {
    return false;
  }
}

function buildFtsQuery(keywords) {
  // Escape FTS5 special characters and join with OR
  return keywords
    .map(k => `"${k.replace(/"/g, '""')}"`)
    .join(' OR ');
}

export function searchKnowledge(database, question, symbols = [], limit = 8, type = null, tags = []) {
  const keywords = [...String(question || '').split(/\s+/), ...(symbols || []), ...(tags || [])]
    .map((term) => term.trim()).filter((term) => term.length >= 3).slice(0, 20);
  if (!keywords.length) return [];

  let rows;

  if (hasFts5(database)) {
    // FTS5 path: fast full-text search
    const ftsQuery = buildFtsQuery(keywords);
    let sql = `SELECT ki.*, rank FROM knowledge_items_fts
      JOIN knowledge_items ki ON knowledge_items_fts.rowid = ki.rowid
      WHERE knowledge_items_fts MATCH ?`;
    const params = [ftsQuery];
    if (type) { sql += ' AND ki.type = ?'; params.push(type); }
    sql += ' ORDER BY rank LIMIT 80';
    try {
      rows = database.prepare(sql).all(...params);
    } catch {
      // Fallback to LIKE if FTS query fails (e.g. bad syntax)
      rows = searchKnowledgeLike(database, keywords, type);
    }
  } else {
    // LIKE fallback path: no FTS5 table
    rows = searchKnowledgeLike(database, keywords, type);
  }

  return rows
    .map((row) => ({ ...row, _score: scoreRow(row, keywords, symbols) }))
    .filter((row) => row._score > 0)
    .sort((a, b) => b._score - a._score || String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, limit);
}

function searchKnowledgeLike(database, keywords, type) {
  const clauses = [];
  const params = [];
  for (const keyword of keywords) {
    const like = `%${keyword}%`;
    clauses.push('(title LIKE ? OR content LIKE ? OR symbols_json LIKE ? OR files_json LIKE ? OR tags_json LIKE ?)');
    params.push(like, like, like, like, like);
  }
  let sql = `SELECT * FROM knowledge_items WHERE (${clauses.join(' OR ')})`;
  if (type) { sql += ' AND type = ?'; params.push(type); }
  sql += ' LIMIT 80';
  return database.prepare(sql).all(...params);
}

export function formatKnowledge(rows) {
  if (!rows.length) return 'No relevant Knowledge Base entries found.';
  return rows.map((row, index) => `### ${index + 1}. [${row.type}] ${row.title} (score ${row._score})\n${row.content}\n\nSymbols: ${row.symbols_json}\nFiles: ${row.files_json}\nTags: ${row.tags_json}`).join('\n\n');
}

export function queryKnowledgeBase(database, args = {}) {
  const question = args.question || args.query || '';
  const mode = args.mode || 'general';
  const symbols = Array.isArray(args.symbols) ? args.symbols : [];
  const tags = Array.isArray(args.tags) ? args.tags : [];
  logEvent(database, 'info', 'tool_call', `recall_kb_query ${mode}: ${question}`);
  const knowledge = searchKnowledge(database, question, symbols, args.limit || 8, args.type || null, tags);
  return `# Knowledge Base Query\n\nServer: ${SERVER_NAME} ${SERVER_VERSION}\nMode: ${mode}\nQuestion: ${question || '(empty)'}\n\n## Results\n\n${formatKnowledge(knowledge)}`;
}

export function rememberKnowledge(database, args = {}) {
  const id = args.id || randomUUID();
  const timestamp = now();
  const content = args.content || args.decision || args.fix || '';
  database.prepare(`INSERT OR REPLACE INTO knowledge_items
    (id, type, title, content, symbols_json, files_json, tags_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM knowledge_items WHERE id = ?), ?), ?)`)
    .run(id, args.type || 'note', args.title || 'Untitled', content, safeJson(args.symbols), safeJson(args.files), safeJson(args.tags), id, timestamp, timestamp);
  logEvent(database, 'info', 'knowledge_saved', `${args.type || 'note'}: ${args.title || 'Untitled'}`);
  return `Knowledge Base entry saved: ${id}`;
}

export function getKnowledgeStatus(database) {
  const counts = {
    knowledge_items: database.prepare('SELECT COUNT(*) AS count FROM knowledge_items').get().count,
    symbol_summaries: database.prepare('SELECT COUNT(*) AS count FROM symbol_summaries').get().count,
    runtime_events: database.prepare('SELECT COUNT(*) AS count FROM runtime_events').get().count,
    internal_events: database.prepare('SELECT COUNT(*) AS count FROM internal_events').get().count,
  };
  const fts5 = hasFts5(database) ? 'enabled' : 'disabled';
  const migrations = database.prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version').all();
  const meta = database.prepare('SELECT key, value FROM meta ORDER BY key').all();
  const recentErrors = database.prepare("SELECT event, detail, created_at FROM internal_events WHERE level = 'error' ORDER BY created_at DESC LIMIT 5").all();
  return `# Knowledge Base Module Status\n\nServer: ${SERVER_NAME} ${SERVER_VERSION}\nSQLite driver: better-sqlite3\nFTS5: ${fts5}\nDB: ${DB_PATH}\nProject: ${PROJECT_PATH}\n\n## Migrations\n\n${JSON.stringify(migrations, null, 2)}\n\n## Meta\n\n${JSON.stringify(meta, null, 2)}\n\n## SQL Counts\n\n${JSON.stringify(counts, null, 2)}\n\n## Recent Errors\n\n${JSON.stringify(recentErrors, null, 2)}`;
}
