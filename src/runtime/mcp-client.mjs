import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CODEGRAPH_MCP_CMD, CODEGRAPH_MCP_ARGS } from './config.mjs';

const CONNECT_TIMEOUT_MS = parseInt(process.env.RECALLOS_CODEGRAPH_TIMEOUT || '30000', 10);

let _client = null;
let _transport = null;
let _connecting = false;
let _connectFailed = false;

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); }
    );
  });
}

async function getClient() {
  if (_client) return _client;
  if (_connectFailed) throw new Error('CodeGraph MCP client previously failed to connect');
  if (_connecting) {
    await new Promise(r => setTimeout(r, 1000));
    if (_client) return _client;
    throw new Error('CodeGraph MCP client is still connecting');
  }
  _connecting = true;
  try {
    _transport = new StdioClientTransport({
      command: CODEGRAPH_MCP_CMD,
      args: CODEGRAPH_MCP_ARGS,
    });
    _client = new Client(
      { name: 'recallos-codegraph-client', version: '1.0.0' },
      { capabilities: {} }
    );
    await withTimeout(_client.connect(_transport), CONNECT_TIMEOUT_MS, 'CodeGraph MCP connect');
    return _client;
  } catch (error) {
    _client = null;
    _transport = null;
    _connectFailed = true;
    throw error;
  } finally {
    _connecting = false;
  }
}

export async function callCodeGraph(toolName, args) {
  const client = await getClient();
  const result = await withTimeout(
    client.callTool({ name: toolName, arguments: args }),
    CONNECT_TIMEOUT_MS,
    `CodeGraph ${toolName}`
  );
  if (result?.content && Array.isArray(result.content)) {
    return result.content.map(c => c.text || '').join('\n');
  }
  return String(result?.content || result || '');
}

export async function closeCodeGraphClient() {
  if (_client) {
    try { await _client.close(); } catch {}
    _client = null;
    _transport = null;
  }
  _connectFailed = false;
}
