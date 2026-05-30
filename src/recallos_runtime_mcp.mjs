#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SERVER_NAME, SERVER_VERSION } from './runtime/config.mjs';
import { registerCodeGraphTools } from './modules/codegraph/tools.mjs';
import { registerKnowledgeBaseTools } from './modules/knowledge-base/tools.mjs';
import { registerMemoryTools } from './modules/memory/tools.mjs';
import { registerProjectBrainTools } from './modules/project-brain/tools.mjs';
import { registerContextOrchestratorTools } from './modules/context-orchestrator/tools.mjs';
import { registerAgentTools } from './modules/agents/tools.mjs';
import { registerSessionRecorderTools } from './modules/session-recorder/tools.mjs';
import { registerForgeBase9ConfigTools } from './modules/forgebase9-config/tools.mjs';
import { registerMemoryCaptureTools } from './modules/memory-capture/tools.mjs';
import { registerWorkflowStateTools } from './modules/workflow-state/tools.mjs';

const mcpServer = new McpServer(
  { name: SERVER_NAME, version: SERVER_VERSION },
  { capabilities: { tools: {} } }
);

registerCodeGraphTools(mcpServer);
registerKnowledgeBaseTools(mcpServer);
registerMemoryTools(mcpServer);
registerProjectBrainTools(mcpServer);
registerContextOrchestratorTools(mcpServer);
registerAgentTools(mcpServer);
registerSessionRecorderTools(mcpServer);
registerForgeBase9ConfigTools(mcpServer);
registerMemoryCaptureTools(mcpServer);
registerWorkflowStateTools(mcpServer);

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
