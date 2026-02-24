/**
 * CLI Output Converter
 * Converts raw CLI tool output into structured Intermediate Representation (IR)
 *
 * Purpose: Decouple output parsing from consumption scenarios (View, Storage, Resume)
 * Supports: Plain text, JSON Lines, and other structured formats
 */

// ========== Type Definitions ==========

/**
 * Unified output unit types for the intermediate representation layer
 */
export type CliOutputUnitType =
  | 'stdout'         // Standard output text
  | 'stderr'         // Standard error text
  | 'thought'        // AI reasoning/thinking
  | 'code'           // Code block content
  | 'file_diff'      // File modification diff
  | 'progress'       // Progress updates
  | 'metadata'       // Session/execution metadata
  | 'system'         // System events/messages
  | 'tool_call'      // Tool invocation/result (Gemini tool_use/tool_result)
  | 'agent_message'  // Final agent response (for --final output)
  | 'streaming_content';  // Streaming delta content (only last one used in final output)

/**
 * Intermediate Representation unit
 * Common structure for all CLI output chunks
 */
export interface CliOutputUnit<T = any> {
  type: CliOutputUnitType;
  content: T;
  timestamp: string;  // ISO 8601 format
}

// ========== Parser Interface ==========

/**
 * Parser interface for converting raw output into IR
 */
export interface IOutputParser {
  /**
   * Parse a chunk of data from stdout/stderr stream
   * @param chunk - Raw buffer from stream
   * @param streamType - Source stream (stdout or stderr)
   * @returns Array of parsed output units
   */
  parse(chunk: Buffer, streamType: 'stdout' | 'stderr'): CliOutputUnit[];

  /**
   * Flush any remaining buffered data
   * Called when stream ends to ensure no data is lost
   * @returns Array of remaining output units
   */
  flush(): CliOutputUnit[];
}

// ========== Plain Text Parser ==========

/**
 * PlainTextParser - Converts plain text output to IR
 * Simply wraps text in appropriate type envelope
 */
export class PlainTextParser implements IOutputParser {
  parse(chunk: Buffer, streamType: 'stdout' | 'stderr'): CliOutputUnit[] {
    const text = chunk.toString('utf8');

    if (!text) {
      return [];
    }

    return [{
      type: streamType,
      content: text,
      timestamp: new Date().toISOString()
    }];
  }

  /**
   * Flush any remaining buffered data
   * Called when stream ends to ensure no data is lost
   *
   * Note: PlainTextParser does not buffer data internally, so this method
   * always returns an empty array. Other parsers (e.g., JsonLinesParser)
   * may have buffered incomplete lines that need to be flushed.
   *
   * @returns Array of remaining output units (always empty for PlainTextParser)
   */
  flush(): CliOutputUnit[] {
    // Plain text parser has no internal buffer
    return [];
  }
}

// ========== JSON Lines Parser ==========

/**
 * JsonLinesParser - Parses newline-delimited JSON output
 *
 * Features:
 * - Handles incomplete lines across chunks
 * - Maps JSON events to appropriate IR types
 * - Falls back to stdout for unparseable lines
 * - Robust error handling for malformed JSON
 */
export class JsonLinesParser implements IOutputParser {
  private buffer: string = '';

  // Gemini "message" frames may be true deltas OR cumulative content (varies by CLI/version).
  // Track cumulative assistant content so we can normalize cumulative frames into true deltas and
  // avoid emitting duplicated content downstream (terminal + dashboard + final reconstruction).
  private geminiAssistantCumulative: string = '';
  private geminiSawAssistantDelta: boolean = false;

