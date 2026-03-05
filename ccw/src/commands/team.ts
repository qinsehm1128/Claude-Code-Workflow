/**
 * Team Command - CLI interface for Team Message Bus
 * Delegates to team-msg.ts handler for JSONL-based persistent messaging
 *
 * Commands:
 *   ccw team log       --session-id <id> --from <role> [--to <role>] [--type <type>] [--summary "..."]
 *   ccw team broadcast --session-id <id> --from <role> [--type <type>] [--summary "..."]
 *   ccw team get_state --session-id <id> [--role <role>]
 *   ccw team read      --session-id <id> --id <MSG-NNN>
 *   ccw team list      --session-id <id> [--from <role>] [--to <role>] [--type <type>] [--last <n>]
 *   ccw team status    --session-id <id>
 *   ccw team delete    --session-id <id> --id <MSG-NNN>
 *   ccw team clear     --session-id <id>
 */

import chalk from 'chalk';
import { handler } from '../tools/team-msg.js';

interface TeamOptions {
  sessionId?: string;
  from?: string;
  to?: string;
  type?: string;
  summary?: string;
  ref?: string;
  data?: string;
  id?: string;
  last?: string;
  role?: string;
  json?: boolean;
}

export async function teamCommand(
  subcommand: string,
  args: string | string[],
  options: TeamOptions
): Promise<void> {
  if (!subcommand) {
    printHelp();
    return;
  }

  if (!options.sessionId) {
    console.error(chalk.red('Error: --session-id is required'));
    process.exit(1);
  }

  // Build params for handler
  const params: Record<string, unknown> = {
    operation: subcommand,
    session_id: options.sessionId,
  };

  if (options.from) params.from = options.from;
  if (options.to) params.to = options.to;
  if (options.type) params.type = options.type;
  if (options.summary) params.summary = options.summary;
  if (options.ref) params.ref = options.ref;
  if (options.id) params.id = options.id;
  if (options.last) params.last = parseInt(options.last, 10);
  if (options.role) params.role = options.role;

  // Parse --data as JSON
  if (options.data) {
    try {
      params.data = JSON.parse(options.data);
    } catch {
      console.error(chalk.red('Error: --data must be valid JSON'));
      process.exit(1);
    }
  }

  try {
    const result = await handler(params);

    if (!result.success) {
      console.error(chalk.red(`Error: ${result.error}`));
      process.exit(1);
    }

    // JSON output mode
    if (options.json) {
      console.log(JSON.stringify(result.result, null, 2));
      return;
    }

    // Formatted output by operation
    switch (subcommand) {
      case 'log':
      case 'broadcast': {
        const r = result.result as { id: string; message: string };
        console.log(chalk.green(`✓ ${r.message}`));
        break;
      }
      case 'read': {
        const msg = result.result as { id: string; ts: string; from: string; to: string; type: string; summary: string; ref?: string; data?: Record<string, unknown> };
        console.log(chalk.bold(`${msg.id} [${msg.ts}]`));
        console.log(`  ${chalk.cyan(msg.from)} → ${chalk.yellow(msg.to)} (${msg.type})`);
        console.log(`  ${msg.summary}`);
        const refPath = msg.ref || (msg.data?.ref as string | undefined);
        if (refPath) console.log(chalk.gray(`  ref: ${refPath}`));
        if (msg.data) console.log(chalk.gray(`  data: ${JSON.stringify(msg.data)}`));
        break;
      }
      case 'list': {
        const r = result.result as { formatted: string; total: number; showing: number };
        console.log(chalk.gray(`Showing ${r.showing} of ${r.total} messages\n`));
        console.log(r.formatted);
        break;
      }
      case 'status': {
        const r = result.result as { formatted?: string; summary?: string; total_messages?: number };
        if (r.summary) {
          console.log(chalk.yellow(r.summary));
        } else {
          console.log(chalk.gray(`Total messages: ${r.total_messages}\n`));
          console.log(r.formatted);
        }
        break;
      }
      case 'delete': {
        const r = result.result as { message: string };
        console.log(chalk.green(`✓ ${r.message}`));
        break;
      }
      case 'clear': {
        const r = result.result as { message: string };
        console.log(chalk.green(`✓ ${r.message}`));
        break;
      }
      case 'get_state': {
        const r = result.result as { role?: string; state?: unknown; role_state?: unknown; message?: string };
        if (r.message) {
          console.log(chalk.yellow(r.message));
        } else if (r.role) {
          console.log(chalk.bold(`Role: ${r.role}`));
          console.log(JSON.stringify(r.state, null, 2));
        } else {
          console.log(JSON.stringify(r.role_state, null, 2));
        }
        break;
      }
      default:
        console.error(chalk.red(`Unknown subcommand: ${subcommand}`));
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(chalk.bold.cyan('\n  CCW Team Message Bus\n'));
  console.log('  CLI interface for team message logging and retrieval.\n');
  console.log('  Subcommands:');
  console.log(chalk.gray('    log                 Log a team message (to defaults to "coordinator", summary auto-generated)'));
  console.log(chalk.gray('    broadcast           Broadcast message to all team members (to="all")'));
  console.log(chalk.gray('    get_state           Read role state from meta.json'));
  console.log(chalk.gray('    read                Read a specific message by ID'));
  console.log(chalk.gray('    list                List recent messages with filters'));
  console.log(chalk.gray('    status              Show team member activity summary'));
  console.log(chalk.gray('    delete              Delete a specific message by ID'));
  console.log(chalk.gray('    clear               Clear all messages for a team'));
  console.log();
  console.log('  Required:');
  console.log(chalk.gray('    --session-id <id>   Session ID (e.g., TLS-my-project-2026-02-27), NOT team name'));
  console.log();
  console.log('  Log/Broadcast Options:');
  console.log(chalk.gray('    --from <role>       Sender role name (required)'));
  console.log(chalk.gray('    --to <role>         Recipient role (default: "coordinator")'));
  console.log(chalk.gray('    --type <type>       Message type (state_update, plan_ready, shutdown, etc.)'));
  console.log(chalk.gray('    --summary <text>    One-line summary (auto-generated if omitted)'));
  console.log(chalk.gray('    --data <json>       JSON structured data. Use data.ref for file paths'));
  console.log();
  console.log('  Get State Options:');
  console.log(chalk.gray('    --role <role>       Role name to query (omit for all roles)'));
  console.log();
  console.log('  Read/Delete Options:');
  console.log(chalk.gray('    --id <MSG-NNN>      Message ID'));
  console.log();
  console.log('  List Options:');
  console.log(chalk.gray('    --from <role>       Filter by sender'));
  console.log(chalk.gray('    --to <role>         Filter by recipient'));
  console.log(chalk.gray('    --type <type>       Filter by message type'));
  console.log(chalk.gray('    --last <n>          Number of messages (default: 20)'));
  console.log();
  console.log('  General:');
  console.log(chalk.gray('    --json              Output as JSON'));
  console.log();
  console.log('  Examples:');
  console.log(chalk.gray('    ccw team log --session-id TLS-xxx --from executor --type state_update --data \'{"status":"done"}\''));
  console.log(chalk.gray('    ccw team broadcast --session-id TLS-xxx --from coordinator --type shutdown'));
  console.log(chalk.gray('    ccw team get_state --session-id TLS-xxx --role executor'));
  console.log(chalk.gray('    ccw team list --session-id TLS-xxx --last 5'));
  console.log(chalk.gray('    ccw team read --session-id TLS-xxx --id MSG-003'));
  console.log(chalk.gray('    ccw team status --session-id TLS-xxx'));
  console.log();
}
