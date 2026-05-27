#!/usr/bin/env node
import { closePg, withPg } from '../src/runtime/pg.mjs';
import {
  memoryWriteEvent,
  memoryUpsertFact,
  memorySearch,
  memoryGetProfile,
  memorySummarizeSession,
} from '../src/modules/memory/index.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function pgAvailable() {
  try {
    await withPg(async (client) => client.query('SELECT 1'));
    return true;
  } catch (error) {
    console.log(`SKIP Memory module DB tests: PostgreSQL unavailable (${error.message})`);
    return false;
  }
}

const ok = await pgAvailable();
if (!ok) process.exit(0);

const session_id = `memory-test-${Date.now()}`;
const eventText = `Memory test event ${session_id}`;

const eventResult = await memoryWriteEvent({
  session_id,
  actor: 'user',
  event_type: 'message',
  content: eventText,
  metadata: { test: true },
  embed: false,
});
assert(eventResult.includes('Event saved:'), 'write_event failed');

const factResult = await memoryUpsertFact({
  scope: 'project',
  key: `test-key-${session_id}`,
  value: `test-value-${session_id}`,
  confidence: 0.95,
  source_ids: [],
});
assert(factResult.includes('Fact saved:'), 'upsert_fact failed');

const searchResult = await memorySearch({ query: session_id, top_k: 5, layers: ['raw', 'active'] });
assert(searchResult.includes(session_id), 'memory search missing inserted data');

const profileResult = await memoryGetProfile({ scope: 'project' });
assert(profileResult.includes(`test-key-${session_id}`), 'profile missing inserted fact');

const summaryResult = await memorySummarizeSession({ session_id });
assert(summaryResult.includes('Session Summary'), 'summarize_session failed');

await closePg();
console.log('PASS RecallOS Memory module tests');
