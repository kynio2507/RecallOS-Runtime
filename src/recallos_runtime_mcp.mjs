#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const SERVER_NAME = 'recallos-runtime';
const SERVER_VERSION = '1.0.0-local';
const SCHEMA_VERSION = '2';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const DEFAULT_ROOT = PACKAGE_ROOT;
const DEFAULT_PROJECT_PATH = path.resolve(PACKAGE_ROOT, '..');

const ROOT = normalizePath(process.env.RECALLOS_ROOT || DEFAULT_ROOT);
const PROJECT_PATH = normalizePath(process.env.RECALLOS_PROJECT_PATH || DEFAULT_PROJECT_PATH);
const DB_PATH = normalizePath(process.env.RECALLOS_DB_PATH || path.join(ROOT, 'data', 'recallos_runtime.sqlite'));
const CODEGRAPH_CMD = process.env.RECALLOS_CODEGRAPH_CMD || 'npx';
const MAX_SECTION_CHARS = Number(process.env.RECALLOS_MAX_SECTION_CHARS || 12000);

function now() { return new Date().toISOString(); }
function normalizePath(value) { return String(value || '').replace(/\\/g, '/'); }
function stripAnsi(text) { return String(text || '').replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, ''); }
function cleanOutput(text) {
  return stripAnsi(text)
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('npm warn cleanup'))
    .join('\n')
    .trim();
}
function truncate(text, max = MAX_SECTION_CHARS) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max)}\n\n... (truncated ${value.length - max} chars) ...` : value;
}
function safeJson(value, fallback = []) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value ? [value] : fallback);
  return JSON.stringify(fallback);
}

// ── SQLite ──

function openDb() {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const database = new Database(DB_PATH);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  ensureSchema(database);
  return database;
}

function ensureSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      symbols_json TEXT NOT NULL DEFAULT '[]',
      files_json TEXT NOT NULL DEFAULT '[]',
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS symbol_summaries (
      symbol TEXT NOT NULL,
      file_path TEXT NOT NULL,
      summary TEXT NOT NULL,
      known_constraints TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (symbol, file_path)
    );
    CREATE TABLE IF NOT EXISTS runtime_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      related_symbols_json TEXT NOT NULL DEFAULT '[]',
      related_files_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS internal_events (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      event TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_items(type);
    CREATE INDEX IF NOT EXISTS idx_knowledge_updated_at ON knowledge_items(updated_at);
    CREATE INDEX IF NOT EXISTS idx_internal_events_created_at ON internal_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_internal_events_level ON internal_events(level);
  `);
  const setMeta = database.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
  setMeta.run('schema_version', SCHEMA_VERSION);
  setMeta.run('server_version', SERVER_VERSION);
  setMeta.run('project_path', PROJECT_PATH);
  setMeta.run('db_path', DB_PATH);
  setMeta.run('sqlite_driver', 'better-sqlite3');
  setMeta.run('mcp_transport', 'sdk-stdio');
}

function withDb(fn) {
  const database = openDb();
  try { return fn(database); }
  catch (error) {
    logEvent(database, 'error', 'db_error', error?.stack || error?.message || String(error));
    throw error;
  } finally {
    database.close();
  }
}

