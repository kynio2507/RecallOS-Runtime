// Layer D: Working Memory — in-process session state
// Flushed to PostgreSQL automatically after each tool call

import { randomUUID } from 'node:crypto';
import { writeEvent } from './layers/raw.mjs';

const state = {
  session_id: `session-${Date.now()}-${randomUUID().slice(0, 8)}`,
  current_goal: null,
  current_task: null,
  open_files: [],
  recent_decisions: [],
  active_constraints: [],
  pending_questions: [],
  _dirty: false,
};

export function getWorkingMemory() {
  return { ...state };
}

export function setWorkingMemory(updates) {
  Object.assign(state, updates);
  state._dirty = true;
}

export function getSessionId() {
  return state.session_id;
}

export function resetSession(newSessionId) {
  state.session_id = newSessionId || `session-${Date.now()}-${randomUUID().slice(0, 8)}`;
  state.current_goal = null;
  state.current_task = null;
  state.open_files = [];
  state.recent_decisions = [];
  state.active_constraints = [];
  state.pending_questions = [];
  state._dirty = false;
}

export function addDecision(decision) {
  state.recent_decisions.push(decision);
  if (state.recent_decisions.length > 50) state.recent_decisions.shift();
  state._dirty = true;
}

export function addConstraint(constraint) {
  state.active_constraints.push(constraint);
  state._dirty = true;
}

export function addQuestion(question) {
  state.pending_questions.push(question);
  state._dirty = true;
}

export async function flushWorkingMemory(pgClient) {
  if (!state._dirty) return;
  try {
    const snapshot = {
      current_goal: state.current_goal,
      current_task: state.current_task,
      open_files: state.open_files,
      recent_decisions: state.recent_decisions,
      active_constraints: state.active_constraints,
      pending_questions: state.pending_questions,
    };
    await writeEvent(pgClient, {
      session_id: state.session_id,
      actor: 'system',
      event_type: 'working_memory_flush',
      content: JSON.stringify(snapshot, null, 2),
      metadata: { flush_time: new Date().toISOString() },
    });
    state._dirty = false;
  } catch (error) {
    console.error('[RecallOS WorkingMemory] Flush error:', error.message);
  }
}
