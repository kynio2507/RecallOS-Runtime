# RecallOS Runtime

Private GitHub repo: `recallos-runtime`.

![RecallOS Runtime overview](assets/recall.png)

RecallOS Runtime is a multi-module MCP/server tool platform for Antigravity and AI agents.

## Modules

- **Knowledge Base** — SQLite knowledge memory with FTS5 full-text search, bug history, architecture decisions, notes, and rules.
- **CodeGraph** — Source graph search, code context, symbol analysis, and impact analysis via MCP client.
- **Memory** — 4-layer agent memory: PostgreSQL raw events, active facts, pgvector semantic search, and in-process working memory.
- **Project Brain** — Project truth: docs, modules, roadmap, decisions, glossary, conventions.
- **Context Orchestrator** — Top-level context assembly across all modules.

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
| Tool namespaces | `recall_kb_*`, `recall_codegraph_*`, `recall_memory_*`, `recall_project_*`, `recall_context_*` |
| Total tools | 29 |
| Stability | production-grade local |

## Tools

### Knowledge Base (5 tools)

| Tool | Purpose |
|---|---|
| `recall_kb_status` | Check DB, metadata, counts, FTS5 status, migrations, and recent errors |
| `recall_kb_query` | Query stored knowledge by question, symbols, type, and tags (FTS5) |
| `recall_kb_remember` | Store reusable knowledge notes/rules |
| `recall_kb_decision` | Store architecture decisions |
| `recall_kb_bug` | Store bug root cause and fix history |

### CodeGraph (5 tools)

| Tool | Purpose |
|---|---|
| `recall_codegraph_status` | Check CodeGraph status for configured project |
| `recall_codegraph_search` | Search symbols/code with CodeGraph |
| `recall_codegraph_context` | Get code context for a task/question |
| `recall_codegraph_symbol` | Analyze a symbol with search/context/impact |
| `recall_codegraph_impact` | Find affected files/tests for a target |

### Memory (7 tools)

| Tool | Purpose |
|---|---|
| `recall_memory_status` | Show PostgreSQL counts and working memory state |
| `recall_memory_write_event` | Write raw event to memory_events (auto-embed) |
| `recall_memory_upsert_fact` | Upsert active fact to memory_facts |
| `recall_memory_search` | Hybrid search across SQL events + facts + vector chunks |
| `recall_memory_get_profile` | Get all facts for a scope |
| `recall_memory_summarize_session` | Summarize session events into structured facts |
| `recall_memory_link` | Create relation link between two memory items |

### Project Brain (9 tools)

| Tool | Purpose |
|---|---|
| `recall_project_overview` | Get project overview: modules, stats, current work |
| `recall_project_modules` | List project modules with status and purpose |
| `recall_project_get_doc` | Get project doc by title or type |
| `recall_project_upsert_doc` | Create or update project documentation (auto-version) |
| `recall_project_roadmap` | List roadmap items by status/priority |
| `recall_project_add_decision` | Record architecture/design decision |
| `recall_project_search` | Full-text search across all Project Brain tables |
| `recall_project_context_pack` | **Project Truth Context**: overview + architecture + modules + decisions + roadmap + glossary (Brain data only) |
| `recall_project_status` | Show Project Brain table counts |

### Context Orchestrator (3 tools)

| Tool | For | Sources |
|---|---|---|
| `recall_context_pack` | Agent chính | **Full**: Project Brain + Memory + KB + CodeGraph |
| `recall_context_for_task` | Task cụ thể | **Focused**: decisions + roadmap + bugs + code context |
| `recall_context_for_worker` | Sub-agent | **Minimal**: modules + conventions + rules + preferences |

> [!TIP]
> `recall_context_pack` is the recommended first call before starting any meaningful work. It assembles context from ALL modules in one response.

## Module Boundaries

```text
┌──────────────────────────────────────────────┐
│           Context Orchestrator               │
│  recall_context_pack                         │
│  recall_context_for_task                     │
│  recall_context_for_worker                   │
├──────────────┬───────────┬───────┬───────────┤
│ Project Brain│  Memory   │  KB   │ CodeGraph │
│ docs/roadmap │ events    │ bugs  │ symbols   │
│ modules      │ facts     │ rules │ callers   │
│ decisions    │ chunks    │ notes │ context   │
│ glossary     │ working   │       │ impact    │
└──────────────┴───────────┴───────┴───────────┘
```

| Module | Stores | When to use |
|---|---|---|
| **Knowledge Base** | bug/fix/rule/technical notes | Debug, code convention, known issues |
| **Project Brain** | project truth/docs/roadmap/architecture | Project structure, planning, decisions |
| **Memory** | agent/user/session/task memory | User preferences, session history, agent context |
| **CodeGraph** | source code intelligence | Symbol search, code context, callers/callees, impact |

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

## Quick Start

### Install

```powershell
npm install
```

### PostgreSQL (for Memory + Project Brain)

```powershell
docker run -d --name recallos-pg -p 5432:5432 \
  -e POSTGRES_USER=recallos \
  -e POSTGRES_PASSWORD=recallos \
  -e POSTGRES_DB=recallos_memory \
  pgvector/pgvector:pg17
```

### CLI help

```powershell
npm run help
recall --help
recall modules
recall codegraph --help
recall kb --help
recall memory --help
recall project --help
recall context --help
```

### Test

```powershell
npm test              # MCP wiring (all 29 tools)
npm run test:memory   # Memory module DB integration
npm run test:brain    # Project Brain DB integration
```

Expected:

```text
PASS RecallOS Runtime MCP tests
PASS RecallOS Memory module tests
PASS RecallOS Project Brain tests
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
