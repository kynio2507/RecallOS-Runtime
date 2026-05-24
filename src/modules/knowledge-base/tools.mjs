import { z } from 'zod';
import { withDb, logEvent } from '../../runtime/db.mjs';
import { getKnowledgeStatus, queryKnowledgeBase, rememberKnowledge } from './index.mjs';

export function registerKnowledgeBaseTools(mcpServer) {
  mcpServer.tool(
    'recall_kb_status',
    'Show Knowledge Base module status, DB counts, metadata, and recent errors.',
    {},
    async () => ({
      content: [{ type: 'text', text: withDb((database) => {
        logEvent(database, 'info', 'tool_call', 'recall_kb_status');
        return getKnowledgeStatus(database);
      }) }],
    })
  );

  mcpServer.tool(
    'recall_kb_query',
    'Query RecallOS Knowledge Base entries by question, symbols, type, and tags.',
    {
      question: z.string(),
      symbols: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      type: z.string().optional(),
      mode: z.string().optional(),
      limit: z.number().optional(),
    },
    async (args) => ({
      content: [{ type: 'text', text: withDb((database) => queryKnowledgeBase(database, args)) }],
    })
  );

  mcpServer.tool(
    'recall_kb_remember',
    'Store a reusable Knowledge Base note, rule, or memory item.',
    {
      id: z.string().optional(),
      type: z.string(),
      title: z.string(),
      content: z.string(),
      symbols: z.array(z.string()).optional(),
      files: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    },
    async (args) => ({
      content: [{ type: 'text', text: withDb((database) => rememberKnowledge(database, args)) }],
    })
  );

  mcpServer.tool(
    'recall_kb_decision',
    'Store an architecture decision in the Knowledge Base.',
    {
      id: z.string().optional(),
      title: z.string(),
      decision: z.string(),
      reason: z.string().optional(),
      symbols: z.array(z.string()).optional(),
      files: z.array(z.string()).optional(),
    },
    async (args) => ({
      content: [{
        type: 'text',
        text: withDb((database) => rememberKnowledge(database, {
          id: args.id,
          type: 'decision',
          title: args.title,
          content: `Decision: ${args.decision}\n\nReason: ${args.reason || ''}`,
          symbols: args.symbols,
          files: args.files,
          tags: ['architecture', 'decision'],
        })),
      }],
    })
  );

  mcpServer.tool(
    'recall_kb_bug',
    'Store a known bug, root cause, and fix in the Knowledge Base.',
    {
      id: z.string().optional(),
      title: z.string(),
      rootCause: z.string(),
      fix: z.string(),
      symbols: z.array(z.string()).optional(),
      files: z.array(z.string()).optional(),
    },
    async (args) => ({
      content: [{
        type: 'text',
        text: withDb((database) => rememberKnowledge(database, {
          id: args.id,
          type: 'bug',
          title: args.title,
          content: `Root cause: ${args.rootCause}\n\nFix: ${args.fix}`,
          symbols: args.symbols,
          files: args.files,
          tags: ['bug', 'fix'],
        })),
      }],
    })
  );
}
