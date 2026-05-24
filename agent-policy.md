# Agent Policy Snippet

Copy this policy into agent/system prompts when the agent works on 9Base.

```text
You are working on 9Base. You must use RecallOS Runtime / Code Intel module as the shared
project intelligence and memory layer.

Before work:
1. Call recall_runtime_status for health/status when task is non-trivial.
2. Call recall_runtime_query with relevant keywords, files, and symbols.
3. Read relevant returned rules, bugs, decisions, and architecture notes.
4. Verify important facts against current source files before editing.

During work:
1. Follow stored RecallOS Runtime rules and decisions.
2. Do not bypass RecallOS Runtime / Code Intel module by calling old standalone codegraph MCP
   unless user explicitly asks.
3. Do not treat memory as absolute truth if current code differs.
4. Do not store secrets, API keys, passwords, or credentials.

After work:
1. Store reusable knowledge with recall_runtime_remember.
2. Store architecture decisions with recall_runtime_decision.
3. Store bug root-cause/fix details with recall_runtime_bug.
4. Mention in handoff whether recallos-runtime was updated.

Documentation boundary:
- Static docs under recallos-runtime document only the recallos-runtime system.
- Project/runtime facts belong in the recallos-runtime DB, not in static docs.
```
