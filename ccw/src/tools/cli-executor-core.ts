/**
 * CLI Executor Tool - Unified execution for external CLI tools
 * Supports Gemini, Qwen, and Codex with streaming output
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { validatePath, resolvePath } from '../utils/path-resolver.js';
import { escapeWindowsArg } from '../utils/shell-escape.js';
import { buildCommand, checkToolAvailability, clearToolCache, debugLog, errorLog, type NativeResumeConfig, type ToolAvailability } from './cli-executor-utils.js';
import type { ConversationRecord, ConversationTurn, ExecutionOutput, ExecutionRecord } from './cli-executor-state.js';
import {
  createOutputParser,
  type CliOutputUnit,
  type IOutputParser,
  flattenOutputUnits
} from './cli-output-converter.js';
import {
  buildMergedPrompt,
  buildMultiTurnPrompt,
  mergeConversations,
  type MergeResult
} from './cli-prompt-builder.js';
import {
  convertToConversation,
  ensureHistoryDir,
  getExecutionDetail,
  getExecutionHistory,
  getSqliteStore,
  loadConversation,
  saveConversation
} from './cli-executor-state.js';

// Track current running child process for cleanup on interruption
let currentChildProcess: ChildProcess | null = null;
let killTimeout: NodeJS.Timeout | null = null;
let killTimeoutProcess: ChildProcess | null = null;

/**
 * Kill the current running CLI child process
 * Called when parent process receives SIGINT/SIGTERM
 */
export function killCurrentCliProcess(): boolean {
  const child = currentChildProcess;
  if (!child || child.killed) return false;

  debugLog('KILL', 'Killing current child process', { pid: child.pid });

  try {
    child.kill('SIGTERM');
  } catch {
    // Ignore kill errors (process may already be gone)
  }

  if (killTimeout) {
    clearTimeout(killTimeout);
    killTimeout = null;
    killTimeoutProcess = null;
  }

  // Force kill after 2 seconds if still running.
  killTimeoutProcess = child;
  killTimeout = setTimeout(() => {
    const target = killTimeoutProcess;
    if (!target || target !== currentChildProcess) return;
    if (target.killed) return;

    try {
      target.kill('SIGKILL');
    } catch {
      // Ignore kill errors (process may already be gone)
    }
  }, 2000);

  return true;
}

// LiteLLM integration
import { executeLiteLLMEndpoint } from './litellm-executor.js';
import { findEndpointById } from '../config/litellm-api-config-manager.js';

// CLI Settings (CLI封装) integration
import { loadEndpointSettings, getSettingsFilePath, findEndpoint } from '../config/cli-settings-manager.js';
import { loadClaudeCliTools, getToolConfig, getPrimaryModel, getSecondaryModel } from './claude-cli-tools.js';

/**
 * Resolve model alias to actual model name
 * Supports: PRIMARY_MODEL, SECONDARY_MODEL
 * Returns original value if not an alias
 */
function resolveModelAlias(model: string | undefined, tool: string, workingDir: string): string | undefined {
  if (!model) return model;

  const upperModel = model.toUpperCase();

  if (upperModel === 'PRIMARY_MODEL') {
    return getPrimaryModel(workingDir, tool);
  }

  if (upperModel === 'SECONDARY_MODEL') {
    return getSecondaryModel(workingDir, tool);
  }

  // Not an alias, return original
  return model;
}

/**
 * Parse .env file content into key-value pairs
 * Supports: KEY=value, KEY="value", KEY='value', comments (#), empty lines
 */
function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    // Skip empty lines and comments
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Find first = sign
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();

    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key) {
      env[key] = value;
    }
  }

  return env;
}

/**
 * Load environment variables from .env file
 * Supports ~ for home directory expansion
 */
function loadEnvFile(envFilePath: string): Record<string, string> {
  try {
    // Expand ~ to home directory
    let resolvedPath = envFilePath;
    if (resolvedPath.startsWith('~')) {
      resolvedPath = path.join(os.homedir(), resolvedPath.slice(1));
    }

    // Resolve relative paths
    if (!path.isAbsolute(resolvedPath)) {
      resolvedPath = path.resolve(resolvedPath);
    }

    if (!fs.existsSync(resolvedPath)) {
      debugLog('ENV_FILE', `Env file not found: ${resolvedPath}`);
      return {};
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const envVars = parseEnvFile(content);
    debugLog('ENV_FILE', `Loaded ${Object.keys(envVars).length} env vars from ${resolvedPath}`);
    return envVars;
  } catch (err) {
    errorLog('ENV_FILE', `Failed to load env file: ${envFilePath}`, err as Error);
    return {};
  }
}

/**
 * Execute Claude CLI with custom settings file (CLI封装)
 */
interface ClaudeWithSettingsParams {
  prompt: string;
  settingsPath: string;
  endpointId: string;
  mode: 'analysis' | 'write' | 'auto' | 'review';
  workingDir: string;
  cd?: string;
  includeDirs?: string[];
  customId?: string;
  onOutput?: (unit: CliOutputUnit) => void;
}

async function executeClaudeWithSettings(params: ClaudeWithSettingsParams): Promise<ExecutionOutput> {
  const { prompt, settingsPath, endpointId, mode, workingDir, cd, includeDirs, customId, onOutput } = params;

  const startTime = Date.now();
  const conversationId = customId || `${Date.now()}-${endpointId}`;

  // Build claude command with --settings flag
  const args: string[] = [
    '--settings', settingsPath,
    '--print'  // Non-interactive mode
  ];

  // Add mode-specific flags
  if (mode === 'write') {
    args.push('--dangerously-skip-permissions');
  }

  // Add working directory if specified
  if (cd) {
    args.push('--cd', cd);
  }

  // Add include directories
  if (includeDirs && includeDirs.length > 0) {
    for (const dir of includeDirs) {
      args.push('--add-dir', dir);
    }
  }

  // Add prompt as argument
  args.push('-p', prompt);

  debugLog('CLAUDE_SETTINGS', `Executing claude with settings`, {
    settingsPath,
    endpointId,
    mode,
    workingDir,
    args
  });

  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const command = 'claude';
    const commandToSpawn = isWindows ? escapeWindowsArg(command) : command;
    const argsToSpawn = isWindows ? args.map(escapeWindowsArg) : args;

    const child = spawn(commandToSpawn, argsToSpawn, {
      cwd: workingDir,
      shell: isWindows,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Track current child process for cleanup
    currentChildProcess = child;

    let stdout = '';
    let stderr = '';
    const outputUnits: CliOutputUnit[] = [];

    child.stdout!.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;

      const unit: CliOutputUnit = {
        type: 'stdout',
        content: text,
        timestamp: new Date().toISOString()
      };
      outputUnits.push(unit);

      if (onOutput) {
        onOutput(unit);
      }
    });

    child.stderr!.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;

      const unit: CliOutputUnit = {
        type: 'stderr',
        content: text,
        timestamp: new Date().toISOString()
      };
      outputUnits.push(unit);

      if (onOutput) {
        onOutput(unit);
      }
    });

    child.on('close', (code) => {
      currentChildProcess = null;

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Determine status
      let status: 'success' | 'error' = 'success';
      if (code !== 0) {
        const hasValidOutput = stdout.trim().length > 0;
        const hasFatalError = stderr.includes('FATAL') ||
                              stderr.includes('Authentication failed') ||
                              stderr.includes('API key');

        if (hasValidOutput && !hasFatalError) {
          status = 'success';
        } else {
          status = 'error';
        }
      }

      const execution: ExecutionRecord = {
        id: conversationId,
        timestamp: new Date(startTime).toISOString(),
        tool: 'claude',
        model: endpointId, // Use endpoint ID as model identifier
        mode,
        prompt,
        status,
        exit_code: code,
        duration_ms: duration,
        output: {
          stdout: stdout.substring(0, 10240),
          stderr: stderr.substring(0, 2048),
          truncated: stdout.length > 10240 || stderr.length > 2048
        }
      };

      const conversation = convertToConversation(execution);

      // Save to history
      try {
        saveConversation(workingDir, conversation);
      } catch (err) {
        console.error('[CLI Executor] Failed to save CLI封装 history:', (err as Error).message);
      }

      resolve({
        success: status === 'success',
        execution,
        conversation,
        stdout,
        stderr
      });
    });

    child.on('error', (error) => {
      currentChildProcess = null;
      reject(new Error(`Failed to spawn claude: ${error.message}`));
    });
  });
}

