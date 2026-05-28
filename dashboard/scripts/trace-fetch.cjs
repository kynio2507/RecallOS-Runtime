const http = require('node:http');
const https = require('node:https');

const originalFetch = globalThis.fetch;
const originalHttpRequest = http.request;
const originalHttpsRequest = https.request;
const originalHttpGet = http.get;
const originalHttpsGet = https.get;

function safeBodySnippet(body) {
  if (typeof body !== 'string') return null;
  try {
    const json = JSON.parse(body);
    return {
      model: json?.model,
      input_type: Array.isArray(json?.input) ? 'array' : typeof json?.input,
      messages: Array.isArray(json?.messages) ? json.messages.length : undefined,
    };
  } catch {
    return body.slice(0, 160);
  }
}

function normalizeUrl(input, options) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  const protocol = options?.protocol || input?.protocol || 'https:';
  const host = options?.hostname || options?.host || input?.hostname || input?.host || 'unknown-host';
  const path = options?.path || input?.path || '';
  return `${protocol}//${host}${path}`;
}

function isLocalUrl(url) {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url) || url.startsWith('/');
}

function logExternal(kind, url, method, body) {
  if (isLocalUrl(url)) return;
  const stack = new Error().stack?.split('\n').slice(3, 11).join('\n');
  console.error(`[RecallOS Dashboard ${kind} Trace]`, JSON.stringify({ url, method: method || 'GET', body: safeBodySnippet(body) }));
  console.error(stack);
}

globalThis.fetch = async function tracedFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url || String(input);
  logExternal('Fetch', url, init?.method || 'GET', init?.body);
  return originalFetch(input, init);
};

function wrapRequest(original, protocol) {
  return function tracedRequest(input, options, cb) {
    const url = normalizeUrl(input, options || {});
    const method = options?.method || input?.method || 'GET';
    logExternal(`${protocol.toUpperCase()} Request`, url, method, null);
    return original.apply(this, arguments);
  };
}

http.request = wrapRequest(originalHttpRequest, 'http');
https.request = wrapRequest(originalHttpsRequest, 'https');
http.get = wrapRequest(originalHttpGet, 'http');
https.get = wrapRequest(originalHttpsGet, 'https');
