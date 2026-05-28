#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SERVER_NAME, SERVER_VERSION } from '../runtime/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MCP_ENTRYPOINT = path.resolve(__dirname, '..', 'recallos_runtime_mcp.mjs');

const CODEGRAPH_TOOLS = [
  ['recall_codegraph_status', 'Check CodeGraph status for the configured project'],
  ['recall_codegraph_search', 'Search symbols/code with CodeGraph'],
  ['recall_codegraph_context', 'Get code context for a task or question'],
  ['recall_codegraph_symbol', 'Analyze a symbol with search, context, and impact'],
  ['recall_codegraph_impact', 'Find affected files/tests for a target'],
];

const KB_TOOLS = [
  ['recall_kb_status', 'Check DB metadata, counts, and recent errors'],
  ['recall_kb_query', 'Query stored knowledge by question, symbols, type, and tags'],
  ['recall_kb_remember', 'Store reusable knowledge notes or rules'],
  ['recall_kb_decision', 'Store architecture decisions'],
  ['recall_kb_bug', 'Store bug root cause and fix history'],
];

const MEMORY_TOOLS = [
  ['recall_memory_status', 'Show PostgreSQL counts and working memory state'],
  ['recall_memory_write_event', 'Write raw event to memory_events'],
  ['recall_memory_upsert_fact', 'Upsert active fact to memory_facts'],
  ['recall_memory_search', 'Hybrid search across SQL and vector layers'],
  ['recall_memory_get_profile', 'Get facts for a scope'],
  ['recall_memory_summarize_session', 'Summarize session events into facts'],
  ['recall_memory_link', 'Link two memory items by relation'],
];

const PROJECT_BRAIN_TOOLS = [
  ['recall_project_overview', 'Get project overview: name, modules, stats'],
  ['recall_project_modules', 'List project modules with status and purpose'],
  ['recall_project_get_doc', 'Get project doc by title or type'],
  ['recall_project_upsert_doc', 'Create or update project documentation'],
  ['recall_project_roadmap', 'List roadmap items by status/priority'],
  ['recall_project_add_decision', 'Record architecture/design decision'],
  ['recall_project_search', 'Search across all Project Brain tables'],
  ['recall_project_context_pack', 'CRITICAL: Assemble full context for a task'],
  ['recall_project_status', 'Show Project Brain table counts'],
];

const CONTEXT_TOOLS = [
  ['recall_context_pack', 'Full Agent Context: all 4 modules assembled'],
  ['recall_context_for_task', 'Focused Task Context: related only'],
  ['recall_context_for_worker', 'Minimal Worker Context: for sub-agents'],
];

function printRows(rows) {
  const width = Math.max(...rows.map(([name]) => name.length));
  for (const [name, description] of rows) {
    console.log(`  ${name.padEnd(width)}  ${description}`);
  }
}

function printHelp() {
  console.log(`RecallOS Runtime ${SERVER_VERSION}
Operating system for AI software teams.

Usage:
  recall <command> [options]

Commands:
  --help, help          Show this help
  version              Print version
  modules              List runtime modules
  codegraph --help     Show CodeGraph module tools
  kb --help            Show Knowledge Base module tools
  memory --help        Show Memory module tools
  project --help       Show Project Brain module tools
  context --help       Show Context Orchestrator tools
  mcp                  Start MCP stdio server

Examples:
  recall --help
  recall modules
  recall codegraph --help
  recall kb --help
  recall memory --help
  recall project --help
  recall context --help
  recall mcp
`);
}

function printVersion() {
  console.log(`${SERVER_NAME} ${SERVER_VERSION}`);
}

function printModules() {
  console.log(`RecallOS Runtime modules\n\n  CodeGraph            Source graph, code context, symbol analysis, impact analysis\n  Knowledge Base       Persistent SQLite knowledge, decisions, bugs, and rules\n  Memory               4-layer agent memory: raw events, active facts, vector context, working state\n  Project Brain        Project knowledge: docs, modules, roadmap, decisions, glossary\n  Context Orchestrator Top-level context assembly across all modules`);
}

function printCodeGraphHelp() {
  console.log('CodeGraph Module\n\nMCP tools:');
  printRows(CODEGRAPH_TOOLS);
  console.log('\nUsage examples:\n  recall codegraph --help\n  recall mcp   # expose tools to MCP clients');
}

function printKbHelp() {
  console.log('Knowledge Base Module\n\nMCP tools:');
  printRows(KB_TOOLS);
  console.log('\nUsage examples:\n  recall kb --help\n  recall mcp   # expose tools to MCP clients');
}

function printMemoryHelp() {
  console.log('Memory Module\n\n4-layer agent memory: PostgreSQL raw events, active facts, pgvector context index, and in-process working memory.\n\nMCP tools:');
  printRows(MEMORY_TOOLS);
  console.log('\nUsage examples:\n  recall memory --help\n  recall mcp   # expose tools to MCP clients');
}

function printProjectBrainHelp() {
  console.log('Project Brain Module\n\nProject knowledge base: docs, modules, roadmap, decisions, glossary.\nrecall_project_context_pack = Project Truth Context (Brain data only).\n\nMCP tools:');
  printRows(PROJECT_BRAIN_TOOLS);
  console.log('\nUsage examples:\n  recall project --help\n  recall mcp   # expose tools to MCP clients');
}

function printContextHelp() {
  console.log('Context Orchestrator Module\n\nTop-level context assembly across all 4 modules.\nrecall_context_pack = Full Agent Context (Brain + Memory + KB + CodeGraph).\n\nMCP tools:');
  printRows(CONTEXT_TOOLS);
  console.log('\nUsage examples:\n  recall context --help\n  recall mcp   # expose tools to MCP clients');
}

function startMcp() {
  const child = spawn(process.execPath, [MCP_ENTRYPOINT], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
}

const args = process.argv.slice(2);
const command = args[0] || '--help';

switch (command) {
  case '--help':
  case '-h':
  case 'help':
    printHelp();
    break;
  case '--version':
  case '-v':
  case 'version':
    printVersion();
    break;
  case 'modules':
    printModules();
    break;
  case 'codegraph':
    if (args.includes('--help') || args.includes('-h') || args.length === 1) printCodeGraphHelp();
    else {
      console.error('Unknown codegraph command. Try: recall codegraph --help');
      process.exit(1);
    }
    break;
  case 'kb':
  case 'knowledge':
    if (args.includes('--help') || args.includes('-h') || args.length === 1) printKbHelp();
    else {
      console.error('Unknown Knowledge Base command. Try: recall kb --help');
      process.exit(1);
    }
    break;
  case 'memory':
    if (args.includes('--help') || args.includes('-h') || args.length === 1) printMemoryHelp();
    else {
      console.error('Unknown Memory command. Try: recall memory --help');
      process.exit(1);
    }
    break;
  case 'project':
  case 'brain':
    if (args.includes('--help') || args.includes('-h') || args.length === 1) printProjectBrainHelp();
    else {
      console.error('Unknown Project Brain command. Try: recall project --help');
      process.exit(1);
    }
    break;
  case 'context':
  case 'orchestrator':
    if (args.includes('--help') || args.includes('-h') || args.length === 1) printContextHelp();
    else {
      console.error('Unknown Context Orchestrator command. Try: recall context --help');
      process.exit(1);
    }
    break;
  case 'mcp':
    startMcp();
    break;
  default:
    console.error(`Unknown command: ${command}\nTry: recall --help`);
    process.exit(1);
}
