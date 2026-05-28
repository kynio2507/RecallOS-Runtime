import { z } from 'zod';
import { contextPack, contextForTask, contextForWorker } from './index.mjs';

export function registerContextOrchestratorTools(mcpServer) {
  mcpServer.tool(
    'recall_context_pack',
    'Full Agent Context: assembles context from ALL modules (Project Brain + Memory + Knowledge Base + CodeGraph) for a task. Use this as the FIRST call before starting any meaningful work.',
    {
      task: z.string(),
      project_id: z.string().optional(),
      symbols: z.array(z.string()).optional(),
      depth: z.enum(['full', 'summary', 'minimal']).optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await contextPack(args) }] })
  );

  mcpServer.tool(
    'recall_context_for_task',
    'Focused Task Context: gathers only task-related context (decisions, roadmap, bugs, code). Skips overview/architecture. Use when you already know the project and need context for a specific task.',
    {
      task: z.string(),
      project_id: z.string().optional(),
      symbols: z.array(z.string()).optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await contextForTask(args) }] })
  );

  mcpServer.tool(
    'recall_context_for_worker',
    'Minimal Worker Context: provides only modules, conventions, user preferences, and rules. Token-efficient for sub-agents. No CodeGraph — worker calls directly if needed.',
    {
      task: z.string(),
      project_id: z.string().optional(),
      symbols: z.array(z.string()).optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await contextForWorker(args) }] })
  );
}
