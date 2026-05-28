#!/usr/bin/env node
// Project Brain module integration test — requires PostgreSQL

import pg from 'pg';

const PG_CONFIG = {
  host: process.env.RECALLOS_PG_HOST || 'localhost',
  port: parseInt(process.env.RECALLOS_PG_PORT || '5432', 10),
  user: process.env.RECALLOS_PG_USER || 'recallos',
  password: process.env.RECALLOS_PG_PASSWORD || 'recallos',
  database: process.env.RECALLOS_PG_DATABASE || 'recallos_memory',
};

// Pre-flight: check PG available
try {
  const client = new pg.Client(PG_CONFIG);
  await client.connect();
  await client.end();
} catch (err) {
  console.log(`SKIP Project Brain DB tests: PostgreSQL unavailable (${err.message})`);
  process.exit(0);
}

// Dynamic import after PG check
const {
  projectOverview,
  projectModules,
  projectGetDoc,
  projectUpsertDoc,
  projectRoadmap,
  projectAddDecision,
  projectSearch,
  projectContextPack,
  projectBrainStatus,
} = await import('../src/modules/project-brain/index.mjs');

const { withPg } = await import('../src/runtime/pg.mjs');
const { upsertModule, addRoadmapItem } = await import('../src/modules/project-brain/index.mjs');

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const testPid = `test-${Date.now()}`;

// Test upsert doc
const docResult = await projectUpsertDoc({
  project_id: testPid,
  title: 'Test Overview',
  content: 'This is a test project overview.',
  doc_type: 'overview',
});
assert(docResult.includes('Doc saved'), `upsert doc: ${docResult}`);

// Test get doc
const getDocResult = await projectGetDoc({ project_id: testPid, doc_type: 'overview' });
assert(getDocResult.includes('Test Overview'), `get doc: ${getDocResult}`);

// Test add module
await withPg(async (client) => {
  await upsertModule(client, { project_id: testPid, name: 'TestModule', purpose: 'Testing', status: 'active' });
});

// Test modules list
const modulesResult = await projectModules({ project_id: testPid });
assert(modulesResult.includes('TestModule'), `modules: ${modulesResult}`);

// Test add decision
const decResult = await projectAddDecision({
  project_id: testPid,
  title: 'Use PostgreSQL',
  decision: 'PostgreSQL for all structured data.',
  reason: 'Robust, JSONB, pgvector.',
});
assert(decResult.includes('Decision saved'), `add decision: ${decResult}`);

// Test roadmap
await withPg(async (client) => {
  await addRoadmapItem(client, { project_id: testPid, title: 'Build Brain', priority: 'high', status: 'doing' });
});
const roadmapResult = await projectRoadmap({ project_id: testPid });
assert(roadmapResult.includes('Build Brain'), `roadmap: ${roadmapResult}`);

// Test search
const searchResult = await projectSearch({ project_id: testPid, query: 'PostgreSQL' });
assert(searchResult.includes('PostgreSQL'), `search: ${searchResult}`);

// Test overview
const overviewResult = await projectOverview({ project_id: testPid });
assert(overviewResult.includes('Test Overview'), `overview: ${overviewResult}`);
assert(overviewResult.includes('TestModule'), `overview modules: ${overviewResult}`);

// Test context pack
const contextResult = await projectContextPack({
  project_id: testPid,
  task: 'Build PostgreSQL module for testing',
  include_memory: false,
});
assert(contextResult.includes('Project Context Pack'), `context pack heading: ${contextResult}`);
assert(contextResult.includes('test project overview'), `context pack overview: ${contextResult}`);

// Test status
const statusResult = await projectBrainStatus({ project_id: testPid });
assert(statusResult.includes('Project Brain Status'), `status: ${statusResult}`);

// Cleanup test data
await withPg(async (client) => {
  for (const t of ['project_docs', 'project_modules', 'project_decisions', 'project_roadmap_items', 'project_glossary']) {
    await client.query(`DELETE FROM ${t} WHERE project_id = $1`, [testPid]);
  }
});

console.log('PASS RecallOS Project Brain tests');
