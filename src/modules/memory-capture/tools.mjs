import { z } from 'zod';
import { memoryCaptureAnalyze, memoryCaptureCommit, memoryCapturePolicy, memoryCaptureList } from './index.mjs';

export function registerMemoryCaptureTools(mcpServer) {
  mcpServer.tool('recall_memory_capture_analyze','Analyze text and create review-first memory capture candidates.',{
    text: z.string(), source_type: z.string().optional(), source_id: z.string().optional(), metadata: z.record(z.any()).optional()
  }, async (args)=>({ content:[{ type:'text', text: await memoryCaptureAnalyze(args) }] }));

  mcpServer.tool('recall_memory_capture_list','List memory capture candidates by status.',{
    status: z.enum(['pending','committed','rejected']).optional(), limit: z.number().optional()
  }, async (args)=>({ content:[{ type:'text', text: await memoryCaptureList(args) }] }));

  mcpServer.tool('recall_memory_capture_commit','Commit or reject a memory capture candidate.',{
    id: z.string(), decision: z.enum(['commit','reject']), scope: z.string().optional(), key: z.string().optional(), project_id: z.string().optional(), agent_id: z.string().optional()
  }, async (args)=>({ content:[{ type:'text', text: await memoryCaptureCommit(args) }] }));

  mcpServer.tool('recall_memory_capture_policy','Read/update memory capture policy.',{
    mode: z.enum(['review_first','auto_write']).optional(), min_confidence: z.number().optional(), auto_commit_types: z.array(z.string()).optional()
  }, async (args)=>({ content:[{ type:'text', text: await memoryCapturePolicy(args) }] }));
}
