import { z } from 'zod';
import { contextPack, contextForTask, contextForWorker, contextForAgent, contextForHandoff, contextForPair } from './index.mjs';

export function registerContextOrchestratorTools(mcpServer) {
  mcpServer.tool(
    'recall_context_pack',
    'Full Agent Context: assembles context from ALL modules (Project Brain + Memory + KB + CodeGraph). Use as FIRST call before starting work.',
    {
      task: z.string(),
      project_id: z.string().optional(),
      symbols: z.array(z.string()).optional(),
      depth: z.enum(['full', 'summary', 'minimal']).optional(),
      workspace_id: z.string().optional(),
      agent_id: z.string().optional(),
      from_agent_id: z.string().optional(),
      pair_agents: z.array(z.union([z.string(), z.array(z.string())])).optional(),
      include_pair_memory: z.boolean().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await contextPack(args) }] })
  );

  mcpServer.tool(
    'recall_context_for_task',
    'Focused Task Context: related decisions, roadmap, bugs, code. Skips overview/architecture.',
    {
      task: z.string(),
      project_id: z.string().optional(),
      symbols: z.array(z.string()).optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await contextForTask(args) }] })
  );

  mcpServer.tool(
    'recall_context_for_worker',
    'Minimal Worker Context: modules, conventions, rules, preferences. Token-efficient for sub-agents.',
    {
      task: z.string(),
      project_id: z.string().optional(),
      symbols: z.array(z.string()).optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await contextForWorker(args) }] })
  );

  mcpServer.tool(
    'recall_context_for_agent',
    'Agent-specific Context: agent identity, private memory, recent messages, project brain, KB, CodeGraph, constraints.',
    {
      agent_id: z.string(),
      task: z.string(),
      project_id: z.string().optional(),
      symbols: z.array(z.string()).optional(),
      workspace_id: z.string().optional(),
      from_agent_id: z.string().optional(),
      pair_agents: z.array(z.union([z.string(), z.array(z.string())])).optional(),
      include_pair_memory: z.boolean().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await contextForAgent(args) }] })
  );

  mcpServer.tool(
    'recall_context_for_handoff',
    'Handoff Context: handoff details, sender work, task chain history, related decisions.',
    {
      handoff_id: z.string(),
      project_id: z.string().optional(),
      task: z.string().optional(),
      workspace_id: z.string().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await contextForHandoff(args) }] })
  );

  mcpServer.tool(
    'recall_context_for_pair',
    'Pair Context: both agent identities, conversation history, pair memory, shared project context.',
    {
      agent_a: z.string(),
      agent_b: z.string(),
      task: z.string().optional(),
      project_id: z.string().optional(),
      workspace_id: z.string().optional(),
      limit: z.number().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await contextForPair(args) }] })
  );
}
