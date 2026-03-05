/**
 * Session Content Parser - Parses native CLI tool session files
 * Supports Gemini/Qwen JSON, Codex JSONL, and Claude JSONL formats
 */

import { readFileSync, existsSync } from 'fs';
import { readFile, access } from 'fs/promises';
import { parseClaudeSession } from './claude-session-parser.js';
import { parseOpenCodeSession } from './opencode-session-parser.js';

// Standardized conversation turn
export interface ParsedTurn {
  turnNumber: number;
  timestamp: string;
  role: 'user' | 'assistant';
  content: string;
  thoughts?: string[];           // Assistant reasoning/thoughts
  toolCalls?: ToolCallInfo[];    // Tool calls made
  tokens?: TokenInfo;            // Token usage
}

export interface ToolCallInfo {
  name: string;
  arguments?: string;
  output?: string;
}

export interface TokenInfo {
  input?: number;
  output?: number;
  cached?: number;
  total?: number;
}

// Full parsed session
export interface ParsedSession {
  sessionId: string;
  tool: string;
  projectHash?: string;
  workingDir?: string;
  startTime: string;
  lastUpdated: string;
  turns: ParsedTurn[];
  totalTokens?: TokenInfo;
  model?: string;
}

// Gemini/Qwen session file structure
interface GeminiQwenSession {
  sessionId: string;
  projectHash: string;
  startTime: string;
  lastUpdated: string;
  messages: GeminiQwenMessage[];
}

interface GeminiQwenMessage {
  id: string;
  timestamp: string;
  type: 'user' | 'gemini' | 'qwen';
  content: string;
  thoughts?: Array<{ subject: string; description: string; timestamp: string }>;
  tokens?: {
    input: number;
    output: number;
    cached?: number;
    thoughts?: number;
    tool?: number;
    total: number;
  };
  model?: string;
}

// Codex JSONL line types
interface CodexSessionMeta {
  timestamp: string;
  type: 'session_meta';
  payload: {
    id: string;
    timestamp: string;
    cwd: string;
    cli_version?: string;
    model_provider?: string;
  };
}

interface CodexResponseItem {
  timestamp: string;
  type: 'response_item';
  payload: {
    type: string;
    role?: string;
    content?: Array<{ type: string; text?: string }>;
    name?: string;
    arguments?: string;
    call_id?: string;
    output?: string;
    summary?: string[];
  };
}

interface CodexEventMsg {
  timestamp: string;
  type: 'event_msg';
  payload: {
    type: string;
    info?: {
      total_token_usage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      };
    };
  };
}

type CodexLine = CodexSessionMeta | CodexResponseItem | CodexEventMsg;

// Qwen new JSONL format
interface QwenJSONLEntry {
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  type: 'user' | 'assistant' | 'system';
  cwd?: string;
  version?: string;
  gitBranch?: string;
  model?: string;
  subtype?: string;  // e.g., 'ui_telemetry'
  message?: {
    role: string;
    parts: Array<{ text?: string }>;
  };
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    thoughtsTokenCount?: number;
    totalTokenCount: number;
    cachedContentTokenCount?: number;
  };
  systemPayload?: {
    uiEvent?: {
      model?: string;
      input_token_count?: number;
      output_token_count?: number;
      cached_content_token_count?: number;
      thoughts_token_count?: number;
      tool_token_count?: number;
      total_token_count?: number;
    };
  };
}

/**
 * Detect if content is JSONL or JSON format
 */
function isJSONL(content: string): boolean {
  const trimmed = content.trim();
  // JSON starts with { or [, but JSONL has multiple lines each starting with {
  if (trimmed.startsWith('[')) return false;  // JSON array
  if (!trimmed.startsWith('{')) return false;

  // Check if first line is complete JSON
  const firstLine = trimmed.split('\n')[0];
  try {
    JSON.parse(firstLine);
    // If multiple lines each parse as JSON, it's JSONL
    const lines = trimmed.split('\n').filter(l => l.trim());
    if (lines.length > 1) {
      // Try to parse second line
      JSON.parse(lines[1]);
      return true;  // Multiple lines of JSON = JSONL
    }
    return false;  // Single JSON object
  } catch {
    return false;
  }
}

/**
 * Check if a path exists (async)
 */
async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a native session file and return standardized conversation data (async)
 */