  /**
   * Classify non-JSON content to determine appropriate output type
   * Helps distinguish real errors from normal progress/output sent to stderr
   * (Some CLI tools like Codex send all progress info to stderr)
   */
  private classifyNonJsonContent(content: string, originalType: 'stdout' | 'stderr'): 'stdout' | 'stderr' | 'progress' {
    // Check for CLI initialization/progress patterns that should be filtered from final output
    const cliProgressPatterns = [
      /^Loaded cached credentials\.?$/i,        // Gemini auth message
      /^Loading.*\.\.\.$/i,                      // Loading messages
      /^Initializ(ing|ed).*$/i,                  // Initialization messages
      /^Connecting.*$/i,                         // Connection messages
      /^Authenticat(ing|ed).*$/i,                // Auth messages
      /^Waiting.*$/i,                            // Waiting messages
      /^Retry(ing)?.*$/i,                        // Retry messages
      /^Using model:?.*$/i,                      // Model info
      /^Session (started|resumed).*$/i,          // Session info
    ];

    for (const pattern of cliProgressPatterns) {
      if (pattern.test(content.trim())) {
        return 'progress';  // Will be filtered from final output
      }
    }

    // If it came from stdout, keep it as stdout
    if (originalType === 'stdout') {
      return 'stdout';
    }

    // Check if content looks like an actual error
    const errorPatterns = [
      /^error:/i,
      /^fatal:/i,
      /^failed:/i,
      /^exception:/i,
      /\bERROR\b/,
      /\bFATAL\b/,
      /\bFAILED\b/,
      /\bpanic:/i,
      /traceback \(most recent/i,
      /syntaxerror:/i,
      /typeerror:/i,
      /referenceerror:/i,
      /\bstack trace\b/i,
      /\bat line \d+\b/i,
      /permission denied/i,
      /access denied/i,
      /authentication failed/i,
      /connection refused/i,
      /network error/i,
      /unable to connect/i,
    ];

    for (const pattern of errorPatterns) {
      if (pattern.test(content)) {
        return 'stderr';
      }
    }

    // Check for common CLI progress/info patterns that are NOT errors
    const progressPatterns = [
      /^[-=]+$/,                    // Separators: ----, ====
      /^\s*\d+\s*$/,               // Just numbers
      /tokens?\s*(used|count)/i,   // Token counts
      /model:/i,                   // Model info
      /session\s*id:/i,            // Session info
      /workdir:/i,                 // Working directory
      /provider:/i,                // Provider info
      /^(user|assistant|codex|claude|gemini)$/i,  // Role labels
      /^mcp:/i,                    // MCP status
      /^[-\s]*$/,                  // Empty or whitespace/dashes
    ];

    for (const pattern of progressPatterns) {
      if (pattern.test(content)) {
        return 'stdout';  // Treat as normal output, not error
      }
    }

    // Default: if stderr but doesn't look like an error, treat as stdout
    // This handles CLI tools that send everything to stderr (like Codex)
    return 'stdout';
  }

  parse(chunk: Buffer, streamType: 'stdout' | 'stderr'): CliOutputUnit[] {
    const text = chunk.toString('utf8');
    this.buffer += text;

    const units: CliOutputUnit[] = [];
    const lines = this.buffer.split('\n');

    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      // Try to parse as JSON
      let parsed: any;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // Not valid JSON, treat as plain text
        // For stderr content, check if it's actually an error or just normal output
        // (Some CLI tools like Codex send all progress info to stderr)
        const effectiveType = this.classifyNonJsonContent(line, streamType);
        units.push({
          type: effectiveType,
          content: line,
          timestamp: new Date().toISOString()
        });
        continue;
      }

      // Map JSON structure to IR type
      const unit = this.mapJsonToIR(parsed, streamType);
      if (unit) {
        units.push(unit);
      }
    }

