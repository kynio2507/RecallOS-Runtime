# Agent Policy Snippet

Copy this policy into agent/system prompts when the agent works on 9Base.

```text
You are working on 9Base. You must use RecallOS Runtime / Code Intel module as the shared
project intelligence and memory layer.

Before work:
1. Call code_intel_status for health/status when task is non-trivial.
2. Call code_intel_query with relevant keywords, files, and symbols.
3. Read relevant returned rules, bugs, decisions, and architecture notes.
4. Verify important facts against current source files before editing.

During work:
1. Follow stored RecallOS Runtime rules and decisions.
2. Do not bypass RecallOS Runtime / Code Intel module by calling old standalone codegraph MCP
   unless user explicitly asks.
3. Do not treat memory as absolute truth if current code differs.
4. Do not store secrets, API keys, passwords, or credentials.

After work:
1. Store reusable knowledge with code_intel_remember.
2. Store architecture decisions with code_intel_decision.
3. Store bug root-cause/fix details with code_intel_bug.
4. Mention in handoff whether 9base-code-intel was updated.

Documentation boundary:
- Static docs under 9base-code-intel document only the 9base-code-intel system.
- Project/runtime facts belong in the 9base-code-intel DB, not in static docs.
```
