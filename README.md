# RecallOS Runtime

Private GitHub repo: `recallos-runtime`.

RecallOS Runtime is a multi-module MCP/server tool platform for Antigravity and AI agents.

Current Phase 1 module:

- **Code Intel module** — SQL knowledge memory, bug history, architecture decisions, and CodeGraph context.

Planned modules:

- **Memory / Recall module** — recall, compression, retrieval, agent memory workflows.
- **Diagnostics module** — runtime health, DB status, error summaries.
- **Policy module** — required agent workflow and project rules.
- **Search / Integration modules** — optional external tools.

> [!IMPORTANT]
> Phase 1 keeps backward-compatible `recall_runtime_*` tool names and the existing local folder path. `recallos-runtime` is now the Code Intel module inside RecallOS Runtime.

## Current Status

| Item | Status |
|---|---|
| Product | `RecallOS Runtime` |
| Server name | `recallos-runtime` |
| Version | `1.0.0-local` |
| Schema version | `2` |
| MCP transport | `@modelcontextprotocol/sdk` StdioServerTransport |
| SQLite driver | `better-sqlite3` |
| DB path | `C:/Users/Tung Admin/.gemini/antigravity/code_intel.sqlite` |
| Project path | `C:/Users/Tung Admin/.gemini/antigravity/scratch/9base-ai-infra` |
| Compatibility tools | `recall_runtime_*` |
| Stability | production-grade local |

## Tools

Current compatibility tools:

| Tool | Module | Purpose |
|---|---|---|
| `recall_runtime_query` | Code Intel | Query SQL knowledge + CodeGraph context |
| `recall_runtime_remember` | Code Intel | Store reusable knowledge |
| `recall_runtime_decision` | Code Intel | Store architecture decisions |
| `recall_runtime_bug` | Code Intel | Store bug root cause and fix history |
| `recall_runtime_status` | Runtime / Code Intel | Check server, DB, and CodeGraph status |

Phase 2 planned aliases:

```text
recall_runtime_query
recall_runtime_remember
```

## Required Agent Workflow

All agents working on 9Base must use RecallOS Runtime before meaningful work.

Minimum required behavior:

```text
1. Query RecallOS Runtime / Code Intel before work.
2. Verify important facts against current source code.
3. Update RecallOS Runtime after meaningful work.
```

See:

- [agent-pipeline.md](agent-pipeline.md)
- [agent-policy.md](agent-policy.md)

## Documentation Boundary

Static docs in this directory describe RecallOS Runtime and its modules:

- MCP server purpose
- tool behavior
- DB schema
- operations
- system requirements
- agent pipeline
- known issues

Project/runtime facts may be stored in the knowledge DB, but should not be expanded into static docs unless they define RecallOS Runtime itself.

## Quick Start

### Install

```powershell
npm install
```

### Test with terminal

```powershell
npm test
```

Expected:

```text
PASS RecallOS Runtime MCP tests
```

### Test in Antigravity

Call:

```text
recall_runtime_status
```

Expected:

```text
Server: recallos-runtime 1.0.0-local
Module: Code Intel
Compatibility tools: recall_runtime_*
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