    return units;
  }

  flush(): CliOutputUnit[] {
    const units: CliOutputUnit[] = [];

    if (this.buffer.trim()) {
      // Try to parse remaining buffer
      try {
        const parsed = JSON.parse(this.buffer.trim());
        const unit = this.mapJsonToIR(parsed, 'stdout');
        if (unit) {
          units.push(unit);
        }
      } catch {
        // Not valid JSON, return as plain text
        units.push({
          type: 'stdout',
          content: this.buffer,
          timestamp: new Date().toISOString()
        });
      }
    }

    this.buffer = '';
    return units;
  }

  /**
   * Debug logging helper for CLI output parsing
   * Enable with DEBUG_CLI_OUTPUT=true environment variable
   */
  private debugLog(event: string, data: Record<string, unknown>): void {
    if (process.env.DEBUG_CLI_OUTPUT) {
      const logEntry = {
        ts: new Date().toISOString(),
        event,
        ...data
      };
      console.error(`[CLI_OUTPUT_DEBUG] ${JSON.stringify(logEntry)}`);
    }
  }

  /**
   * Map parsed JSON object to appropriate IR type
   * Handles various JSON event formats from different CLI tools:
   * - Gemini CLI: stream-json format (init, message, result)
   * - Codex CLI: --json format (thread.started, item.completed, turn.completed)
   * - Claude CLI: stream-json format (system, assistant, result)
   * - OpenCode CLI: --format json (step_start, text, step_finish)
   */
  private mapJsonToIR(json: any, fallbackStreamType: 'stdout' | 'stderr'): CliOutputUnit | null {
    this.debugLog('mapJsonToIR_input', { type: json.type, role: json.role, keys: Object.keys(json) });
    // Handle numeric timestamp (milliseconds) from OpenCode
    const timestamp = typeof json.timestamp === 'number'
      ? new Date(json.timestamp).toISOString()
      : (json.timestamp || new Date().toISOString());

    // ========== Gemini CLI stream-json format ==========
    // {"type":"init","timestamp":"...","session_id":"...","model":"..."}
    // {"type":"message","timestamp":"...","role":"assistant","content":"...","delta":true}
    // {"type":"result","timestamp":"...","status":"success","stats":{...}}
    if (json.type === 'init' && json.session_id) {
      return {
        type: 'metadata',
        content: {
          tool: 'gemini',
          sessionId: json.session_id,
          model: json.model,
          raw: json
        },
        timestamp
      };
    }

    if (json.type === 'message' && json.role) {
      // Gemini assistant/user message
      if (json.role === 'assistant') {
        const content = json.content || '';
        if (!content) {
          return null;
        }

        // Delta messages use 'streaming_content' type (should be incremental).
        // Some CLIs send delta=true with cumulative content; normalize to a suffix-delta when possible.
        if (json.delta === true) {
          this.geminiSawAssistantDelta = true;

          // Duplicate frame
          if (content === this.geminiAssistantCumulative) {
            return null;
          }

          // Cumulative frame (new content starts with previous content)
          if (this.geminiAssistantCumulative && content.startsWith(this.geminiAssistantCumulative)) {
            const delta = content.slice(this.geminiAssistantCumulative.length);
            this.geminiAssistantCumulative = content;
            if (!delta) {
              return null;
            }
            return {
              type: 'streaming_content',
              content: delta,
              timestamp
            };
          }

          // Unexpected reset/shortening: treat as a fresh stream restart to avoid negative slicing
          if (this.geminiAssistantCumulative && this.geminiAssistantCumulative.startsWith(content)) {
            this.geminiAssistantCumulative = content;
            return {
              type: 'streaming_content',
              content,
              timestamp
            };
          }

          // True delta frame (append-only)
          this.geminiAssistantCumulative += content;
          return {
            type: 'streaming_content',
            content,
            timestamp
          };
        }

        // Non-delta (final) messages use 'agent_message' type directly.
        // If we already streamed deltas for this assistant message, skip this final frame to avoid duplication
        // in streaming UIs (frontend already has the assembled content from deltas).
        if (this.geminiSawAssistantDelta) {
          // Keep cumulative for potential later comparisons but do not emit.
          this.geminiAssistantCumulative = content;
          return null;
        }

        this.geminiAssistantCumulative = content;
        return {
          type: 'agent_message',
          content,
          timestamp
        };
      }
      // Skip user messages in output (they're echo of input)
      return null;
    }

    if (json.type === 'result' && json.stats) {
      return {
        type: 'metadata',
        content: {
          tool: 'gemini',
          status: json.status,
          stats: json.stats,
          raw: json
        },
        timestamp
      };
    }

    // Gemini tool_use: {"type":"tool_use","timestamp":"...","tool_name":"...","tool_id":"...","parameters":{...}}
    if (json.type === 'tool_use' && json.tool_name) {
      return {
        type: 'tool_call',
        content: {
          tool: 'gemini',
          action: 'invoke',
          toolName: json.tool_name,
          toolId: json.tool_id,
          parameters: json.parameters,
          raw: json
        },
        timestamp
      };
    }

    // Gemini tool_result: {"type":"tool_result","timestamp":"...","tool_id":"...","status":"...","output":"..."}
    if (json.type === 'tool_result' && json.tool_id) {
      return {
        type: 'tool_call',
        content: {
          tool: 'gemini',
          action: 'result',
          toolId: json.tool_id,
          status: json.status,
          output: json.output,
          raw: json
        },
        timestamp
      };
    }

    // ========== Codex CLI --json format ==========
    // {"type":"thread.started","thread_id":"..."}
    // {"type":"turn.started"}
    // {"type":"item.started","item":{"id":"...","type":"command_execution","status":"in_progress"}}
    // {"type":"item.completed","item":{"id":"...","type":"reasoning","text":"..."}}
    // {"type":"item.completed","item":{"id":"...","type":"agent_message","text":"..."}}
    // {"type":"item.completed","item":{"id":"...","type":"command_execution","aggregated_output":"..."}}
    // {"type":"turn.completed","usage":{"input_tokens":...,"output_tokens":...}}
    if (json.type === 'thread.started' && json.thread_id) {
      return {
        type: 'metadata',
        content: {
          tool: 'codex',
          threadId: json.thread_id,
          raw: json
        },
        timestamp
      };
    }

    if (json.type === 'turn.started') {
      return {
        type: 'progress',
        content: {
          message: 'Turn started',
          tool: 'codex'
        },
        timestamp
      };
    }

    // Handle item.started - command execution in progress
    if (json.type === 'item.started' && json.item) {
      const item = json.item;
      if (item.type === 'command_execution') {
        return {
          type: 'progress',
          content: {
            message: `Executing: ${item.command || 'command'}`,
            tool: 'codex',
            status: item.status || 'in_progress'
          },
          timestamp
        };
      }
      // Other item.started types
      return {
        type: 'progress',
        content: {
          message: `Starting: ${item.type}`,
          tool: 'codex'
        },
        timestamp
      };
    }

    if (json.type === 'item.completed' && json.item) {
      const item = json.item;

      if (item.type === 'reasoning') {
        return {
          type: 'thought',
          content: item.text || item.summary || '',
          timestamp
        };
      }

      if (item.type === 'agent_message') {
        return {
          type: 'agent_message',  // Use dedicated type for final agent response
          content: item.text || '',
          timestamp
        };
      }

      // Handle command_execution output
      if (item.type === 'command_execution') {
        // Show command output as code block
        const output = item.aggregated_output || '';
        return {
          type: 'code',
          content: {
            command: item.command,
            output: output,
            exitCode: item.exit_code,
            status: item.status
          },
          timestamp
        };
      }

      // Other item types (function_call, etc.)
      return {
        type: 'system',
        content: {
          itemType: item.type,
          itemId: item.id,
          raw: item
        },
        timestamp
      };
    }

    if (json.type === 'turn.completed' && json.usage) {
      return {
        type: 'metadata',
        content: {
          tool: 'codex',
          usage: json.usage,
          raw: json
        },
        timestamp
      };
    }

    // ========== Claude CLI stream-json format ==========
    // {"type":"system","subtype":"init","cwd":"...","session_id":"...","tools":[...],"model":"..."}
    // {"type":"assistant","message":{...},"session_id":"..."}
    // {"type":"result","subtype":"success","duration_ms":...,"result":"...","total_cost_usd":...}
    if (json.type === 'system' && json.subtype === 'init') {
      return {
        type: 'metadata',
        content: {
          tool: 'claude',
          sessionId: json.session_id,
          model: json.model,
          cwd: json.cwd,
          tools: json.tools,
          mcpServers: json.mcp_servers,
          raw: json
        },
        timestamp
      };
    }

    if (json.type === 'assistant' && json.message) {
      // Extract text content from Claude message
      const message = json.message;
      const textContent = message.content
        ?.filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n') || '';

      return {
        type: 'agent_message',  // Use dedicated type for Claude final response
        content: textContent,
        timestamp
      };
    }

    if (json.type === 'result' && json.subtype) {
      return {
        type: 'metadata',
        content: {
          tool: 'claude',
          status: json.subtype,
          result: json.result,
          durationMs: json.duration_ms,
          totalCostUsd: json.total_cost_usd,
          usage: json.usage,
          modelUsage: json.modelUsage,
          raw: json
        },
        timestamp
      };
    }

    // ========== OpenCode CLI --format json ==========
    // {"type":"step_start","timestamp":...,"sessionID":"...","part":{...}}
    // {"type":"text","timestamp":...,"sessionID":"...","part":{"type":"text","text":"..."}}
    // {"type":"tool_use","timestamp":...,"sessionID":"...","part":{"type":"tool","tool":"glob","input":{...},"state":{...}}}
    // {"type":"step_finish","timestamp":...,"part":{"tokens":{...}}}
    if (json.type === 'step_start' && json.sessionID) {
      return {
        type: 'progress',
        content: {
          message: 'Step started',
          tool: 'opencode',
          sessionId: json.sessionID
        },
        timestamp
      };
    }

    if (json.type === 'text' && json.part) {
      return {
        type: 'agent_message',  // Use dedicated type for OpenCode text response
        content: json.part.text || '',
        timestamp
      };
    }

    // OpenCode tool_use: {"type":"tool_use","part":{"type":"tool","tool":"glob","input":{...},"state":{"status":"..."}}}
    if (json.type === 'tool_use' && json.part) {
      const part = json.part;
      const toolName = part.tool || 'unknown';
      const status = part.state?.status || 'in_progress';
      const input = part.input || {};

      return {
        type: 'tool_call',
        content: {
          tool: 'opencode',
          action: status === 'completed' ? 'result' : 'invoke',
          toolName: toolName,
          toolId: part.callID || part.id,
          parameters: input,
          status: status,
          output: part.output
        },
        timestamp
      };
    }

    if (json.type === 'step_finish' && json.part) {
      const tokens = json.part.tokens || {};
      const inputTokens = tokens.input || 0;
      const outputTokens = tokens.output || 0;

      return {
        type: 'metadata',
        content: {
          tool: 'opencode',
          reason: json.part.reason,
          tokens: { input: inputTokens, output: outputTokens },
          cost: json.part.cost
        },
        timestamp
      };
    }

    // ========== Legacy/Generic formats ==========
    // Check for generic type field patterns
    if (json.type) {
      switch (json.type) {
        case 'thought':
        case 'thinking':
        case 'reasoning':
          return {
            type: 'thought',
            content: json.content || json.text || json.message,
            timestamp
          };

        case 'code':
        case 'code_block':
          return {
            type: 'code',
            content: json.content || json.code,
            timestamp
          };

        case 'diff':
        case 'file_diff':
        case 'file_change':
          return {
            type: 'file_diff',
            content: {
              path: json.path || json.file,
              diff: json.diff || json.content,
              action: json.action || 'modify'
            },
            timestamp
          };

        case 'progress':
        case 'status':
          return {
            type: 'progress',
            content: {
              message: json.message || json.content,
              progress: json.progress,
              total: json.total
            },
            timestamp
          };

        case 'metadata':
        case 'session_meta':
          return {
            type: 'metadata',
            content: json.payload || json.data || json,
            timestamp
          };

        case 'system':
        case 'event':
          return {
            type: 'system',
            content: json.message || json.content || json,
            timestamp
          };
      }
    }

    // Check for legacy Codex JSONL format (response_item)
    if (json.type === 'response_item' && json.payload) {
      const payloadType = json.payload.type;

      if (payloadType === 'message') {
        // User or assistant message
        const content = json.payload.content
          ?.map((c: any) => c.text || '')
          .filter((t: string) => t)
          .join('\n') || '';

        return {
          type: 'agent_message',  // Use dedicated type for legacy Codex response
          content,
          timestamp
        };
      }

      if (payloadType === 'reasoning') {
        return {
          type: 'thought',
          content: json.payload.summary || json.payload.content,
          timestamp
        };
      }

      if (payloadType === 'function_call' || payloadType === 'function_call_output') {
        return {
          type: 'system',
          content: json.payload,
          timestamp
        };
      }
    }

    // Check for Gemini/Qwen message format (role-based)
    if (json.role === 'assistant') {
      return {
        type: 'agent_message',  // Use dedicated type for Gemini/Qwen assistant response
        content: json.content || json.text || '',
        timestamp
      };
    }
    if (json.role === 'user') {
      return {
        type: 'stdout',  // User messages remain as stdout
        content: json.content || json.text || '',
        timestamp
      };
    }

    // Check for thoughts array
    if (json.thoughts && Array.isArray(json.thoughts)) {
      return {
        type: 'thought',
        content: json.thoughts.map((t: any) =>
          typeof t === 'string' ? t : `${t.subject}: ${t.description}`
        ).join('\n'),
        timestamp
      };
    }

    // Default: treat as stdout/stderr based on fallback
    if (json.content || json.message || json.text) {
      const rawContent = json.content || json.message || json.text;
      // Safely convert to string: content may be an array (e.g. Claude API content blocks) or object
      const contentStr = typeof rawContent === 'string'
        ? rawContent
        : JSON.stringify(rawContent);
      this.debugLog('mapJsonToIR_fallback_stdout', {
        type: json.type,
        fallbackType: fallbackStreamType,
        hasContent: !!json.content,
        hasMessage: !!json.message,
        hasText: !!json.text,
        contentPreview: contentStr.substring(0, 100)
      });
      return {
        type: fallbackStreamType,
        content: contentStr,
        timestamp
      };
    }

    // Unrecognized structure, return as metadata
    this.debugLog('mapJsonToIR_fallback_metadata', { type: json.type, keys: Object.keys(json) });
    return {
      type: 'metadata',
      content: json,
      timestamp
    };
  }
}

