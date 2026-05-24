# 9Base Code Intel

`9base-code-intel` is a local MCP server for Antigravity. It provides shared code intelligence and memory for 9Base development.

It combines:

- **CodeGraph** — source graph, symbol lookup, context snippets.
- **SQLite knowledge DB** — rules, bug history, architecture decisions, notes.
- **MCP protocol** — tools exposed to Antigravity agents.

> [!IMPORTANT]
> `9base-code-intel` is development infrastructure. It is not the 9Base runtime application.

## Current Status

| Item | Status |
|---|---|
| Version | `1.0.0-local` |
| Schema version | `2` |
| MCP transport | `@modelcontextprotocol/sdk` StdioServerTransport |
| SQLite driver | `better-sqlite3` |
| DB path | `C:/Users/Tung Admin/.gemini/antigravity/code_intel.sqlite` |
| Project path | `C:/Users/Tung Admin/.gemini/antigravity/scratch/9base-ai-infra` |
| Knowledge items | `21+` |
| CodeGraph index | `[OK] Index is up to date` |
| Stability | production-grade local |

## Tools

| Tool | Purpose |
|---|---|
| `code_intel_query` | Query SQL knowledge + CodeGraph context |
| `code_intel_remember` | Store reusable knowledge |
| `code_intel_decision` | Store architecture decisions |
| `code_intel_bug` | Store bug root cause and fix history |
| `code_intel_status` | Check server, DB, and CodeGraph status |

## Required Agent Workflow

All agents working on 9Base must follow the policy in:

- [agent-pipeline.md](agent-pipeline.md)
- [agent-policy.md](agent-policy.md)

Minimum required behavior:

```text
1. Query 9base-code-intel before work.
2. Verify important facts against current source code.
3. Update 9base-code-intel after meaningful work.
```

## Documentation Boundary

Static docs in this directory describe only `9base-code-intel` itself:

- MCP server purpose
- tool behavior
- DB schema
- operations
- system requirements
- agent pipeline
- known issues of Code Intel itself

Project/runtime facts may be stored in the knowledge DB, but should not be expanded into these static docs.

## Quick Start

### Test with terminal

```powershell
node "C:/Users/Tung Admin/.gemini/antigravity/test_code_intel_mcp.mjs"
```

Expected:

```text
PASS 9base-code-intel MCP tests
```

### Test in Antigravity

Call:

```text
code_intel_status
```

Expected:

```text
Server: 9base-code-intel 1.0.0-local
MCP transport: SDK stdio
SQLite driver: better-sqlite3
CodeGraph: [OK] Index is up to date
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
