import { z } from 'zod';
import {
  providerUpsert, providerList, providerCheck,
  modelUpsert, modelList, modelDiscover,
  assignmentUpsert, assignmentList, assignmentResolve,
  forgebase9ConfigPack, seedCurrentForgebase9Config,
} from './index.mjs';

const text = (label, result) => ({ content: [{ type: 'text', text: typeof result === 'string' ? result : `# ${label}\n\n${JSON.stringify(result, null, 2)}` }] });

export function registerForgeBase9ConfigTools(server) {
  server.tool('recall_forge_provider_upsert', 'Create/update ForgeBase9 LLM endpoint/provider. API key is stored masked/encrypted/local-only and never returned raw.', {
    id: z.string().optional(), name: z.string(), base_url: z.string(), api_key: z.string().optional(), api_key_env_var: z.string().optional(), status: z.string().optional(), metadata: z.record(z.any()).optional(), workspace_id: z.string().optional(), project_id: z.string().optional()
  }, async (args) => text('Forge Provider Upsert', await providerUpsert(args)));

  server.tool('recall_forge_provider_list', 'List configured ForgeBase9 providers with masked key status.', {}, async () => text('Forge Providers', await providerList({})));

  server.tool('recall_forge_provider_check', 'Check provider /models endpoint reachability.', { provider_id: z.string() }, async (args) => text('Forge Provider Check', await providerCheck(args)));

  server.tool('recall_forge_model_upsert', 'Add/update model ID for a provider.', {
    provider_id: z.string(), model_id: z.string(), prefix: z.string().optional(), family: z.string().optional(), capabilities: z.record(z.any()).optional(), status: z.string().optional()
  }, async (args) => text('Forge Model Upsert', await modelUpsert(args)));

  server.tool('recall_forge_model_list', 'List model catalog entries.', { provider_id: z.string().optional() }, async (args) => text('Forge Models', await modelList(args)));

  server.tool('recall_forge_model_discover', 'Discover OpenAI-compatible /models catalog for provider.', { provider_id: z.string() }, async (args) => text('Forge Model Discovery', await modelDiscover(args)));

  server.tool('recall_forge_assignment_upsert', 'Assign provider/model to a multi-agent role.', {
    workspace_id: z.string().optional(), project_id: z.string().optional(), agent_id: z.string(), provider_id: z.string(), model_id: z.string(), purpose: z.string().optional(), status: z.string().optional(), metadata: z.record(z.any()).optional()
  }, async (args) => text('Forge Assignment Upsert', await assignmentUpsert(args)));

  server.tool('recall_forge_assignment_list', 'List ForgeBase9 model assignments.', { workspace_id: z.string().optional(), project_id: z.string().optional() }, async (args) => text('Forge Assignments', await assignmentList(args)));

  server.tool('recall_forge_assignment_resolve', 'Resolve active provider/model for an agent.', { workspace_id: z.string().optional(), project_id: z.string().optional(), agent_id: z.string(), purpose: z.string().optional() }, async (args) => text('Forge Assignment Resolve', await assignmentResolve(args)));

  server.tool('recall_forge_config_pack', 'Return providers, models, assignments, and default ForgeBase9 agents.', { workspace_id: z.string().optional(), project_id: z.string().optional() }, async (args) => text('ForgeBase9 Config Pack', await forgebase9ConfigPack(args)));

  server.tool('recall_forge_seed_current_config', 'Seed current 9router ForgeBase9 provider, models, and agent assignments.', { api_key: z.string().optional(), api_key_masked: z.string().optional() }, async (args) => text('ForgeBase9 Seed', await seedCurrentForgebase9Config(args)));
}
