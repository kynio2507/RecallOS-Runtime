import { z } from 'zod';
import {
  recordSessionEvent,
  recordUserRequest,
  recordAssistantAction,
  recordFileChange,
  recordCommandResult,
  recordDecision,
  recordError,
  recordBuildResult,
  recordGitEvent,
  recordProjectSnapshot,
  importTranscript,
  summarizeSessionToFacts,
  resumeContext,
} from './index.mjs';

const baseProps = {
  workspace_id: z.string().optional(),
  project_id: z.string().optional(),
  session_id: z.string().optional(),
  conversation_id: z.string().optional(),
  run_id: z.string().optional(),
  task_id: z.string().optional(),
  content: z.string(),
  metadata: z.record(z.any()).optional(),
  promote_to_fact: z.boolean().optional(),
  fact_scope: z.string().optional(),
  fact_key: z.string().optional(),
  fact_value: z.string().optional(),
  confidence: z.number().optional(),
};

function resultText(label, result) {
  if (typeof result === 'string') return result;
  return `# ${label}\n\n${JSON.stringify(result, null, 2)}`;
}

export function registerSessionRecorderTools(server) {
  server.tool('recall_session_record', 'Record any Antigravity/session event into RecallOS 4-layer memory.', {
    ...baseProps,
    event_type: z.enum(['user_request','assistant_action','assistant_response','file_change','command_result','decision','error','build_result','git_event','system_event','tool_call','mcp_call','artifact_update','project_snapshot','session_summary','workflow_event']),
    actor: z.string().optional(),
  }, async (args) => ({ content: [{ type: 'text', text: resultText('Session Event Recorded', await recordSessionEvent(args)) }] }));

  server.tool('recall_session_record_user_request', 'Record user request into 4-layer memory.', baseProps, async (args) => ({ content: [{ type: 'text', text: resultText('User Request Recorded', await recordUserRequest(args)) }] }));
  server.tool('recall_session_record_assistant_action', 'Record assistant action into 4-layer memory.', baseProps, async (args) => ({ content: [{ type: 'text', text: resultText('Assistant Action Recorded', await recordAssistantAction(args)) }] }));
  server.tool('recall_session_record_file_change', 'Record file change into 4-layer memory.', { ...baseProps, file_path: z.string().optional() }, async (args) => ({ content: [{ type: 'text', text: resultText('File Change Recorded', await recordFileChange(args)) }] }));
  server.tool('recall_session_record_command_result', 'Record terminal command result into 4-layer memory.', { ...baseProps, command: z.string().optional(), exit_code: z.number().optional() }, async (args) => ({ content: [{ type: 'text', text: resultText('Command Result Recorded', await recordCommandResult(args)) }] }));
  server.tool('recall_session_record_decision', 'Record decision into active session/project memory.', baseProps, async (args) => ({ content: [{ type: 'text', text: resultText('Decision Recorded', await recordDecision(args)) }] }));
  server.tool('recall_session_record_error', 'Record error or blocker into 4-layer memory.', baseProps, async (args) => ({ content: [{ type: 'text', text: resultText('Error Recorded', await recordError(args)) }] }));
  server.tool('recall_session_record_build_result', 'Record build/test validation result.', { ...baseProps, command: z.string().optional(), status: z.string().optional() }, async (args) => ({ content: [{ type: 'text', text: resultText('Build Result Recorded', await recordBuildResult(args)) }] }));
  server.tool('recall_session_record_git_event', 'Record git commit/push/status event.', { ...baseProps, commit: z.string().optional(), remote: z.string().optional() }, async (args) => ({ content: [{ type: 'text', text: resultText('Git Event Recorded', await recordGitEvent(args)) }] }));
  server.tool('recall_session_record_project_snapshot', 'Record project state snapshot for resume memory.', baseProps, async (args) => ({ content: [{ type: 'text', text: resultText('Project Snapshot Recorded', await recordProjectSnapshot(args)) }] }));

  server.tool('recall_session_import_transcript', 'Import Antigravity transcript JSONL into RecallOS 4-layer memory.', {
    transcript_path: z.string(),
    workspace_id: z.string().optional(),
    project_id: z.string().optional(),
    session_id: z.string().optional(),
    conversation_id: z.string().optional(),
    limit: z.number().optional(),
    max_content_chars: z.number().optional(),
  }, async (args) => ({ content: [{ type: 'text', text: resultText('Transcript Import', await importTranscript(args)) }] }));

  server.tool('recall_session_summarize', 'Summarize a recorded session into active facts.', {
    workspace_id: z.string().optional(), project_id: z.string().optional(), session_id: z.string().optional(), conversation_id: z.string().optional()
  }, async (args) => ({ content: [{ type: 'text', text: resultText('Session Summary', await summarizeSessionToFacts({ ...args, session_id: args.session_id || args.conversation_id })) }] }));

  server.tool('recall_session_resume_context', 'Build resume context from 4-layer memory so agents can continue without chat history.', {
    workspace_id: z.string().optional(), project_id: z.string().optional(), session_id: z.string().optional(), conversation_id: z.string().optional(), limit: z.number().optional()
  }, async (args) => ({ content: [{ type: 'text', text: await resumeContext(args) }] }));
}
