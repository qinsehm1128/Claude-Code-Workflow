/**
 * Team Message Bus - JSONL-based persistent message log for Agent Teams
 *
 * Operations:
 * - log:    Append a message, returns auto-incremented ID
 * - read:   Read message(s) by ID
 * - list:   List recent messages with optional filters (from/to/type/last N)
 * - status: Summarize team member activity from message history
 * - delete: Delete a specific message by ID
 * - clear:  Clear all messages for a team
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { getProjectRoot } from '../utils/path-validator.js';

// --- Types ---

export interface TeamMessage {
  id: string;
  ts: string;
  from: string;
  to: string;
  type: string;
  summary: string;
  ref?: string;
  data?: Record<string, unknown>;
}

export interface StatusEntry {
  member: string;
  lastSeen: string;
  lastAction: string;
  messageCount: number;
}

// --- Zod Schema ---

const ParamsSchema = z.object({
  operation: z.enum(['log', 'read', 'list', 'status', 'delete', 'clear']).describe('Operation to perform'),
  team: z.string().describe('Team name (maps to .workflow/.team-msg/{team}/messages.jsonl)'),

  // log params
  from: z.string().optional().describe('[log/list] Sender role name'),
  to: z.string().optional().describe('[log/list] Recipient role name'),
  type: z.string().optional().describe('[log/list] Message type (plan_ready, impl_complete, test_result, etc.)'),
  summary: z.string().optional().describe('[log] One-line human-readable summary'),
  ref: z.string().optional().describe('[log] File path reference for large content'),
  data: z.record(z.string(), z.unknown()).optional().describe('[log] Optional structured data'),

  // read params
  id: z.string().optional().describe('[read] Message ID to read (e.g. MSG-003)'),

  // list params
  last: z.number().min(1).max(100).optional().describe('[list] Return last N messages (default: 20)'),
});

type Params = z.infer<typeof ParamsSchema>;

// --- Tool Schema ---

export const schema: ToolSchema = {
  name: 'team_msg',
  description: `Team message bus - persistent JSONL log for Agent Team communication.

Operations:
  team_msg(operation="log", team="my-team", from="planner", to="coordinator", type="plan_ready", summary="Plan ready: 3 tasks", ref=".workflow/.team-plan/my-team/plan.json")
  team_msg(operation="read", team="my-team", id="MSG-003")
  team_msg(operation="list", team="my-team")
  team_msg(operation="list", team="my-team", from="tester", last=5)
  team_msg(operation="status", team="my-team")
  team_msg(operation="delete", team="my-team", id="MSG-003")
  team_msg(operation="clear", team="my-team")

Message types: plan_ready, plan_approved, plan_revision, task_unblocked, impl_complete, impl_progress, test_result, review_result, fix_required, error, shutdown`,
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['log', 'read', 'list', 'status', 'delete', 'clear'],
        description: 'Operation: log | read | list | status | delete | clear',
      },
      team: {
        type: 'string',
        description: 'Team name',
      },
      from: { type: 'string', description: '[log/list] Sender role' },
      to: { type: 'string', description: '[log/list] Recipient role' },
      type: { type: 'string', description: '[log/list] Message type' },
      summary: { type: 'string', description: '[log] One-line summary' },
      ref: { type: 'string', description: '[log] File path for large content' },
      data: { type: 'object', description: '[log] Optional structured data' },
      id: { type: 'string', description: '[read] Message ID (e.g. MSG-003)' },
      last: { type: 'number', description: '[list] Last N messages (default 20)', minimum: 1, maximum: 100 },
    },
    required: ['operation', 'team'],
  },
};

// --- Helpers ---

export function getLogDir(team: string): string {
  const root = getProjectRoot();
  return join(root, '.workflow', '.team-msg', team);
}

function getLogPath(team: string): string {
  return join(getLogDir(team), 'messages.jsonl');
}

function ensureLogFile(team: string): string {
  const logPath = getLogPath(team);
  const dir = dirname(logPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(logPath)) {
    appendFileSync(logPath, '', 'utf-8');
  }
  return logPath;
}

export function readAllMessages(team: string): TeamMessage[] {
  const logPath = getLogPath(team);
  if (!existsSync(logPath)) return [];

  const content = readFileSync(logPath, 'utf-8').trim();
  if (!content) return [];

  return content.split('\n').map(line => {
    try {
      return JSON.parse(line) as TeamMessage;
    } catch {
      return null;
    }
  }).filter((m): m is TeamMessage => m !== null);
}

function getNextId(messages: TeamMessage[]): string {
  const maxNum = messages.reduce((max, m) => {
    const match = m.id.match(/^MSG-(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `MSG-${String(maxNum + 1).padStart(3, '0')}`;
}

function nowISO(): string {
  return new Date().toISOString().replace('Z', '+00:00');
}

// --- Operations ---

function opLog(params: Params): ToolResult {
  if (!params.from) return { success: false, error: 'log requires "from"' };
  if (!params.to) return { success: false, error: 'log requires "to"' };
  if (!params.summary) return { success: false, error: 'log requires "summary"' };

  const logPath = ensureLogFile(params.team);
  const messages = readAllMessages(params.team);
  const id = getNextId(messages);

  const msg: TeamMessage = {
    id,
    ts: nowISO(),
    from: params.from,
    to: params.to,
    type: params.type || 'message',
    summary: params.summary,
  };
  if (params.ref) msg.ref = params.ref;
  if (params.data) msg.data = params.data;

  appendFileSync(logPath, JSON.stringify(msg) + '\n', 'utf-8');

  return { success: true, result: { id, message: `Logged ${id}: [${msg.from} → ${msg.to}] ${msg.summary}` } };
}

function opRead(params: Params): ToolResult {
  if (!params.id) return { success: false, error: 'read requires "id"' };

  const messages = readAllMessages(params.team);
  const msg = messages.find(m => m.id === params.id);

  if (!msg) {
    return { success: false, error: `Message ${params.id} not found in team "${params.team}"` };
  }

  return { success: true, result: msg };
}

function opList(params: Params): ToolResult {
  let messages = readAllMessages(params.team);

  // Apply filters
  if (params.from) messages = messages.filter(m => m.from === params.from);
  if (params.to) messages = messages.filter(m => m.to === params.to);
  if (params.type) messages = messages.filter(m => m.type === params.type);

  // Take last N
  const last = params.last || 20;
  const sliced = messages.slice(-last);

  const lines = sliced.map(m => `${m.id} [${m.ts.substring(11, 19)}] ${m.from} → ${m.to} (${m.type}) ${m.summary}`);

  return {
    success: true,
    result: {
      total: messages.length,
      showing: sliced.length,
      messages: sliced,
      formatted: lines.join('\n'),
    },
  };
}

function opStatus(params: Params): ToolResult {
  const messages = readAllMessages(params.team);

  if (messages.length === 0) {
    return { success: true, result: { members: [], summary: 'No messages recorded yet.' } };
  }

  // Aggregate per-member stats
  const memberMap = new Map<string, StatusEntry>();

  for (const msg of messages) {
    for (const role of [msg.from, msg.to]) {
      if (!memberMap.has(role)) {
        memberMap.set(role, { member: role, lastSeen: msg.ts, lastAction: '', messageCount: 0 });
      }
    }
    const fromEntry = memberMap.get(msg.from)!;
    fromEntry.lastSeen = msg.ts;
    fromEntry.lastAction = `sent ${msg.type} → ${msg.to}`;
    fromEntry.messageCount++;
  }

  const members = Array.from(memberMap.values()).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));

  const formatted = members.map(m =>
    `${m.member.padEnd(12)} | last: ${m.lastSeen.substring(11, 19)} | msgs: ${m.messageCount} | ${m.lastAction}`
  ).join('\n');

  return {
    success: true,
    result: {
      members,
      total_messages: messages.length,
      formatted,
    },
  };
}

function opDelete(params: Params): ToolResult {
  if (!params.id) return { success: false, error: 'delete requires "id"' };

  const messages = readAllMessages(params.team);
  const idx = messages.findIndex(m => m.id === params.id);

  if (idx === -1) {
    return { success: false, error: `Message ${params.id} not found in team "${params.team}"` };
  }

  const removed = messages.splice(idx, 1)[0];
  const logPath = ensureLogFile(params.team);
  writeFileSync(logPath, messages.map(m => JSON.stringify(m)).join('\n') + (messages.length > 0 ? '\n' : ''), 'utf-8');

  return { success: true, result: { deleted: removed.id, message: `Deleted ${removed.id}: [${removed.from} → ${removed.to}] ${removed.summary}` } };
}

function opClear(params: Params): ToolResult {
  const logPath = getLogPath(params.team);
  const dir = getLogDir(params.team);

  if (!existsSync(logPath)) {
    return { success: true, result: { message: `Team "${params.team}" has no messages to clear.` } };
  }

  const count = readAllMessages(params.team).length;
  rmSync(dir, { recursive: true, force: true });

  return { success: true, result: { cleared: count, message: `Cleared ${count} messages for team "${params.team}".` } };
}

// --- Handler ---

export async function handler(params: Record<string, unknown>): Promise<ToolResult> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid params: ${parsed.error.message}` };
  }

  const p = parsed.data;

  switch (p.operation) {
    case 'log': return opLog(p);
    case 'read': return opRead(p);
    case 'list': return opList(p);
    case 'status': return opStatus(p);
    case 'delete': return opDelete(p);
    case 'clear': return opClear(p);
    default:
      return { success: false, error: `Unknown operation: ${p.operation}` };
  }
}
