# Architecture

## Tổng quan

`9base-code-intel` gồm 3 lớp:

```text
MCP Tools (5 tools)
  ↓ @modelcontextprotocol/sdk StdioServerTransport
Code Intel Server (code_intel_mcp.mjs)
  ↓
SQLite Knowledge DB (better-sqlite3) + CodeGraph CLI (@colbymchenry/codegraph)
```

## Runtime components

| Component | Path | Mục đích |
|---|---|---|
| MCP server | `C:/Users/Tung Admin/.gemini/antigravity/code_intel_mcp.mjs` | expose tools qua stdio MCP |
| SQLite DB | `C:/Users/Tung Admin/.gemini/antigravity/code_intel.sqlite` | lưu knowledge (21 items) |
| Test script | `C:/Users/Tung Admin/.gemini/antigravity/test_code_intel_mcp.mjs` | test protocol/tools |
| CodeGraph index | `9base-ai-infra/.codegraph` | index source code (46 files, 312 nodes) |
| SDK dependency | `@modelcontextprotocol/sdk` | MCP protocol transport |
| SQLite driver | `better-sqlite3` | native SQLite bindings, stable |

## MCP transport

Sử dụng `@modelcontextprotocol/sdk` với `StdioServerTransport`:

- Newline-delimited JSON (`\n`), **KHÔNG** dùng Content-Length framing
- Server tự handle `initialize` → `notifications/initialized` → tool calls

## MCP tools

### `code_intel_status`

Trả:

- server version (`1.0.0-local`)
- schema version (`2`)
- SQLite driver (`better-sqlite3`)
- DB path, project path
- count các bảng (knowledge_items, symbol_summaries, runtime_events, internal_events)
- Recent errors
- CodeGraph status

### `code_intel_query`

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

### `code_intel_remember`

Lưu knowledge dạng tự do. Hỗ trợ type:

- `rule` — quy tắc phải tuân thủ
- `decision` — quyết định kiến trúc
- `bug` — bug history + root cause + fix
- `note` — ghi chú kỹ thuật
- `runtime` — sự kiện runtime đáng nhớ
- `symbol_summary` — summary cho symbol/file
- `architecture` — bản đồ kiến trúc module/system

### `code_intel_decision`

Shortcut lưu architecture decision.

### `code_intel_bug`

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
