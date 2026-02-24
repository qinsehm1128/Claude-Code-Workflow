/**
 * Hook Command - CLI endpoint for Claude Code hooks
 * Provides simplified interface for hook operations, replacing complex bash/curl commands
 */

import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';

interface HookOptions {
  stdin?: boolean;
  sessionId?: string;
  prompt?: string;
  type?: 'session-start' | 'context' | 'session-end' | 'stop' | 'pre-compact';
  path?: string;
}

interface HookData {
  session_id?: string;
  prompt?: string;
  cwd?: string;
  tool_input?: Record<string, unknown>;
  user_prompt?: string; // For UserPromptSubmit hook
  // Stop context fields
  stop_reason?: string;
  stopReason?: string;
  end_turn_reason?: string;
  endTurnReason?: string;
  user_requested?: boolean;
  userRequested?: boolean;
  active_mode?: 'analysis' | 'write' | 'review' | 'auto';
  activeMode?: 'analysis' | 'write' | 'review' | 'auto';
  active_workflow?: boolean;
  activeWorkflow?: boolean;
}

/**
 * Read JSON data from stdin (for Claude Code hooks)
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
    // Handle case where stdin is empty or not piped
    if (process.stdin.isTTY) {
      resolve('');
    }
  });
}

/**
 * Get project path from hook data or current working directory
 */
function getProjectPath(hookCwd?: string): string {
  return hookCwd || process.cwd();
}

/**
 * Session context action - provides progressive context loading
 *
 * Uses HookContextService for unified context generation:
 *   - session-start: MEMORY.md summary + clusters + hot entities + patterns
 *   - per-prompt: vector search across all memory categories
 *
 * Falls back to SessionClusteringService.getProgressiveIndex() when
 * the embedder is unavailable, preserving backward compatibility.
 */