// ========== Smart Content Formatter ==========

/**
 * Intelligent content formatter that detects and formats JSON content
 * based on structural patterns rather than hardcoded tool-specific formats.
 *
 * Key detection patterns:
 * - Session/Metadata: session_id, sessionID, thread_id, model, stats
 * - Tool Calls: tool_name, tool, function_name, parameters
 * - Progress: status, progress, state, reason
 * - Tokens: tokens, usage, input_tokens, output_tokens
 * - Text Content: content, text, message
 */
export class SmartContentFormatter {
  /**
   * Format structured content into human-readable text
   * NEVER returns null - always returns displayable content to prevent data loss
   */
  static format(content: any, type: CliOutputUnitType): string {
    // Handle null/undefined
    if (content === null || content === undefined) {
      return '';
    }

    // String content - return as-is
    if (typeof content === 'string') {
      return content;
    }

    // Primitive types - convert to string
    if (typeof content !== 'object') {
      return String(content);
    }

    // Type-specific formatting with fallback chain
    let result: string | null = null;

    switch (type) {
      case 'metadata':
        result = this.formatMetadata(content);
        break;
      case 'progress':
        result = this.formatProgress(content);
        break;
      case 'tool_call':
        result = this.formatToolCall(content);
        break;
      case 'code':
        result = this.formatCode(content);
        break;
      case 'file_diff':
        result = this.formatFileDiff(content);
        break;
      case 'thought':
        result = this.formatThought(content);
        break;
      case 'system':
        result = this.formatSystem(content);
        break;
      default:
        // Try to extract text content from common fields
        result = this.extractTextContent(content);
    }

    // If type-specific formatting succeeded, return it
    if (result && result.trim()) {
      return result;
    }

    // Fallback: try to extract any text content regardless of type
    const textContent = this.extractTextContent(content);
    if (textContent && textContent.trim()) {
      return textContent;
    }

    // Last resort: format as readable JSON with type hint
    return this.formatAsReadableJson(content, type);
  }

