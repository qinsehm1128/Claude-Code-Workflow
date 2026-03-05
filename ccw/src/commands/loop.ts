/**
 * Loop Command
 * CCW Loop System - CLI interface for loop management
 * Reference: .workflow/.scratchpad/loop-system-complete-design-20260121.md section 4.3
 */

import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { LoopManager } from '../tools/loop-manager.js';
import type { TaskLoopControl } from '../types/loop.js';

// Minimal Task interface for task config files
interface Task {
  id: string;
  title?: string;
  loop_control?: TaskLoopControl;
}

/**
 * Read task configuration
 */
async function readTaskConfig(taskId: string, workflowDir: string): Promise<Task> {
  const taskFile = join(workflowDir, '.task', `${taskId}.json`);

  if (!existsSync(taskFile)) {
    throw new Error(`Task file not found: ${taskFile}`);
  }

  const content = await readFile(taskFile, 'utf-8');
  return JSON.parse(content) as Task;
}

/**
 * Find active workflow session
 */
function findActiveSession(cwd: string): string | null {
  const workflowDir = join(cwd, '.workflow', 'active');

  if (!existsSync(workflowDir)) {
    return null;
  }

  const { readdirSync } = require('fs');
  const sessions = readdirSync(workflowDir).filter((d: string) => d.startsWith('WFS-'));

  if (sessions.length === 0) {
    return null;
  }

  if (sessions.length === 1) {
    return join(cwd, '.workflow', 'active', sessions[0]);
  }

  // Multiple sessions, require user to specify
  console.error(chalk.red('\n  Error: Multiple active sessions found:'));
  sessions.forEach((s: string) => console.error(chalk.gray(`    - ${s}`)));
  console.error(chalk.yellow('\n  Please specify session with --session <name>\n'));
  return null;
}

/**
 * Get status badge with color
 */
function getStatusBadge(status: string): string {
  switch (status) {
    case 'created':
      return chalk.gray('○ created');
    case 'running':
      return chalk.cyan('● running');
    case 'paused':
      return chalk.yellow('⏸ paused');
    case 'completed':
      return chalk.green('✓ completed');
    case 'failed':
      return chalk.red('✗ failed');
    default:
      return status;
  }
}

/**
 * Format time ago
 */
function timeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Start action
 */
async function startAction(taskId: string, options: { session?: string }): Promise<void> {
  const currentCwd = process.cwd();

  // Find workflow session
  let sessionDir: string | null;

  if (options.session) {
    sessionDir = join(currentCwd, '.workflow', 'active', options.session);
    if (!existsSync(sessionDir)) {
      console.error(chalk.red(`\n  Error: Session not found: ${options.session}\n`));
      process.exit(1);
    }
  } else {
    sessionDir = findActiveSession(currentCwd);
    if (!sessionDir) {
      console.error(chalk.red('\n  Error: No active workflow session found.'));
      console.error(chalk.gray('  Run "ccw workflow-plan" first to create a session.\n'));
      process.exit(1);
    }
  }

  console.log(chalk.cyan(`  Using session: ${sessionDir.split(/[\\/]/).pop()}`));

  // Read task config
  const task = await readTaskConfig(taskId, sessionDir);

  if (!task.loop_control?.enabled) {
    console.error(chalk.red(`\n  Error: Task ${taskId} does not have loop enabled.\n`));
    process.exit(1);
  }

  // Start loop
  const loopManager = new LoopManager(sessionDir);
  const loopId = await loopManager.startLoop(task as any); // Task interface compatible

  console.log(chalk.green(`\n  ✓ Loop started: ${loopId}`));
  console.log(chalk.dim(`  Status:  ccw loop status ${loopId}`));
  console.log(chalk.dim(`  Pause:   ccw loop pause ${loopId}`));
  console.log(chalk.dim(`  Stop:    ccw loop stop ${loopId}\n`));
}

/**
 * Status action
 */
