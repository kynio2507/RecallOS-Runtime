#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER = path.resolve(__dirname, '../src/recallos_runtime_mcp.mjs');

function callMcp(requests, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        RECALLOS_CODEGRAPH_TIMEOUT: '3000',
        RECALLOS_CODEGRAPH_MCP_CMD: process.execPath,
        RECALLOS_CODEGRAPH_MCP_ARGS: '-e,process.exit(1)',
      },
    });
    const responses = [];
    let stderr = '';
    let buf = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Timed out after ${timeoutMs}ms\nstderr: ${stderr}\nresponses: ${JSON.stringify(responses)}`));
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      buf += data.toString();
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try { responses.push(JSON.parse(line)); } catch {}
      }
    });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('close', () => {
      clearTimeout(timer);
      resolve({ responses, stderr });
    });

    for (const request of requests) child.stdin.write(JSON.stringify(request) + '\n');
    setTimeout(() => child.stdin.end(), 4000);
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const testId = `test-${Date.now()}`;
const requests = [
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } } },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'recall_kb_status', arguments: {} } },
  { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'recall_kb_remember', arguments: { id: `${testId}-note`, type: 'note', title: 'MCP test note', content: `MCP test content ${testId}`, symbols: ['McpTestSymbol'], files: ['test/file.ts'], tags: ['test'] } } },
  { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'recall_kb_decision', arguments: { id: `${testId}-decision`, title: 'MCP test decision', decision: `Decision content ${testId}`, reason: 'Test coverage', symbols: ['McpDecisionSymbol'], files: ['test/decision.ts'] } } },
  { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'recall_kb_bug', arguments: { id: `${testId}-bug`, title: 'MCP test bug', rootCause: `Root cause ${testId}`, fix: 'Fix coverage', symbols: ['McpBugSymbol'], files: ['test/bug.ts'] } } },
  { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'recall_kb_query', arguments: { question: testId, symbols: ['McpTestSymbol'], mode: 'debug' } } },
  { jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'recall_codegraph_status', arguments: {} } },
];

const { responses, stderr } = await callMcp(requests);
const byId = new Map(responses.filter((r) => r.id !== undefined).map((r) => [r.id, r]));

assert(byId.get(1)?.result?.serverInfo?.name === 'recallos-runtime', `initialize failed, got: ${JSON.stringify(byId.get(1))}`);
assert(byId.get(1)?.result?.serverInfo?.version === '1.0.0-local', 'wrong server version');
const toolNames = byId.get(2)?.result?.tools?.map((tool) => tool.name).sort() || [];
const expectedTools = [
  'recall_codegraph_context',
  'recall_codegraph_impact',
  'recall_codegraph_search',
  'recall_codegraph_status',
  'recall_codegraph_symbol',
  'recall_kb_bug',
  'recall_kb_decision',
  'recall_kb_query',
  'recall_kb_remember',
  'recall_kb_status',
  'recall_memory_get_profile',
  'recall_memory_link',
  'recall_memory_search',
  'recall_memory_status',
  'recall_memory_summarize_session',
  'recall_memory_upsert_fact',
  'recall_memory_write_event',
  'recall_project_add_decision',
  'recall_project_context_pack',
  'recall_project_get_doc',
  'recall_project_modules',
  'recall_project_overview',
  'recall_project_roadmap',
  'recall_project_search',
  'recall_project_status',
  'recall_project_upsert_doc',
].sort();
assert(JSON.stringify(toolNames) === JSON.stringify(expectedTools), `tools/list mismatch, got ${JSON.stringify(toolNames)}`);

// KB tests
assert(byId.get(3)?.result?.content?.[0]?.text?.includes('Knowledge Base Module Status'), 'kb status missing heading');
assert(byId.get(3)?.result?.content?.[0]?.text?.includes('better-sqlite3'), 'kb status missing better-sqlite3');
assert(byId.get(3)?.result?.content?.[0]?.text?.includes('FTS5'), 'kb status missing FTS5 indicator');
assert(byId.get(3)?.result?.content?.[0]?.text?.includes('Migrations'), 'kb status missing migrations');
assert(byId.get(4)?.result?.content?.[0]?.text?.includes(`${testId}-note`), 'remember failed');
assert(byId.get(5)?.result?.content?.[0]?.text?.includes(`${testId}-decision`), 'decision failed');
assert(byId.get(6)?.result?.content?.[0]?.text?.includes(`${testId}-bug`), 'bug failed');
assert(byId.get(7)?.result?.content?.[0]?.text?.includes(testId), 'query missing inserted test knowledge');

// CodeGraph via MCP client — returns result or error (both valid in test env)
const cgResponse = byId.get(8)?.result?.content?.[0]?.text || '';
assert(cgResponse.length > 0, 'codegraph status returned empty');
assert(cgResponse.includes('CodeGraph') || cgResponse.includes('Error'), 'codegraph status unexpected response');

assert(!toolNames.some((name) => name.startsWith(['recall', 'runtime'].join('_') + '_')), 'strict split should not expose aggregate runtime tools');

console.log('PASS RecallOS Runtime MCP tests');
