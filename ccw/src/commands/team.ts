/**
 * Team Command - CLI interface for Team Message Bus
 * Delegates to team-msg.ts handler for JSONL-based persistent messaging
 *
 * Commands:
 *   ccw team log    --team <name> --from <role> --to <role> --type <type> --summary "..."
 *   ccw team read   --team <name> --id <MSG-NNN>
 *   ccw team list   --team <name> [--from <role>] [--to <role>] [--type <type>] [--last <n>]
 *   ccw team status --team <name>
 *   ccw team delete --team <name> --id <MSG-NNN>
 *   ccw team clear  --team <name>
 */

import chalk from 'chalk';
import { handler } from '../tools/team-msg.js';

interface TeamOptions {
  team?: string;
  from?: string;
  to?: string;
  type?: string;
  summary?: string;
  ref?: string;
  data?: string;
  id?: string;
  last?: string;
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

  if (!options.team) {
    console.error(chalk.red('Error: --team is required'));
    process.exit(1);
  }

  // Build params for handler
  const params: Record<string, unknown> = {
    operation: subcommand,
    team: options.team,
  };

  if (options.from) params.from = options.from;
  if (options.to) params.to = options.to;
  if (options.type) params.type = options.type;
  if (options.summary) params.summary = options.summary;
  if (options.ref) params.ref = options.ref;
  if (options.id) params.id = options.id;
  if (options.last) params.last = parseInt(options.last, 10);

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
      case 'log': {
        const r = result.result as { id: string; message: string };
        console.log(chalk.green(`✓ ${r.message}`));
        break;
      }
      case 'read': {
        const msg = result.result as { id: string; ts: string; from: string; to: string; type: string; summary: string; ref?: string; data?: unknown };
        console.log(chalk.bold(`${msg.id} [${msg.ts}]`));
        console.log(`  ${chalk.cyan(msg.from)} → ${chalk.yellow(msg.to)} (${msg.type})`);
        console.log(`  ${msg.summary}`);
        if (msg.ref) console.log(chalk.gray(`  ref: ${msg.ref}`));
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
  console.log(chalk.gray('    log                 Log a team message'));
  console.log(chalk.gray('    read                Read a specific message by ID'));
  console.log(chalk.gray('    list                List recent messages with filters'));
  console.log(chalk.gray('    status              Show team member activity summary'));
  console.log(chalk.gray('    delete              Delete a specific message by ID'));
  console.log(chalk.gray('    clear               Clear all messages for a team'));
  console.log();
  console.log('  Required:');
  console.log(chalk.gray('    --team <name>       Team name'));
  console.log();
  console.log('  Log Options:');
  console.log(chalk.gray('    --from <role>       Sender role name'));
  console.log(chalk.gray('    --to <role>         Recipient role name'));
  console.log(chalk.gray('    --type <type>       Message type (plan_ready, impl_complete, etc.)'));
  console.log(chalk.gray('    --summary <text>    One-line summary'));
  console.log(chalk.gray('    --ref <path>        File path reference'));
  console.log(chalk.gray('    --data <json>       JSON structured data'));
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
  console.log(chalk.gray('    ccw team log --team my-team --from executor --to coordinator --type impl_complete --summary "Task done"'));
  console.log(chalk.gray('    ccw team list --team my-team --last 5'));
  console.log(chalk.gray('    ccw team read --team my-team --id MSG-003'));
  console.log(chalk.gray('    ccw team status --team my-team'));
  console.log(chalk.gray('    ccw team delete --team my-team --id MSG-003'));
  console.log(chalk.gray('    ccw team clear --team my-team'));
  console.log(chalk.gray('    ccw team log --team my-team --from planner --to coordinator --type plan_ready --summary "Plan ready" --json'));
  console.log();
}
