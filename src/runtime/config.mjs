import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

export const SERVER_NAME = 'recallos-runtime';
export const SERVER_VERSION = '1.0.0-local';
export const SCHEMA_VERSION = '3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
export const DEFAULT_ROOT = PACKAGE_ROOT;
export const DEFAULT_PROJECT_PATH = path.resolve(PACKAGE_ROOT, '..');

export function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function findProjectPath() {
  if (process.env.RECALLOS_PROJECT_PATH) {
    return process.env.RECALLOS_PROJECT_PATH;
  }
  // Try to find .codegraph starting from process.cwd() upwards
  try {
    let current = process.cwd();
    while (current) {
      if (fs.existsSync(path.join(current, '.codegraph'))) {
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  } catch {}
  
  // Try some known paths
  try {
    const knownPaths = [
      path.resolve(PACKAGE_ROOT, '..', 'scratch', '9base-ai-infra'),
      path.resolve(PACKAGE_ROOT, '..'),
    ];
    for (const p of knownPaths) {
      if (fs.existsSync(path.join(p, '.codegraph'))) {
        return p;
      }
    }
  } catch {}
  
  return DEFAULT_PROJECT_PATH;
}

export const ROOT = normalizePath(process.env.RECALLOS_ROOT || DEFAULT_ROOT);
export const PROJECT_PATH = normalizePath(findProjectPath());
export const DB_PATH = normalizePath(process.env.RECALLOS_DB_PATH || path.join(ROOT, 'data', 'recallos_runtime.sqlite'));
export const MAX_SECTION_CHARS = Number(process.env.RECALLOS_MAX_SECTION_CHARS || 12000);

// CodeGraph MCP client config
export const CODEGRAPH_MCP_CMD = process.env.RECALLOS_CODEGRAPH_MCP_CMD || 'npx';
export const CODEGRAPH_MCP_ARGS = (process.env.RECALLOS_CODEGRAPH_MCP_ARGS || `-y,@colbymchenry/codegraph,serve,--mcp,--path,${PROJECT_PATH}`).split(',');

