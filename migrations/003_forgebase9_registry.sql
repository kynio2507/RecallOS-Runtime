-- ForgeBase9 provider/model registry
CREATE TABLE IF NOT EXISTS llm_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_ciphertext TEXT,
  api_key_masked TEXT,
  api_key_env_var TEXT,
  status TEXT DEFAULT 'active',
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS llm_model_catalog (
  id TEXT PRIMARY KEY,
  provider_id TEXT REFERENCES llm_providers(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  prefix TEXT,
  family TEXT,
  capabilities_json JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_id, model_id)
);

CREATE TABLE IF NOT EXISTS agent_model_assignments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT DEFAULT 'default',
  project_id TEXT DEFAULT 'default',
  agent_id TEXT NOT NULL,
  provider_id TEXT REFERENCES llm_providers(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  purpose TEXT DEFAULT 'primary',
  status TEXT DEFAULT 'active',
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, project_id, agent_id, purpose)
);

CREATE TABLE IF NOT EXISTS llm_provider_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id TEXT REFERENCES llm_providers(id) ON DELETE CASCADE,
  check_type TEXT,
  ok BOOLEAN,
  status_code INT,
  message TEXT,
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