export async function parseSessionFile(filePath: string, tool: string): Promise<ParsedSession | null> {
  if (!(await pathExists(filePath))) {
    return null;
  }

  try {
    const content = await readFile(filePath, 'utf8');

    switch (tool) {
      case 'gemini':
        return parseGeminiQwenSession(content, tool);
      case 'qwen':
        // Qwen can be either JSON (legacy) or JSONL (new format)
        if (isJSONL(content)) {
          return parseQwenJSONLSession(content);
        }
        return parseGeminiQwenSession(content, tool);
      case 'codex':
        return parseCodexSession(content);
      case 'claude':
        return parseClaudeSession(filePath);
      case 'opencode':
        return parseOpenCodeSession(filePath);
      default:
        return null;
    }
  } catch (error) {
    console.error(`Failed to parse session file ${filePath}:`, error);
    return null;
  }
}

/**
 * Parse Gemini or Qwen JSON session file
 */
function parseGeminiQwenSession(content: string, tool: string): ParsedSession {
  const session: GeminiQwenSession = JSON.parse(content);
  const turns: ParsedTurn[] = [];
  let turnNumber = 0;
  let totalTokens: TokenInfo = { input: 0, output: 0, cached: 0, total: 0 };
  let model: string | undefined;

  for (const msg of session.messages) {
    // Ensure content is always a string (handle legacy object data like {text: "..."})
    const contentStr = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content);

    if (msg.type === 'user') {
      turnNumber++;
      turns.push({
        turnNumber,
        timestamp: msg.timestamp,
        role: 'user',
        content: contentStr
      });
    } else if (msg.type === 'gemini' || msg.type === 'qwen') {
      // Find the corresponding user turn
      const userTurn = turns.find(t => t.turnNumber === turnNumber && t.role === 'user');

      // Extract thoughts
      const thoughts = msg.thoughts?.map(t => `${t.subject}: ${t.description}`) || [];

      turns.push({
        turnNumber,
        timestamp: msg.timestamp,
        role: 'assistant',
        content: contentStr,
        thoughts: thoughts.length > 0 ? thoughts : undefined,
        tokens: msg.tokens ? {
          input: msg.tokens.input,
          output: msg.tokens.output,
          cached: msg.tokens.cached,
          total: msg.tokens.total
        } : undefined
      });

      // Accumulate tokens
      if (msg.tokens) {
        totalTokens.input = (totalTokens.input || 0) + msg.tokens.input;
        totalTokens.output = (totalTokens.output || 0) + msg.tokens.output;
        totalTokens.cached = (totalTokens.cached || 0) + (msg.tokens.cached || 0);
        totalTokens.total = (totalTokens.total || 0) + msg.tokens.total;
      }

      if (msg.model) {
        model = msg.model;
      }
    }
  }

  return {
    sessionId: session.sessionId,
    tool,
    projectHash: session.projectHash,
    startTime: session.startTime,
    lastUpdated: session.lastUpdated,
    turns,
    totalTokens,
    model
  };
}

/**
 * Parse Qwen JSONL session file (new format)
 */
function parseQwenJSONLSession(content: string): ParsedSession {
  const lines = content.split('\n').filter(l => l.trim());
  const turns: ParsedTurn[] = [];

  let sessionId = '';
  let workingDir = '';
  let startTime = '';
  let lastUpdated = '';
  let model: string | undefined;
  let totalTokens: TokenInfo = { input: 0, output: 0, cached: 0, total: 0 };
  let currentTurn = 0;

  for (const line of lines) {
    try {
      const entry: QwenJSONLEntry = JSON.parse(line);
      lastUpdated = entry.timestamp;

      // Get session info from first entry
      if (!sessionId && entry.sessionId) {
        sessionId = entry.sessionId;
      }
      if (!workingDir && entry.cwd) {
        workingDir = entry.cwd;
      }
      if (!startTime) {
        startTime = entry.timestamp;
      }

      if (entry.type === 'user' && entry.message) {
        // User message
        currentTurn++;
        const textContent = entry.message.parts
          .map(p => p.text || '')
          .filter(t => t)
          .join('\n');

        turns.push({
          turnNumber: currentTurn,
          timestamp: entry.timestamp,
          role: 'user',
          content: textContent
        });
      } else if (entry.type === 'assistant' && entry.message) {
        // Assistant response
        const textContent = entry.message.parts
          .map(p => p.text || '')
          .filter(t => t)
          .join('\n');

        const tokens = entry.usageMetadata ? {
          input: entry.usageMetadata.promptTokenCount,
          output: entry.usageMetadata.candidatesTokenCount,
          cached: entry.usageMetadata.cachedContentTokenCount || 0,
          total: entry.usageMetadata.totalTokenCount
        } : undefined;

        turns.push({
          turnNumber: currentTurn,
          timestamp: entry.timestamp,
          role: 'assistant',
          content: textContent,
          tokens
        });

        // Accumulate tokens
        if (tokens) {
          totalTokens.input = (totalTokens.input || 0) + tokens.input;
          totalTokens.output = (totalTokens.output || 0) + tokens.output;
          totalTokens.cached = (totalTokens.cached || 0) + (tokens.cached || 0);
          totalTokens.total = (totalTokens.total || 0) + tokens.total;
        }

        if (entry.model) {
          model = entry.model;
        }
      } else if (entry.type === 'system' && entry.subtype === 'ui_telemetry') {
        // Telemetry event - extract model info if available
        if (entry.systemPayload?.uiEvent?.model && !model) {
          model = entry.systemPayload.uiEvent.model;
        }
      }
    } catch {
      // Skip invalid lines
    }
  }

  return {
    sessionId,
    tool: 'qwen',
    workingDir,
    startTime,
    lastUpdated,
    turns,
    totalTokens,
    model
  };
}

