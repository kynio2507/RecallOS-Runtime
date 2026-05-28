# Architecture

## Overview

`recallos-runtime` — 6-module MCP server for multi-agent AI workflows.

```text
┌──────────────────────────────────────────────────┐
│              Context Orchestrator                 │
│  context_pack / for_task / for_worker            │
│  for_agent / for_handoff / for_pair              │
├────────┬──────────┬───────┬───────────┬──────────┤
│ Project│  Memory  │  KB   │ CodeGraph │  Agents  │
│ Brain  │          │       │           │          │
│ PG     │ PG+pgvec│SQLite │ MCP Client│ PG       │
│ docs   │ events   │ FTS5  │ symbols   │ identity │
│ roadmap│ facts    │ bugs  │ callers   │ messages │
│ modules│ chunks   │ rules │ context   │ handoffs │
│ decides│ working  │ notes │ impact    │          │
└────────┴──────────┴───────┴───────────┴──────────┘
```

## Data Flow

```text
Agent Request
  ↓
Context Orchestrator
  ├── Project Brain (PG) → overview, architecture, modules, decisions, roadmap
  ├── Memory (PG+pgvector) → user profile, agent memory, session facts, vector search
  ├── Knowledge Base (SQLite+FTS5) → bugs, rules, decisions, notes
  ├── CodeGraph (MCP Client) → symbol search, code context, impact
  └── Agents (PG) → agent identity, recent messages, handoff context
  ↓
Assembled Context (Markdown)
```

## Module Responsibilities

| Module | Storage | Responsibility |
|---|---|---|
| Knowledge Base | SQLite + FTS5 | bug/fix/rule/technical notes |
| CodeGraph | MCP Client → CodeGraph Server | source code intelligence |
| Memory | PostgreSQL + pgvector | agent/user/session memory, multi-agent scoped |
| Project Brain | PostgreSQL | project truth — docs, modules, roadmap, decisions |
| Agents | PostgreSQL | agent identity, messaging, handoff chains |
| Context Orchestrator | (no storage) | top-level context assembly |

## Multi-Agent Architecture

### Agent Identity

```sql
agents (id TEXT PK, name, role, model_id, system_prompt, capabilities_json)
```

Roles: `assistant`, `architect`, `secretary`, `coder`, `designer`, `reviewer`, `tester`, `custom`

### Inter-Agent Messaging

```sql
agent_messages (id, workspace_id, project_id, run_id, task_id,
                from_agent_id, to_agent_id, message_type, content, summary)
```

Types: `message`, `request`, `response`, `feedback`, `broadcast`

### Task Handoffs

```sql
agent_handoffs (id, from_agent_id, to_agent_id, project_id,
                task_title, task_payload_json, status, result_summary)
```

Status: `pending` → `accepted` → `in_progress` → `completed` / `failed` / `cancelled`

Handoff chain:

```text
Assistant → handoff(Architect, "Design auth")
  → Architect completes → handoff(Coder, "Implement auth", payload: design)
  → Coder completes → handoff(Reviewer, "Review auth")
  → Reviewer completes → result_summary back to Assistant
```

### Memory Scopes

```text
global / workspace / project / agent_private / agent_pair / task / session
```

Scope columns on `memory_events` and `memory_facts`:

```text
workspace_id, project_id, agent_id, pair_key, task_id, session_id, run_id
```

Pair key: alphabetical sort → `architect:coder` (bidirectional lookup).

## Context Orchestrator

6 tools for different context needs:

| Tool | For | What it fetches |
|---|---|---|
| `context_pack` | Main agent | Full: overview + arch + modules + decisions + roadmap + memory + KB + CodeGraph |
| `context_for_task` | Specific task | Focused: related decisions + roadmap + bugs + code (skip overview) |
| `context_for_worker` | Sub-agent | Minimal: modules + conventions + rules + preferences |
| `context_for_agent` | Named agent | Identity + private memory + recent messages + brain + KB + CodeGraph + constraints |
| `context_for_handoff` | Handoff receiver | Handoff details + sender work + task chain + related decisions + KB |
| `context_for_pair` | 2 agents | Both identities + conversation + pair memory + project context |

## Schema Management

### SQLite

Migration engine: `migrations/001_initial_schema.sql`, `002_fts5_knowledge.sql`

Tracked in `schema_migrations` table. Auto-applies on startup.

### PostgreSQL

Auto-schema via `ensureMemorySchema()` in `pg.mjs`. Tables:

```text
Memory:     memory_events, memory_facts, memory_chunks, memory_links
Brain:      project_docs, project_modules, project_decisions, project_roadmap_items, project_glossary
Agents:     agents, agent_messages, agent_handoffs
```

## Knowledge Base — FTS5

```sql
CREATE VIRTUAL TABLE knowledge_items_fts USING fts5(
  title, content, symbols_json, files_json, tags_json,
  content=knowledge_items, content_rowid=rowid
);
```

Auto-sync triggers. Falls back to LIKE if unavailable.

## CodeGraph — MCP Client

```text
RecallOS → MCP Client → StdioClientTransport → CodeGraph MCP Server
```

Lazy connect, 30s timeout, circuit breaker. `PROJECT_PATH` per call.

## Architectural Decisions

| Decision | Reason |
|---|---|
| `better-sqlite3` | Stable native bindings |
| FTS5 | Fast full-text search |
| Migration engine | Versioned schema |
| MCP client for CodeGraph | Faster than CLI/npx |
| PostgreSQL for Memory + Brain + Agents | JSONB, UUID, pgvector |
| Separate Brain vs Memory | Brain = project truth, Memory = dynamic state |
| Agent identity table | Enable stateless agents via MCP API |
| Pair key alphabetical | Bidirectional lookup with single key |
| Context Orchestrator | Single entry point for all context |
