# Architecture

## Overview

`recallos-runtime` is a multi-module MCP server with 5 modules:

```text
┌──────────────────────────────────────────────┐
│           Context Orchestrator               │
│  recall_context_pack (Full Agent Context)    │
│  recall_context_for_task (Focused)           │
│  recall_context_for_worker (Minimal)         │
├──────────────┬───────────┬───────┬───────────┤
│ Project Brain│  Memory   │  KB   │ CodeGraph │
│ PostgreSQL   │ PostgreSQL│SQLite │ MCP Client│
│ docs/roadmap │ events    │ FTS5  │ symbols   │
│ modules      │ facts     │ bugs  │ callers   │
│ decisions    │ chunks    │ rules │ context   │
│ glossary     │ working   │ notes │ impact    │
└──────────────┴───────────┴───────┴───────────┘
```

## Module Responsibilities

| Module | Storage | Responsibility |
|---|---|---|
| Knowledge Base | SQLite + FTS5 | bug/fix/rule/technical notes — debug, code convention, known issues |
| CodeGraph | MCP Client → CodeGraph Server | source code intelligence — symbols, callers, callees, impact |
| Memory | PostgreSQL + pgvector | agent/user/session memory — events, facts, vector search, working state |
| Project Brain | PostgreSQL | project truth — docs, modules, roadmap, decisions, glossary, conventions |
| Context Orchestrator | (no storage) | top-level context assembly — calls all 4 modules, returns assembled context |

## Data Flow

```text
Agent Request
  ↓
Context Orchestrator
  ├── Project Brain (PostgreSQL) → overview, architecture, modules, decisions, roadmap, glossary
  ├── Memory (PostgreSQL+pgvector) → user profile, session facts, vector search
  ├── Knowledge Base (SQLite+FTS5) → bugs, rules, decisions, notes
  └── CodeGraph (MCP Client) → symbol search, code context, impact
  ↓
Assembled Context (Markdown)
  ↓
Agent Response
```

## MCP Transport

Uses `@modelcontextprotocol/sdk` with `StdioServerTransport`:
- Newline-delimited JSON, NOT Content-Length framing
- Server handles `initialize` → `notifications/initialized` → tool calls

## Schema Management

### SQLite Migration Engine

Versioned SQL files in `migrations/`:

```text
migrations/
  001_initial_schema.sql    — base tables, indexes
  002_fts5_knowledge.sql    — FTS5 virtual table + sync triggers
```

Applied migrations tracked in `schema_migrations` table. New migrations auto-apply on startup.

### PostgreSQL Schema

Memory + Project Brain tables auto-created on first connection via `ensureMemorySchema()` in `pg.mjs`.

Tables:

```text
Memory:          memory_events, memory_facts, memory_chunks, memory_links
Project Brain:   project_docs, project_modules, project_decisions, project_roadmap_items, project_glossary
```

## Knowledge Base

### FTS5 Full-Text Search

```sql
CREATE VIRTUAL TABLE knowledge_items_fts USING fts5(
  title, content, symbols_json, files_json, tags_json,
  content=knowledge_items, content_rowid=rowid
);
```

Auto-sync triggers on INSERT/UPDATE/DELETE. Falls back to LIKE if FTS5 unavailable.

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

MCP Client connects to CodeGraph MCP server via `@modelcontextprotocol/sdk`:

```text
RecallOS → MCP Client → StdioClientTransport → CodeGraph MCP Server
```

- Lazy connect, timeout with circuit breaker (default 30s)
- `PROJECT_PATH` passed per call via `projectPath` parameter

## Memory Module

4-layer architecture:

| Layer | Storage | Table | Purpose |
|---|---|---|---|
| Raw Memory | PostgreSQL | `memory_events` | Raw events |
| Active Memory | PostgreSQL | `memory_facts` | Compressed facts |
| Context Index | PostgreSQL + pgvector | `memory_chunks` | Semantic vector search |
| Working Memory | In-process | runtime state | Current session (auto-flush) |

Hybrid search: SQL ILIKE on events + facts → pgvector cosine similarity on chunks → merge + rank.

## Project Brain

Project truth store:

| Table | Purpose |
|---|---|
| `project_docs` | Versioned docs: overview, architecture, api, guide, convention |
| `project_modules` | Module registry with status, purpose, owner |
| `project_decisions` | Architecture decisions with reason, alternatives, impact |
| `project_roadmap_items` | Roadmap with priority, status, milestone |
| `project_glossary` | Term definitions and aliases |

`recall_project_context_pack` = **Project Truth Context** (Brain data only, no Memory).

## Context Orchestrator

Top-level intelligence layer:

| Tool | For | Fetches |
|---|---|---|
| `recall_context_pack` | Agent chính | Full: overview + arch + modules + decisions + roadmap + glossary + memory profile + memory search + KB bugs/rules + CodeGraph context |
| `recall_context_for_task` | Specific task | Focused: related decisions + roadmap + memory facts + KB bugs + CodeGraph (skip overview/arch) |
| `recall_context_for_worker` | Sub-agent | Minimal: modules + conventions + user preferences + rules (no CodeGraph) |

`recall_context_pack` = **Full Agent Context** (all 4 modules).

Supports `depth` parameter: `full` (default), `summary`, `minimal`.

## Architectural Decisions

| Decision | Reason |
|---|---|
| `better-sqlite3` | Stable native bindings |
| FTS5 | Fast full-text search with ranking |
| Migration engine | Versioned schema changes |
| MCP client for CodeGraph | Faster than CLI/npx spawn |
| PostgreSQL for Memory + Brain | JSONB, UUID, pgvector |
| Context Orchestrator | Single entry point for all context |
| Separate Project Brain vs Memory | Brain = project truth, Memory = dynamic agent state |
