import { z } from 'zod';
import {
  agentRegister, agentList, agentGet,
  agentSendMessage, agentGetMessages, agentGetConversation,
  agentHandoff, agentHandoffUpdate, agentHandoffList,
  pairMemoryUpsert, pairMemorySearch, pairMemorySeedDefaults, pairMemoryExtract,
} from './index.mjs';

const pairType = z.enum(['protocol', 'constraint', 'preference', 'issue', 'checklist', 'decision', 'summary']);

export function registerAgentTools(mcpServer) {
  // --- Identity ---
  mcpServer.tool(
    'recall_agent_register',
    'Register or update an agent identity (name, role, model, capabilities).',
    {
      id: z.string(),
      name: z.string(),
      role: z.enum(['assistant', 'architect', 'secretary', 'coder', 'designer', 'reviewer', 'tester', 'custom']),
      model_id: z.string().optional(),
      system_prompt: z.string().optional(),
      capabilities: z.array(z.string()).optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await agentRegister(args) }] })
  );

  mcpServer.tool('recall_agent_list', 'List all registered agents, optionally filter by role.', { role: z.string().optional() }, async (args) => ({ content: [{ type: 'text', text: await agentList(args) }] }));
  mcpServer.tool('recall_agent_get', 'Get agent details by ID.', { agent_id: z.string() }, async (args) => ({ content: [{ type: 'text', text: await agentGet(args) }] }));

  // --- Messaging ---
  mcpServer.tool(
    'recall_agent_send_message',
    'Send a message between agents. Types: message, request, response, feedback, broadcast.',
    {
      from_agent_id: z.string(), to_agent_id: z.string(), content: z.string(),
      message_type: z.enum(['message', 'request', 'response', 'feedback', 'broadcast']).optional(),
      summary: z.string().optional(), workspace_id: z.string().optional(), project_id: z.string().optional(), task_id: z.string().optional(), run_id: z.string().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await agentSendMessage(args) }] })
  );

  mcpServer.tool(
    'recall_agent_get_messages',
    'Get message history for an agent, task, or run.',
    { agent_id: z.string().optional(), task_id: z.string().optional(), run_id: z.string().optional(), message_type: z.string().optional(), limit: z.number().optional() },
    async (args) => ({ content: [{ type: 'text', text: await agentGetMessages(args) }] })
  );

  mcpServer.tool(
    'recall_agent_get_conversation',
    'Get full conversation between two agents, optionally for a task.',
    { agent_a: z.string(), agent_b: z.string(), task_id: z.string().optional(), run_id: z.string().optional(), limit: z.number().optional() },
    async (args) => ({ content: [{ type: 'text', text: await agentGetConversation(args) }] })
  );

  // --- Handoffs ---
  mcpServer.tool(
    'recall_agent_handoff',
    'Create a task handoff. Supports old task_payload and standardized ForgeBase9 handoff payload.',
    {
      from_agent_id: z.string().optional(), to_agent_id: z.string().optional(),
      from_agent: z.string().optional(), to_agent: z.string().optional(),
      task_title: z.string().optional(), task_payload: z.any().optional(), project_id: z.string().optional(), workspace_id: z.string().optional(),
      task_type: z.string().optional(), objective: z.string().optional(), required_context: z.array(z.string()).optional(), constraints: z.array(z.string()).optional(), expected_output: z.any().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await agentHandoff(args) }] })
  );

  mcpServer.tool('recall_agent_handoff_update', 'Update handoff status and result summary.', { handoff_id: z.string(), status: z.enum(['pending', 'accepted', 'in_progress', 'completed', 'failed', 'cancelled']).optional(), result_summary: z.string().optional() }, async (args) => ({ content: [{ type: 'text', text: await agentHandoffUpdate(args) }] }));
  mcpServer.tool('recall_agent_handoff_list', 'List handoffs for an agent (incoming/outgoing/both).', { agent_id: z.string().optional(), direction: z.enum(['incoming', 'outgoing', 'both']).optional(), status: z.string().optional(), project_id: z.string().optional() }, async (args) => ({ content: [{ type: 'text', text: await agentHandoffList(args) }] }));

  // --- Pair Memory ---
  mcpServer.tool(
    'recall_pair_memory_upsert',
    'Upsert reusable memory for an agent pair: protocol, constraint, preference, issue, checklist, decision, summary.',
    {
      id: z.string().optional(), workspace_id: z.string().optional(), project_id: z.string().optional(),
      agent_a: z.string(), agent_b: z.string(), type: pairType,
      title: z.string().optional(), content: z.string(), importance: z.number().optional(), status: z.string().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await pairMemoryUpsert(args) }] })
  );

  mcpServer.tool(
    'recall_pair_memory_search',
    'Search pair memory by pair, type, status, and query.',
    {
      workspace_id: z.string().optional(), project_id: z.string().optional(),
      agent_a: z.string().optional(), agent_b: z.string().optional(), pair_key: z.string().optional(),
      type: pairType.optional(), status: z.string().optional(), query: z.string().optional(), limit: z.number().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await pairMemorySearch(args) }] })
  );

  mcpServer.tool(
    'recall_pair_memory_seed_defaults',
    'Seed default pair memories for assistant↔pm, pm↔analyzer/designer/coder, coder↔reviewer.',
    { workspace_id: z.string().optional(), project_id: z.string().optional() },
    async (args) => ({ content: [{ type: 'text', text: await pairMemorySeedDefaults(args) }] })
  );

  mcpServer.tool(
    'recall_pair_memory_extract',
    'Deterministically extract candidate pair memories from an agent response. Dry-run by default.',
    { workspace_id: z.string().optional(), project_id: z.string().optional(), agent_a: z.string(), agent_b: z.string(), agent_response: z.string(), dry_run: z.boolean().optional() },
    async (args) => ({ content: [{ type: 'text', text: await pairMemoryExtract(args) }] })
  );
}
