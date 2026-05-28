import { PROJECT_PATH } from '../../runtime/config.mjs';
import { logEvent } from '../../runtime/db.mjs';
import { truncate } from '../../runtime/utils.mjs';
import { callCodeGraph } from '../../runtime/mcp-client.mjs';

async function safeCall(toolName, args, database = null) {
  try {
    const out = await callCodeGraph(toolName, args);
    if (database) logEvent(database, 'info', 'codegraph_call', `${toolName} ${JSON.stringify(args)}`);
    return truncate(out);
  } catch (error) {
    const msg = error?.message || String(error);
    if (database) logEvent(database, 'error', 'codegraph_error', `${toolName} ${JSON.stringify(args)}\n${msg}`);
    return `[CodeGraph Error]\n${truncate(msg, 6000)}`;
  }
}

export async function getCodeGraphStatus(database = null) {
  return safeCall('codegraph_status', {}, database);
}

export async function searchCodeGraph(query, database = null) {
  return safeCall('codegraph_search', { query, projectPath: PROJECT_PATH }, database);
}

export async function getCodeGraphContext(question, database = null) {
  return safeCall('codegraph_context', {
    task: question,
    projectPath: PROJECT_PATH,
    maxNodes: 18,
    includeCode: true,
  }, database);
}

export async function getCodeGraphSymbol(symbol, database = null, includeImpact = true) {
  const sections = [`# CodeGraph Symbol\n\nSymbol: ${symbol}`];
  sections.push(`## Search\n\n${await searchCodeGraph(symbol, database)}`);
  sections.push(`## Context\n\n${await safeCall('codegraph_context', {
    task: `Analyze symbol ${symbol}: callers, callees, dependencies, and impact`,
    projectPath: PROJECT_PATH,
    maxNodes: 12,
    includeCode: true,
  }, database)}`);
  if (includeImpact) sections.push(`## Impact\n\n${await getCodeGraphImpact(symbol, database)}`);
  return sections.join('\n\n---\n\n');
}

export async function getCodeGraphImpact(symbolOrPath, database = null) {
  return safeCall('codegraph_impact', { symbolOrPath, projectPath: PROJECT_PATH }, database);
}
