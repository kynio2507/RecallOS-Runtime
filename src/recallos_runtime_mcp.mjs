#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SERVER_NAME, SERVER_VERSION } from './runtime/config.mjs';
import { registerCodeGraphTools } from './modules/codegraph/tools.mjs';
import { registerKnowledgeBaseTools } from './modules/knowledge-base/tools.mjs';

const mcpServer = new McpServer(
  { name: SERVER_NAME, version: SERVER_VERSION },
  { capabilities: { tools: {} } }
);

registerCodeGraphTools(mcpServer);
registerKnowledgeBaseTools(mcpServer);

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