// Native resume support
import {
  trackNewSession,
  getNativeResumeArgs,
  supportsNativeResume,
  calculateProjectHash
} from './native-session-discovery.js';
import {
  determineResumeStrategy,
  buildContextPrefix,
  getResumeModeDescription,
  type ResumeDecision
} from './resume-strategy.js';
import {
  isToolEnabled as isToolEnabledFromConfig,
  enableTool as enableToolFromConfig,
  disableTool as disableToolFromConfig
} from './cli-config-manager.js';

// Built-in CLI tools
const BUILTIN_CLI_TOOLS = ['gemini', 'qwen', 'codex', 'opencode', 'claude'] as const;
type BuiltinCliTool = typeof BUILTIN_CLI_TOOLS[number];

/**
 * Transaction ID type for concurrent session disambiguation
 * Format: ccw-tx-${conversationId}-${timestamp}
 */
export type TransactionId = string;

/**
 * Generate a unique transaction ID for the current execution
 * @param conversationId - CCW conversation ID
 * @returns Transaction ID in format: ccw-tx-${conversationId}-${uniquePart}
 */
export function generateTransactionId(conversationId: string): TransactionId {
  // Use crypto.randomUUID() if available, otherwise use timestamp + random
  const uniquePart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `ccw-tx-${conversationId}-${uniquePart}`;
}

/**
 * Inject transaction ID into user prompt
 * @param prompt - Original user prompt
 * @param txId - Transaction ID to inject
 * @returns Prompt with transaction ID injected at the start
 */
export function injectTransactionId(prompt: string, txId: TransactionId): string {
  return `[CCW-TX-ID: ${txId}]\n\n${prompt}`;
}

/**
 * Extract transaction ID from prompt
 * @param prompt - Prompt that may contain transaction ID
 * @returns Transaction ID if found, null otherwise
 */
export function extractTransactionId(prompt: string): TransactionId | null {
  const match = prompt.match(/\[CCW-TX-ID:\s+([^\]]+)\]/);
  return match ? match[1] : null;
}

// Define Zod schema for validation
// tool accepts built-in tools or custom endpoint IDs (CLI封装)
const ParamsSchema = z.object({
  tool: z.string().min(1, 'Tool is required'), // Accept any tool ID (built-in or custom endpoint)
  prompt: z.string(), // Prompt can be empty for review mode with target flags
  mode: z.enum(['analysis', 'write', 'auto', 'review']).default('analysis'),
  format: z.enum(['plain', 'yaml', 'json']).default('plain'), // Multi-turn prompt concatenation format
  model: z.string().optional(),
  cd: z.string().optional(),
  includeDirs: z.string().optional(),
  // timeout removed - controlled by external caller (bash timeout)
  resume: z.union([z.boolean(), z.string()]).optional(), // true = last, string = single ID or comma-separated IDs
  id: z.string().optional(), // Custom execution ID (e.g., IMPL-001-step1)
  noNative: z.boolean().optional(), // Force prompt concatenation instead of native resume
  category: z.enum(['user', 'internal', 'insight']).default('user'), // Execution category for tracking
  parentExecutionId: z.string().optional(), // Parent execution ID for fork/retry scenarios
  stream: z.boolean().default(false), // false = cache full output (default), true = stream output via callback
  outputFormat: z.enum(['text', 'json-lines']).optional().default('json-lines'), // Output parsing format (default: json-lines for type badges)
  // Codex review options
  uncommitted: z.boolean().optional(), // Review uncommitted changes (default for review mode)
  base: z.string().optional(), // Review changes against base branch
  commit: z.string().optional(), // Review changes from specific commit
  title: z.string().optional(), // Optional title for review summary
  // Claude-specific options
  effort: z.enum(['low', 'medium', 'high']).optional(), // Effort level for claude
  // Rules env vars (PROTO, TMPL) - will be passed to subprocess environment
  rulesEnv: z.object({
    PROTO: z.string().optional(),
    TMPL: z.string().optional(),
  }).optional(),
});

type Params = z.infer<typeof ParamsSchema>;

type NonEmptyArray<T> = [T, ...T[]];

function assertNonEmptyArray<T>(items: T[], message: string): asserts items is NonEmptyArray<T> {
  if (items.length === 0) {
    throw new Error(message);
  }
}

/**
 * Execute CLI tool with streaming output
 */
