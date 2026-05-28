# RecallOS Runtime

Private GitHub repo: `recallos-runtime`.

![RecallOS Runtime overview](assets/recall.png)

RecallOS Runtime is a multi-module MCP/server tool platform for Antigravity and AI agents.

## Modules

- **Knowledge Base** — SQLite knowledge memory with FTS5 full-text search, bug history, architecture decisions, notes, and rules.
- **CodeGraph** — Source graph search, code context, symbol analysis, and impact analysis via MCP client.
- **Memory** — 4-layer agent memory: PostgreSQL raw events, active facts, pgvector semantic search, and in-process working memory.

> [!IMPORTANT]
> RecallOS Runtime now exposes strict module-specific MCP tools only.

## Current Status

| Item | Status |
|---|---|
| Product | `RecallOS Runtime` |
| Server name | `recallos-runtime` |
| Version | `1.0.0-local` |
| Schema version | `3` |
| MCP transport | `@modelcontextprotocol/sdk` StdioServerTransport |
| SQLite driver | `better-sqlite3` |
| SQLite search | FTS5 full-text search |
| Schema management | SQL migration engine (`migrations/*.sql`) |
| PostgreSQL | `pgvector/pgvector:pg17` (Docker) |
| CodeGraph backend | MCP client (replaces CLI/npx) |
| DB path | `/path/to/recallos-runtime/data/recallos_runtime.sqlite` |
| Project path | `/path/to/project` |
| Tool namespaces | `recall_kb_*`, `recall_codegraph_*`, `recall_memory_*` |
| Stability | production-grade local |

## Tools

### Knowledge Base

| Tool | Purpose |
|---|---|
| `recall_kb_status` | Check DB, metadata, counts, FTS5 status, migrations, and recent errors |
| `recall_kb_query` | Query stored knowledge by question, symbols, type, and tags (FTS5) |
| `recall_kb_remember` | Store reusable knowledge notes/rules |
| `recall_kb_decision` | Store architecture decisions |
| `recall_kb_bug` | Store bug root cause and fix history |

### CodeGraph

| Tool | Purpose |
|---|---|
| `recall_codegraph_status` | Check CodeGraph status for configured project |
| `recall_codegraph_search` | Search symbols/code with CodeGraph |
| `recall_codegraph_context` | Get code context for a task/question |
| `recall_codegraph_symbol` | Analyze a symbol with search/context/impact |
| `recall_codegraph_impact` | Find affected files/tests for a target |

### Memory

| Tool | Purpose |
|---|---|
| `recall_memory_status` | Show PostgreSQL counts and working memory state |
| `recall_memory_write_event` | Write raw event to memory_events (auto-embed) |
| `recall_memory_upsert_fact` | Upsert active fact to memory_facts |
| `recall_memory_search` | Hybrid search across SQL events + facts + vector chunks |
| `recall_memory_get_profile` | Get all facts for a scope |
| `recall_memory_summarize_session` | Summarize session events into structured facts |
| `recall_memory_link` | Create relation link between two memory items |

## Architecture

### Migration Engine

Schema changes are managed by versioned SQL migration files:

```text
migrations/
  001_initial_schema.sql    — base tables, indexes
  002_fts5_knowledge.sql    — FTS5 virtual table + sync triggers
```

Applied migrations are tracked in `schema_migrations`:

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
```

Adding new tables: create `migrations/003_your_change.sql`. Migrator auto-applies on startup.

### FTS5 Full-Text Search

Knowledge Base uses SQLite FTS5 for fast full-text search:

```sql
CREATE VIRTUAL TABLE knowledge_items_fts USING fts5(
  title, content, symbols_json, files_json, tags_json,
  content=knowledge_items, content_rowid=rowid
);
```

Auto-sync triggers keep FTS5 in sync on INSERT/UPDATE/DELETE. Falls back to LIKE if FTS5 is unavailable.

### CodeGraph MCP Client

CodeGraph module connects to the CodeGraph MCP server via MCP client SDK (replaces CLI/npx):

- Lazy connect on first call
- Timeout with circuit breaker (default 30s, configurable via `RECALLOS_CODEGRAPH_TIMEOUT`)
- `PROJECT_PATH` passed per call via `projectPath` parameter
- No more `execFileSync`, `cmd.exe`, or `npx` overhead

### Memory Module

4-layer agent memory:

| Layer | Storage | Table |
|---|---|---|
| Raw Memory | PostgreSQL | `memory_events` |
| Active Memory | PostgreSQL | `memory_facts` |
| Context Index | PostgreSQL + pgvector | `memory_chunks` |
| Working Memory | In-process | runtime state (auto-flush) |

PostgreSQL + pgvector quick start:

```powershell
docker run -d --name recallos-pg -p 5432:5432 \
  -e POSTGRES_USER=recallos \
  -e POSTGRES_PASSWORD=recallos \
  -e POSTGRES_DB=recallos_memory \
  pgvector/pgvector:pg17
