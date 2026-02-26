/**
 * Claude Session Parser - Parses Claude Code CLI JSONL session files
 * Storage path: ~/.claude/projects/<projectHash>/<sessionId>.jsonl
 */

import { readFileSync, existsSync } from 'fs';
import { basename } from 'path';
import type { ParsedSession, ParsedTurn, ToolCallInfo, TokenInfo } from './session-content-parser.js';

/**
 * Claude JSONL line types
 * Each line is a JSON object with a type field indicating the content type
 */
export interface ClaudeJsonlLine {
  type: 'user' | 'assistant' | 'summary' | 'file-history-snapshot';
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  sessionId?: string;
  cwd?: string;
  version?: string;
  gitBranch?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
}

/**
 * User message line in Claude JSONL
 * Content can be string or array of content blocks
 */
export interface ClaudeUserLine extends ClaudeJsonlLine {
  type: 'user';
  message: {
    role: 'user';
    content: string | ClaudeContentBlock[];
  };
  userType?: string;
}

/**
 * Assistant message line in Claude JSONL
 * Contains content blocks, tool calls, and usage info
 * Note: usage can be at top level or inside message object
 */
export interface ClaudeAssistantLine extends ClaudeJsonlLine {
  type: 'assistant';
  message: {
    role: 'assistant';
    content: ClaudeContentBlock[];
    model?: string;
    id?: string;
    stop_reason?: string | null;
    stop_sequence?: string | null;
    usage?: ClaudeUsage;
  };
  usage?: ClaudeUsage;
  requestId?: string;
}

/**
 * Summary line in Claude JSONL (for compacted conversations)
 */
export interface ClaudeSummaryLine extends ClaudeJsonlLine {
  type: 'summary';
  summary: string;
  lemon?: string;
}

/**
 * File history snapshot (metadata, not conversation content)
 */
export interface ClaudeFileHistoryLine extends ClaudeJsonlLine {
  type: 'file-history-snapshot';
  messageId: string;
  snapshot: {
    messageId: string;
    trackedFileBackups: Record<string, unknown>;
    timestamp: string;
  };
  isSnapshotUpdate: boolean;
}

/**
 * Content block in Claude messages
 */
export interface ClaudeContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'image' | 'thinking';
  text?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  source?: {
    type: string;
    media_type?: string;
    data?: string;
    path?: string;
  };
  thinking?: string;
}

/**
 * Token usage information in Claude messages
 */
export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  service_tier?: string;
}

/**
 * Parse Claude Code CLI session file (JSONL format)
 * @param filePath - Path to the Claude JSONL session file
 * @returns ParsedSession object with turns, tokens, and metadata
 */