async function executeCliTool(
  params: Record<string, unknown>,
  onOutput?: ((unit: CliOutputUnit) => void) | null
): Promise<ExecutionOutput> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(`Invalid params: ${parsed.error.message}`);
  }

  const { tool, prompt, mode, format, model, cd, includeDirs, resume, id: customId, noNative, category, parentExecutionId, outputFormat, uncommitted, base, commit, title, effort, rulesEnv } = parsed.data;

  // Validate and determine working directory early (needed for conversation lookup)
  let workingDir: string;
  if (cd) {
    const validation = validatePath(cd, { mustExist: true });
    if (!validation.valid) {
      throw new Error(`Invalid working directory (--cd): ${validation.error}. Path: ${cd}`);
    }
    workingDir = validation.path!;
  } else {
    workingDir = process.cwd();
  }
  ensureHistoryDir(workingDir); // Ensure history directory exists

  // NEW: Check if model is a custom LiteLLM endpoint ID
  if (model) {
    const endpoint = findEndpointById(workingDir, model);
    if (endpoint) {
      // Route to LiteLLM executor
      if (onOutput) {
        onOutput({
          type: 'stderr',
          content: `[Routing to LiteLLM endpoint: ${model}]\n`,
          timestamp: new Date().toISOString()
        });
      }

      const result = await executeLiteLLMEndpoint({
        prompt,
        endpointId: model,
        baseDir: workingDir,
        cwd: cd,
        includeDirs: includeDirs ? includeDirs.split(',').map(d => d.trim()) : undefined,
        enableCache: true,
        onOutput: onOutput || undefined,
      });

      // Convert LiteLLM result to ExecutionOutput format
      const startTime = Date.now();
      const endTime = Date.now();
      const duration = endTime - startTime;

      const execution: ExecutionRecord = {
        id: customId || `${Date.now()}-litellm`,
        timestamp: new Date(startTime).toISOString(),
        tool: 'litellm',
        model: result.model,
        mode,
        prompt,
        status: result.success ? 'success' : 'error',
        exit_code: result.success ? 0 : 1,
        duration_ms: duration,
        output: {
          stdout: result.output,
          stderr: result.error || '',
          truncated: false,
        },
      };

      const conversation = convertToConversation(execution);

      // Try to save to history
      try {
        saveConversation(workingDir, conversation);
      } catch (err) {
        console.error('[CLI Executor] Failed to save LiteLLM history:', (err as Error).message);
      }

      return {
        success: result.success,
        execution,
        conversation,
        stdout: result.output,
        stderr: result.error || '',
      };
    }
  }

  // Check if tool is a custom CLI封装 endpoint (not a built-in tool)
  const isBuiltinTool = BUILTIN_CLI_TOOLS.includes(tool as BuiltinCliTool);
  if (!isBuiltinTool) {
    // Check if it's a CLI封装 endpoint (by ID or name)
    const cliSettings = findEndpoint(tool);
    if (cliSettings && cliSettings.enabled) {
      // Route to Claude CLI with --settings flag
      const settingsPath = getSettingsFilePath(cliSettings.id);
      const displayName = cliSettings.name !== cliSettings.id ? `${cliSettings.name} (${cliSettings.id})` : cliSettings.id;
      if (onOutput) {
        onOutput({
          type: 'stderr',
          content: `[Routing to CLI封装 endpoint: ${displayName} via claude --settings]\n`,
          timestamp: new Date().toISOString()
        });
      }

      // Execute claude CLI with settings file
      const result = await executeClaudeWithSettings({
        prompt,
        settingsPath,
        endpointId: cliSettings.id,
        mode,
        workingDir,
        cd,
        includeDirs: includeDirs ? includeDirs.split(',').map(d => d.trim()) : undefined,
        customId,
        onOutput: onOutput || undefined
      });

      return result;
    }

    // Check cli-tools.json for CLI wrapper tools or API endpoints
    const cliToolsConfig = loadClaudeCliTools(workingDir);

    // First check if tool is a cli-wrapper in tools section
    const cliWrapperTool = Object.entries(cliToolsConfig.tools).find(
      ([name, t]) => name.toLowerCase() === tool.toLowerCase() && t.type === 'cli-wrapper' && t.enabled
    );
    if (cliWrapperTool) {
      const [toolName] = cliWrapperTool;
      // Check if there's a corresponding CLI封装 settings file
      const cliSettingsForTool = findEndpoint(toolName);
      if (cliSettingsForTool) {
        const settingsPath = getSettingsFilePath(cliSettingsForTool.id);
        if (onOutput) {
          onOutput({
            type: 'stderr',
            content: `[Routing to CLI wrapper tool: ${toolName} via claude --settings]\n`,
            timestamp: new Date().toISOString()
          });
        }

        const result = await executeClaudeWithSettings({
          prompt,
          settingsPath,
          endpointId: cliSettingsForTool.id,
          mode,
          workingDir,
          cd,
          includeDirs: includeDirs ? includeDirs.split(',').map(d => d.trim()) : undefined,
          customId,
          onOutput: onOutput || undefined
        });

        return result;
      }
    }

    // Check tools with type: 'api-endpoint' -> route to LiteLLM
    const apiEndpointTool = Object.entries(cliToolsConfig.tools).find(
      ([name, t]) => t.type === 'api-endpoint' && t.enabled &&
        (t.id === tool || name === tool || name.toLowerCase() === tool.toLowerCase())
    );
    if (apiEndpointTool) {
      const [toolName, toolConfig] = apiEndpointTool;
      // id field is the LiteLLM endpoint ID (e.g., "g25")
      const litellmEndpointId = toolConfig.id || toolName;

      // Use configured primary model if no explicit model provided
      // This allows --model parameter to override the tool's primaryModel
      // Resolve model aliases (PRIMARY_MODEL, SECONDARY_MODEL) before using
      // Use undefined if primaryModel is empty string (endpoint.model will be used as fallback)
      const resolvedApiModel = resolveModelAlias(model, toolName, workingDir);
      const apiEndpointEffectiveModel = resolvedApiModel || (toolConfig.primaryModel || undefined);

      // Find LiteLLM endpoint configuration
      const litellmEndpoint = findEndpointById(workingDir, litellmEndpointId);
      if (litellmEndpoint) {
        if (onOutput) {
          onOutput({
            type: 'stderr',
            content: `[Routing to LiteLLM API endpoint: ${toolName} (${litellmEndpointId})]\n`,
            timestamp: new Date().toISOString()
          });
        }

        // Execute via LiteLLM with model override
        const result = await executeLiteLLMEndpoint({
          prompt,
          endpointId: litellmEndpointId,
          baseDir: workingDir,
          cwd: cd || workingDir,
          includeDirs: includeDirs ? includeDirs.split(',').map(d => d.trim()) : undefined,
          model: apiEndpointEffectiveModel, // Pass effective model (--model or primaryModel)
          onOutput: onOutput || undefined,
        });

        // Convert LiteLLM result to ExecutionOutput format
        const startTime = Date.now();
        const endTime = Date.now();
        const duration = endTime - startTime;

        const execution: ExecutionRecord = {
          id: customId || `${Date.now()}-litellm`,
          timestamp: new Date(startTime).toISOString(),
          tool: toolName,
          model: result.model, // Use effective model from result (reflects any override)
          mode,
          prompt,
          status: result.success ? 'success' : 'error',
          exit_code: result.success ? 0 : 1,
          duration_ms: duration,
          output: {
            stdout: result.output,
            stderr: result.error || '',
            truncated: false
          }
        };

        const conversation = convertToConversation(execution);

        // Try to save to history
        try {
          saveConversation(workingDir, conversation);
        } catch (err) {
          console.error('[CLI Executor] Failed to save LiteLLM history:', (err as Error).message);
        }

        return {
          success: result.success,
          execution,
          conversation,
          stdout: result.output,
          stderr: result.error || '',
        };
      }
    }

    // Tool not found
    throw new Error(`Unknown tool: ${tool}. Use one of: ${BUILTIN_CLI_TOOLS.join(', ')} or a registered CLI封装 endpoint name.`);
  }

  // Get SQLite store for native session lookup
  const store = await getSqliteStore(workingDir);

  // Determine conversation ID and load existing conversation
  // Logic:
  // - If --resume <id1,id2,...> (multiple IDs): merge conversations
  //   - With --id: create new merged conversation
  //   - Without --id: append to ALL source conversations
  // - If --resume <id> AND --id <newId>: fork - read context from resume ID, create new conversation with newId
  // - If --id provided (no resume): use that ID (create new or append)
  // - If --resume <id> without --id: use resume ID (append to existing)
  // - No params: create new with auto-generated ID
  let conversationId: string;
  let existingConversation: ConversationRecord | null = null;
  let contextConversation: ConversationRecord | null = null; // For fork scenario
  let mergeResult: MergeResult | null = null; // For merge scenario
  let sourceConversations: ConversationRecord[] = []; // All source conversations for merge

  // Parse resume IDs (can be comma-separated for merge)
  const resumeIds: string[] = resume
    ? (typeof resume === 'string' ? resume.split(',').map(id => id.trim()).filter(Boolean) : [])
    : [];
  const isMerge = resumeIds.length > 1;
  const resumeId = resumeIds.length === 1 ? resumeIds[0] : null;

  if (isMerge) {
    // Merge scenario: multiple resume IDs
    sourceConversations = resumeIds
      .map(id => loadConversation(workingDir, id))
      .filter((c): c is ConversationRecord => c !== null);

    // Guard against empty merge sources before accessing sourceConversations[0].
    assertNonEmptyArray(
      sourceConversations,
      `No valid conversations found for merge: ${resumeIds.join(', ')}`
    );

    mergeResult = mergeConversations(sourceConversations);
    debugLog('MERGE', 'Merged conversations', {
      sourceConversationCount: sourceConversations.length,
      resumeIds
    });

    if (customId) {
      // Create new merged conversation with custom ID
      conversationId = customId;
      existingConversation = loadConversation(workingDir, customId);
    } else {
      // Will append to ALL source conversations (handled in save logic)
      // Use first source conversation ID as primary
      conversationId = sourceConversations[0].id;
      existingConversation = sourceConversations[0];
    }
  } else if (customId && resumeId) {
    // Fork: read context from resume ID, but create new conversation with custom ID
    conversationId = customId;
    contextConversation = loadConversation(workingDir, resumeId);
    existingConversation = loadConversation(workingDir, customId);
  } else if (customId) {
    // Use custom ID - may be new or existing
    conversationId = customId;
    existingConversation = loadConversation(workingDir, customId);
  } else if (resumeId) {
    // Resume single ID without new ID - append to existing conversation
    conversationId = resumeId;
    existingConversation = loadConversation(workingDir, resumeId);
  } else if (resume) {
    // resume=true: get last conversation for this tool
    const history = getExecutionHistory(workingDir, { limit: 1, tool });
    if (history.executions.length > 0) {
      conversationId = history.executions[0].id;
      existingConversation = loadConversation(workingDir, conversationId);
    } else {
      // No previous conversation, create new
      conversationId = `${Date.now()}-${tool}`;
    }
  } else {
    // New conversation with auto-generated ID
    conversationId = `${Date.now()}-${tool}`;
  }

  // Generate transaction ID for concurrent session disambiguation
  // This will be injected into the prompt for exact session matching during resume
  const transactionId = generateTransactionId(conversationId);
  debugLog('TX_ID', `Generated transaction ID: ${transactionId}`, { conversationId });

  // Determine resume strategy (native vs prompt-concat vs hybrid)
  let resumeDecision: ResumeDecision | null = null;
  let nativeResumeConfig: NativeResumeConfig | undefined;

  // resume=true (latest) - use native latest if supported
  if (resume === true && !noNative && supportsNativeResume(tool)) {
    resumeDecision = {
      strategy: 'native',
      isLatest: true,
      primaryConversationId: conversationId
    };
  }
  // Use strategy engine for complex scenarios
  else if (resumeIds.length > 0 && !noNative) {
    resumeDecision = determineResumeStrategy({
      tool,
      resumeIds,
      customId,
      // Force prompt-concat if noNative flag is set OR if tool doesn't support native resume
      // (e.g., codex resume requires TTY which spawn() doesn't provide)
      forcePromptConcat: noNative || !supportsNativeResume(tool),
      getNativeSessionId: (ccwId) => store.getNativeSessionId(ccwId),
      getConversation: (ccwId) => loadConversation(workingDir, ccwId),
      getConversationTool: (ccwId) => {
        const conv = loadConversation(workingDir, ccwId);
        return conv?.tool || null;
      }
    });
  }

  // Configure native resume if strategy decided to use it
  if (resumeDecision && (resumeDecision.strategy === 'native' || resumeDecision.strategy === 'hybrid')) {
    nativeResumeConfig = {
      enabled: true,
      sessionId: resumeDecision.nativeSessionId,
      isLatest: resumeDecision.isLatest
    };
  }

  // Build final prompt with conversation context
  // For native: minimal prompt (native tool handles context)
  // For hybrid: context prefix from other conversations + new prompt
  // For prompt-concat: full multi-turn prompt
  let finalPrompt = prompt;

  if (resumeDecision?.strategy === 'native') {
    // Native mode: just use the new prompt, tool handles context
    finalPrompt = prompt;
  } else if (resumeDecision?.strategy === 'hybrid' && resumeDecision.contextTurns?.length) {
    // Hybrid mode: add context prefix from other conversations
    const contextPrefix = buildContextPrefix(resumeDecision.contextTurns, format);
    finalPrompt = contextPrefix + prompt;
  } else if (mergeResult && mergeResult.mergedTurns.length > 0) {
    // Full merge: use merged prompt
    finalPrompt = buildMergedPrompt(mergeResult, prompt, format);
  } else {
    // Standard prompt-concat
    const conversationForContext = contextConversation || existingConversation;
    if (conversationForContext && conversationForContext.turns.length > 0) {
      finalPrompt = buildMultiTurnPrompt(conversationForContext, prompt, format);
    }
  }

  // Inject transaction ID at the start of the final prompt for session tracking
  // This enables exact session matching during parallel execution scenarios
  finalPrompt = injectTransactionId(finalPrompt, transactionId);
  debugLog('TX_ID', `Injected transaction ID into prompt`, { transactionId, promptLength: finalPrompt.length });

  // Check tool availability
  const toolStatus = await checkToolAvailability(tool);
  if (!toolStatus.available) {
    throw new Error(`CLI tool not available: ${tool}. Please ensure it is installed and in PATH.`);
  }

  // Log resume mode for debugging
  if (resumeDecision) {
    const modeDesc = getResumeModeDescription(resumeDecision);
    if (onOutput) {
      onOutput({
        type: 'stderr',
        content: `[Resume mode: ${modeDesc}]\n`,
        timestamp: new Date().toISOString()
      });
    }

    // Info message for Codex TTY limitation
    if (tool === 'codex' && !supportsNativeResume(tool) && resumeDecision.strategy !== 'native') {
      if (onOutput) {
        onOutput({
          type: 'stderr',
          content: '[ccw] Using prompt-concat mode for Codex (Codex TTY limitation for native resume)\n',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Use configured primary model if no explicit model provided
  // Resolve model aliases (PRIMARY_MODEL, SECONDARY_MODEL) before using
  const resolvedModel = resolveModelAlias(model, tool, workingDir);
  const effectiveModel = resolvedModel || getPrimaryModel(workingDir, tool);

  // Load and validate settings file for Claude tool (builtin only)
  let settingsFilePath: string | undefined;
  let effectiveEffort = effort;
  if (tool === 'claude') {
    const toolConfig = getToolConfig(workingDir, tool);
    if (toolConfig.settingsFile) {
      try {
        const resolved = resolvePath(toolConfig.settingsFile);
        if (fs.existsSync(resolved)) {
          settingsFilePath = resolved;
          debugLog('SETTINGS_FILE', `Resolved Claude settings file`, { configured: toolConfig.settingsFile, resolved });
        } else {
          errorLog('SETTINGS_FILE', `Claude settings file not found, skipping`, { configured: toolConfig.settingsFile, resolved });
        }
      } catch (err) {
        errorLog('SETTINGS_FILE', `Failed to resolve Claude settings file`, { configured: toolConfig.settingsFile, error: (err as Error).message });
      }
    }
    // Use default effort from config if not explicitly provided, fallback to 'high'
    if (!effectiveEffort) {
      effectiveEffort = (toolConfig.effort as typeof effectiveEffort) || 'high';
      debugLog('EFFORT', `Using effort level`, { effort: effectiveEffort, source: toolConfig.effort ? 'config' : 'default' });
    }
  }

  // Build command
  const { command, args, useStdin, outputFormat: autoDetectedFormat } = buildCommand({
    tool,
    prompt: finalPrompt,
    mode,
    model: effectiveModel,
    dir: cd,
    include: includeDirs,
    nativeResume: nativeResumeConfig,
    settingsFile: settingsFilePath,
    reviewOptions: mode === 'review' ? { uncommitted, base, commit, title } : undefined,
    effort: effectiveEffort
  });

  // Use auto-detected format (from buildCommand) if available, otherwise use passed outputFormat
  const finalOutputFormat = autoDetectedFormat || outputFormat;
  
  // Create output parser and IR storage
  const parser = createOutputParser(finalOutputFormat);
  const allOutputUnits: CliOutputUnit[] = [];

  const startTime = Date.now();

  debugLog('EXEC', `Starting CLI execution`, {
    tool,
    mode,
    workingDir,
    conversationId,
    promptLength: finalPrompt.length,
    hasResume: !!resume,
    hasCustomId: !!customId,
    outputFormat: finalOutputFormat
  });

  return new Promise((resolve, reject) => {
    // Windows requires shell: true for npm global commands (.cmd files)
    // Unix-like systems can use shell: false for direct execution
    const isWindows = process.platform === 'win32';

    // When using cmd.exe via `shell: true`, escape args to prevent metacharacter injection.
    const commandToSpawn = isWindows ? escapeWindowsArg(command) : command;
    const argsToSpawn = isWindows ? args.map(escapeWindowsArg) : args;

    // Load custom environment variables from envFile if configured (for gemini/qwen)
    const toolConfig = getToolConfig(workingDir, tool);
    let customEnv: Record<string, string> = {};
    if (toolConfig.envFile) {
      customEnv = loadEnvFile(toolConfig.envFile);
    }

    // Merge custom env with process.env (custom env takes precedence)
    // Also include rulesEnv for $PROTO and $TMPL template variables
    const spawnEnv = {
      ...process.env,
      ...customEnv,
      ...(rulesEnv || {})
    };

    debugLog('SPAWN', `Spawning process`, {
      command,
      args,
      cwd: workingDir,
      shell: isWindows,
      useStdin,
      platform: process.platform,
      fullCommand: `${command} ${args.join(' ')}`,
      hasCustomEnv: Object.keys(customEnv).length > 0,
      customEnvKeys: Object.keys(customEnv),
      ...(isWindows ? { escapedCommand: commandToSpawn, escapedArgs: argsToSpawn, escapedFullCommand: `${commandToSpawn} ${argsToSpawn.join(' ')}` } : {})
    });

    const child = spawn(commandToSpawn, argsToSpawn, {
      cwd: workingDir,
      shell: isWindows,  // Enable shell on Windows for .cmd files
      stdio: [useStdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      env: spawnEnv
    });

    // Track current child process for cleanup on interruption
    currentChildProcess = child;

    debugLog('SPAWN', `Process spawned`, { pid: child.pid });

    // Write prompt to stdin if using stdin mode (for gemini/qwen)
    if (useStdin && child.stdin) {
      debugLog('STDIN', `Writing prompt to stdin (${finalPrompt.length} bytes)`);
      child.stdin.write(finalPrompt);
      child.stdin.end();
    }

    let stdout = '';
    let stderr = '';

    // Handle stdout
    child.stdout!.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;

      // Parse into IR units
      const units = parser.parse(data, 'stdout');
      allOutputUnits.push(...units);

      if (onOutput) {
        // Send each IR unit to callback
        for (const unit of units) {
          onOutput(unit);
        }
      }
    });

    // Handle stderr
    child.stderr!.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;

      // Parse into IR units
      const units = parser.parse(data, 'stderr');
      allOutputUnits.push(...units);

      if (onOutput) {
        // Send each IR unit to callback
        for (const unit of units) {
          onOutput(unit);
        }
      }
    });

    // Handle completion
    child.on('close', async (code) => {
      if (killTimeout && killTimeoutProcess === child) {
        clearTimeout(killTimeout);
        killTimeout = null;
        killTimeoutProcess = null;
      }

      // Clear current child process reference
      currentChildProcess = null;

      // Flush remaining buffer from parser
      const remainingUnits = parser.flush();
      allOutputUnits.push(...remainingUnits);
      if (onOutput) {
        for (const unit of remainingUnits) {
          onOutput(unit);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      debugLog('CLOSE', `Process closed`, {
        exitCode: code,
        duration: `${duration}ms`,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
        outputUnitsCount: allOutputUnits.length
      });

      // Determine status - prioritize output content over exit code
      let status: 'success' | 'error' = 'success';
      if (code !== 0) {
        // Non-zero exit code doesn't always mean failure
        // Check if there's valid output (AI response) - treat as success
        const hasValidOutput = stdout.trim().length > 0;
        const hasFatalError = stderr.includes('FATAL') ||
                              stderr.includes('Authentication failed') ||
                              stderr.includes('API key') ||
                              stderr.includes('rate limit exceeded');

        debugLog('STATUS', `Non-zero exit code analysis`, {
          exitCode: code,
          hasValidOutput,
          hasFatalError,
          stderrPreview: stderr.substring(0, 500)
        });

        if (hasValidOutput && !hasFatalError) {
          // Has output and no fatal errors - treat as success despite exit code
          status = 'success';
          debugLog('STATUS', `Treating as success (has valid output, no fatal errors)`);
        } else {
          status = 'error';
          errorLog('EXEC', `CLI execution failed`, undefined, {
            exitCode: code,
            tool,
            command,
            args,
            workingDir,
            stderrFull: stderr,
            stdoutPreview: stdout.substring(0, 200)
          });
        }
      } else {
        debugLog('STATUS', `Execution successful (exit code 0)`);
      }

      // Create new turn - cache full output when not streaming (default)
      const shouldCache = !parsed.data.stream;

      // Compute parsed output (filtered, intermediate content removed) for general display
      const computedParsedOutput = flattenOutputUnits(allOutputUnits, {
        excludeTypes: ['stderr', 'progress', 'metadata', 'system', 'tool_call', 'thought', 'code', 'file_diff', 'streaming_content'],
        stripCommandJsonBlocks: true  // Strip embedded command execution JSON from agent_message
      });

      // Compute final output (only agent_message) for --final flag
      const computedFinalOutput = flattenOutputUnits(allOutputUnits, {
        includeTypes: ['agent_message'],
        stripCommandJsonBlocks: true  // Strip embedded command execution JSON from agent_message
      });

      const newTurnOutput = {
        stdout: stdout.substring(0, 10240), // Truncate preview to 10KB
        stderr: stderr.substring(0, 2048),  // Truncate preview to 2KB
        truncated: stdout.length > 10240 || stderr.length > 2048,
        cached: shouldCache,
        stdout_full: shouldCache ? stdout : undefined,
        stderr_full: shouldCache ? stderr : undefined,
        parsed_output: computedParsedOutput || undefined,  // Filtered output for general display
        final_output: computedFinalOutput || undefined,  // Agent message only for --final flag
        structured: allOutputUnits  // Save structured IR units
      };

      // Determine base turn number for merge scenarios
      const baseTurnNumber = isMerge && mergeResult
        ? mergeResult.mergedTurns.length + 1
        : (existingConversation ? existingConversation.turns.length + 1 : 1);

      const newTurn: ConversationTurn = {
        turn: baseTurnNumber,
        timestamp: new Date(startTime).toISOString(),
        prompt,
        duration_ms: duration,
        status,
        exit_code: code,
        output: newTurnOutput
      };

      // Create or update conversation record
      let conversation: ConversationRecord;

      if (isMerge && mergeResult && !customId) {
        // Merge without --id: append to ALL source conversations
        // Save new turn to each source conversation
        const savedConversations: ConversationRecord[] = [];
        for (const srcConv of sourceConversations) {
          const turnForSrc: ConversationTurn = {
            ...newTurn,
            turn: srcConv.turns.length + 1 // Use each conversation's turn count
          };
          const updatedConv: ConversationRecord = {
            ...srcConv,
            updated_at: new Date().toISOString(),
            total_duration_ms: srcConv.total_duration_ms + duration,
            turn_count: srcConv.turns.length + 1,
            latest_status: status,
            turns: [...srcConv.turns, turnForSrc]
          };
          savedConversations.push(updatedConv);
        }
        // Use first conversation as primary
        conversation = savedConversations[0];
        // Save all source conversations
        try {
          for (const conv of savedConversations) {
            saveConversation(workingDir, conv);
          }
        } catch (err) {
          console.error('[CLI Executor] Failed to save merged histories:', (err as Error).message);
        }
      } else if (isMerge && mergeResult && customId) {
        // Merge with --id: create new conversation with merged turns + new turn
        // Convert merged turns to regular turns (without source_id)
        const mergedTurns: ConversationTurn[] = mergeResult.mergedTurns.map((mt, idx) => ({
          turn: idx + 1,
          timestamp: mt.timestamp,
          prompt: mt.prompt,
          duration_ms: mt.duration_ms,
          status: mt.status,
          exit_code: mt.exit_code,
          output: mt.output
        }));

        conversation = existingConversation
          ? {
              ...existingConversation,
              updated_at: new Date().toISOString(),
              total_duration_ms: existingConversation.total_duration_ms + duration,
              turn_count: existingConversation.turns.length + 1,
              latest_status: status,
              turns: [...existingConversation.turns, newTurn]
            }
          : {
              id: conversationId,
              created_at: new Date(startTime).toISOString(),
              updated_at: new Date().toISOString(),
              tool,
              model: model || 'default',
              mode,
              category,
              total_duration_ms: mergeResult.totalDuration + duration,
              turn_count: mergedTurns.length + 1,
              latest_status: status,
              turns: [...mergedTurns, newTurn]
            };
        // Save merged conversation
        try {
          saveConversation(workingDir, conversation);
        } catch (err) {
          console.error('[CLI Executor] Failed to save merged conversation:', (err as Error).message);
        }
      } else {
        // Normal scenario: single conversation
        conversation = existingConversation
          ? {
              ...existingConversation,
              updated_at: new Date().toISOString(),
              total_duration_ms: existingConversation.total_duration_ms + duration,
              turn_count: existingConversation.turns.length + 1,
              latest_status: status,
              turns: [...existingConversation.turns, newTurn]
            }
          : {
              id: conversationId,
              created_at: new Date(startTime).toISOString(),
              updated_at: new Date().toISOString(),
              tool,
              model: model || 'default',
              mode,
              category,
              total_duration_ms: duration,
              turn_count: 1,
              latest_status: status,
              turns: [newTurn],
              parent_execution_id: parentExecutionId
            };
        // Try to save conversation to history
        try {
          saveConversation(workingDir, conversation);
        } catch (err) {
          // Non-fatal: continue even if history save fails
          console.error('[CLI Executor] Failed to save history:', (err as Error).message);
        }
      }

      // Track native session after execution (awaited to prevent process hang)
      // Pass prompt and transactionId for precise matching in parallel execution scenarios
      try {
        const nativeSession = await trackNewSession(tool, new Date(startTime), workingDir, prompt, transactionId);
        if (nativeSession) {
          // Save native session mapping with transaction ID
          try {
            store.saveNativeSessionMapping({
              ccw_id: conversationId,
              tool,
              native_session_id: nativeSession.sessionId,
              native_session_path: nativeSession.filePath,
              project_hash: nativeSession.projectHash,
              transaction_id: transactionId,
              created_at: new Date().toISOString()
            });
          } catch (err) {
            console.error('[CLI Executor] Failed to save native session mapping:', (err as Error).message);
          }
        }
      } catch (err) {
        console.error('[CLI Executor] Failed to track native session:', (err as Error).message);
      }

      // Create legacy execution record for backward compatibility
      const execution: ExecutionRecord = {
        id: conversationId,
        timestamp: new Date(startTime).toISOString(),
        tool,
        model: effectiveModel || 'default',
        mode,
        prompt,
        status,
        exit_code: code,
        duration_ms: duration,
        output: newTurnOutput,
        parsedOutput: computedParsedOutput,  // Use already-computed filtered output
        finalOutput: computedFinalOutput  // Use already-computed agent_message only output
      };

      resolve({
        success: status === 'success',
        execution,
        conversation,
        stdout,
        stderr,
        parsedOutput: execution.parsedOutput,
        finalOutput: execution.finalOutput
      });
    });

    // Handle errors
    child.on('error', (error) => {
      errorLog('SPAWN', `Failed to spawn process`, error, {
        tool,
        command,
        args,
        workingDir,
        fullCommand: `${command} ${args.join(' ')}`,
        platform: process.platform,
        path: process.env.PATH?.split(process.platform === 'win32' ? ';' : ':').slice(0, 10).join('\n  ') + '...'
      });
      reject(new Error(`Failed to spawn ${tool}: ${error.message}\n  Command: ${command} ${args.join(' ')}\n  Working Dir: ${workingDir}`));
    });

    // Timeout controlled by external caller (bash timeout)
    // When parent process terminates, child will be cleaned up via process exit handler
  });
}

// Tool schema for MCP
export const schema: ToolSchema = {
  name: 'cli_executor',
  description: `Execute external CLI tools (gemini/qwen/codex) with unified interface.
Modes:
- analysis: Read-only operations (default)
- write: File modifications allowed
- auto: Full autonomous operations (codex only)
- review: Code review mode (codex uses 'codex review' subcommand, others accept but no operation change)`,
  inputSchema: {
    type: 'object',
    properties: {
      tool: {
        type: 'string',
        enum: ['gemini', 'qwen', 'codex'],
        description: 'CLI tool to execute'
      },
      prompt: {
        type: 'string',
        description: 'Prompt to send to the CLI tool'
      },
      mode: {
        type: 'string',
        enum: ['analysis', 'write', 'auto', 'review'],
        description: 'Execution mode (default: analysis). review mode uses codex review subcommand for codex tool.',
        default: 'analysis'
      },
      model: {
        type: 'string',
        description: 'Model override (tool-specific)'
      },
      cd: {
        type: 'string',
        description: 'Working directory for execution (-C for codex)'
      },
      includeDirs: {
        type: 'string',
        description: 'Additional directories (comma-separated). Maps to --include-directories for gemini/qwen, --add-dir for codex'
      }
      // timeout removed - controlled by external caller (bash timeout)
    },
    required: ['tool', 'prompt']
  }
};

// Handler function
export async function handler(params: Record<string, unknown>): Promise<ToolResult<ExecutionOutput>> {
  try {
    const result = await executeCliTool(params);
    return {
      success: result.success,
      result
    };
  } catch (error) {
    return {
      success: false,
      error: `CLI execution failed: ${(error as Error).message}`
    };
  }
}

export {
  batchDeleteExecutionsAsync,
  deleteExecution,
  deleteExecutionAsync,
  getConversationDetail,
  getConversationDetailWithNativeInfo,
  getExecutionDetail,
  getExecutionHistory,
  getExecutionHistoryAsync
} from './cli-executor-state.js';

/**
 * Get status of all CLI tools
 * Dynamically reads tools from config file
 * Handles different tool types:
 * - builtin: Check system PATH availability
 * - cli-wrapper: Check CLI Settings configuration exists
 * - api-endpoint: Check LiteLLM endpoint configuration exists
 */
export async function getCliToolsStatus(): Promise<Record<string, ToolAvailability>> {
  const funcStart = Date.now();
  debugLog('PERF', 'getCliToolsStatus START');

  // Default built-in tools
  const builtInTools = ['gemini', 'qwen', 'codex', 'claude', 'opencode'];

  // Try to get tools from config with their types
  interface ToolInfo {
    name: string;
    type?: 'builtin' | 'cli-wrapper' | 'api-endpoint';
    enabled?: boolean;
    id?: string;  // For api-endpoint type
  }
  let toolsInfo: ToolInfo[] = builtInTools.map(name => ({ name, type: 'builtin' }));

  const configLoadStart = Date.now();
  try {
    // Dynamic import to avoid circular dependencies
    const { loadClaudeCliTools } = await import('./claude-cli-tools.js');
    const config = loadClaudeCliTools(configBaseDir);
    if (config.tools && typeof config.tools === 'object') {
      // Build complete tool info list from config
      const configToolsInfo: ToolInfo[] = Object.entries(config.tools).map(([name, toolConfig]) => ({
        name,
        type: toolConfig.type || 'builtin',
        enabled: toolConfig.enabled !== false,
        id: toolConfig.id
      }));

      // Merge: config tools take precedence over built-in defaults
      const toolsMap = new Map<string, ToolInfo>();
      toolsInfo.forEach(t => toolsMap.set(t.name, t));
      configToolsInfo.forEach(t => toolsMap.set(t.name, t));
      toolsInfo = Array.from(toolsMap.values());
    }
  } catch (e) {
    // Fallback to built-in tools if config load fails
    debugLog('cli-executor', `Using built-in tools (config load failed: ${(e as Error).message})`);
  }
  debugLog('PERF', `Config load: ${Date.now() - configLoadStart}ms, tools: ${toolsInfo.length}`);

  const results: Record<string, ToolAvailability> = {};
  const toolTimings: Record<string, number> = {};

  const checksStart = Date.now();
  await Promise.all(toolsInfo.map(async (toolInfo) => {
    const { name, type, enabled, id } = toolInfo;
    const toolStart = Date.now();

    // Check availability based on tool type
    if (type === 'cli-wrapper') {
      // For cli-wrapper: check if CLI Settings configuration exists
      try {
        const { findEndpoint } = await import('../config/cli-settings-manager.js');
        const endpoint = findEndpoint(name);
        if (endpoint && endpoint.enabled) {
          results[name] = {
            available: true,
            path: `cli-settings:${endpoint.id}`  // Virtual path indicating CLI Settings source
          };
        } else {
          results[name] = { available: false, path: null };
        }
      } catch (e) {
        debugLog('cli-executor', `Failed to check cli-wrapper ${name}: ${(e as Error).message}`);
        results[name] = { available: false, path: null };
      }
    } else if (type === 'api-endpoint') {
      // For api-endpoint: check if LiteLLM endpoint configuration exists
      try {
        const { findEndpointById } = await import('../config/litellm-api-config-manager.js');
        const endpointId = id || name;
        const endpoint = findEndpointById(configBaseDir, endpointId);
        if (endpoint && enabled !== false) {
          results[name] = {
            available: true,
            path: `litellm:${endpointId}`  // Virtual path indicating LiteLLM source
          };
        } else {
          results[name] = { available: false, path: null };
        }
      } catch (e) {
        debugLog('cli-executor', `Failed to check api-endpoint ${name}: ${(e as Error).message}`);
        results[name] = { available: false, path: null };
      }
    } else {
      // For builtin: check system PATH availability
      results[name] = await checkToolAvailability(name);
    }

    toolTimings[name] = Date.now() - toolStart;
  }));

  debugLog('PERF', `Tool checks: ${Date.now() - checksStart}ms | Individual: ${JSON.stringify(toolTimings)}`);
  debugLog('PERF', `getCliToolsStatus TOTAL: ${Date.now() - funcStart}ms`);

  return results;
}

// CLI tool package mapping
const CLI_TOOL_PACKAGES: Record<string, string> = {
  gemini: '@google/gemini-cli',
  qwen: '@qwen-code/qwen-code',
  codex: '@openai/codex',
  claude: '@anthropic-ai/claude-code',
  opencode: 'opencode'  // https://opencode.ai - installed via npm/pnpm/bun/brew
};

// Disabled tools storage (in-memory fallback, main storage is in cli-config.json)
const disabledTools = new Set<string>();

// Default working directory for config operations
let configBaseDir = process.cwd();

/**
 * Set the base directory for config operations
 */
export function setConfigBaseDir(dir: string): void {
  configBaseDir = dir;
}

/**
 * Install a CLI tool via npm
 */
export async function installCliTool(tool: string): Promise<{ success: boolean; error?: string }> {
  const packageName = CLI_TOOL_PACKAGES[tool];
  if (!packageName) {
    return { success: false, error: `Unknown tool: ${tool}` };
  }

  return new Promise((resolve) => {
    const child = spawn('npm', ['install', '-g', packageName], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    child.stderr?.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      // Clear cache to force re-check
      clearToolCache();

      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr || `npm install failed with code ${code}` });
      }
    });

    child.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      child.kill();
      resolve({ success: false, error: 'Installation timed out' });
    }, 120000);
  });
}

