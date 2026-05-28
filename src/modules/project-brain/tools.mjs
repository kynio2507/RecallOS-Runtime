import { z } from 'zod';
import {
  projectOverview,
  projectModules,
  projectGetDoc,
  projectUpsertDoc,
  projectRoadmap,
  projectAddDecision,
  projectSearch,
  projectContextPack,
  projectBrainStatus,
} from './index.mjs';

export function registerProjectBrainTools(mcpServer) {
  mcpServer.tool(
    'recall_project_overview',
    'Get project overview: name, goal, status, modules, stats, current work.',
    { project_id: z.string().optional() },
    async (args) => ({ content: [{ type: 'text', text: await projectOverview(args) }] })
  );

  mcpServer.tool(
    'recall_project_modules',
    'List project modules with status and purpose.',
    {
      project_id: z.string().optional(),
      status: z.enum(['planned', 'active', 'deprecated']).optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await projectModules(args) }] })
  );

  mcpServer.tool(
    'recall_project_get_doc',
    'Get project documentation by title or type.',
    {
      title: z.string().optional(),
      doc_type: z.enum(['overview', 'architecture', 'api', 'guide', 'convention']).optional(),
      project_id: z.string().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await projectGetDoc(args) }] })
  );

  mcpServer.tool(
    'recall_project_upsert_doc',
    'Create or update project documentation. Auto-versions on update.',
    {
      title: z.string(),
      content: z.string(),
      doc_type: z.enum(['overview', 'architecture', 'api', 'guide', 'convention']),
      status: z.enum(['draft', 'active', 'deprecated']).optional(),
      project_id: z.string().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await projectUpsertDoc(args) }] })
  );

  mcpServer.tool(
    'recall_project_roadmap',
    'List project roadmap items. Filter by status and priority.',
    {
      status: z.enum(['planned', 'doing', 'done', 'blocked']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      project_id: z.string().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await projectRoadmap(args) }] })
  );

  mcpServer.tool(
    'recall_project_add_decision',
    'Record an architecture or design decision with reason, alternatives, and impact.',
    {
      title: z.string(),
      decision: z.string(),
      reason: z.string().optional(),
      alternatives: z.string().optional(),
      impact: z.string().optional(),
      status: z.enum(['proposed', 'accepted', 'rejected', 'superseded']).optional(),
      project_id: z.string().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await projectAddDecision(args) }] })
  );

  mcpServer.tool(
    'recall_project_search',
    'Full-text search across all Project Brain tables: docs, decisions, modules, roadmap, glossary.',
    {
      query: z.string(),
      project_id: z.string().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await projectSearch(args) }] })
  );

  mcpServer.tool(
    'recall_project_context_pack',
    'CRITICAL: Assemble full project context for a task. Gathers overview, architecture, modules, related decisions, roadmap, docs, glossary, and optionally memory context into one response.',
    {
      task: z.string(),
      project_id: z.string().optional(),
      include_memory: z.boolean().optional(),
    },
    async (args) => ({ content: [{ type: 'text', text: await projectContextPack(args) }] })
  );

  mcpServer.tool(
    'recall_project_status',
    'Show Project Brain status: table counts for a project.',
    { project_id: z.string().optional() },
    async (args) => ({ content: [{ type: 'text', text: await projectBrainStatus(args) }] })
  );
}
