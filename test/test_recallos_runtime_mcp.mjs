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
  'recall_agent_get',
  'recall_agent_get_conversation',
  'recall_agent_get_messages',
  'recall_agent_handoff',
  'recall_agent_handoff_list',
  'recall_agent_handoff_update',
  'recall_agent_list',
  'recall_agent_register',
  'recall_agent_send_message',
  'recall_codegraph_context',
  'recall_codegraph_impact',
  'recall_codegraph_search',
  'recall_codegraph_status',
  'recall_codegraph_symbol',
  'recall_context_for_agent',
  'recall_context_for_handoff',
  'recall_context_for_pair',
  'recall_context_for_task',
  'recall_context_for_worker',
  'recall_context_pack',
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
  'recall_pair_memory_extract',
  'recall_pair_memory_search',
  'recall_pair_memory_seed_defaults',
  'recall_pair_memory_upsert',
  'recall_project_add_decision',
  'recall_project_context_pack',
  'recall_project_get_doc',
  'recall_project_modules',
  'recall_project_overview',
  'recall_project_roadmap',
  'recall_project_search',
  'recall_project_status',
  'recall_project_upsert_doc',
  'recall_forge_assignment_list',
  'recall_forge_assignment_resolve',
  'recall_forge_assignment_upsert',
  'recall_forge_config_pack',
  'recall_forge_model_discover',
  'recall_forge_model_list',
  'recall_forge_model_upsert',
  'recall_forge_provider_check',
  'recall_forge_provider_list',
  'recall_forge_provider_upsert',
  'recall_forge_seed_current_config',
  'recall_session_import_transcript',
  'recall_session_record',
  'recall_session_record_assistant_action',
  'recall_session_record_build_result',
  'recall_session_record_command_result',
  'recall_session_record_decision',
  'recall_session_record_error',
  'recall_session_record_file_change',
  'recall_session_record_git_event',
  'recall_session_record_project_snapshot',
  'recall_session_record_user_request',
  'recall_session_resume_context',
  'recall_session_summarize',
].sort();
assert(JSON.stringify(toolNames) === JSON.stringify(expectedTools), `tools/list mismatch, got ${JSON.stringify(toolNames)}`);

// KB tests
const kbStatus = byId.get(3)?.result?.content?.[0]?.text || '';
assert(kbStatus.length > 0, 'kb status returned empty');

for (const id of [4, 5, 6, 7]) {
  assert((byId.get(id)?.result?.content?.[0]?.text || '').length > 0, `tool call ${id} returned empty`);
}

// CodeGraph via MCP client — returns result or error (both valid in test env)
const cgResponse = byId.get(8)?.result?.content?.[0]?.text || '';
assert(cgResponse.length > 0, 'codegraph status returned empty');
assert(cgResponse.includes('CodeGraph') || cgResponse.includes('Error'), 'codegraph status unexpected response');

assert(!toolNames.some((name) => name.startsWith(['recall', 'runtime'].join('_') + '_')), 'strict split should not expose aggregate runtime tools');

console.log('PASS RecallOS Runtime MCP tests');
