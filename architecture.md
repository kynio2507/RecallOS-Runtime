# Architecture

## Tổng quan

`recallos-runtime` gồm 3 lớp:

```text
MCP Tools (5 tools)
  ↓ @modelcontextprotocol/sdk StdioServerTransport
Knowledge Base + CodeGraph Server (recallos_runtime_mcp.mjs)
  ↓
SQLite Knowledge DB (better-sqlite3) + CodeGraph CLI (@colbymchenry/codegraph)
```

## Runtime components

| Component | Path | Mục đích |
|---|---|---|
| MCP server | `/path/to/recallos-runtime/src/recallos_runtime_mcp.mjs` | expose tools qua stdio MCP |
| SQLite DB | `/path/to/recallos-runtime/data/recallos_runtime.sqlite` | lưu knowledge (21 items) |
| Test script | `/path/to/recallos-runtime/test/test_recallos_runtime_mcp.mjs` | test protocol/tools |
| CodeGraph index | `9base-ai-infra/.codegraph` | index source code (46 files, 312 nodes) |
| SDK dependency | `@modelcontextprotocol/sdk` | MCP protocol transport |
| SQLite driver | `better-sqlite3` | native SQLite bindings, stable |

## MCP transport

Sử dụng `@modelcontextprotocol/sdk` với `StdioServerTransport`:

- Newline-delimited JSON (`\n`), **KHÔNG** dùng Content-Length framing
- Server tự handle `initialize` → `notifications/initialized` → tool calls

## MCP tools

### `recall_kb_status`

Trả:

- server version (`1.0.0-local`)
- schema version (`2`)
- SQLite driver (`better-sqlite3`)
- DB path, project path
- count các bảng (knowledge_items, symbol_summaries, runtime_events, internal_events)
- Recent errors
- CodeGraph status

### `recall_kb_query`

Input:

```json
{
  "question": "...",
  "symbols": ["..."],
  "mode": "debug",
  "includeContext": true,
  "includeImpact": true
}
```

Luồng:

```text
question/symbols
  ↓
SQL knowledge ranking (score-based)
  ↓
CodeGraph query + context (symbol search, code snippets)
  ↓
markdown answer (knowledge + code context combined)
```

### `recall_kb_remember`

Lưu knowledge dạng tự do. Hỗ trợ type:

- `rule` — quy tắc phải tuân thủ
- `decision` — quyết định kiến trúc
- `bug` — bug history + root cause + fix
- `note` — ghi chú kỹ thuật
- `runtime` — sự kiện runtime đáng nhớ
- `symbol_summary` — summary cho symbol/file
- `architecture` — bản đồ kiến trúc module/system

### `recall_kb_decision`

Shortcut lưu architecture decision.

### `recall_kb_bug`

Shortcut lưu bug/root cause/fix.

## SQLite schema (version 2)

### `meta`

| Column | Type | Meaning |
|---|---|---|
| `key` | TEXT PK | primary key |
| `value` | TEXT | value |

Current keys: `schema_version`, `server_version`, `project_path`, `db_path`, `mcp_transport`, `sqlite_driver`

### `knowledge_items`

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

### `symbol_summaries`

| Column | Type | Meaning |
|---|---|---|
| `id` | TEXT PK | UUID |
| `symbol` | TEXT | symbol name |
| `summary` | TEXT | summary text |
| `file_path` | TEXT | file location |
| `created_at` | TEXT | ISO timestamp |

### `internal_events`

| Column | Type | Meaning |
|---|---|---|
| `id` | TEXT PK | UUID |
| `level` | TEXT | info/warn/error |
| `event` | TEXT | event name |
| `detail` | TEXT | truncated detail |
| `created_at` | TEXT | ISO timestamp |

## Ranking algorithm

| Match | Score |
|---|---:|
| symbol exact-ish | +100 |
| title match | +50 |
| symbol text match | +40 |
| tags match | +30 |
| content match | +10 |
| type bug/decision/rule | +10 |

## CodeGraph integration

Current adapter:

```powershell
cmd.exe /c npx -y @colbymchenry/codegraph ...
```

Used commands:

| Command | Purpose |
|---|---|
| `status` | check index stats |
| `query` | symbol search |
| `context` | context/code snippets + caller/callee |
| `affected` | affected tests/files |

## Known architectural tradeoffs

| Tradeoff | Reason |
|---|---|
| `better-sqlite3` | stable native bindings, replaces experimental `node:sqlite` |
| `npx` runtime | easy install, but slower first run |
| CLI CodeGraph | stable enough, but less rich than MCP callers/callees |
| external DB | avoids touching 9Base app runtime |
| `@modelcontextprotocol/sdk` | official SDK, handles protocol correctly |
## Memory Module

RecallOS Runtime includes a 4-layer agent memory module:

| Layer | Storage | Purpose |
|---|---|---|
| Raw Memory | PostgreSQL `memory_events` | Store important raw events |
| Active Memory | PostgreSQL `memory_facts` | Store compressed facts and profiles |
| Context Index | PostgreSQL + pgvector `memory_chunks` | Semantic search over memory chunks |
| Working Memory | In-process runtime state | Track current goal, task, open files, constraints, and pending questions |

Memory tools:

```text
recall_memory_status
recall_memory_write_event
recall_memory_upsert_fact
recall_memory_search
recall_memory_get_profile
recall_memory_summarize_session
recall_memory_link
```

PostgreSQL + pgvector quick start:

```powershell
docker run -d --name recallos-pg -p 5432:5432 -e POSTGRES_USER=recallos -e POSTGRES_PASSWORD=recallos -e POSTGRES_DB=recallos_memory pgvector/pgvector:pg17
```

Embedding uses an OpenAI-compatible endpoint:

```text
RECALLOS_EMBEDDING_ENDPOINT=https://your-router.example/v1/embeddings
RECALLOS_EMBEDDING_MODEL=your-embedding-model
RECALLOS_EMBEDDING_DIM=3072
```

Example event:

```json
{
  "actor": "main_agent",
  "event_type": "observation",
  "content": "RecallOS Memory stores raw events, active facts, vector context, and working memory.",
  "embed": true
}
```

Example fact:

```json
{
  "scope": "project",
  "key": "memory_architecture",
  "value": "4-layer memory: raw events, active facts, vector context, working state",
  "confidence": 1
}
```
