import { z } from 'zod';
import { withDb, logEvent } from '../../runtime/db.mjs';
import {
  getCodeGraphContext,
  getCodeGraphImpact,
  getCodeGraphStatus,
  getCodeGraphSymbol,
  searchCodeGraph,
} from './index.mjs';

export function registerCodeGraphTools(mcpServer) {
  mcpServer.tool(
    'recall_codegraph_status',
    'Show CodeGraph module status for the configured project.',
    {},
    async () => ({
      content: [{ type: 'text', text: withDb((database) => {
        logEvent(database, 'info', 'tool_call', 'recall_codegraph_status');
        return `# CodeGraph Module Status\n\n${getCodeGraphStatus(database)}`;
      }) }],
    })
  );

  mcpServer.tool(
    'recall_codegraph_search',
    'Search CodeGraph for a symbol or query.',
    { query: z.string() },
    async (args) => ({
      content: [{ type: 'text', text: withDb((database) => {
        logEvent(database, 'info', 'tool_call', `recall_codegraph_search: ${args.query}`);
        return searchCodeGraph(args.query, database);
      }) }],
    })
  );

  mcpServer.tool(
    'recall_codegraph_context',
    'Get CodeGraph context for a question or task.',
    { question: z.string() },
    async (args) => ({
      content: [{ type: 'text', text: withDb((database) => {
        logEvent(database, 'info', 'tool_call', `recall_codegraph_context: ${args.question}`);
        return getCodeGraphContext(args.question, database);
      }) }],
    })
  );

  mcpServer.tool(
    'recall_codegraph_symbol',
    'Analyze a symbol using CodeGraph search, context, and optional impact.',
    { symbol: z.string(), includeImpact: z.boolean().optional() },
    async (args) => ({
      content: [{ type: 'text', text: withDb((database) => {
        logEvent(database, 'info', 'tool_call', `recall_codegraph_symbol: ${args.symbol}`);
        return getCodeGraphSymbol(args.symbol, database, args.includeImpact !== false);
      }) }],
    })
  );

  mcpServer.tool(
    'recall_codegraph_impact',
    'Find affected files/tests for a symbol or path using CodeGraph.',
    { target: z.string() },
    async (args) => ({
      content: [{ type: 'text', text: withDb((database) => {
        logEvent(database, 'info', 'tool_call', `recall_codegraph_impact: ${args.target}`);
        return getCodeGraphImpact(args.target, database);
      }) }],
    })
  );
}