```

Embedding uses an OpenAI-compatible endpoint:

```text
RECALLOS_EMBEDDING_ENDPOINT=https://your-router.example/v1/embeddings
RECALLOS_EMBEDDING_MODEL=your-embedding-model
RECALLOS_EMBEDDING_DIM=3072
```

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `RECALLOS_ROOT` | package root | Runtime root directory |
| `RECALLOS_PROJECT_PATH` | parent of root | Target project path |
| `RECALLOS_DB_PATH` | `<root>/data/recallos_runtime.sqlite` | SQLite database path |
| `RECALLOS_CODEGRAPH_MCP_CMD` | `npx` | CodeGraph MCP server command |
| `RECALLOS_CODEGRAPH_MCP_ARGS` | auto-configured | CodeGraph MCP server arguments |
| `RECALLOS_CODEGRAPH_TIMEOUT` | `30000` | CodeGraph MCP connect/call timeout (ms) |
| `RECALLOS_PG_HOST` | `localhost` | PostgreSQL host |
| `RECALLOS_PG_PORT` | `5432` | PostgreSQL port |
| `RECALLOS_PG_USER` | `recallos` | PostgreSQL user |
| `RECALLOS_PG_PASSWORD` | `recallos` | PostgreSQL password |
| `RECALLOS_PG_DATABASE` | `recallos_memory` | PostgreSQL database |
| `RECALLOS_EMBEDDING_ENDPOINT` | (none) | Embedding API endpoint |
| `RECALLOS_EMBEDDING_MODEL` | `gemini/gemini-embedding-2-preview` | Embedding model |
| `RECALLOS_EMBEDDING_API_KEY` | (none) | Embedding API key |
| `RECALLOS_EMBEDDING_DIM` | `3072` | Embedding vector dimension |

## Required Agent Workflow

All agents working on 9Base must use RecallOS Runtime before meaningful work.

Minimum required behavior:

```text
1. Query RecallOS Runtime / Knowledge Base + CodeGraph before work.
2. Verify important facts against current source code.
3. Update RecallOS Runtime after meaningful work.
```

See:

- [agent-pipeline.md](agent-pipeline.md)
- [agent-policy.md](agent-policy.md)

## Quick Start

### Install

```powershell
npm install
```

### CLI help

```powershell
npm run help
node ./src/cli/recall.mjs --help
node ./src/cli/recall.mjs codegraph --help
node ./src/cli/recall.mjs kb --help
node ./src/cli/recall.mjs memory --help
```

After linking/installing globally:

```powershell
recall --help
recall modules
recall codegraph --help
recall kb --help
recall memory --help
recall mcp
```

### Test

```powershell
npm test              # MCP wiring + KB + CodeGraph + Memory tools
npm run test:memory   # Memory module DB integration (requires PostgreSQL)
```

Expected:

```text
PASS RecallOS Runtime MCP tests
PASS RecallOS Memory module tests
```

### Test in Antigravity

Call:

```text
recall_kb_status
```

Expected output includes:

```text
FTS5: enabled
Migrations: [...]
```

## Documentation

| File | Content |
|---|---|
| [definition.md](definition.md) | Scope, definitions, boundaries |
| [architecture.md](architecture.md) | Technical architecture |
| [agent-pipeline.md](agent-pipeline.md) | Required workflow for agents |
| [agent-policy.md](agent-policy.md) | Short policy snippet for prompts |
| [user-guide.md](user-guide.md) | User guide |
| [operations.md](operations.md) | Install, test, operations |
| [roadmap.md](roadmap.md) | Development roadmap |
| [logs-and-issues.md](logs-and-issues.md) | Logs and known issues |
| [system-requirements.md](system-requirements.md) | System requirements |
