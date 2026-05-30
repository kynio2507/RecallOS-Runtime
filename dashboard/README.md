# RecallOS Runtime Dashboard

Next.js dashboard for observing and operating RecallOS Runtime.

## Purpose

The dashboard is the visual command center for:

- 4-layer memory
- multi-agent memory and workflows
- Project Brain
- Knowledge Base
- CodeGraph status/search
- Context Pack Composer
- Multi Agent provider/model registry
- direct provider/model tests through RecallOS

## Local Development

Run from this directory:

```powershell
npm install
npm run dev
```

Default local URL:

```text
http://localhost:3303
```

Production build check:

```powershell
npm run build
```

## Data Sources

| Source | Used for |
|---|---|
| PostgreSQL | Memory, Project Brain, Agents, Pair Memory, Multi Agent registry |
| SQLite | Knowledge Base + FTS5 |
| CodeGraph MCP | code intelligence and symbol context |
| Runtime APIs | context pack generation, memory search, workflow views |

PostgreSQL defaults:

```text
host=localhost
port=5432
user=recallos
password=recallos
database=recallos_memory
```

## Pages

| Route | Label | Purpose |
|---|---|---|
| `/` | Overview | Runtime module cards and counts |
| `/memory` | Memory | 4-layer memory, multi-agent memory, search |
| `/project-brain` | Project Brain | Project truth docs/modules/roadmap/decisions |
| `/knowledge-base` | Knowledge Base | KB notes/rules/bugs/decisions |
| `/codegraph` | CodeGraph | Code intelligence status/search |
| `/context-pack` | Context Pack | Context Pack Composer and generated markdown |
| `/forgebase9` | Multi Agent | Provider/model registry, assignments, direct model test |

## Multi Agent Direct Model Test

The direct test path bypasses ForgeBase9 MCP:

```text
Dashboard
-> POST /api/forgebase9/test
-> RecallOS provider registry
-> provider /chat/completions
```

If provider only has masked key, direct test fails with:

```text
Provider has no raw API key available.
```

Fix:

1. Open `Multi Agent`.
2. Click `Edit` on provider.
3. Paste raw API key or set `api_key_env_var`.
4. Click `Update provider`.
5. Run `Test model` again.

Raw API keys are never returned by dashboard APIs.

## API Routes

| Route | Purpose |
|---|---|
| `/api/overview` | dashboard module overview |
| `/api/memory` | memory counts/search views |
| `/api/pair-memory` | pair memory views |
| `/api/workflows` | workflow and handoff data |
| `/api/project-brain` | Project Brain data |
| `/api/kb` | Knowledge Base data |
| `/api/codegraph` | CodeGraph status/search |
| `/api/context-pack` | generated context markdown |
| `/api/forgebase9` | Multi Agent config pack/seed |
| `/api/forgebase9/providers` | provider CRUD-ish actions |
| `/api/forgebase9/models` | model catalog actions |
| `/api/forgebase9/assignments` | agent model assignments |
| `/api/forgebase9/test` | direct provider/model chat completion test |

## Known Gotchas

- Monaco editor previously hung at `Loading...` in production/Turbopack. Context Pack output uses a plain `<pre>` block instead.
- Turbopack root must stay dashboard-local. Dashboard APIs should use `dashboard/lib/db` instead of importing runtime modules outside the Next root.
- Restart dev server after adding new routes; route tree can stay cached.