  /**
   * Format object as readable JSON with type hint (fallback for unknown content)
   * Ensures content is never lost
   */
  private static formatAsReadableJson(content: any, type: CliOutputUnitType): string {
    try {
      const jsonStr = JSON.stringify(content, null, 0);
      // For short content, show inline; for long content, indicate it's data
      if (jsonStr.length <= 200) {
        return `[${type}] ${jsonStr}`;
      }
      // For long content, show truncated with type indicator
      return `[${type}] ${jsonStr.substring(0, 200)}...`;
    } catch {
      // If JSON.stringify fails, try to extract keys
      const keys = Object.keys(content).slice(0, 5).join(', ');
      return `[${type}] {${keys}${Object.keys(content).length > 5 ? ', ...' : ''}}`;
    }
  }

  /**
   * Format metadata (session info, stats, etc.)
   * Returns null if no meaningful metadata could be extracted
   */
  private static formatMetadata(content: any): string | null {
    const parts: string[] = [];

    // Tool identifier
    if (content.tool) {
      parts.push(`[${content.tool.toUpperCase()}]`);
    }

    // Session ID
    const sessionId = content.sessionId || content.session_id || content.threadId || content.thread_id;
    if (sessionId) {
      parts.push(`Session: ${this.truncate(sessionId, 20)}`);
    }

    // Model info
    if (content.model) {
      parts.push(`Model: ${content.model}`);
    }

    // Status
    if (content.status) {
      parts.push(`Status: ${content.status}`);
    }

    // Reason (for step_finish events)
    if (content.reason) {
      parts.push(`Reason: ${content.reason}`);
    }

    // Duration
    if (content.durationMs || content.duration_ms) {
      const ms = content.durationMs || content.duration_ms;
      parts.push(`Duration: ${this.formatDuration(ms)}`);
    }

    // Token usage
    const tokens = this.extractTokens(content);
    if (tokens) {
      parts.push(`Tokens: ${tokens}`);
    }

    // Cost
    if (content.totalCostUsd !== undefined || content.total_cost_usd !== undefined || content.cost !== undefined) {
      const cost = content.totalCostUsd ?? content.total_cost_usd ?? content.cost;
      parts.push(`Cost: $${typeof cost === 'number' ? cost.toFixed(6) : cost}`);
    }

    // Result
    if (content.result && typeof content.result === 'string') {
      parts.push(`Result: ${this.truncate(content.result, 100)}`);
    }

    // Return null if no meaningful parts extracted (let fallback handle it)
    return parts.length > 0 ? parts.join(' | ') : null;
  }

