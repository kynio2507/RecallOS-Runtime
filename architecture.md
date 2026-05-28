# Architecture

## Overview

`recallos-runtime` is a multi-module MCP server with 3 modules:

```text
MCP Server (recallos_runtime_mcp.mjs)
  ├── Knowledge Base   → SQLite + FTS5
  ├── CodeGraph        → MCP Client → CodeGraph MCP Server
  └── Memory           → PostgreSQL + pgvector
```

## Runtime Components

| Component | Purpose |
|---|---|
| MCP server | Expose tools via stdio MCP transport |
| SQLite DB | Knowledge Base storage (FTS5 full-text search) |
| Migration engine | Versioned SQL migrations (`migrations/*.sql`) |
| CodeGraph MCP client | Connect to CodeGraph MCP server (replaces CLI/npx) |
| PostgreSQL + pgvector | Memory module: raw events, active facts, vector chunks |
| Embedding client | OpenAI-compatible endpoint for vector embeddings |

## MCP Transport

Uses `@modelcontextprotocol/sdk` with `StdioServerTransport`:

- Newline-delimited JSON (`\n`), NOT Content-Length framing
- Server handles `initialize` → `notifications/initialized` → tool calls

## Schema Management

### Migration Engine

Schema changes use versioned SQL files:

```text
migrations/
  001_initial_schema.sql    — base tables, indexes
  002_fts5_knowledge.sql    — FTS5 virtual table + sync triggers
```

Applied migrations tracked in `schema_migrations` table. New migrations auto-apply on startup.

### SQLite Schema (version 3)

#### `schema_migrations`

| Column | Type | Meaning |
|---|---|---|
| `version` | INTEGER PK | migration version number |
| `name` | TEXT | migration filename |
| `applied_at` | TEXT | ISO timestamp |

#### `meta`

| Column | Type | Meaning |
|---|---|---|
| `key` | TEXT PK | primary key |
| `value` | TEXT | value |

#### `knowledge_items`

| Column | Type | Meaning |
|---|---|---|
| `id` | TEXT PK | UUID |
| `type` | TEXT | rule/bug/decision/note/runtime/architecture |
| `title` | TEXT | short searchable title |
| `content` | TEXT | main content |
| `symbols_json` | TEXT | JSON array of related symbols |
| `files_json` | TEXT | JSON array of related file paths |
| `tags_json` | TEXT | JSON array of tags |
| `created_at` | TEXT | ISO timestamp |
| `updated_at` | TEXT | ISO timestamp |

#### `knowledge_items_fts` (FTS5 virtual table)

Mirrors `knowledge_items` for full-text search. Auto-synced by triggers on INSERT/UPDATE/DELETE.

#### `symbol_summaries`, `runtime_events`, `internal_events`

Same as before.

## Knowledge Base Search

### FTS5 Path (default)

```text
query keywords → FTS5 MATCH → scoreRow() re-rank → top results
```

### LIKE Fallback

If FTS5 unavailable, falls back to multi-column LIKE queries.

### Ranking Algorithm

| Match | Score |
|---|---:|
| symbol exact-ish | +100 |
| title match | +50 |
| symbol text match | +40 |
| tags match | +30 |
| content match | +10 |
| type bug/decision/rule | +10 |

## CodeGraph Integration

### MCP Client (current)

CodeGraph module connects to CodeGraph MCP server via `@modelcontextprotocol/sdk` client:

```text
RecallOS Runtime → MCP Client → StdioClientTransport → CodeGraph MCP Server
```

Features:
- Lazy connect on first call
- Timeout with circuit breaker (default 30s)
- `PROJECT_PATH` passed per call via `projectPath` parameter
- No `execFileSync`, `cmd.exe`, or `npx` overhead

MCP tools called:

| MCP Tool | Purpose |
|---|---|
| `codegraph_status` | Index stats |
| `codegraph_search` | Symbol search |
| `codegraph_context` | Context/code snippets + callers/callees |
| `codegraph_impact` | Affected tests/files |

## Memory Module

4-layer agent memory:

| Layer | Storage | Table | Purpose |
|---|---|---|---|
| Raw Memory | PostgreSQL | `memory_events` | Store raw events |
| Active Memory | PostgreSQL | `memory_facts` | Store compressed facts |
| Context Index | PostgreSQL + pgvector | `memory_chunks` | Semantic vector search |
| Working Memory | In-process | runtime state | Current session state (auto-flush) |

### Hybrid Search

```text
query → SQL ILIKE on events + facts
      → pgvector cosine similarity on chunks
      → merge + rank → top_k results
```

### Embedding

Uses OpenAI-compatible endpoint. Auto-embeds events and facts into `memory_chunks`.

## Known Architectural Decisions

| Decision | Reason |
|---|---|
| `better-sqlite3` | Stable native bindings, replaces experimental `node:sqlite` |
| FTS5 | Fast full-text search with ranking, replaces multi-column LIKE |
| Migration engine | Versioned schema changes, no more inline SQL |
| MCP client for CodeGraph | Faster and more reliable than CLI/npx spawn |
| PostgreSQL for Memory | JSONB, UUID, pgvector — features SQLite lacks |
| External DB | Avoids touching target app runtime |
| `@modelcontextprotocol/sdk` | Official SDK, handles protocol correctly |