/**
 * Uninstall a CLI tool via npm
 */
export async function uninstallCliTool(tool: string): Promise<{ success: boolean; error?: string }> {
  const packageName = CLI_TOOL_PACKAGES[tool];
  if (!packageName) {
    return { success: false, error: `Unknown tool: ${tool}` };
  }

  return new Promise((resolve) => {
    const child = spawn('npm', ['uninstall', '-g', packageName], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    child.stderr?.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      // Clear cache to force re-check
      clearToolCache();

      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr || `npm uninstall failed with code ${code}` });
      }
    });

    child.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    // Timeout after 1 minute
    setTimeout(() => {
      child.kill();
      resolve({ success: false, error: 'Uninstallation timed out' });
    }, 60000);
  });
}

/**
 * Enable a CLI tool (updates config file)
 */
export function enableCliTool(tool: string): { success: boolean } {
  try {
    enableToolFromConfig(configBaseDir, tool);
    disabledTools.delete(tool); // Also update in-memory fallback
    return { success: true };
  } catch (err) {
    console.error('[cli-executor] Error enabling tool:', err);
    disabledTools.delete(tool); // Fallback to in-memory
    return { success: true };
  }
}

/**
 * Disable a CLI tool (updates config file)
 */
export function disableCliTool(tool: string): { success: boolean } {
  try {
    disableToolFromConfig(configBaseDir, tool);
    disabledTools.add(tool); // Also update in-memory fallback
    return { success: true };
  } catch (err) {
    console.error('[cli-executor] Error disabling tool:', err);
    disabledTools.add(tool); // Fallback to in-memory
    return { success: true };
  }
}

