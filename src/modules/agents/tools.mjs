import { z } from 'zod';
import {
  agentRegister, agentList, agentGet,
  agentSendMessage, agentGetMessages, agentGetConversation,
  agentHandoff, agentHandoffUpdate, agentHandoffList,
} from './index.mjs';

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

  mcpServer.tool(
    'recall_agent_list',
    'List all registered agents, optionally filter by role.',
    { role: z.string().optional() },
    async (args) => ({ content: [{ type: 'text', text: await agentList(args) }] })
  );

  mcpServer.tool(
    'recall_agent_get',
    'Get agent details by ID.',
    { agent_id: z.string() },
    async (args) => ({ content: [{ type: 'text', text: await agentGet(args) }] })
  );

  // --- Messaging ---
  mcpServer.tool(
    'recall_agent_send_message',
    'Send a message between agents. Types: message, request, response, feedback, broadcast.',
    {
      from_agent_id: z.string(),
      to_agent_id: z.string(),
      content: z.string(),
      message_type: z.enum(['message', 'request', 'response', 'feedback', 'broadcast']).optional(),
      summary: z.string().optional(),
      workspace_id: z.string().optional(),
      project_id: z.string().optional(),
      task_id: z.string().optional(),
      run_id: z.string().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await agentSendMessage(args) }] })
  );

  mcpServer.tool(
    'recall_agent_get_messages',
    'Get message history for an agent, task, or run.',
    {
      agent_id: z.string().optional(),
      task_id: z.string().optional(),
      run_id: z.string().optional(),
      message_type: z.string().optional(),
      limit: z.number().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await agentGetMessages(args) }] })
  );

  mcpServer.tool(
    'recall_agent_get_conversation',
    'Get full conversation between two agents, optionally for a task.',
    {
      agent_a: z.string(),
      agent_b: z.string(),
      task_id: z.string().optional(),
      run_id: z.string().optional(),
      limit: z.number().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await agentGetConversation(args) }] })
  );

  // --- Handoffs ---
  mcpServer.tool(
    'recall_agent_handoff',
    'Create a task handoff from one agent to another with payload.',
    {
      from_agent_id: z.string(),
      to_agent_id: z.string(),
      task_title: z.string(),
      task_payload: z.any().optional(),
      project_id: z.string().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await agentHandoff(args) }] })
  );

  mcpServer.tool(
    'recall_agent_handoff_update',
    'Update handoff status and result summary.',
    {
      handoff_id: z.string(),
      status: z.enum(['pending', 'accepted', 'in_progress', 'completed', 'failed', 'cancelled']).optional(),
      result_summary: z.string().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await agentHandoffUpdate(args) }] })
  );

  mcpServer.tool(
    'recall_agent_handoff_list',
    'List handoffs for an agent (incoming/outgoing/both).',
    {
      agent_id: z.string().optional(),
      direction: z.enum(['incoming', 'outgoing', 'both']).optional(),
      status: z.string().optional(),
      project_id: z.string().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await agentHandoffList(args) }] })
  );
}