/**
 * Parse Codex JSONL session file
 */
function parseCodexSession(content: string): ParsedSession {
  const lines = content.split('\n').filter(l => l.trim());
  const turns: ParsedTurn[] = [];

  let sessionId = '';
  let workingDir = '';
  let startTime = '';
  let lastUpdated = '';
  let model: string | undefined;
  let totalTokens: TokenInfo = { input: 0, output: 0, total: 0 };

  let currentTurn = 0;
  let currentToolCalls: ToolCallInfo[] = [];
  let pendingToolCalls: Map<string, ToolCallInfo> = new Map();

  for (const line of lines) {
    try {
      const parsed: CodexLine = JSON.parse(line);
      lastUpdated = parsed.timestamp;

      if (parsed.type === 'session_meta') {
        const meta = parsed as CodexSessionMeta;
        sessionId = meta.payload.id;
        workingDir = meta.payload.cwd;
        startTime = meta.payload.timestamp;
      } else if (parsed.type === 'response_item') {
        const item = parsed as CodexResponseItem;

        if (item.payload.type === 'message' && item.payload.role === 'user') {
          // User message
          currentTurn++;
          const textContent = item.payload.content
            ?.filter(c => c.type === 'input_text')
            .map(c => {
              // Ensure text is a string (handle legacy object data like {text: "..."})
              const txt = c.text;
              return typeof txt === 'string' ? txt : JSON.stringify(txt);
            })
            .join('\n') || '';

          turns.push({
            turnNumber: currentTurn,
            timestamp: parsed.timestamp,
            role: 'user',
            content: textContent
          });

          // Reset tool calls for new turn
          currentToolCalls = [];
          pendingToolCalls.clear();
        } else if (item.payload.type === 'function_call') {
          // Tool call
          const toolCall: ToolCallInfo = {
            name: item.payload.name || 'unknown',
            arguments: item.payload.arguments
          };
          if (item.payload.call_id) {
            pendingToolCalls.set(item.payload.call_id, toolCall);
          }
          currentToolCalls.push(toolCall);
        } else if (item.payload.type === 'function_call_output') {
          // Tool result
          if (item.payload.call_id && pendingToolCalls.has(item.payload.call_id)) {
            const toolCall = pendingToolCalls.get(item.payload.call_id)!;
            toolCall.output = item.payload.output;
          }
        } else if (item.payload.type === 'message' && item.payload.role === 'assistant') {
          // Assistant message (final response)
          const textContent = item.payload.content
            ?.filter(c => c.type === 'output_text' || c.type === 'text')
            .map(c => {
              // Ensure text is a string (handle legacy object data like {text: "..."})
              const txt = c.text;
              return typeof txt === 'string' ? txt : JSON.stringify(txt);
            })
            .join('\n') || '';

          if (textContent) {
            turns.push({
              turnNumber: currentTurn,
              timestamp: parsed.timestamp,
              role: 'assistant',
              content: textContent,
              toolCalls: currentToolCalls.length > 0 ? [...currentToolCalls] : undefined
            });
          }
        } else if (item.payload.type === 'reasoning') {
          // Reasoning (may be encrypted, extract summary if available)
          const summary = item.payload.summary;
          if (summary && summary.length > 0) {
            // Add reasoning summary to the last assistant turn
            const lastAssistantTurn = turns.findLast(t => t.role === 'assistant');
            if (lastAssistantTurn) {
              lastAssistantTurn.thoughts = summary;
            }
          }
        }
      } else if (parsed.type === 'event_msg') {
        const event = parsed as CodexEventMsg;
        if (event.payload.type === 'token_count' && event.payload.info?.total_token_usage) {
          const usage = event.payload.info.total_token_usage;
          totalTokens = {
            input: usage.input_tokens,
            output: usage.output_tokens,
            total: usage.total_tokens
          };
        }
      }
    } catch {
      // Skip invalid lines
    }
  }

  // If we have tool calls but no final assistant message, create one
  if (currentToolCalls.length > 0) {
    const lastTurn = turns[turns.length - 1];
    if (lastTurn && lastTurn.role === 'user') {
      // Find if there's already an assistant response for this turn
      const hasAssistant = turns.some(t => t.turnNumber === currentTurn && t.role === 'assistant');
      if (!hasAssistant) {
        turns.push({
          turnNumber: currentTurn,
          timestamp: lastUpdated,
          role: 'assistant',
          content: '[Tool execution completed]',
          toolCalls: currentToolCalls
        });
      }
    }
  }

  return {
    sessionId,
    tool: 'codex',
    workingDir,
    startTime,
    lastUpdated,
    turns,
    totalTokens,
    model
  };
}