/**
 * Check if a tool is enabled (reads from config file)
 */
export function isToolEnabled(tool: string): boolean {
  try {
    return isToolEnabledFromConfig(configBaseDir, tool);
  } catch {
    // Fallback to in-memory check
    return !disabledTools.has(tool);
  }
}

/**
 * Get full status of all CLI tools including enabled state
 */
export async function getCliToolsFullStatus(): Promise<Record<string, {
  available: boolean;
  enabled: boolean;
  path: string | null;
  packageName: string;
}>> {
  const tools = Object.keys(CLI_TOOL_PACKAGES);
  const results: Record<string, {
    available: boolean;
    enabled: boolean;
    path: string | null;
    packageName: string;
  }> = {};

  await Promise.all(tools.map(async (tool) => {
    const availability = await checkToolAvailability(tool);
    results[tool] = {
      available: availability.available,
      enabled: isToolEnabled(tool),
      path: availability.path,
      packageName: CLI_TOOL_PACKAGES[tool]
    };
  }));

  return results;
}


/**
 * Build continuation prompt with previous conversation context (legacy)
 */
function buildContinuationPrompt(previous: ExecutionRecord, additionalPrompt?: string): string {
  const parts: string[] = [];

  // Add previous conversation context
  parts.push('=== PREVIOUS CONVERSATION ===');
  parts.push('');
  parts.push('USER PROMPT:');
  parts.push(previous.prompt);
  parts.push('');
  parts.push('ASSISTANT RESPONSE:');
  parts.push(previous.output.stdout || '[No output recorded]');
  parts.push('');
  parts.push('=== CONTINUATION ===');
  parts.push('');

  if (additionalPrompt) {
    parts.push(additionalPrompt);
  } else {
    parts.push('Continue from where we left off. What should we do next?');
  }

  return parts.join('\n');
}

