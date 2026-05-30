import { z } from 'zod';
import { workflowRunStart, workflowStepStart, workflowStepUpdate, workflowRunFinish, workflowRunList, workflowRunGet } from './index.mjs';
export function registerWorkflowStateTools(mcpServer){
 mcpServer.tool('recall_workflow_run_start','Start a workflow run.',{goal:z.string(),current_phase:z.string().optional(),workspace_id:z.string().optional(),project_id:z.string().optional(),metadata:z.record(z.any()).optional()},async(args)=>({content:[{type:'text',text:await workflowRunStart(args)}]}));
 mcpServer.tool('recall_workflow_step_start','Start a workflow step.',{run_id:z.string(),agent_id:z.string().optional(),step_name:z.string(),model_id:z.string().optional(),provider_id:z.string().optional(),handoff_id:z.string().optional(),input_summary:z.string().optional(),metadata:z.record(z.any()).optional()},async(args)=>({content:[{type:'text',text:await workflowStepStart(args)}]}));
 mcpServer.tool('recall_workflow_step_update','Update workflow step status.',{step_id:z.string(),status:z.enum(['running','completed','failed','cancelled']).optional(),output_summary:z.string().optional(),error:z.string().optional()},async(args)=>({content:[{type:'text',text:await workflowStepUpdate(args)}]}));
 mcpServer.tool('recall_workflow_run_finish','Finish a workflow run.',{run_id:z.string(),status:z.enum(['completed','failed','cancelled']).optional(),result_summary:z.string().optional(),error:z.string().optional()},async(args)=>({content:[{type:'text',text:await workflowRunFinish(args)}]}));
 mcpServer.tool('recall_workflow_run_list','List workflow runs.',{status:z.string().optional(),limit:z.number().optional()},async(args)=>({content:[{type:'text',text:await workflowRunList(args)}]}));
 mcpServer.tool('recall_workflow_run_get','Get workflow run with steps.',{run_id:z.string()},async(args)=>({content:[{type:'text',text:await workflowRunGet(args)}]}));
}
