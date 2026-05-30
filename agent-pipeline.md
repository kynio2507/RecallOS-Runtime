# Agent Pipeline Policy

> [!IMPORTANT]
> This is a hard policy for agents working with RecallOS/9Base.
> Agents must use `recallos-runtime` before, during, and after meaningful work.

## Purpose

`recallos-runtime` is the shared intelligence layer for 9Base development. It stores project truth, session memory, reusable knowledge, known bugs, decisions, agent state, handoffs, and context packs so agents do not repeat old mistakes or lose context between sessions.

## Current Memory Reality

Memory is **semi-automatic**, not fully automatic middleware yet.

Current behavior:

```text
agent calls recall_memory_write_event / recall_session_record_*
-> RecallOS stores raw event
-> RecallOS can auto-create chunks / embeddings when embedding config is available
```

But agents still must explicitly call tools to store:

- event
- fact
- decision
- bug
- constraint
- handoff update
- reusable project knowledge

Future direction: Memory Capture Middleware extracts candidates after each agent response and commits them after review or policy approval.

## Scope

This pipeline applies to any agent that works on:

- 9Base source code
- RecallOS Runtime source code
- docs
- architecture
- debugging or root-cause analysis
- implementation planning
- feature changes
- refactors
- test/build fixes
- multi-agent workflow execution

## Required Pipeline

### 1. Start-of-task context intake

Use context-first retrieval.

For named agent or multi-agent work, first call:

```text
recall_context_for_agent
```

Use `agent_id`, task text, and known project/workspace scope.

For general single-agent work, first call:

```text
recall_context_pack
```

Purpose:

- get Project Brain truth
- get relevant 4-layer memory resume/context
- get KB items
- get CodeGraph context when task needs code
- get agent identity/private/pair memory where applicable

Then use targeted follow-up calls only as needed:

```text
recall_kb_query
recall_memory_search
recall_codegraph_context
recall_project_context_pack
```

`recall_kb_status` is health/debug, not default first call. Use it when tools look broken, counts seem wrong, or DB/migration health matters.

### 2. Research and verification

RecallOS context is a starting point, not ground truth.

Required behavior:

- verify remembered facts against current files
- prefer source code over stale memory if conflict exists
- note stale/misleading knowledge for update
- avoid source changes during pure research/planning phase
- check active docs/plan before implementing complex changes

### 3. Implementation

During implementation:

- respect stored architecture decisions
- avoid reintroducing known bugs
- keep permission/memory/workspace boundaries intact
- document new decisions when design changes
- do not bypass current project workflow without explicit user approval
- keep Multi Agent provider/model state in RecallOS registry, not hardcoded maps, where possible

### 4. Post-task capture

After meaningful work, update RecallOS. This is mandatory until Memory Capture Middleware exists.

Use Session Recorder for reconstruction:

```text
recall_session_record_user_request
recall_session_record_assistant_action
recall_session_record_file_change
recall_session_record_command_result
recall_session_record_decision
recall_session_record_error
recall_session_record_build_result
recall_session_record_git_event
recall_session_record_project_snapshot
```

Use 4-layer Memory for dynamic state:

```text
recall_memory_write_event
recall_memory_upsert_fact
recall_memory_link
```

Use KB for reusable durable knowledge:

```text
recall_kb_remember
recall_kb_decision
recall_kb_bug
```

Use Agent tools for workflow state:

```text
recall_agent_handoff_update
recall_agent_send_message
recall_pair_memory_upsert
```

### 5. Handoff/final response

Final response or handoff must include:

- changed files
- verification performed
- known limitations
- memory/KB/session updates performed
- handoff status if multi-agent workflow is active

## Minimal Required Calls

### Small task

```text
1. recall_context_pack OR recall_context_for_agent
2. verify current file/code
3. implement/test
4. recall_session_record_* or recall_memory_write_event if meaningful
```

### Debug task

```text
1. recall_context_for_task
2. recall_kb_query for known bugs
3. recall_codegraph_context for affected symbols/files
4. reproduce/verify
5. fix/test
6. recall_kb_bug + recall_session_record_error/build_result
```

### Complex feature/refactor

```text
1. recall_context_pack
2. recall_project_context_pack
3. recall_memory_search for prior related work
4. research current code
5. plan and get approval
6. implement
7. test/build
8. recall_session_record_project_snapshot
9. recall_kb_decision / recall_kb_remember
10. final handoff
```

### Multi-agent workflow

```text
1. recall_context_for_agent
2. recall_context_for_pair or recall_context_for_handoff when collaborating
3. resolve model assignment from Multi Agent registry if needed
4. execute task/handoff
5. recall_agent_handoff_update
6. recall_pair_memory_upsert for pair protocol learnings
7. recall_session_record_* for reconstruction
```

## Anti-Patterns

Agents must not:

- start with only `recall_kb_query` for complex tasks when context pack is available
- bypass `recallos-runtime` with old standalone `codegraph` MCP unless user explicitly asks
- store secrets, tokens, API keys, passwords, or private credentials in memory/KB/docs
- treat old knowledge as absolute truth without code verification
- skip memory/session update after fixing a non-trivial bug
- duplicate docs that belong to another subsystem
- rely only on chat transcript for continuation context

## Documentation Boundary

`recallos-runtime` static docs describe:

- MCP server purpose
- tool behavior
- DB schema
- operations
- policies
- pipeline
- dashboard behavior
- known issues of `recallos-runtime` itself

Project-specific facts belong in RecallOS memory/KB through tools, not only in static docs.