/**
 * Get previous execution for resume
 * @param baseDir - Working directory
 * @param tool - Tool to filter by
 * @param resume - true for last, or execution ID string
 */
function getPreviousExecution(baseDir: string, tool: string, resume: boolean | string): ExecutionRecord | null {
  if (typeof resume === 'string') {
    // Resume specific execution by ID
    return getExecutionDetail(baseDir, resume);
  } else if (resume === true) {
    // Resume last execution for this tool
    const history = getExecutionHistory(baseDir, { limit: 1, tool });
    if (history.executions.length === 0) {
      return null;
    }
    return getExecutionDetail(baseDir, history.executions[0].id);
  }
  return null;
}

/**
 * Latest execution + native session history functions are re-exported from state.
 */
export {
  getEnrichedConversation,
  getFormattedNativeConversation,
  getHistoryWithNativeInfo,
  getLatestExecution,
  getNativeConversationPairs,
  getNativeSessionContent
} from './cli-executor-state.js';

// Export types
export type { ExecutionCategory, ConversationRecord, ConversationTurn, ExecutionRecord } from './cli-executor-state.js';
export type { PromptFormat, ConcatOptions } from './cli-prompt-builder.js';

// Export utility functions and tool definition for backward compatibility
export { executeCliTool, checkToolAvailability, clearToolCache };

// Export env file utilities for testing
export { parseEnvFile, loadEnvFile };

// Export prompt concatenation utilities
export { PromptConcatenator, createPromptConcatenator, buildPrompt, buildMultiTurnPrompt } from './cli-prompt-builder.js';

// Note: Async storage functions (getExecutionHistoryAsync, deleteExecutionAsync,
// batchDeleteExecutionsAsync) are exported at declaration site - SQLite storage only

// Export tool definition (for legacy imports) - This allows direct calls to execute with onOutput
export const cliExecutorTool = {
  schema,
  execute: executeCliTool // Use executeCliTool directly which supports onOutput callback
};