async function statusAction(loopId: string | undefined, options: { session?: string }): Promise<void> {
  const currentCwd = process.cwd();
  const sessionDir = options?.session
    ? join(currentCwd, '.workflow', 'active', options.session)
    : findActiveSession(currentCwd);

  if (!sessionDir) {
    console.error(chalk.red('\n  Error: No active session found.\n'));
    process.exit(1);
  }

  const loopManager = new LoopManager(sessionDir);

  if (loopId) {
    // Show single loop detail
    const state = await loopManager.getStatus(loopId);

    console.log(chalk.bold.cyan('\n  Loop Status\n'));
    console.log(`  ${chalk.gray('ID:')}         ${state.loop_id}`);
    console.log(`  ${chalk.gray('Task:')}       ${state.task_id}`);
    console.log(`  ${chalk.gray('Status:')}     ${getStatusBadge(state.status)}`);
    console.log(`  ${chalk.gray('Iteration:')}  ${state.current_iteration}/${state.max_iterations}`);
    console.log(`  ${chalk.gray('Step:')}       ${state.current_cli_step + 1}/${state.cli_sequence.length}`);
    console.log(`  ${chalk.gray('Created:')}    ${state.created_at}`);
    console.log(`  ${chalk.gray('Updated:')}    ${state.updated_at}`);

    if (state.failure_reason) {
      console.log(`  ${chalk.gray('Reason:')}     ${chalk.red(state.failure_reason)}`);
    }

    console.log(chalk.bold.cyan('\n  CLI Sequence\n'));
    state.cli_sequence.forEach((step, i) => {
      const current = i === state.current_cli_step ? chalk.cyan('→') : ' ';
      console.log(`  ${current} ${i + 1}. ${chalk.bold(step.step_id)} (${step.tool})`);
    });

    if (state.execution_history && state.execution_history.length > 0) {
      console.log(chalk.bold.cyan('\n  Recent Executions\n'));
      const recent = state.execution_history.slice(-5);
      recent.forEach(exec => {
        const status = exec.exit_code === 0 ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${status} ${exec.step_id} (${exec.tool}) - ${(exec.duration_ms / 1000).toFixed(1)}s`);
      });
    }

    console.log();
  } else {
    // List all loops
    const loops = await loopManager.listLoops();

    if (loops.length === 0) {
      console.log(chalk.yellow('\n  No loops found.\n'));
      return;
    }

    console.log(chalk.bold.cyan('\n  Active Loops\n'));
    console.log(chalk.gray('  Status  ID                                Iteration  Task'));
    console.log(chalk.gray('  ' + '─'.repeat(70)));

    loops.forEach(loop => {
      const status = getStatusBadge(loop.status);
      const iteration = `${loop.current_iteration}/${loop.max_iterations}`;
      console.log(`  ${status}  ${chalk.dim(loop.loop_id.padEnd(35))}  ${iteration.padEnd(9)}  ${loop.task_id}`);
    });

    console.log();
  }
}

/**
 * Pause action
 */
async function pauseAction(loopId: string, options: { session?: string }): Promise<void> {
  const currentCwd = process.cwd();
  const sessionDir = options.session
    ? join(currentCwd, '.workflow', 'active', options.session)
    : findActiveSession(currentCwd);

  if (!sessionDir) {
    console.error(chalk.red('\n  Error: No active session found.\n'));
    process.exit(1);
  }

  const loopManager = new LoopManager(sessionDir);
  await loopManager.pauseLoop(loopId);
}

/**
 * Resume action
 */
async function resumeAction(loopId: string, options: { session?: string }): Promise<void> {
  const currentCwd = process.cwd();
  const sessionDir = options.session
    ? join(currentCwd, '.workflow', 'active', options.session)
    : findActiveSession(currentCwd);

  if (!sessionDir) {
    console.error(chalk.red('\n  Error: No active session found.\n'));
    process.exit(1);
  }

  const loopManager = new LoopManager(sessionDir);
  await loopManager.resumeLoop(loopId);
}

/**
 * Stop action
 */
async function stopAction(loopId: string, options: { session?: string }): Promise<void> {
  const currentCwd = process.cwd();
  const sessionDir = options.session
    ? join(currentCwd, '.workflow', 'active', options.session)
    : findActiveSession(currentCwd);

  if (!sessionDir) {
    console.error(chalk.red('\n  Error: No active session found.\n'));
    process.exit(1);
  }

  const loopManager = new LoopManager(sessionDir);
  await loopManager.stopLoop(loopId);
}

/**
 * Loop command entry point
 */
export async function loopCommand(
  subcommand: string,
  args: string | string[],
  options: any
): Promise<void> {
  const argsArray = Array.isArray(args) ? args : (args ? [args] : []);

  try {
    switch (subcommand) {
      case 'start':
        if (!argsArray[0]) {
          console.error(chalk.red('\n  Error: Task ID is required\n'));
          console.error(chalk.gray('  Usage: ccw loop start <task-id> [--session <name>]\n'));
          process.exit(1);
        }
        await startAction(argsArray[0], options);
        break;

      case 'status':
        await statusAction(argsArray[0], options);
        break;

      case 'pause':
        if (!argsArray[0]) {
          console.error(chalk.red('\n  Error: Loop ID is required\n'));
          console.error(chalk.gray('  Usage: ccw loop pause <loop-id>\n'));
          process.exit(1);
        }
        await pauseAction(argsArray[0], options);
        break;

      case 'resume':
        if (!argsArray[0]) {
          console.error(chalk.red('\n  Error: Loop ID is required\n'));
          console.error(chalk.gray('  Usage: ccw loop resume <loop-id>\n'));
          process.exit(1);
        }
        await resumeAction(argsArray[0], options);
        break;

      case 'stop':
        if (!argsArray[0]) {
          console.error(chalk.red('\n  Error: Loop ID is required\n'));
          console.error(chalk.gray('  Usage: ccw loop stop <loop-id>\n'));
          process.exit(1);
        }
        await stopAction(argsArray[0], options);
        break;

      default:
        // Show help
        console.log(chalk.bold.cyan('\n  CCW Loop System\n'));
        console.log('  Manage automated CLI execution loops\n');
        console.log('  Subcommands:');
        console.log(chalk.gray('    start <task-id>    Start a new loop from task configuration'));
        console.log(chalk.gray('    status [loop-id]   Show loop status (all or specific)'));
        console.log(chalk.gray('    pause <loop-id>    Pause a running loop'));
        console.log(chalk.gray('    resume <loop-id>   Resume a paused loop'));
        console.log(chalk.gray('    stop <loop-id>     Stop a loop'));
        console.log();
        console.log('  Options:');
        console.log(chalk.gray('    --session <name>   Specify workflow session'));
        console.log();
        console.log('  Examples:');
        console.log(chalk.gray('    ccw loop start IMPL-3'));
        console.log(chalk.gray('    ccw loop status'));
        console.log(chalk.gray('    ccw loop status loop-IMPL-3-20260121120000'));
        console.log(chalk.gray('    ccw loop pause loop-IMPL-3-20260121120000'));
        console.log();
    }
  } catch (error) {
    console.error(chalk.red(`\n  ✗ Error: ${error instanceof Error ? error.message : error}\n`));
    process.exit(1);
  }
}
