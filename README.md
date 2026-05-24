# RecallOS Runtime

Private GitHub repo: `recallos-runtime`.

![RecallOS Runtime overview](assets/recall.png)

RecallOS Runtime is a multi-module MCP/server tool platform for Antigravity and AI agents.

Current modules:

- **Knowledge Base** — SQLite knowledge memory, bug history, architecture decisions, notes, and rules.
- **CodeGraph** — source graph search, code context, symbol analysis, and impact analysis.

Planned modules:

- **Memory / Recall module** — recall, compression, retrieval, agent memory workflows.
- **Diagnostics module** — runtime health, DB status, error summaries.
- **Policy module** — required agent workflow and project rules.
- **Search / Integration modules** — optional external tools.

> [!IMPORTANT]
> RecallOS Runtime now exposes strict module-specific MCP tools only.

## Current Status

| Item | Status |
|---|---|
| Product | `RecallOS Runtime` |
| Server name | `recallos-runtime` |
| Version | `1.0.0-local` |
| Schema version | `2` |
| MCP transport | `@modelcontextprotocol/sdk` StdioServerTransport |
| SQLite driver | `better-sqlite3` |
| DB path | `/path/to/recallos-runtime/data/recallos_runtime.sqlite` |
| Project path | `/path/to/project` |
| Tool namespaces | `recall_kb_*`, `recall_codegraph_*` |
| Stability | production-grade local |

## Tools

### Knowledge Base

| Tool | Purpose |
|---|---|
| `recall_kb_status` | Check DB, metadata, counts, and recent errors |
| `recall_kb_query` | Query stored knowledge by question, symbols, type, and tags |
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

### CLI help

```powershell
npm run help
node ./src/cli/recall.mjs --help
node ./src/cli/recall.mjs codegraph --help
node ./src/cli/recall.mjs kb --help
```

After linking/installing globally:

```powershell
recall --help
recall modules
recall codegraph --help
recall kb --help
recall mcp
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
recall_kb_status
```

Expected:

```text
# Knowledge Base Module Status
Server: recallos-runtime 1.0.0-local
```

For CodeGraph:

```text
# CodeGraph Module Status
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
