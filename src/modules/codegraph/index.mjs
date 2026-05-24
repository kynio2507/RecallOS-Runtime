import { execFileSync } from 'node:child_process';
import { CODEGRAPH_CMD, PROJECT_PATH } from '../../runtime/config.mjs';
import { logEvent } from '../../runtime/db.mjs';
import { cleanOutput, truncate } from '../../runtime/utils.mjs';

export function runCodeGraph(args, database = null) {
  try {
    const out = execFileSync('cmd.exe', ['/c', CODEGRAPH_CMD, '-y', '@colbymchenry/codegraph', ...args], {
      cwd: PROJECT_PATH,
      encoding: 'utf8',
      timeout: 45000,
      maxBuffer: 1024 * 1024 * 4,
      windowsHide: true,
    });
    if (database) logEvent(database, 'info', 'codegraph_call', args.join(' '));
    return truncate(cleanOutput(out));
  } catch (error) {
    const msg = cleanOutput(`${error.message}\n${error.stdout || ''}\n${error.stderr || ''}`);
    if (database) logEvent(database, 'error', 'codegraph_error', `${args.join(' ')}\n${msg}`);
    return `[CodeGraph Error]\n${truncate(msg, 6000)}`;
  }
}

export function getCodeGraphStatus(database = null) {
  return runCodeGraph(['status', PROJECT_PATH], database);
}

export function searchCodeGraph(query, database = null) {
  return runCodeGraph(['query', query, '--path', PROJECT_PATH], database);
}

export function getCodeGraphContext(question, database = null) {
  return runCodeGraph(['context', question, '--path', PROJECT_PATH, '--max-nodes', '18', '--max-code', '6'], database);
}

export function getCodeGraphSymbol(symbol, database = null, includeImpact = true) {
  const sections = [`# CodeGraph Symbol\n\nSymbol: ${symbol}`];
  sections.push(`## Search\n\n${searchCodeGraph(symbol, database)}`);
  sections.push(`## Context\n\n${runCodeGraph(['context', `Analyze symbol ${symbol}: callers, callees, dependencies, and impact`, '--path', PROJECT_PATH, '--max-nodes', '12', '--max-code', '4'], database)}`);
  if (includeImpact) sections.push(`## Impact\n\n${getCodeGraphImpact(symbol, database)}`);
  return sections.join('\n\n---\n\n');
}

export function getCodeGraphImpact(symbolOrPath, database = null) {
  return runCodeGraph(['affected', '--path', PROJECT_PATH, symbolOrPath], database);
}