async function sessionContextAction(options: HookOptions): Promise<void> {
  let { stdin, sessionId, prompt } = options;
  let hookCwd: string | undefined;

  // If --stdin flag is set, read from stdin (Claude Code hook format)
  if (stdin) {
    try {
      const stdinData = await readStdin();
      if (stdinData) {
        const hookData = JSON.parse(stdinData) as HookData;
        sessionId = hookData.session_id || sessionId;
        hookCwd = hookData.cwd;
        prompt = hookData.prompt || prompt;
      }
    } catch {
      // Silently continue if stdin parsing fails
    }
  }

  if (!sessionId) {
    if (!stdin) {
      console.error(chalk.red('Error: --session-id is required'));
      console.error(chalk.gray('Usage: ccw hook session-context --session-id <id>'));
      console.error(chalk.gray('       ccw hook session-context --stdin'));
    }
    process.exit(stdin ? 0 : 1);
  }

  try {
    const projectPath = getProjectPath(hookCwd);

    // Check for recovery on session-start
    const isFirstPrompt = !prompt || prompt.trim() === '';
    let recoveryMessage = '';

    if (isFirstPrompt && sessionId) {
      try {
        const { RecoveryHandler } = await import('../core/hooks/recovery-handler.js');
        const recoveryHandler = new RecoveryHandler({
          projectPath,
          enableLogging: !stdin
        });

        const checkpoint = await recoveryHandler.checkRecovery(sessionId);
        if (checkpoint) {
          recoveryMessage = await recoveryHandler.formatRecoveryMessage(checkpoint);
          if (!stdin) {
            console.log(chalk.yellow('Recovery checkpoint found!'));
          }
        }
      } catch (recoveryError) {
        // Recovery check failure should not affect session start
        if (!stdin) {
          console.log(chalk.yellow(`Recovery check warning: ${(recoveryError as Error).message}`));
        }
      }
    }

    // Use HookContextService for unified context generation
    const { HookContextService } = await import('../core/services/hook-context-service.js');
    const contextService = new HookContextService({ projectPath });

    // Build context using the service
    const result = await contextService.buildPromptContext({
      sessionId,
      prompt,
      projectId: projectPath
    });

    const content = result.content;
    const contextType = result.type;
    const loadCount = result.state.loadCount;
    const isAdvanced = await contextService.isAdvancedContextAvailable();

    if (stdin) {
      // For hooks: output content directly to stdout
      // Include recovery message if available
      if (recoveryMessage) {
        process.stdout.write(recoveryMessage);
        if (content) {
          process.stdout.write('\n\n');
          process.stdout.write(content);
        }
      } else if (content) {
        process.stdout.write(content);
      }
      process.exit(0);
    }

    // Interactive mode: show detailed output
    console.log(chalk.green('Session Context'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.cyan('Session ID:'), sessionId);
    console.log(chalk.cyan('Type:'), contextType);
    console.log(chalk.cyan('First Prompt:'), isFirstPrompt ? 'Yes' : 'No');
    console.log(chalk.cyan('Load Count:'), loadCount);
    console.log(chalk.cyan('Builder:'), isAdvanced ? 'UnifiedContextBuilder' : 'Legacy (getProgressiveIndex)');
    if (recoveryMessage) {
      console.log(chalk.cyan('Recovery:'), 'Checkpoint found');
    }
    console.log(chalk.gray('─'.repeat(40)));
    if (recoveryMessage) {
      console.log(chalk.yellow('Recovery Message:'));
      console.log(recoveryMessage);
      console.log();
    }
    if (content) {
      console.log(content);
    } else {
      console.log(chalk.gray('(No context generated)'));
    }
  } catch (error) {
    if (stdin) {
      // Silent failure for hooks
      process.exit(0);
    }
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Session end action - triggers async background tasks for memory maintenance.
 *
 * Uses SessionEndService for unified task management:
 *   - Incremental vector embedding (index new/updated content)
 *   - Incremental clustering (cluster unclustered sessions)
 *   - Heat score updates (recalculate entity heat scores)
 *
 * All tasks run best-effort; failures are logged but do not affect exit code.
 */
async function sessionEndAction(options: HookOptions): Promise<void> {
  let { stdin, sessionId } = options;
  let hookCwd: string | undefined;

  if (stdin) {
    try {
      const stdinData = await readStdin();
      if (stdinData) {
        const hookData = JSON.parse(stdinData) as HookData;
        sessionId = hookData.session_id || sessionId;
        hookCwd = hookData.cwd;
      }
    } catch {
      // Silently continue if stdin parsing fails
    }
  }

  if (!sessionId) {
    if (!stdin) {
      console.error(chalk.red('Error: --session-id is required'));
    }
    process.exit(stdin ? 0 : 1);
  }

  try {
    const projectPath = getProjectPath(hookCwd);

    // Clean up mode states for this session
    try {
      const { ModeRegistryService } = await import('../core/services/mode-registry-service.js');
      const modeRegistry = new ModeRegistryService({
        projectPath,
        enableLogging: !stdin
      });

      // Get active modes for this session and deactivate them
      const activeModes = modeRegistry.getActiveModes(sessionId);
      for (const mode of activeModes) {
        modeRegistry.deactivateMode(mode, sessionId);
        if (!stdin) {
          console.log(chalk.gray(`  Deactivated mode: ${mode}`));
        }
      }
    } catch (modeError) {
      // Mode cleanup failure should not affect session end
      if (!stdin) {
        console.log(chalk.yellow(`  Mode cleanup warning: ${(modeError as Error).message}`));
      }
    }

    // Use SessionEndService for unified task management
    const { createSessionEndService } = await import('../core/services/session-end-service.js');
    const sessionEndService = await createSessionEndService(projectPath, sessionId, !stdin);

    const registeredTasks = sessionEndService.getRegisteredTasks();

    if (registeredTasks.length === 0) {
      // No tasks available - skip session-end tasks
      if (!stdin) {
        console.log(chalk.gray('(No session-end tasks available)'));
      }
      process.exit(0);
    }

    if (!stdin) {
      console.log(chalk.green(`Session End: executing ${registeredTasks.length} background tasks...`));
    }

    // Execute all tasks
    const summary = await sessionEndService.executeEndTasks(sessionId);

    if (!stdin) {
      for (const result of summary.results) {
        const status = result.success ? 'OK' : 'FAIL';
        const color = result.success ? chalk.green : chalk.yellow;
        console.log(color(`  [${status}] ${result.type} (${result.duration}ms)`));
      }
      console.log(chalk.gray(`Total: ${summary.successful}/${summary.totalTasks} tasks completed in ${summary.totalDuration}ms`));
    }

    process.exit(0);
  } catch (error) {
    if (stdin) {
      process.exit(0);
    }
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Stop action - handles Stop hook events with Soft Enforcement
 *
 * Uses StopHandler for priority-based stop handling:
 *   1. context-limit: Always allow stop (deadlock prevention)
 *   2. user-abort: Respect user intent
 *   3. active-workflow: Inject continuation message
 *   4. active-mode: Inject continuation message
 *
 * Returns { continue: true, message?: string } - never blocks stops.
 */
async function stopAction(options: HookOptions): Promise<void> {
  let { stdin, sessionId } = options;
  let hookCwd: string | undefined;
  let hookData: HookData = {};

  // If --stdin flag is set, read from stdin (Claude Code hook format)
  if (stdin) {
    try {
      const stdinData = await readStdin();
      if (stdinData) {
        hookData = JSON.parse(stdinData) as HookData;
        sessionId = hookData.session_id || sessionId;
        hookCwd = hookData.cwd;
      }
    } catch {
      // Silently continue if stdin parsing fails
    }
  }

  try {
    const projectPath = getProjectPath(hookCwd);

    // Import StopHandler dynamically to avoid circular dependencies
    const { StopHandler } = await import('../core/hooks/stop-handler.js');
    const stopHandler = new StopHandler({
      enableLogging: !stdin,
      projectPath // Pass projectPath for ModeRegistryService integration
    });

    // Build stop context from hook data
    const stopContext = {
      session_id: sessionId,
      sessionId: sessionId,
      project_path: projectPath,
      projectPath: projectPath,
      stop_reason: hookData.stop_reason,
      stopReason: hookData.stopReason,
      end_turn_reason: hookData.end_turn_reason,
      endTurnReason: hookData.endTurnReason,
      user_requested: hookData.user_requested,
      userRequested: hookData.userRequested,
      active_mode: hookData.active_mode,
      activeMode: hookData.activeMode,
      active_workflow: hookData.active_workflow,
      activeWorkflow: hookData.activeWorkflow
    };

    // Handle the stop event
    const result = await stopHandler.handleStop(stopContext);

    if (stdin) {
      // For hooks: output JSON result to stdout
      const output: { continue: true; message?: string } = {
        continue: true
      };
      if (result.message) {
        output.message = result.message;
      }
      process.stdout.write(JSON.stringify(output));
      process.exit(0);
    }

    // Interactive mode: show detailed output
    console.log(chalk.green('Stop Handler'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.cyan('Mode:'), result.mode || 'none');
    console.log(chalk.cyan('Continue:'), result.continue);
    if (result.message) {
      console.log(chalk.yellow('Message:'));
      console.log(result.message);
    }
    if (result.metadata) {
      console.log(chalk.gray('─'.repeat(40)));
      console.log(chalk.cyan('Metadata:'));
      console.log(JSON.stringify(result.metadata, null, 2));
    }
    process.exit(0);
  } catch (error) {
    if (stdin) {
      // Silent failure for hooks - always allow stop
      process.stdout.write(JSON.stringify({ continue: true }));
      process.exit(0);
    }
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Parse CCW status.json and output formatted status
 */
async function parseStatusAction(options: HookOptions): Promise<void> {
  const { path: filePath } = options;

  if (!filePath) {
    console.error(chalk.red('Error: --path is required'));
    process.exit(1);
  }

  try {
    // Check if this is a CCW status.json file
    if (!filePath.includes('status.json') ||
        !filePath.match(/\.(ccw|ccw-coordinator|ccw-debug)[/\\]/)) {
      console.log(chalk.gray('(Not a CCW status file)'));
      process.exit(0);
    }

    // Read and parse status.json
    if (!existsSync(filePath)) {
      console.log(chalk.gray('(Status file not found)'));
      process.exit(0);
    }

    const statusContent = readFileSync(filePath, 'utf8');
    const status = JSON.parse(statusContent);

    // Extract key information
    const sessionId = status.session_id || 'unknown';
    const workflow = status.workflow || status.mode || 'unknown';

    // Find current command (running or last completed)
    let currentCommand = status.command_chain?.find((cmd: { status: string }) => cmd.status === 'running')?.command;
    if (!currentCommand) {
      const completed = status.command_chain?.filter((cmd: { status: string }) => cmd.status === 'completed');
      currentCommand = completed?.[completed.length - 1]?.command || 'unknown';
    }

    // Find next command (first pending)
    const nextCommand = status.command_chain?.find((cmd: { status: string }) => cmd.status === 'pending')?.command || '无';

    // Format status message
    const message = `📋 CCW Status [${sessionId}] (${workflow}): 当前处于 ${currentCommand}，下一个命令 ${nextCommand}`;

    console.log(message);
    process.exit(0);
  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Keyword detection and mode activation action
 *
 * Detects magic keywords in user prompts and activates corresponding modes.
 * Called from UserPromptSubmit hook.
 */
async function keywordAction(options: HookOptions): Promise<void> {
  let { stdin, sessionId, prompt } = options;
  let hookCwd: string | undefined;

  if (stdin) {
    try {
      const stdinData = await readStdin();
      if (stdinData) {
        const hookData = JSON.parse(stdinData) as HookData;
        sessionId = hookData.session_id || sessionId;
        hookCwd = hookData.cwd;
        // Support both 'prompt' and 'user_prompt' fields
        prompt = hookData.prompt || hookData.user_prompt || prompt;
      }
    } catch {
      // Silently continue if stdin parsing fails
    }
  }

  if (!prompt) {
    // No prompt to analyze - just exit silently
    if (stdin) {
      process.exit(0);
    }
    console.error(chalk.red('Error: --prompt is required'));
    process.exit(1);
  }

  try {
    const projectPath = getProjectPath(hookCwd);

    // Import keyword detector
    const { getPrimaryKeyword, getAllKeywords, KEYWORD_PATTERNS } = await import('../core/hooks/keyword-detector.js');

    // Detect keywords in prompt
    const primaryKeyword = getPrimaryKeyword(prompt);

    if (!primaryKeyword) {
      // No keywords detected - exit silently for hooks
      if (stdin) {
        process.exit(0);
      }
      console.log(chalk.gray('No mode keywords detected'));
      process.exit(0);
    }

    // Map keyword type to execution mode
    const keywordToModeMap: Record<string, string> = {
      'autopilot': 'autopilot',
      'ralph': 'ralph',
      'ultrawork': 'ultrawork',
      'swarm': 'swarm',
      'pipeline': 'pipeline',
      'team': 'team',
      'ultrapilot': 'team', // ultrapilot maps to team
      'ultraqa': 'ultraqa'
    };

    const executionMode = keywordToModeMap[primaryKeyword.type];

    if (!executionMode) {
      // Keyword not mapped to execution mode (e.g., 'cancel', 'codex', 'gemini')
      if (stdin) {
        process.exit(0);
      }
      console.log(chalk.gray(`Keyword "${primaryKeyword.keyword}" detected but no execution mode mapped`));
      process.exit(0);
    }

    // Generate sessionId if not provided
    const effectiveSessionId = sessionId || `mode-${Date.now()}`;

    // Import ModeRegistryService and activate mode
    const { ModeRegistryService } = await import('../core/services/mode-registry-service.js');
    const modeRegistry = new ModeRegistryService({
      projectPath,
      enableLogging: !stdin
    });

    // Check if mode can be started
    const canStart = modeRegistry.canStartMode(executionMode as any, effectiveSessionId);
    if (!canStart.allowed) {
      if (stdin) {
        // For hooks: just output a warning message
        const output = {
          continue: true,
          systemMessage: `[MODE ACTIVATION BLOCKED] ${canStart.message}`
        };
        process.stdout.write(JSON.stringify(output));
        process.exit(0);
      }
      console.log(chalk.yellow(`Cannot activate mode: ${canStart.message}`));
      process.exit(0);
    }

    // Activate the mode
    const activated = modeRegistry.activateMode(
      executionMode as any,
      effectiveSessionId,
      { prompt, keyword: primaryKeyword.keyword }
    );

    if (stdin) {
      // For hooks: output activation result
      const output = {
        continue: true,
        systemMessage: activated
          ? `[MODE ACTIVATED] ${executionMode.toUpperCase()} mode activated for this session. Keyword detected: "${primaryKeyword.keyword}"`
          : `[MODE ACTIVATION FAILED] Could not activate ${executionMode} mode`
      };
      process.stdout.write(JSON.stringify(output));
      process.exit(0);
    }

    // Interactive mode: show detailed output
    console.log(chalk.green('Keyword Detection'));
    console.log(chalk.gray('-'.repeat(40)));
    console.log(chalk.cyan('Detected Keyword:'), primaryKeyword.keyword);
    console.log(chalk.cyan('Type:'), primaryKeyword.type);
    console.log(chalk.cyan('Position:'), primaryKeyword.position);
    console.log(chalk.cyan('Execution Mode:'), executionMode);
    console.log(chalk.cyan('Session ID:'), effectiveSessionId);
    console.log(chalk.cyan('Activated:'), activated ? 'Yes' : 'No');
    process.exit(0);
  } catch (error) {
    if (stdin) {
      // Silent failure for hooks
      process.exit(0);
    }
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * PreCompact action - handles PreCompact hook events
 *
 * Creates a checkpoint before context compaction to preserve state.
 * Uses RecoveryHandler with mutex to prevent concurrent compaction.
 *
 * Returns { continue: true, systemMessage?: string } - checkpoint summary.
 */
async function preCompactAction(options: HookOptions): Promise<void> {
  let { stdin, sessionId } = options;
  let hookCwd: string | undefined;
  let trigger: 'manual' | 'auto' = 'auto';

  if (stdin) {
    try {
      const stdinData = await readStdin();
      if (stdinData) {
        const hookData = JSON.parse(stdinData) as HookData & {
          trigger?: 'manual' | 'auto';
          transcript_path?: string;
          permission_mode?: string;
          hook_event_name?: string;
        };
        sessionId = hookData.session_id || sessionId;
        hookCwd = hookData.cwd;
        trigger = hookData.trigger || 'auto';
      }
    } catch {
      // Silently continue if stdin parsing fails
    }
  }

  if (!sessionId) {
    if (!stdin) {
      console.error(chalk.red('Error: --session-id is required'));
    }
    // For hooks, use a default session ID
    sessionId = `compact-${Date.now()}`;
  }

  try {
    const projectPath = getProjectPath(hookCwd);

    // Import RecoveryHandler dynamically
    const { RecoveryHandler } = await import('../core/hooks/recovery-handler.js');
    const recoveryHandler = new RecoveryHandler({
      projectPath,
      enableLogging: !stdin
    });

    // Handle PreCompact with mutex protection
    const result = await recoveryHandler.handlePreCompact({
      session_id: sessionId,
      cwd: projectPath,
      hook_event_name: 'PreCompact',
      trigger
    });

    if (stdin) {
      // For hooks: output JSON result to stdout
      const output: { continue: boolean; systemMessage?: string } = {
        continue: result.continue
      };
      if (result.systemMessage) {
        output.systemMessage = result.systemMessage;
      }
      process.stdout.write(JSON.stringify(output));
      process.exit(0);
    }

    // Interactive mode: show detailed output
    console.log(chalk.green('PreCompact Handler'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.cyan('Session ID:'), sessionId);
    console.log(chalk.cyan('Trigger:'), trigger);
    console.log(chalk.cyan('Continue:'), result.continue);
    if (result.systemMessage) {
      console.log(chalk.yellow('System Message:'));
      console.log(result.systemMessage);
    }
    process.exit(0);
  } catch (error) {
    if (stdin) {
      // Don't block compaction on error
      process.stdout.write(JSON.stringify({ continue: true }));
      process.exit(0);
    }
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Notify dashboard action - send notification to running ccw view server
 */
async function notifyAction(options: HookOptions): Promise<void> {
  const { stdin } = options;
  let hookData: HookData = {};

  if (stdin) {
    try {
      const stdinData = await readStdin();
      if (stdinData) {
        hookData = JSON.parse(stdinData) as HookData;
      }
    } catch {
      // Silently continue if stdin parsing fails
    }
  }

  try {
    const { notifyRefreshRequired } = await import('../tools/notifier.js');
    await notifyRefreshRequired();

    if (!stdin) {
      console.log(chalk.green('Notification sent to dashboard'));
    }
    process.exit(0);
  } catch (error) {
    if (stdin) {
      process.exit(0);
    }
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Show help for hook command
 */
function showHelp(): void {
  console.log(`
${chalk.bold('ccw hook')} - CLI endpoint for Claude Code hooks

${chalk.bold('USAGE')}
  ccw hook <subcommand> [options]

${chalk.bold('SUBCOMMANDS')}
  parse-status      Parse CCW status.json and display current/next command
  session-context   Progressive session context loading (replaces curl/bash hook)
  session-end       Trigger background memory maintenance tasks
  stop              Handle Stop hook events with Soft Enforcement
  keyword           Detect mode keywords in prompts and activate modes
  pre-compact       Handle PreCompact hook events (checkpoint creation)
  notify            Send notification to ccw view dashboard

${chalk.bold('OPTIONS')}
  --stdin           Read input from stdin (for Claude Code hooks)
  --path            Path to status.json file (for parse-status)
  --session-id      Session ID (alternative to stdin)
  --prompt          Current prompt text (alternative to stdin)

${chalk.bold('EXAMPLES')}
  ${chalk.gray('# Parse CCW status file:')}
  ccw hook parse-status --path .workflow/.ccw/ccw-123/status.json

  ${chalk.gray('# Use in Claude Code hook (settings.json):')}
  ccw hook session-context --stdin

  ${chalk.gray('# Interactive usage:')}
  ccw hook session-context --session-id abc123

  ${chalk.gray('# Handle Stop hook events:')}
  ccw hook stop --stdin

  ${chalk.gray('# Notify dashboard:')}
  ccw hook notify --stdin

  ${chalk.gray('# Detect mode keywords:')}
  ccw hook keyword --stdin --prompt "use autopilot to implement auth"

  ${chalk.gray('# Handle PreCompact events:')}
  ccw hook pre-compact --stdin

${chalk.bold('HOOK CONFIGURATION')}
  ${chalk.gray('Add to .claude/settings.json for Stop hook:')}
  {
    "hooks": {
      "Stop": [{
        "matcher": "",
        "hooks": [{
          "type": "command",
          "command": "ccw hook stop --stdin"
        }]
      }]
    }
  }

  ${chalk.gray('Add to .claude/settings.json for status tracking:')}
  {
    "hooks": {
      "PostToolUse": [{
        "trigger": "PostToolUse",
        "matcher": "Write",
        "command": "bash",
        "args": ["-c", "INPUT=$(cat); FILE_PATH=$(echo \\"$INPUT\\" | jq -r \\".tool_input.file_path // empty\\"); [ -n \\"$FILE_PATH\\" ] && ccw hook parse-status --path \\"$FILE_PATH\\""]
      }]
    }
  }
`);
}

/**
 * Main hook command handler
 */
export async function hookCommand(
  subcommand: string,
  args: string | string[],
  options: HookOptions
): Promise<void> {
  switch (subcommand) {
    case 'parse-status':
      await parseStatusAction(options);
      break;
    case 'session-context':
    case 'context':
      await sessionContextAction(options);
      break;
    case 'session-end':
      await sessionEndAction(options);
      break;
    case 'stop':
      await stopAction(options);
      break;
    case 'keyword':
      await keywordAction(options);
      break;
    case 'pre-compact':
    case 'precompact':
      await preCompactAction(options);
      break;
    case 'notify':
      await notifyAction(options);
      break;
    case 'help':
    case undefined:
      showHelp();
      break;
    default:
      console.error(chalk.red(`Unknown subcommand: ${subcommand}`));
      console.error(chalk.gray('Run "ccw hook help" for usage information'));
      process.exit(1);
  }
}
