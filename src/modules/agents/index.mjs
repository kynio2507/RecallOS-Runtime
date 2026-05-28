// Agents module — identity, messaging, handoffs

import { withPg } from '../../runtime/pg.mjs';

// --- Pair key helper ---
function makePairKey(a, b) {
  return [a, b].sort().join(':');
}

// --- Agent Identity ---

export async function agentRegister(args) {
  return withPg(async (client) => {
    const result = await client.query(
      `INSERT INTO agents (id, name, role, model_id, system_prompt, capabilities_json)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         model_id = COALESCE(EXCLUDED.model_id, agents.model_id),
         system_prompt = COALESCE(EXCLUDED.system_prompt, agents.system_prompt),
         capabilities_json = COALESCE(EXCLUDED.capabilities_json, agents.capabilities_json)
       RETURNING id, name, role, created_at`,
      [args.id, args.name, args.role, args.model_id || null,
       args.system_prompt || null, JSON.stringify(args.capabilities || [])]
    );
    const a = result.rows[0];
    return `Agent registered: ${a.id} (${a.name}, ${a.role})`;
  });
}

export async function agentList(args = {}) {
  return withPg(async (client) => {
    const conditions = [];
    const params = [];
    if (args.role) { conditions.push(`role = $${params.length + 1}`); params.push(args.role); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await client.query(`SELECT * FROM agents ${where} ORDER BY id`, params);
    if (result.rows.length === 0) return 'No agents registered.';
    const lines = [`# Registered Agents (${result.rows.length})\n`];
    for (const a of result.rows) {
      lines.push(`- **${a.id}** (${a.name}) — role: ${a.role}, model: ${a.model_id || '(none)'}, capabilities: ${JSON.stringify(a.capabilities_json)}`);
    }
    return lines.join('\n');
  });
}

export async function agentGet(args) {
  return withPg(async (client) => {
    const result = await client.query('SELECT * FROM agents WHERE id = $1', [args.agent_id]);
    if (result.rows.length === 0) return `Agent not found: ${args.agent_id}`;
    const a = result.rows[0];
    return `# Agent: ${a.id}\n\n- Name: ${a.name}\n- Role: ${a.role}\n- Model: ${a.model_id || '(none)'}\n- System Prompt: ${a.system_prompt || '(none)'}\n- Capabilities: ${JSON.stringify(a.capabilities_json)}\n- Created: ${a.created_at}`;
  });
}

// --- Agent Messages ---

export async function agentSendMessage(args) {
  return withPg(async (client) => {
    const result = await client.query(
      `INSERT INTO agent_messages (workspace_id, project_id, run_id, task_id, from_agent_id, to_agent_id, message_type, content, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, created_at`,
      [args.workspace_id || null, args.project_id || 'default', args.run_id || null,
       args.task_id || null, args.from_agent_id, args.to_agent_id,
       args.message_type || 'message', args.content, args.summary || null]
    );
    return `Message sent: ${result.rows[0].id} (${args.from_agent_id} → ${args.to_agent_id})`;
  });
}

export async function agentGetMessages(args) {
  return withPg(async (client) => {
    const conditions = [];
    const params = [];
    if (args.agent_id) {
      conditions.push(`(from_agent_id = $${params.length + 1} OR to_agent_id = $${params.length + 1})`);
      params.push(args.agent_id);
    }
    if (args.task_id) { conditions.push(`task_id = $${params.length + 1}`); params.push(args.task_id); }
    if (args.run_id) { conditions.push(`run_id = $${params.length + 1}`); params.push(args.run_id); }
    if (args.message_type) { conditions.push(`message_type = $${params.length + 1}`); params.push(args.message_type); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = args.limit || 20;
    const result = await client.query(
      `SELECT * FROM agent_messages ${where} ORDER BY created_at DESC LIMIT $${params.length + 1}`,
      [...params, limit]
    );
    if (result.rows.length === 0) return 'No messages found.';
    const lines = [`# Agent Messages (${result.rows.length})\n`];
    for (const m of result.rows) {
      lines.push(`**[${m.message_type}]** ${m.from_agent_id} → ${m.to_agent_id} (${m.created_at})`);
      lines.push(`${m.content.slice(0, 300)}${m.content.length > 300 ? '...' : ''}\n`);
    }
    return lines.join('\n');
  });
}

export async function agentGetConversation(args) {
  return withPg(async (client) => {
    const conditions = [
      `((from_agent_id = $1 AND to_agent_id = $2) OR (from_agent_id = $2 AND to_agent_id = $1))`
    ];
    const params = [args.agent_a, args.agent_b];
    if (args.task_id) { conditions.push(`task_id = $${params.length + 1}`); params.push(args.task_id); }
    if (args.run_id) { conditions.push(`run_id = $${params.length + 1}`); params.push(args.run_id); }
    const limit = args.limit || 30;
    const result = await client.query(
      `SELECT * FROM agent_messages WHERE ${conditions.join(' AND ')} ORDER BY created_at ASC LIMIT $${params.length + 1}`,
      [...params, limit]
    );
    if (result.rows.length === 0) return `No conversation between ${args.agent_a} and ${args.agent_b}.`;
    const lines = [`# Conversation: ${args.agent_a} ↔ ${args.agent_b} (${result.rows.length} messages)\n`];
    for (const m of result.rows) {
      lines.push(`**${m.from_agent_id}** (${m.message_type}, ${m.created_at}):`);
      lines.push(`${m.content}\n`);
    }
    return lines.join('\n');
  });
}

// --- Agent Handoffs ---

export async function agentHandoff(args) {
  return withPg(async (client) => {
    const result = await client.query(
      `INSERT INTO agent_handoffs (from_agent_id, to_agent_id, project_id, task_title, task_payload_json)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [args.from_agent_id, args.to_agent_id, args.project_id || 'default',
       args.task_title, JSON.stringify(args.task_payload || {})]
    );
    return `Handoff created: ${result.rows[0].id} (${args.from_agent_id} → ${args.to_agent_id}: ${args.task_title})`;
  });
}

export async function agentHandoffUpdate(args) {
  return withPg(async (client) => {
    const sets = ['updated_at = NOW()'];
    const params = [args.handoff_id];
    if (args.status) { sets.push(`status = $${params.length + 1}`); params.push(args.status); }
    if (args.result_summary) { sets.push(`result_summary = $${params.length + 1}`); params.push(args.result_summary); }
    const result = await client.query(
      `UPDATE agent_handoffs SET ${sets.join(', ')} WHERE id = $1 RETURNING id, status, updated_at`,
      params
    );
    if (result.rows.length === 0) return `Handoff not found: ${args.handoff_id}`;
    return `Handoff updated: ${result.rows[0].id} (status: ${result.rows[0].status})`;
  });
}

export async function agentHandoffList(args) {
  return withPg(async (client) => {
    const conditions = [];
    const params = [];
    if (args.agent_id) {
      const dir = args.direction || 'both';
      if (dir === 'incoming') { conditions.push(`to_agent_id = $${params.length + 1}`); params.push(args.agent_id); }
      else if (dir === 'outgoing') { conditions.push(`from_agent_id = $${params.length + 1}`); params.push(args.agent_id); }
      else { conditions.push(`(from_agent_id = $${params.length + 1} OR to_agent_id = $${params.length + 1})`); params.push(args.agent_id); }
    }
    if (args.status) { conditions.push(`status = $${params.length + 1}`); params.push(args.status); }
    if (args.project_id) { conditions.push(`project_id = $${params.length + 1}`); params.push(args.project_id); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await client.query(
      `SELECT * FROM agent_handoffs ${where} ORDER BY created_at DESC LIMIT 20`, params
    );
    if (result.rows.length === 0) return 'No handoffs found.';
    const lines = [`# Agent Handoffs (${result.rows.length})\n`];
    for (const h of result.rows) {
      lines.push(`- **${h.task_title}** (${h.status}): ${h.from_agent_id} → ${h.to_agent_id}${h.result_summary ? ` — result: ${h.result_summary.slice(0, 100)}` : ''}`);
    }
    return lines.join('\n');
  });
}

export { makePairKey };