  /**
   * Format progress updates
   * Returns null if no meaningful progress info could be extracted
   */
  private static formatProgress(content: any): string | null {
    const parts: string[] = [];

    // Tool identifier
    if (content.tool) {
      parts.push(`[${content.tool.toUpperCase()}]`);
    }

    // Message
    if (content.message) {
      parts.push(content.message);
    }

    // Status
    if (content.status) {
      parts.push(`(${content.status})`);
    }

    // Progress indicator
    if (content.progress !== undefined && content.total !== undefined) {
      parts.push(`[${content.progress}/${content.total}]`);
    }

    // Session ID (brief) - only show if no message (avoid duplication)
    const sessionId = content.sessionId || content.session_id;
    if (sessionId && !content.message) {
      parts.push(`Session: ${this.truncate(sessionId, 12)}`);
    }

    // Return null if no meaningful parts extracted (let fallback handle it)
    return parts.length > 0 ? parts.join(' ') : null;
  }

  /**
   * Format tool call (invoke/result)
   */
  private static formatToolCall(content: any): string {
    const toolName = content.toolName || content.tool_name || content.name || 'unknown';
    const action = content.action || 'invoke';
    const status = content.status;

    if (action === 'result') {
      const statusText = status || 'completed';
      let result = `[Tool Result] ${toolName}: ${statusText}`;
      if (content.output) {
        const outputStr = typeof content.output === 'string' ? content.output : JSON.stringify(content.output);
        result += ` → ${this.truncate(outputStr, 150)}`;
      }
      return result;
    } else {
      // invoke
      let params = '';
      if (content.parameters) {
        const paramStr = typeof content.parameters === 'string'
          ? content.parameters
          : JSON.stringify(content.parameters);
        params = this.truncate(paramStr, 100);
      }
      return `[Tool] ${toolName}(${params})`;
    }
  }

  /**
   * Format code block
   */
  private static formatCode(content: any): string {
    if (typeof content === 'string') {
      return `\`\`\`\n${content}\n\`\`\``;
    }

    const lang = content.language || '';
    const code = content.code || content.output || content.content || '';
    const command = content.command;

    let result = '';
    if (command) {
      result += `$ ${command}\n`;
    }
    result += `\`\`\`${lang}\n${code}\n\`\`\``;

    if (content.exitCode !== undefined) {
      result += `\n(exit: ${content.exitCode})`;
    }

    return result;
  }

  /**
   * Format file diff
   */
  private static formatFileDiff(content: any): string {
    const path = content.path || content.file || 'unknown';
    const action = content.action || 'modify';
    const diff = content.diff || content.content || '';

    return `[${action.toUpperCase()}] ${path}\n\`\`\`diff\n${diff}\n\`\`\``;
  }

  /**
   * Format thought/reasoning
   * Returns null if no text content could be extracted
   */
  private static formatThought(content: any): string | null {
    if (typeof content === 'string') {
      return `💭 ${content}`;
    }
    const text = content.text || content.summary || content.content || content.thinking;
    return text ? `💭 ${text}` : null;
  }

  /**
   * Format system message
   * Returns null if no message content could be extracted
   */
  private static formatSystem(content: any): string | null {
    if (typeof content === 'string') {
      return `⚙️ ${content}`;
    }
    const message = content.message || content.content || content.event || content.info;
    return message ? `⚙️ ${message}` : null;
  }

  /**
   * Extract text content from common fields
   */
  private static extractTextContent(content: any): string | null {
    // Priority order for text extraction
    const textFields = ['text', 'content', 'message', 'output', 'data'];

    for (const field of textFields) {
      if (content[field] && typeof content[field] === 'string') {
        return content[field];
      }
    }

    // Check for nested content
    if (content.part && typeof content.part === 'object') {
      const nested = this.extractTextContent(content.part);
      if (nested) return nested;
    }

    // Check for item content (Codex format)
    if (content.item && typeof content.item === 'object') {
      const nested = this.extractTextContent(content.item);
      if (nested) return nested;
    }

    return null;
  }

  /**
   * Extract token usage from various formats
   */
  private static extractTokens(content: any): string | null {
    // Direct tokens object
    if (content.tokens && typeof content.tokens === 'object') {
      const input = content.tokens.input || content.tokens.input_tokens || 0;
      const output = content.tokens.output || content.tokens.output_tokens || 0;
      return `${input}↓ ${output}↑`;
    }

    // Usage object
    if (content.usage && typeof content.usage === 'object') {
      const input = content.usage.input_tokens || content.usage.inputTokens || 0;
      const output = content.usage.output_tokens || content.usage.outputTokens || 0;
      return `${input}↓ ${output}↑`;
    }

    // Stats object
    if (content.stats && typeof content.stats === 'object') {
      const input = content.stats.input_tokens || content.stats.inputTokens || 0;
      const output = content.stats.output_tokens || content.stats.outputTokens || 0;
      if (input || output) {
        return `${input}↓ ${output}↑`;
      }
    }

    return null;
  }

