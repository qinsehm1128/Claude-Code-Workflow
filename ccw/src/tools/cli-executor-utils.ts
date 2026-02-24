import { spawn } from 'child_process';

// Debug logging utility - check env at runtime for --debug flag support
export function isDebugEnabled(): boolean {
  return process.env.DEBUG === 'true' || process.env.DEBUG === '1' || process.env.CCW_DEBUG === 'true';
}

export function debugLog(category: string, message: string, data?: Record<string, unknown>): void {
  if (!isDebugEnabled()) return;
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [CLI-DEBUG] [${category}]`;
  if (data) {
    console.error(`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.error(`${prefix} ${message}`);
  }
}

export function errorLog(
  category: string,
  message: string,
  error?: Error | unknown,
  context?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [CLI-ERROR] [${category}]`;
  console.error(`${prefix} ${message}`);
  if (error instanceof Error) {
    console.error(`${prefix} Error: ${error.message}`);
    if (isDebugEnabled() && error.stack) {
      console.error(`${prefix} Stack: ${error.stack}`);
    }
  } else if (error) {
    console.error(`${prefix} Error: ${String(error)}`);
  }
  if (context) {
    console.error(`${prefix} Context:`, JSON.stringify(context, null, 2));
  }
}

export interface ToolAvailability {
  available: boolean;
  path: string | null;
}

// Tool availability cache with TTL
interface CachedToolAvailability {
  result: ToolAvailability;
  timestamp: number;
}

// Cache storage: Map<toolName, CachedToolAvailability>
const toolAvailabilityCache = new Map<string, CachedToolAvailability>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isCacheValid(cached: CachedToolAvailability): boolean {
  return Date.now() - cached.timestamp < CACHE_TTL_MS;
}

function clearExpiredCache(): void {
  const now = Date.now();
  const entriesToDelete: string[] = [];

  toolAvailabilityCache.forEach((cached, tool) => {
    if (now - cached.timestamp >= CACHE_TTL_MS) {
      entriesToDelete.push(tool);
    }
  });

  entriesToDelete.forEach((tool) => toolAvailabilityCache.delete(tool));
}

export function clearToolCache(): void {
  toolAvailabilityCache.clear();
}

/**
 * Check if a CLI tool is available (with caching)
 */
export async function checkToolAvailability(tool: string): Promise<ToolAvailability> {
  debugLog('TOOL_CHECK', `Checking availability for tool: ${tool}`);

  const cached = toolAvailabilityCache.get(tool);
  if (cached && isCacheValid(cached)) {
    debugLog('TOOL_CHECK', `Cache hit for ${tool}`, { available: cached.result.available, path: cached.result.path });
    return cached.result;
  }

  clearExpiredCache();

  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'where' : 'which';

    debugLog('TOOL_CHECK', `Running ${command} ${tool}`, { platform: process.platform });

    const child = spawn(command, [tool], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout!.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const result: ToolAvailability = code === 0 && stdout.trim()
        ? { available: true, path: stdout.trim().split('\n')[0] }
        : { available: false, path: null };

      if (result.available) {
        debugLog('TOOL_CHECK', `Tool ${tool} found`, { path: result.path });
        toolAvailabilityCache.set(tool, {
          result,
          timestamp: Date.now(),
        });
      } else {
        debugLog('TOOL_CHECK', `Tool ${tool} not found`, { exitCode: code, stderr: stderr.trim() || '(empty)' });
      }

      resolve(result);
    });

    child.on('error', (error) => {
      errorLog('TOOL_CHECK', `Failed to check tool availability: ${tool}`, error, { command, tool });
      resolve({ available: false, path: null });
    });

    setTimeout(() => {
      child.kill();
      debugLog('TOOL_CHECK', `Timeout checking tool ${tool} (5s)`);
      resolve({ available: false, path: null });
    }, 5000);
  });
}

// Native resume configuration
export interface NativeResumeConfig {
  enabled: boolean;
  sessionId?: string; // Native UUID
  isLatest?: boolean; // Use latest/--last flag
}

/**
 * Build command arguments based on tool and options
 */
export function buildCommand(params: {
  tool: string;
  prompt: string;
  mode: string;
  model?: string;
  dir?: string;
  include?: string;
  nativeResume?: NativeResumeConfig;
  /** Claude CLI settings file path (for --settings parameter) */
  settingsFile?: string;
  /** Codex review options */
  reviewOptions?: {
    uncommitted?: boolean;
    base?: string;
    commit?: string;
    title?: string;
  };
  /** Effort level for claude (low, medium, high) */
  effort?: string;
}): { command: string; args: string[]; useStdin: boolean; outputFormat?: 'text' | 'json-lines' } {
  const { tool, prompt, mode = 'analysis', model, dir, include, nativeResume, settingsFile, reviewOptions, effort } = params;

  debugLog('BUILD_CMD', `Building command for tool: ${tool}`, {
    mode,
    model: model || '(default)',
    dir: dir || '(cwd)',
    include: include || '(none)',
    nativeResume: nativeResume
      ? { enabled: nativeResume.enabled, isLatest: nativeResume.isLatest, sessionId: nativeResume.sessionId }
      : '(none)',
    promptLength: prompt.length,
  });

  let command = tool;
  let args: string[] = [];
  // Default to stdin for all tools to avoid escaping issues on Windows
  let useStdin = true;

  switch (tool) {
    case 'gemini':
      if (nativeResume?.enabled) {
        if (nativeResume.isLatest) {
          args.push('-r', 'latest');
        } else if (nativeResume.sessionId) {
          args.push('-r', nativeResume.sessionId);
        }
      }
      if (model) {
        args.push('-m', model);
      }
      if (mode === 'write') {
        args.push('--approval-mode', 'yolo');
      }
      if (include) {
        args.push('--include-directories', include);
      }
      // Enable stream-json output for structured parsing
      args.push('-o', 'stream-json');
      break;

    case 'qwen':
      if (nativeResume?.enabled) {
        if (nativeResume.isLatest) {
          args.push('--continue');
        } else if (nativeResume.sessionId) {
          args.push('--resume', nativeResume.sessionId);
        }
      }
      if (model) {
        args.push('-m', model);
      }
      if (mode === 'write') {
        args.push('--approval-mode', 'yolo');
      }
      if (include) {
        args.push('--include-directories', include);
      }
      // Enable stream-json output for structured parsing (same as gemini)
      args.push('-o', 'stream-json');
      break;

    case 'codex':
      useStdin = true;
      if (mode === 'review') {
        // codex review mode: non-interactive code review
        // Format: codex review [OPTIONS] [PROMPT]
        args.push('review');

        // Review target: --uncommitted (default), --base <branch>, or --commit <sha>
        if (reviewOptions?.base) {
          args.push('--base', reviewOptions.base);
        } else if (reviewOptions?.commit) {
          args.push('--commit', reviewOptions.commit);
        } else {
          // Default to --uncommitted if no specific target
          args.push('--uncommitted');
        }

        // Optional title for review summary
        if (reviewOptions?.title) {
          args.push('--title', reviewOptions.title);
        }

        if (model) {
          // codex review uses -c key=value for config override, not -m
          args.push('-c', `model=${model}`);
        }
        // Note: --skip-git-repo-check is NOT supported by codex review command
        // codex review uses positional prompt argument, not stdin
        useStdin = false;
        if (prompt) {
          args.push(prompt);
        }
      } else if (nativeResume?.enabled) {
        args.push('resume');
        if (nativeResume.isLatest) {
          args.push('--last');
        } else if (nativeResume.sessionId) {
          args.push(nativeResume.sessionId);
        }
        if (mode === 'write' || mode === 'auto') {
          args.push('--dangerously-bypass-approvals-and-sandbox');
        } else {
          args.push('--full-auto');
        }
        if (model) {
          args.push('-m', model);
        }
        if (include) {
          const dirs = include.split(',').map((d) => d.trim()).filter((d) => d);
          for (const addDir of dirs) {
            args.push('--add-dir', addDir);
          }
        }
        // Skip git repo check by default for codex (allows non-git directories)
        args.push('--skip-git-repo-check');
        // Enable JSON output for structured parsing
        args.push('--json');
        // codex resume uses positional prompt argument, not stdin
        // Format: codex resume <session-id> [prompt]
        useStdin = false;
        args.push(prompt);
      } else {
        args.push('exec');
        if (mode === 'write' || mode === 'auto') {
          args.push('--dangerously-bypass-approvals-and-sandbox');
        } else {
          args.push('--full-auto');
        }
        if (model) {
          args.push('-m', model);
        }
        if (include) {
          const dirs = include.split(',').map((d) => d.trim()).filter((d) => d);
          for (const addDir of dirs) {
            args.push('--add-dir', addDir);
          }
        }
        // Skip git repo check by default for codex (allows non-git directories)
        args.push('--skip-git-repo-check');
        // Enable JSON output for structured parsing
        args.push('--json');
        args.push('-');
      }
      break;

    case 'claude':
      // Claude Code: claude -p "prompt" for non-interactive mode
      args.push('-p'); // Print mode (non-interactive)
      // Settings file: claude --settings <file-or-json>
      if (settingsFile) {
        args.push('--settings', settingsFile);
      }
      // Native resume: claude --resume <session-id> or --continue
      if (nativeResume?.enabled) {
        if (nativeResume.isLatest) {
          args.push('--continue');
        } else if (nativeResume.sessionId) {
          args.push('--resume', nativeResume.sessionId);
        }
      }
      if (model) {
        args.push('--model', model);
      }
      // Effort level: claude --effort <low|medium|high>
      if (effort) {
        args.push('--effort', effort);
      }
      // Permission modes: write/auto → bypassPermissions, analysis → default
      if (mode === 'write' || mode === 'auto') {
        args.push('--permission-mode', 'bypassPermissions');
      } else {
        args.push('--permission-mode', 'default');
      }
      // Output format: stream-json for structured parsing (requires --verbose)
      args.push('--output-format', 'stream-json');
      args.push('--verbose');
      // Add directories
      if (include) {
        const dirs = include.split(',').map((d) => d.trim()).filter((d) => d);
        for (const addDir of dirs) {
          args.push('--add-dir', addDir);
        }
      }
      break;

    case 'opencode':
      // OpenCode: opencode run [message..] for non-interactive mode
      // https://opencode.ai/docs/cli/
      // Prompt is passed as positional arguments (NOT stdin)
      useStdin = false;
      args.push('run');
      // Native resume: opencode run --continue or --session <id>
      if (nativeResume?.enabled) {
        if (nativeResume.isLatest) {
          args.push('--continue');
        } else if (nativeResume.sessionId) {
          args.push('--session', nativeResume.sessionId);
        }
      }
      // Model: --model <provider/model> (e.g., anthropic/claude-sonnet-4-20250514)
      if (model) {
        args.push('--model', model);
      }
      // Output format: json for structured parsing
      args.push('--format', 'json');
      // Add prompt as positional argument at the end
      // OpenCode expects: opencode run [options] [message..]
      args.push(prompt);
      break;

    default:
      errorLog('BUILD_CMD', `Unknown CLI tool: ${tool}`);
      throw new Error(`Unknown CLI tool: ${tool}`);
  }

  debugLog('BUILD_CMD', `Command built successfully`, {
    command,
    args,
    useStdin,
    fullCommand: `${command} ${args.join(' ')}${useStdin ? ' (stdin)' : ''}`,
  });

  // Auto-detect output format: All CLI tools use JSON lines output
  // - Codex: --json
  // - Gemini: -o stream-json
  // - Qwen: -o stream-json
  // - Claude: --output-format stream-json
  // - OpenCode: --format json
  const jsonLineTools = ['codex', 'gemini', 'qwen', 'claude', 'opencode'];
  const outputFormat = jsonLineTools.includes(tool.toLowerCase()) ? 'json-lines' : 'text';

  return { command, args, useStdin, outputFormat };
}
