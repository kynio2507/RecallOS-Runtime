import { MAX_SECTION_CHARS } from './config.mjs';

export function now() {
  return new Date().toISOString();
}

export function stripAnsi(text) {
  return String(text || '').replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

export function cleanOutput(text) {
  return stripAnsi(text)
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('npm warn cleanup'))
    .join('\n')
    .trim();
}

export function truncate(text, max = MAX_SECTION_CHARS) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max)}\n\n... (truncated ${value.length - max} chars) ...` : value;
}

export function safeJson(value, fallback = []) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value ? [value] : fallback);
  return JSON.stringify(fallback);
}