function logEvent(database, level, event, detail = '') {
  try {
    database.prepare('INSERT INTO internal_events (id, level, event, detail, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), level, event, truncate(String(detail), 4000), now());
  } catch {}
}

// ── CodeGraph ──

function runCodeGraph(args, database = null) {
  try {
    const out = execFileSync('cmd.exe', ['/c', CODEGRAPH_CMD, '-y', '@colbymchenry/codegraph', ...args], {
      cwd: PROJECT_PATH,
      encoding: 'utf8',
      timeout: 45000,
      maxBuffer: 1024 * 1024 * 4,
      windowsHide: true,
    });
    if (database) logEvent(database, 'info', 'codegraph_call', args.join(' '));
    return truncate(cleanOutput(out));
  } catch (error) {
    const msg = cleanOutput(`${error.message}\n${error.stdout || ''}\n${error.stderr || ''}`);
    if (database) logEvent(database, 'error', 'codegraph_error', `${args.join(' ')}\n${msg}`);
    return `[CodeGraph Error]\n${truncate(msg, 6000)}`;
  }
}

// ── Knowledge ranking ──

function scoreRow(row, keywords, symbols) {
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

function searchKnowledge(database, question, symbols = [], limit = 8, type = null, tags = []) {
  const keywords = [...String(question || '').split(/\s+/), ...(symbols || []), ...(tags || [])]
    .map((term) => term.trim()).filter((term) => term.length >= 3).slice(0, 20);
  if (!keywords.length) return [];
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
  const rows = database.prepare(sql).all(...params);
  return rows
    .map((row) => ({ ...row, _score: scoreRow(row, keywords, symbols) }))
    .filter((row) => row._score > 0)
    .sort((a, b) => b._score - a._score || String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, limit);
}

function formatKnowledge(rows) {
  if (!rows.length) return 'Không có knowledge SQL liên quan.';
  return rows.map((row, index) => `### ${index + 1}. [${row.type}] ${row.title} (score ${row._score})\n${row.content}\n\nSymbols: ${row.symbols_json}\nFiles: ${row.files_json}\nTags: ${row.tags_json}`).join('\n\n');
}

// ── Tool implementations ──

function codeIntelQuery(args = {}) {
  return withDb((database) => {
    const question = args.question || args.query || '';
    const mode = args.mode || 'general';
    const symbols = Array.isArray(args.symbols) ? args.symbols : [];
    const tags = Array.isArray(args.tags) ? args.tags : [];
    logEvent(database, 'info', 'tool_call', `recall_runtime_query ${mode}: ${question}`);
    const knowledge = searchKnowledge(database, question, symbols, args.limit || 8, args.type || null, tags);
    const sections = [`# RecallOS Runtime\n\nModule: Code Intel\nVersion: ${SERVER_VERSION}\nMode: ${mode}\nQuestion: ${question || '(empty)'}`];
    sections.push(`## SQL Knowledge / Decisions / Bug History\n\n${formatKnowledge(knowledge)}`);
    if (args.includeContext !== false && question) {
      sections.push(`## CodeGraph Context\n\n${runCodeGraph(['context', question, '--path', PROJECT_PATH, '--max-nodes', '18', '--max-code', '6'], database)}`);
    }
    for (const symbol of symbols) {
      sections.push(`## Symbol: ${symbol}`);
      sections.push(`### Search\n\n${runCodeGraph(['query', symbol, '--path', PROJECT_PATH], database)}`);
      sections.push(`### Related Context\n\n${runCodeGraph(['context', `Analyze symbol ${symbol}: callers, callees, dependencies, and impact`, '--path', PROJECT_PATH, '--max-nodes', '12', '--max-code', '4'], database)}`);
      if (args.includeImpact !== false) sections.push(`### Affected Tests / Files\n\n${runCodeGraph(['affected', '--path', PROJECT_PATH, symbol], database)}`);
    }
    logEvent(database, 'info', knowledge.length ? 'query_success' : 'query_empty', question);
    return sections.join('\n\n---\n\n');
  });
}

function rememberKnowledge(args = {}) {
  return withDb((database) => {
    const id = args.id || randomUUID();
    const timestamp = now();
    const content = args.content || args.decision || args.fix || '';
    database.prepare(`INSERT OR REPLACE INTO knowledge_items
      (id, type, title, content, symbols_json, files_json, tags_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM knowledge_items WHERE id = ?), ?), ?)`)
      .run(id, args.type || 'note', args.title || 'Untitled', content, safeJson(args.symbols), safeJson(args.files), safeJson(args.tags), id, timestamp, timestamp);
    logEvent(database, 'info', 'knowledge_saved', `${args.type || 'note'}: ${args.title || 'Untitled'}`);
    return `Đã lưu knowledge: ${id}`;
  });
}

function getStatus() {
  return withDb((database) => {
    logEvent(database, 'info', 'tool_call', 'recall_runtime_status');
    const counts = {
      knowledge_items: database.prepare('SELECT COUNT(*) AS count FROM knowledge_items').get().count,
      symbol_summaries: database.prepare('SELECT COUNT(*) AS count FROM symbol_summaries').get().count,
      runtime_events: database.prepare('SELECT COUNT(*) AS count FROM runtime_events').get().count,
      internal_events: database.prepare('SELECT COUNT(*) AS count FROM internal_events').get().count,
    };
    const meta = database.prepare('SELECT key, value FROM meta ORDER BY key').all();
    const recentErrors = database.prepare("SELECT event, detail, created_at FROM internal_events WHERE level = 'error' ORDER BY created_at DESC LIMIT 5").all();
    const cg = runCodeGraph(['status', PROJECT_PATH], database);
    return `# RecallOS Runtime Status\n\nServer: ${SERVER_NAME} ${SERVER_VERSION}\nModule: Code Intel\nCompatibility tools: recall_runtime_*\nMCP transport: SDK stdio\nSQLite driver: better-sqlite3\nDB: ${DB_PATH}\nProject: ${PROJECT_PATH}\n\n## Meta\n\n${JSON.stringify(meta, null, 2)}\n\n## SQL Counts\n\n${JSON.stringify(counts, null, 2)}\n\n## Recent Errors\n\n${JSON.stringify(recentErrors, null, 2)}\n\n## CodeGraph\n\n${cg}`;
  });
}

// ── MCP Server (SDK) ──

const mcpServer = new McpServer(
  { name: SERVER_NAME, version: SERVER_VERSION },
  { capabilities: { tools: {} } }
);

mcpServer.tool(
  'recall_runtime_query',
  'RecallOS Runtime Code Intel module: SQL memory/bug history/architecture decisions + CodeGraph context.',
  {
    question: z.string(),
    symbols: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    type: z.string().optional(),
    mode: z.string().optional(),
    limit: z.number().optional(),
    includeContext: z.boolean().optional(),
    includeImpact: z.boolean().optional(),
  },
  async (args) => ({
    content: [{ type: 'text', text: codeIntelQuery(args) }],
  })
);

mcpServer.tool(
  'recall_runtime_remember',
  'Store 9Base knowledge/rule/decision/bug note.',
  {
    id: z.string().optional(),
    type: z.string(),
    title: z.string(),
    content: z.string(),
    symbols: z.array(z.string()).optional(),
    files: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  },
  async (args) => ({
    content: [{ type: 'text', text: rememberKnowledge(args) }],
  })
);

mcpServer.tool(
  'recall_runtime_decision',
  'Store architecture decision.',
  {
    id: z.string().optional(),
    title: z.string(),
    decision: z.string(),
    reason: z.string().optional(),
    symbols: z.array(z.string()).optional(),
    files: z.array(z.string()).optional(),
  },
  async (args) => ({
    content: [{
      type: 'text',
      text: rememberKnowledge({
        id: args.id,
        type: 'decision',
        title: args.title,
        content: `Decision: ${args.decision}\n\nReason: ${args.reason || ''}`,
        symbols: args.symbols,
        files: args.files,
        tags: ['architecture', 'decision'],
      }),
    }],
  })
);

mcpServer.tool(
  'recall_runtime_bug',
  'Store known bug/root cause/fix.',
  {
    id: z.string().optional(),
    title: z.string(),
    rootCause: z.string(),
    fix: z.string(),
    symbols: z.array(z.string()).optional(),
    files: z.array(z.string()).optional(),
  },
  async (args) => ({
    content: [{
      type: 'text',
      text: rememberKnowledge({
        id: args.id,
        type: 'bug',
        title: args.title,
        content: `Root cause: ${args.rootCause}\n\nFix: ${args.fix}`,
        symbols: args.symbols,
        files: args.files,
        tags: ['bug', 'fix'],
      }),
    }],
  })
);

mcpServer.tool(
  'recall_runtime_status',
  'Show status, DB counts, metadata, and CodeGraph status.',
  {},
  async () => ({
    content: [{ type: 'text', text: getStatus() }],
  })
);

// ── Start ──

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
