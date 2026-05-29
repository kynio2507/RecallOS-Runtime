# Multi Agent Provider Registry

RecallOS Runtime owns provider/model configuration for multi-agent work. This lets agents and dashboards resolve model assignments from RecallOS instead of relying on hardcoded ForgeBase9 MCP configuration.

## What it stores

| Table | Purpose |
|---|---|
| `llm_providers` | OpenAI-compatible endpoints, masked key metadata, optional local/env key source |
| `llm_model_catalog` | Provider model IDs, prefixes, families, status, last seen time |
| `agent_model_assignments` | Workspace/project agent role to provider/model mapping |
| `llm_provider_checks` | Provider health check history |

## Dashboard

Page: `/forgebase9`

Sidebar label: **Multi Agent**

Capabilities:

- add provider endpoint
- edit provider and re-enter raw API key
- delete provider, including related models and assignments
- add model manually
- discover `/models` when raw key is available
- assign provider/model to ForgeBase9 agent roles
- direct model test via RecallOS registry

## Direct model test

The test path bypasses ForgeBase9 MCP:

```text
Dashboard
-> POST /api/forgebase9/test
-> llm_providers + llm_model_catalog
-> provider /chat/completions
```

Request shape:

```json
{
  "provider_id": "prov_...",
  "model_id": "ag/claude-opus-4-6-thinking",
  "prompt": "Reply with exactly: RecallOS model test OK"
}
```

If a provider only has `api_key_masked`, direct test cannot run. Click **Edit**, paste raw API key, and click **Update provider**. Alternatively set `api_key_env_var` to an environment variable available to the dashboard process.

## Security

- Raw API keys are never returned by dashboard APIs.
- UI shows masked key or env var name only.
- Local direct keys are stored as `plain:<base64>` for local development unless runtime encryption is enabled.
- Runtime module supports optional AES-GCM encryption with `RECALLOS_SECRET_KEY`.

## Seeded current assignments

| Agent | Model |
|---|---|
| `pm_architecture` | `cx/gpt-5.5` |
| `analyzer` | `gemini/gemini-3-flash-preview` |
| `senior_product_designer` | `ag/claude-sonnet-4-6` |
| `senior_product_coder` | `cmc/deepseek/deepseek-v4-pro` |
| `product_code_reviewer` | `ag/claude-opus-4-6-thinking` |

Provider:

```text
9router -> https://9router.may365.cloud/v1
```

## MCP tools

```text
recall_forge_provider_upsert
recall_forge_provider_list
recall_forge_provider_check
recall_forge_model_upsert
recall_forge_model_list
recall_forge_model_discover
recall_forge_assignment_upsert
recall_forge_assignment_list
recall_forge_assignment_resolve
recall_forge_config_pack
recall_forge_seed_current_config
```