export function parseClaudeSession(filePath: string): ParsedSession | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());

    // Extract session ID from filename (UUID format)
    const sessionId = extractSessionId(filePath);

    const turns: ParsedTurn[] = [];
    let workingDir = '';
    let startTime = '';
    let lastUpdated = '';
    let model: string | undefined;
    let totalTokens: TokenInfo = { input: 0, output: 0, total: 0 };

    // Build message map for parent-child relationships
    const messageMap = new Map<string, ClaudeJsonlLine>();

    // First pass: collect all messages
    for (const line of lines) {
      try {
        const entry: ClaudeJsonlLine = JSON.parse(line);

        // Skip non-conversation types
        if (entry.type === 'file-history-snapshot') {
          continue;
        }

        messageMap.set(entry.uuid, entry);

        // Extract metadata from first entry
        if (!startTime && entry.timestamp) {
          startTime = entry.timestamp;
        }
        if (!workingDir && entry.cwd) {
          workingDir = entry.cwd;
        }

        // Update last timestamp
        if (entry.timestamp) {
          lastUpdated = entry.timestamp;
        }
      } catch (e) {
        console.warn('[claude-session-parser] Failed to parse JSON line:', e instanceof Error ? e.message : String(e));
      }
    }

    // Second pass: process user/assistant message pairs
    // Find all user messages that are not meta/command messages
    let turnNumber = 0;
    const processedUserUuids = new Set<string>();

    for (const [uuid, entry] of messageMap) {
      if (entry.type !== 'user') continue;

      const userEntry = entry as ClaudeUserLine;

      // Skip meta messages (command messages, system messages)
      if (userEntry.isMeta) continue;

      // Skip if already processed
      if (processedUserUuids.has(uuid)) continue;

      // Extract user content
      const userContent = extractUserContent(userEntry);

      // Skip if no meaningful content (commands, tool results, etc.)
      if (!userContent || userContent.trim().length === 0) continue;

      // Skip command-like messages
      if (isCommandMessage(userContent)) continue;

      processedUserUuids.add(uuid);
      turnNumber++;

      // Find the corresponding assistant response(s)
      // Look for assistant messages that have this user message as parent
      let assistantContent = '';
      let assistantTimestamp = '';
      let toolCalls: ToolCallInfo[] = [];
      let thoughts: string[] = [];
      let turnTokens: TokenInfo | undefined;

      for (const [childUuid, childEntry] of messageMap) {
        if (childEntry.parentUuid === uuid && childEntry.type === 'assistant') {
          const assistantEntry = childEntry as ClaudeAssistantLine;

          const extracted = extractAssistantContent(assistantEntry);
          if (extracted.content) {
            assistantContent = extracted.content;
            assistantTimestamp = childEntry.timestamp;
          }
          if (extracted.toolCalls.length > 0) {
            toolCalls = toolCalls.concat(extracted.toolCalls);
          }
          if (extracted.thoughts.length > 0) {
            thoughts = thoughts.concat(extracted.thoughts);
          }

          // Usage can be at top level or inside message object
          const usage = assistantEntry.usage || assistantEntry.message?.usage;
          if (usage) {
            turnTokens = {
              input: usage.input_tokens,
              output: usage.output_tokens,
              total: usage.input_tokens + usage.output_tokens,
              cached: (usage.cache_read_input_tokens || 0) +
                      (usage.cache_creation_input_tokens || 0)
            };

            // Accumulate total tokens
            totalTokens.input = (totalTokens.input || 0) + (turnTokens.input || 0);
            totalTokens.output = (totalTokens.output || 0) + (turnTokens.output || 0);

            // Extract model from assistant message
            if (!model && assistantEntry.message?.model) {
              model = assistantEntry.message.model;
            }
          }
        }
      }

      // Create user turn
      turns.push({
        turnNumber,
        timestamp: entry.timestamp,
        role: 'user',
        content: userContent
      });

      // Create assistant turn if there's a response
      if (assistantContent || toolCalls.length > 0) {
        turns.push({
          turnNumber,
          timestamp: assistantTimestamp || entry.timestamp,
          role: 'assistant',
          content: assistantContent || '[Tool execution]',
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          thoughts: thoughts.length > 0 ? thoughts : undefined,
          tokens: turnTokens
        });
      }
    }

    // Calculate total tokens
    totalTokens.total = (totalTokens.input || 0) + (totalTokens.output || 0);

    return {
      sessionId,
      tool: 'claude',
      workingDir,
      startTime,
      lastUpdated,
      turns,
      totalTokens: totalTokens.total > 0 ? totalTokens : undefined,
      model
    };
  } catch (error) {
    console.error(`Failed to parse Claude session file ${filePath}:`, error);
    return null;
  }
}

/**
 * Check if content is a command message (should be skipped)
 */
function isCommandMessage(content: string): boolean {
  const trimmed = content.trim();
  return (
    trimmed.startsWith('<command-name>') ||
    trimmed.startsWith('<local-command') ||
    trimmed.startsWith('<command-') ||
    trimmed.includes('<local-command-caveat>')
  );
}

/**
 * Extract session ID from file path
 * Claude session files are named <uuid>.jsonl
 */
function extractSessionId(filePath: string): string {
  const filename = basename(filePath);
  // Remove .jsonl extension
  const nameWithoutExt = filename.replace(/\.jsonl$/i, '');
  // Check if it's a UUID format
  const uuidMatch = nameWithoutExt.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  return uuidMatch ? uuidMatch[1] : nameWithoutExt;
}

/**
 * Extract text content from user message
 * Handles both string and array content formats
 */
function extractUserContent(entry: ClaudeUserLine): string {
  const content = entry.message?.content;
  if (!content) return '';

  // Simple string content
  if (typeof content === 'string') {
    return content;
  }

  // Array content - extract text blocks
  if (Array.isArray(content)) {
    const textParts: string[] = [];
    for (const block of content) {
      if (block.type === 'text' && block.text) {
        textParts.push(block.text);
      }
      // Note: tool_result blocks contain tool outputs, not user text
    }
    return textParts.join('\n');
  }

  return '';
}

/**
 * Extract content, tool calls, and thoughts from assistant message
 */
function extractAssistantContent(entry: ClaudeAssistantLine): {
  content: string;
  toolCalls: ToolCallInfo[];
  thoughts: string[];
} {
  const result: { content: string; toolCalls: ToolCallInfo[]; thoughts: string[] } = {
    content: '',
    toolCalls: [],
    thoughts: []
  };

  const content = entry.message?.content;
  if (!content || !Array.isArray(content)) {
    return result;
  }

  const textParts: string[] = [];

  for (const block of content) {
    switch (block.type) {
      case 'text':
        if (block.text) {
          textParts.push(block.text);
        }
        break;

      case 'thinking':
        if (block.thinking) {
          result.thoughts.push(block.thinking);
        }
        break;

      case 'tool_use':
        result.toolCalls.push({
          name: block.name || 'unknown',
          arguments: block.input ? JSON.stringify(block.input) : undefined
        });
        break;
    }
  }

  result.content = textParts.join('\n');
  return result;
}

