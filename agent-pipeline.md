# Agent Pipeline Policy

> [!IMPORTANT]
> This is a hard policy for agents working on 9Base.
> Agents must use `9base-code-intel` before, during, and after work.

## Purpose

`9base-code-intel` is the shared intelligence layer for 9Base development.
It stores rules, decisions, bugs, architecture notes, and reusable project
knowledge so agents do not repeat old mistakes or lose context between sessions.

## Scope

This pipeline applies to any agent that works on:

- 9Base source code
- 9Base docs
- 9Base architecture
- debugging or root-cause analysis
- implementation planning
- feature changes
- refactors
- test or build fixes

## Required Pipeline

### 1. Start-of-task intake

Before analysis or implementation, agent must call:

```text
code_intel_status
```

Purpose:

- confirm server health
- confirm DB path/project path
- confirm CodeGraph index status
- see current knowledge counts/errors

Then agent must call:

```text
code_intel_query
```

Use task-relevant keywords, files, and symbols.

Examples:

```json
{
  "question": "How does session message handling work?",
  "symbols": ["handleMessage", "executeAgentTools"],
  "includeContext": true,
  "includeImpact": true
}
```

```json
{
  "question": "Known rules and bugs for RecallOS memory compression",
  "symbols": ["triggerCompression", "recallSearch"],
  "includeContext": true
}
```

### 2. Research and verification

Agents must treat `9base-code-intel` as a starting point, not absolute truth.

Required behavior:

- verify remembered facts against current files
- prefer source code over stale memory if conflict exists
- note stale/misleading knowledge for later update
- avoid making source changes during pure research/planning phase

### 3. Implementation

During implementation, agents must follow relevant rules found in 9base-ci.

Required behavior:

- respect stored architecture decisions
- avoid reintroducing known bugs
- keep permission/memory/workspace boundaries intact
- document new decisions when design changes
- do not bypass current project workflow without explicit user approval

### 4. Post-change memory update

After meaningful work, agent must update `9base-code-intel`.

Use `code_intel_remember` for:

- new architecture map
- module behavior summary
- important implementation detail
- operational note
- reusable debugging note

Use `code_intel_decision` for:

- architecture choices
- tool/workflow decisions
- scope/boundary decisions
- tradeoff decisions

Use `code_intel_bug` for:

- root cause
- fix
- affected files/symbols
- how to verify

### 5. Handoff

Final response or handoff must include:

- changed files
- verification performed
- known limitations
- whether 9base-ci was updated

## Anti-Patterns

Agents must not:

- bypass `9base-code-intel` with old standalone `codegraph` MCP unless user explicitly asks
- write app-runtime details into `9base-code-intel` static docs
- store secrets, tokens, API keys, passwords, or private credentials
- treat old knowledge as absolute truth without code verification
- skip memory update after fixing a non-trivial bug
- duplicate docs that belong to another subsystem

## Documentation Boundary

`9base-code-intel` static docs describe only:

- MCP server purpose
- tool behavior
- DB schema
- operations
- policies
- pipeline
- known issues of `9base-code-intel` itself

They must not become docs for:

- `webapp` features
- specific agents
- runtime UI behavior
- app-level web search behavior
- app database business schema
- RecallOS runtime internals

Project-specific facts belong in the `knowledge_items` DB through
`code_intel_remember`, not in static Code Intel docs.

## Minimal Required Calls

For small tasks:

```text
1. code_intel_query
2. verify current file/code
3. code_intel_remember if new reusable knowledge exists
```

For complex tasks:

```text
1. code_intel_status
2. code_intel_query
3. verify current code
4. plan
5. implement
6. test
7. code_intel_remember / decision / bug
8. handoff
```