  /**
   * Truncate string to max length
   */
  private static truncate(str: string, maxLen: number): string {
    if (!str || str.length <= maxLen) return str;
    return str.substring(0, maxLen) + '...';
  }

  /**
   * Format duration from milliseconds
   */
  private static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}m ${rs}s`;
  }
}

// ========== Factory Function ==========

/**
 * Create an output parser instance based on format
 * @param format - Output format type
 * @returns Parser instance
 */
export function createOutputParser(format: 'text' | 'json-lines'): IOutputParser {
  switch (format) {
    case 'json-lines':
      return new JsonLinesParser();
    case 'text':
    default:
      return new PlainTextParser();
  }
}

// ========== Utility Functions ==========

/**
 * Find the start index of the last streaming_content group
 * Groups are separated by non-streaming events (tool_call, metadata, etc.)
 * This helps filter out intermediate assistant messages in multi-turn executions
 *
 * @param units - All output units
 * @returns Index of the last streaming_content group start
 */
function findLastStreamingGroup(units: CliOutputUnit[]): number {
  let lastGroupStart = 0;

  for (let i = units.length - 1; i >= 0; i--) {
    const unit = units[i];

    // streaming_content found, this could be part of the last group
    if (unit.type === 'streaming_content') {
      lastGroupStart = i;

      // Look backwards to find the start of this group
      // (first streaming_content after a non-streaming event)
      for (let j = i - 1; j >= 0; j--) {
        if (units[j].type === 'streaming_content') {
          lastGroupStart = j;
        } else {
          // Found a separator (tool_call, metadata, etc.)
          break;
        }
      }
      break;
    }
  }

  return lastGroupStart;
}

/**
 * Flatten output units into plain text string
 * Useful for Resume scenario where we need concatenated context
 *
 * @param units - Array of output units to flatten
 * @param options - Filtering and formatting options
 * @returns Concatenated text content
 */
export function flattenOutputUnits(
  units: CliOutputUnit[],
  options?: {
    includeTypes?: CliOutputUnitType[];
    excludeTypes?: CliOutputUnitType[];
    includeTimestamps?: boolean;
    separator?: string;
    stripCommandJsonBlocks?: boolean;  // Strip embedded command execution JSON code blocks from stdout
  }
): string {
  const {
    includeTypes,
    excludeTypes,
    includeTimestamps = false,
    separator = '\n',
    stripCommandJsonBlocks = false
  } = options || {};

  // Debug logging for output unit analysis
  if (process.env.DEBUG_CLI_OUTPUT) {
    const typeCounts: Record<string, number> = {};
    for (const u of units) {
      typeCounts[u.type] = (typeCounts[u.type] || 0) + 1;
    }
    console.error(`[CLI_OUTPUT_DEBUG] flattenOutputUnits_input: ${JSON.stringify({ unitCount: units.length, typeCounts, includeTypes, excludeTypes })}`);
  }

  // Special handling for streaming_content: concatenate all into a single agent_message unit
  // Gemini delta messages are incremental (each contains partial content to append)
  let processedUnits = units;
  const streamingUnits = units.filter(u => u.type === 'streaming_content');
  const agentMessages = units.filter(u => u.type === 'agent_message');

  if (streamingUnits.length > 0) {
    const hasAgentMessage = agentMessages.length > 0;

    // If a non-delta final agent_message already exists, prefer it and simply drop streaming_content.
    // This avoids duplicated final output when providers emit BOTH streaming deltas and a final message frame.
    processedUnits = units.filter(u => u.type !== 'streaming_content');

    // If no agent_message exists, synthesize one from streaming_content (delta-only streams).
    if (!hasAgentMessage) {
      // For multi-turn executions, only keep the LAST group of streaming_content
      // (separated by tool_call/tool_result/metadata events)
      // This filters out intermediate planning/status messages
      const lastGroupStartIndex = findLastStreamingGroup(units);
      const lastGroupStreamingUnits = streamingUnits.filter((_, idx) => {
        const unitIndex = units.indexOf(streamingUnits[idx]);
        return unitIndex >= lastGroupStartIndex;
      });

      const concatenatedContent = lastGroupStreamingUnits
        .map(u => typeof u.content === 'string' ? u.content : '')
        .join('');

      if (concatenatedContent) {
        processedUnits.push({
          type: 'agent_message',
          content: concatenatedContent,
          timestamp: lastGroupStreamingUnits[lastGroupStreamingUnits.length - 1].timestamp
        });
      }
    }
  }

  // For multi-turn executions with multiple agent_message units (Codex/Claude),
  // only keep the LAST agent_message (final result)
  if (agentMessages.length > 1) {
    const lastAgentMessage = agentMessages[agentMessages.length - 1];
    processedUnits = processedUnits.filter(u =>
      u.type !== 'agent_message' || u === lastAgentMessage
    );
  }

  // Filter units by type
  let filtered = processedUnits;
  if (includeTypes && includeTypes.length > 0) {
    filtered = filtered.filter(u => includeTypes.includes(u.type));
  }
  if (excludeTypes && excludeTypes.length > 0) {
    filtered = filtered.filter(u => !excludeTypes.includes(u.type));
  }

  // Debug logging for filtered output
  if (process.env.DEBUG_CLI_OUTPUT) {
    const filteredTypeCounts: Record<string, number> = {};
    for (const u of filtered) {
      filteredTypeCounts[u.type] = (filteredTypeCounts[u.type] || 0) + 1;
    }
    console.error(`[CLI_OUTPUT_DEBUG] flattenOutputUnits_filtered: ${JSON.stringify({ filteredCount: filtered.length, filteredTypeCounts })}`);
  }

  // Convert to text
  const lines = filtered.map(unit => {
    let text = '';

    if (includeTimestamps) {
      text += `[${unit.timestamp}] `;
    }

    // Extract text content based on type
    if (typeof unit.content === 'string') {
      let content = unit.content;

      // Strip command execution JSON code blocks if requested (codex agent_message often includes these)
      if (stripCommandJsonBlocks && (unit.type === 'stdout' || unit.type === 'agent_message')) {
        // Pattern 1: Backtick-wrapped JSON blocks
        // Format: ```...{"command":"...","output":"...","exitCode":N,"status":"..."...}...```
        // Uses [\s\S]*? to match any characters (including newlines) non-greedily
        content = content.replace(/```[\s\S]*?\{"command":[\s\S]*?,"status":"[^"]*"\}[\s\S]*?```/g, '').trim();
        // Pattern 2: Raw JSON command execution (no backticks)
        // Matches complete JSON object with command/output/exitCode/status fields
        content = content.replace(/\{"command":[\s\S]*?,"status":"[^"]*"\}/g, '').trim();
      }

      text += content;
    } else if (typeof unit.content === 'object' && unit.content !== null) {
      // Handle structured content with type-specific formatting
      switch (unit.type) {
        case 'file_diff':
          // Format file diff with path and diff content
          text += `File: ${unit.content.path}\n\`\`\`diff\n${unit.content.diff}\n\`\`\``;
          break;

        case 'code':
          // Format code block with language
          const lang = unit.content.language || '';
          const code = unit.content.code || unit.content;
          text += `\`\`\`${lang}\n${typeof code === 'string' ? code : JSON.stringify(code)}\n\`\`\``;
          break;

        case 'thought':
          // Format thought/reasoning content
          text += `[Thought] ${typeof unit.content === 'string' ? unit.content : JSON.stringify(unit.content)}`;
          break;

        case 'progress':
          // Format progress updates
          if (unit.content.message) {
            text += unit.content.message;
            if (unit.content.progress !== undefined && unit.content.total !== undefined) {
              text += ` (${unit.content.progress}/${unit.content.total})`;
            }
          } else {
            text += JSON.stringify(unit.content);
          }
          break;

        case 'tool_call':
          // Format tool call/result
          if (unit.content.action === 'invoke') {
            const params = unit.content.parameters ? JSON.stringify(unit.content.parameters) : '';
            text += `[Tool] ${unit.content.toolName}(${params})`;
          } else if (unit.content.action === 'result') {
            const status = unit.content.status || 'unknown';
            const output = unit.content.output ? `: ${unit.content.output.substring(0, 200)}${unit.content.output.length > 200 ? '...' : ''}` : '';
            text += `[Tool Result] ${status}${output}`;
          } else {
            text += JSON.stringify(unit.content);
          }
          break;

        case 'metadata':
        case 'system':
          // Metadata and system events are typically excluded from prompt context
          // Include minimal representation if they passed filtering
          text += JSON.stringify(unit.content);
          break;

        default:
          // Fallback for unknown structured types
          text += JSON.stringify(unit.content);
      }
    } else {
      text += String(unit.content);
    }

    return text;
  });

  return lines.join(separator);
}

/**
 * Extract specific content type from units
 * Convenience helper for common extraction patterns
 */
export function extractContent(
  units: CliOutputUnit[],
  type: CliOutputUnitType
): string[] {
  return units
    .filter(u => u.type === type)
    .map(u => typeof u.content === 'string' ? u.content : JSON.stringify(u.content));
}

/**
 * Get statistics about output units
 * Useful for debugging and analytics
 */
export function getOutputStats(units: CliOutputUnit[]): {
  total: number;
  byType: Record<CliOutputUnitType, number>;
  firstTimestamp?: string;
  lastTimestamp?: string;
} {
  const byType: Record<string, number> = {};
  let firstTimestamp: string | undefined;
  let lastTimestamp: string | undefined;

  for (const unit of units) {
    byType[unit.type] = (byType[unit.type] || 0) + 1;

    if (!firstTimestamp || unit.timestamp < firstTimestamp) {
      firstTimestamp = unit.timestamp;
    }
    if (!lastTimestamp || unit.timestamp > lastTimestamp) {
      lastTimestamp = unit.timestamp;
    }
  }

  return {
    total: units.length,
    byType: byType as Record<CliOutputUnitType, number>,
    firstTimestamp,
    lastTimestamp
  };
}
