import { z } from 'zod';
import { withDb, logEvent } from '../../runtime/db.mjs';
import {
  getCodeGraphContext,
  getCodeGraphImpact,
  getCodeGraphStatus,
  getCodeGraphSymbol,
  searchCodeGraph,
} from './index.mjs';

function log(event, detail) {
  try { withDb((db) => logEvent(db, 'info', 'tool_call', `${event}: ${detail}`)); } catch {}
}

export function registerCodeGraphTools(mcpServer) {
  mcpServer.tool(
    'recall_codegraph_status',
    'Show CodeGraph module status for the configured project.',
    {},
    async () => {
      log('recall_codegraph_status', '');
      const text = await getCodeGraphStatus();
      return { content: [{ type: 'text', text: `# CodeGraph Module Status\n\n${text}` }] };
    }
  );

  mcpServer.tool(
    'recall_codegraph_search',
    'Search CodeGraph for a symbol or query.',
    { query: z.string() },
    async (args) => {
      log('recall_codegraph_search', args.query);
      const text = await searchCodeGraph(args.query);
      return { content: [{ type: 'text', text }] };
    }
  );

  mcpServer.tool(
    'recall_codegraph_context',
    'Get CodeGraph context for a question or task.',
    { question: z.string() },
    async (args) => {
      log('recall_codegraph_context', args.question);
      const text = await getCodeGraphContext(args.question);
      return { content: [{ type: 'text', text }] };
    }
  );

  mcpServer.tool(
    'recall_codegraph_symbol',
    'Analyze a symbol using CodeGraph search, context, and optional impact.',
    { symbol: z.string(), includeImpact: z.boolean().optional() },
    async (args) => {
      log('recall_codegraph_symbol', args.symbol);
      const text = await getCodeGraphSymbol(args.symbol, null, args.includeImpact !== false);
      return { content: [{ type: 'text', text }] };
    }
  );

  mcpServer.tool(
    'recall_codegraph_impact',
    'Find affected files/tests for a symbol or path using CodeGraph.',
    { target: z.string() },
    async (args) => {
      log('recall_codegraph_impact', args.target);
      const text = await getCodeGraphImpact(args.target);
      return { content: [{ type: 'text', text }] };
    }
  );
}