/**
 * Parse Claude session content from string (for in-memory parsing)
 * @param content - The JSONL content as string
 * @param filePath - Optional file path for session ID extraction
 * @returns ParsedSession object
 */
export function parseClaudeSessionContent(content: string, filePath?: string): ParsedSession | null {
  const sessionId = filePath ? extractSessionId(filePath) : 'unknown';

  const lines = content.split('\n').filter(l => l.trim());
  const turns: ParsedTurn[] = [];
  let workingDir = '';
  let startTime = '';
  let lastUpdated = '';
  let model: string | undefined;
  let totalTokens: TokenInfo = { input: 0, output: 0, total: 0 };

  // Build message map
  const messageMap = new Map<string, ClaudeJsonlLine>();

  for (const line of lines) {
    try {
      const entry: ClaudeJsonlLine = JSON.parse(line);

      if (entry.type === 'file-history-snapshot') {
        continue;
      }

      messageMap.set(entry.uuid, entry);

      if (!startTime && entry.timestamp) {
        startTime = entry.timestamp;
      }
      if (!workingDir && entry.cwd) {
        workingDir = entry.cwd;
      }
      if (entry.timestamp) {
        lastUpdated = entry.timestamp;
      }
    } catch (e) {
      console.warn('[claude-session-parser] Failed to parse JSON line in parseClaudeSessionContent:', e instanceof Error ? e.message : String(e));
    }
  }

  // Process user/assistant pairs
  let turnNumber = 0;
  const processedUserUuids = new Set<string>();

  for (const [uuid, entry] of messageMap) {
    if (entry.type !== 'user') continue;

    const userEntry = entry as ClaudeUserLine;

    if (userEntry.isMeta) continue;
    if (processedUserUuids.has(uuid)) continue;

    const userContent = extractUserContent(userEntry);
    if (!userContent || userContent.trim().length === 0) continue;
    if (isCommandMessage(userContent)) continue;

    processedUserUuids.add(uuid);
    turnNumber++;

    let assistantContent = '';
    let assistantTimestamp = '';
    let toolCalls: ToolCallInfo[] = [];
    let thoughts: string[] = [];
    let turnTokens: TokenInfo | undefined;

    for (const [childUuid, childEntry] of messageMap) {
      if (childEntry.parentUuid === uuid && childEntry.type === 'assistant') {
        const assistantEntry = childEntry as ClaudeAssistantLine;

        const extracted = extractAssistantContent(assistantEntry);
        if (extracted.content) {
          assistantContent = extracted.content;
          assistantTimestamp = childEntry.timestamp;
        }
        if (extracted.toolCalls.length > 0) {
          toolCalls = toolCalls.concat(extracted.toolCalls);
        }
        if (extracted.thoughts.length > 0) {
          thoughts = thoughts.concat(extracted.thoughts);
        }

        // Usage can be at top level or inside message object
        const usage = assistantEntry.usage || assistantEntry.message?.usage;
        if (usage) {
          turnTokens = {
            input: usage.input_tokens,
            output: usage.output_tokens,
            total: usage.input_tokens + usage.output_tokens,
            cached: (usage.cache_read_input_tokens || 0) +
                    (usage.cache_creation_input_tokens || 0)
          };

          totalTokens.input = (totalTokens.input || 0) + (turnTokens.input || 0);
          totalTokens.output = (totalTokens.output || 0) + (turnTokens.output || 0);

          if (!model && assistantEntry.message?.model) {
            model = assistantEntry.message.model;
          }
        }
      }
    }

    turns.push({
      turnNumber,
      timestamp: entry.timestamp,
      role: 'user',
      content: userContent
    });

    if (assistantContent || toolCalls.length > 0) {
      turns.push({
        turnNumber,
        timestamp: assistantTimestamp || entry.timestamp,
        role: 'assistant',
        content: assistantContent || '[Tool execution]',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        thoughts: thoughts.length > 0 ? thoughts : undefined,
        tokens: turnTokens
      });
    }
  }

  totalTokens.total = (totalTokens.input || 0) + (totalTokens.output || 0);

  return {
    sessionId,
    tool: 'claude',
    workingDir,
    startTime,
    lastUpdated,
    turns,
    totalTokens: totalTokens.total > 0 ? totalTokens : undefined,
    model
  };
}
