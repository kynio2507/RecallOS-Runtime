import { z } from 'zod';
import {
  memoryWriteEvent,
  memoryUpsertFact,
  memorySearch,
  memoryGetProfile,
  memorySummarizeSession,
  memoryLink,
  memoryStatus,
} from './index.mjs';

export function registerMemoryTools(mcpServer) {
  mcpServer.tool(
    'recall_memory_write_event',
    'Write a raw event to RecallOS Memory (Layer A). Auto-embeds for vector search. Supports multi-agent scoping.',
    {
      content: z.string(),
      actor: z.enum(['user', 'main_agent', 'worker_agent', 'tool', 'system']),
      event_type: z.enum(['message', 'decision', 'task', 'bug', 'fix', 'command', 'observation']),
      session_id: z.string().optional(),
      metadata: z.record(z.any()).optional(),
      embed: z.boolean().optional(),
      workspace_id: z.string().optional(),
      project_id: z.string().optional(),
      agent_id: z.string().optional(),
      task_id: z.string().optional(),
      run_id: z.string().optional(),
    },
    async (args) => ({
      content: [{ type: 'text', text: await memoryWriteEvent(args) }],
    })
  );

  mcpServer.tool(
    'recall_memory_upsert_fact',
    'Upsert a fact in RecallOS Memory (Layer B). Supports expanded scopes for multi-agent.',
    {
      scope: z.enum(['global', 'workspace', 'project', 'agent_private', 'agent_pair', 'task', 'session', 'user', 'repo', 'agent']),
      key: z.string(),
      value: z.string(),
      confidence: z.number().min(0).max(1).optional(),
      source_ids: z.array(z.string()).optional(),
      workspace_id: z.string().optional(),
      project_id: z.string().optional(),
      agent_id: z.string().optional(),
      pair_key: z.string().optional(),
      task_id: z.string().optional(),
      session_id: z.string().optional(),
      run_id: z.string().optional(),
    },
    async (args) => ({
      content: [{ type: 'text', text: await memoryUpsertFact(args) }],
    })
  );

  mcpServer.tool(
    'recall_memory_search',
    'Hybrid search across all Memory layers. Supports agent/task/workspace filtering.',
    {
      query: z.string(),
      scope: z.string().optional(),
      top_k: z.number().optional(),
      layers: z.array(z.enum(['all', 'raw', 'active', 'context'])).optional(),
      event_type: z.string().optional(),
      actor: z.string().optional(),
      agent_id: z.string().optional(),
      task_id: z.string().optional(),
      run_id: z.string().optional(),
      workspace_id: z.string().optional(),
      project_id: z.string().optional(),
      pair_key: z.string().optional(),
    },
    async (args) => ({
      content: [{ type: 'text', text: await memorySearch(args) }],
    })
  );

  mcpServer.tool(
    'recall_memory_get_profile',
    'Get all facts for a scope. Supports agent_id and pair_key filtering.',
    {
      scope: z.enum(['global', 'workspace', 'project', 'agent_private', 'agent_pair', 'task', 'session', 'user', 'repo', 'agent']),
      agent_id: z.string().optional(),
      pair_key: z.string().optional(),
    },
    async (args) => ({
      content: [{ type: 'text', text: await memoryGetProfile(args) }],
    })
  );

  mcpServer.tool(
    'recall_memory_summarize_session',
    'Summarize a session: extract events into structured facts (Layer A → Layer B).',
    {
      session_id: z.string(),
    },
    async (args) => ({
      content: [{ type: 'text', text: await memorySummarizeSession(args) }],
    })
  );

  mcpServer.tool(
    'recall_memory_link',
    'Create a relation link between two memory items.',
    {
      source_id: z.string(),
      target_id: z.string(),
      relation: z.enum(['supports', 'contradicts', 'supersedes', 'derived_from', 'related']),
      metadata: z.record(z.any()).optional(),
    },
    async (args) => ({
      content: [{ type: 'text', text: await memoryLink(args) }],
    })
  );

  mcpServer.tool(
    'recall_memory_status',
    'Show Memory module status: PostgreSQL counts and working memory state.',
    {},
    async () => ({
      content: [{ type: 'text', text: await memoryStatus() }],
    })
  );
}
