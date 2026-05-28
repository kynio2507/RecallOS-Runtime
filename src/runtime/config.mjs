import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

export const ROOT = normalizePath(process.env.RECALLOS_ROOT || DEFAULT_ROOT);
export const PROJECT_PATH = normalizePath(process.env.RECALLOS_PROJECT_PATH || DEFAULT_PROJECT_PATH);
export const DB_PATH = normalizePath(process.env.RECALLOS_DB_PATH || path.join(ROOT, 'data', 'recallos_runtime.sqlite'));
export const MAX_SECTION_CHARS = Number(process.env.RECALLOS_MAX_SECTION_CHARS || 12000);

// CodeGraph MCP client config
export const CODEGRAPH_MCP_CMD = process.env.RECALLOS_CODEGRAPH_MCP_CMD || 'npx';
export const CODEGRAPH_MCP_ARGS = (process.env.RECALLOS_CODEGRAPH_MCP_ARGS || `-y,@colbymchenry/codegraph,serve,--mcp,--path,${PROJECT_PATH}`).split(',');