/**
 * Get conversation as formatted text
 */
export function formatConversation(session: ParsedSession, options?: {
  includeThoughts?: boolean;
  includeToolCalls?: boolean;
  includeTokens?: boolean;
  maxContentLength?: number;
}): string {
  const {
    includeThoughts = false,
    includeToolCalls = false,
    includeTokens = false,
    maxContentLength = 4096
  } = options || {};

  const lines: string[] = [];

  lines.push(`=== Session: ${session.sessionId} ===`);
  lines.push(`Tool: ${session.tool}`);
  lines.push(`Started: ${session.startTime}`);
  lines.push(`Updated: ${session.lastUpdated}`);
  if (session.model) {
    lines.push(`Model: ${session.model}`);
  }
  lines.push('');

  for (const turn of session.turns) {
    const roleLabel = turn.role === 'user' ? 'USER' : 'ASSISTANT';
    lines.push(`--- Turn ${turn.turnNumber} [${roleLabel}] ---`);

    const content = turn.content.length > maxContentLength
      ? turn.content.substring(0, maxContentLength) + '\n[truncated]'
      : turn.content;
    lines.push(content);

    if (includeThoughts && turn.thoughts && turn.thoughts.length > 0) {
      lines.push('');
      lines.push('Thoughts:');
      for (const thought of turn.thoughts) {
        lines.push(`  - ${thought}`);
      }
    }

    if (includeToolCalls && turn.toolCalls && turn.toolCalls.length > 0) {
      lines.push('');
      lines.push('Tool Calls:');
      for (const tc of turn.toolCalls) {
        lines.push(`  - ${tc.name}`);
        if (tc.output) {
          const output = tc.output.length > 200
            ? tc.output.substring(0, 200) + '...'
            : tc.output;
          lines.push(`    Output: ${output}`);
        }
      }
    }

    if (includeTokens && turn.tokens) {
      lines.push(`Tokens: ${turn.tokens.total} (in: ${turn.tokens.input}, out: ${turn.tokens.output})`);
    }

    lines.push('');
  }

  if (session.totalTokens) {
    lines.push(`=== Total Tokens: ${session.totalTokens.total} ===`);
  }

  return lines.join('\n');
}

/**
 * Extract just user prompts and assistant responses as simple pairs
 */
export function extractConversationPairs(session: ParsedSession): Array<{
  turn: number;
  userPrompt: string;
  assistantResponse: string;
  timestamp: string;
}> {
  const pairs: Array<{
    turn: number;
    userPrompt: string;
    assistantResponse: string;
    timestamp: string;
  }> = [];

  const turnNumbers = [...new Set(session.turns.map(t => t.turnNumber))];

  for (const turnNum of turnNumbers) {
    const userTurn = session.turns.find(t => t.turnNumber === turnNum && t.role === 'user');
    const assistantTurn = session.turns.find(t => t.turnNumber === turnNum && t.role === 'assistant');

    if (userTurn) {
      pairs.push({
        turn: turnNum,
        userPrompt: userTurn.content,
        assistantResponse: assistantTurn?.content || '',
        timestamp: userTurn.timestamp
      });
    }
  }

  return pairs;
}
