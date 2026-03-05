/**
 * Spec Command - CLI endpoint for project spec management
 *
 * Provides 6 subcommands: load, list, rebuild, status, init, help.
 * The load subcommand supports dual-mode: CLI direct and Hook stdin.
 *
 * Pattern: cli.ts register -> commands/spec.ts dispatch -> tools/spec-*.ts execute
 */

import chalk from 'chalk';

interface SpecOptions {
  dimension?: string;
  category?: string;
  keywords?: string;
  stdin?: boolean;
  json?: boolean;
}

interface StdinData {
  session_id?: string;
  cwd?: string;
  user_prompt?: string;
  prompt?: string;
  [key: string]: unknown;
}

/**
 * Read JSON data from stdin (for Claude Code hooks).
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
    if (process.stdin.isTTY) {
      resolve('');
    }
  });
}

/**
 * Get project path from hook data or current working directory.
 */
function getProjectPath(hookCwd?: string): string {
  return hookCwd || process.cwd();
}

// ============================================================================
// Subcommand Actions
// ============================================================================

/**
 * Load action - load specs matching dimension/category/keywords.
 *
 * CLI mode: --dimension, --category, --keywords options, outputs formatted markdown.
 * Hook mode: --stdin reads JSON {session_id, cwd, user_prompt}, outputs JSON {continue, systemMessage}.
 */
async function loadAction(options: SpecOptions): Promise<void> {
  const { stdin, dimension, category, keywords: keywordsInput } = options;
  let projectPath: string;
  let stdinData: StdinData | undefined;

  if (stdin) {
    try {
      const raw = await readStdin();
      if (raw) {
        stdinData = JSON.parse(raw) as StdinData;
        projectPath = getProjectPath(stdinData.cwd);
      } else {
        projectPath = getProjectPath();
      }
    } catch {
      // Malformed stdin - output continue and exit
      process.stdout.write(JSON.stringify({ continue: true }));
      process.exit(0);
    }
  } else {
    projectPath = getProjectPath();
  }

  try {
    const { loadSpecs } = await import('../tools/spec-loader.js');

    const keywords = keywordsInput
      ? keywordsInput.split(/[\s,]+/).filter(Boolean)
      : undefined;

    const result = await loadSpecs({
      projectPath,
      dimension: dimension as 'specs' | 'personal' | undefined,
      category: category as 'general' | 'exploration' | 'planning' | 'execution' | undefined,
      keywords,
      outputFormat: stdin ? 'hook' : 'cli',
      stdinData,
    });

    if (stdin) {
      process.stdout.write(result.content);
      process.exit(0);
    }

    console.log(result.content);
  } catch (error) {
    if (stdin) {
      process.stdout.write(JSON.stringify({ continue: true }));
      process.exit(0);
    }
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * List action - show all indexed specs with readMode and keyword info.
 */
async function listAction(options: SpecOptions): Promise<void> {
  const { dimension, json } = options;
  const projectPath = getProjectPath();

  try {
    const { getDimensionIndex, SPEC_DIMENSIONS } = await import(
      '../tools/spec-index-builder.js'
    );

    const dimensions = dimension ? [dimension] : [...SPEC_DIMENSIONS];
    const allEntries: Array<{
      dimension: string;
      title: string;
      readMode: string;
      priority: string;
      keywords: string[];
      file: string;
    }> = [];

    for (const dim of dimensions) {
      const index = await getDimensionIndex(projectPath, dim);
      for (const entry of index.entries) {
        allEntries.push({
          dimension: entry.dimension,
          title: entry.title,
          readMode: entry.readMode,
          priority: entry.priority,
          keywords: entry.keywords,
          file: entry.file,
        });
      }
    }

    if (json) {
      console.log(JSON.stringify(allEntries, null, 2));
      return;
    }

    if (allEntries.length === 0) {
      console.log(chalk.gray('No specs found. Run "ccw spec init" to create seed documents.'));
      return;
    }

    console.log(chalk.bold(`Specs (${allEntries.length} total)\n`));

    let currentDim = '';
    for (const entry of allEntries) {
      if (entry.dimension !== currentDim) {
        currentDim = entry.dimension;
        console.log(chalk.yellow(`  [${currentDim}]`));
      }

      const modeTag =
        entry.readMode === 'required'
          ? chalk.red('required')
          : chalk.gray('optional');
      const priTag = chalk.cyan(entry.priority);
      const kw = entry.keywords.length > 0
        ? chalk.gray(` (${entry.keywords.join(', ')})`)
        : '';

      console.log(`    ${entry.title}  ${modeTag}  ${priTag}${kw}`);
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Rebuild action - force re-scan of MD files and rebuild .spec-index cache.
 */
async function rebuildAction(options: SpecOptions): Promise<void> {
  const { dimension } = options;
  const projectPath = getProjectPath();

  try {
    const { buildAllIndices, buildDimensionIndex, getIndexPath, SPEC_DIMENSIONS } =
      await import('../tools/spec-index-builder.js');
    const { writeFileSync } = await import('fs');

    if (dimension) {
      console.log(chalk.cyan(`Rebuilding index for: ${dimension}`));
      const index = await buildDimensionIndex(projectPath, dimension);
      const indexPath = getIndexPath(projectPath, dimension);
      writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
      console.log(
        chalk.green(`  ${dimension}: ${index.entries.length} entries indexed`)
      );
    } else {
      console.log(chalk.cyan('Rebuilding all spec indices...'));
      await buildAllIndices(projectPath);
      // Show stats
      const { readCachedIndex } = await import('../tools/spec-index-builder.js');
      for (const dim of SPEC_DIMENSIONS) {
        const cached = readCachedIndex(projectPath, dim);
        const count = cached?.entries.length ?? 0;
        console.log(chalk.green(`  ${dim}: ${count} entries indexed`));
      }
    }

    console.log(chalk.green('\nIndex rebuild complete.'));
  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Status action - show per-dimension stats.
 */
async function statusAction(options: SpecOptions): Promise<void> {
  const { json } = options;
  const projectPath = getProjectPath();

  try {
    const { readCachedIndex, SPEC_DIMENSIONS, getDimensionDir } = await import(
      '../tools/spec-index-builder.js'
    );
    const { existsSync } = await import('fs');

    const stats: Array<{
      dimension: string;
      total: number;
      required: number;
      optional: number;
      indexed: boolean;
      built_at: string | null;
      dirExists: boolean;
    }> = [];

    for (const dim of SPEC_DIMENSIONS) {
      const cached = readCachedIndex(projectPath, dim);
      const dimDir = getDimensionDir(projectPath, dim);
      const dirExists = existsSync(dimDir);

      const entries = cached?.entries ?? [];
      const required = entries.filter(e => e.readMode === 'required').length;
      const optional = entries.filter(e => e.readMode === 'optional').length;

      stats.push({
        dimension: dim,
        total: entries.length,
        required,
        optional,
        indexed: cached !== null,
        built_at: cached?.built_at ?? null,
        dirExists,
      });
    }

    if (json) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log(chalk.bold('Spec System Status\n'));

    for (const s of stats) {
      const dirStatus = s.dirExists ? chalk.green('OK') : chalk.red('missing');
      const indexStatus = s.indexed ? chalk.green('cached') : chalk.yellow('not built');
      const builtAt = s.built_at
        ? chalk.gray(` (${new Date(s.built_at).toLocaleString()})`)
        : '';

      console.log(chalk.yellow(`  [${s.dimension}]`));
      console.log(`    Directory: ${dirStatus}`);
      console.log(`    Index: ${indexStatus}${builtAt}`);
      console.log(
        `    Specs: ${s.total} total (${chalk.red(String(s.required))} required, ${chalk.gray(String(s.optional))} optional)`
      );
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Init action - create directory structure and seed documents.
 */
async function initAction(): Promise<void> {
  const projectPath = getProjectPath();

  try {
    const { initSpecSystem } = await import('../tools/spec-init.js');

    console.log(chalk.cyan('Initializing spec system...'));
    const result = initSpecSystem(projectPath);

    if (result.directories.length > 0) {
      console.log(chalk.green('\nDirectories created:'));
      for (const dir of result.directories) {
        console.log(chalk.gray(`  + ${dir}`));
      }
    }

    if (result.created.length > 0) {
      console.log(chalk.green('\nSeed files created:'));
      for (const file of result.created) {
        console.log(chalk.gray(`  + ${file}`));
      }
    }

    if (result.skipped.length > 0) {
      console.log(chalk.gray('\nSkipped (already exist):'));
      for (const file of result.skipped) {
        console.log(chalk.gray(`  - ${file}`));
      }
    }

    if (result.directories.length === 0 && result.created.length === 0) {
      console.log(chalk.gray('\nSpec system already initialized. No changes made.'));
    } else {
      console.log(chalk.green('\nSpec system initialized. Run "ccw spec rebuild" to build index.'));
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Show help for spec command.
 */
function showHelp(): void {
  console.log(`
${chalk.bold('ccw spec')} - Project spec management

${chalk.bold('USAGE')}
  ccw spec <subcommand> [options]

${chalk.bold('SUBCOMMANDS')}
  load      Load specs matching dimension/keywords (CLI or Hook mode)
  list      List all indexed specs with readMode and keyword info
  rebuild   Force re-scan of MD files and rebuild .ccw/.spec-index cache
  status    Show per-dimension stats (total, required, optional, freshness)
  init      Create 2-dimension directory structure with seed MD documents

${chalk.bold('OPTIONS')}
  --dimension <dim>   Target dimension: specs, personal
  --keywords <text>   Keywords for spec matching (space or comma separated)
  --stdin             Read input from stdin (Hook mode)
  --json              Output as JSON

${chalk.bold('KEYWORD CATEGORIES')}
  Use these predefined keywords to load specs for specific workflow stages:
  ${chalk.cyan('exploration')}  - Code exploration, analysis, debugging context
  ${chalk.cyan('planning')}     - Task planning, requirements context
  ${chalk.cyan('execution')}    - Implementation, testing, deployment context

${chalk.bold('EXAMPLES')}
  ${chalk.gray('# Initialize spec system:')}
  ccw spec init

  ${chalk.gray('# Load exploration-phase specs:')}
  ccw spec load --category exploration

  ${chalk.gray('# Load planning-phase specs with auth topic:')}
  ccw spec load --category "planning auth"

  ${chalk.gray('# Load execution-phase specs:')}
  ccw spec load --category execution

  ${chalk.gray('# Load specs for a topic (CLI mode):')}
  ccw spec load --dimension specs --keywords "auth jwt security"

  ${chalk.gray('# Use as Claude Code hook (settings.json):')}
  ccw spec load --stdin

  ${chalk.gray('# List all specs:')}
  ccw spec list

  ${chalk.gray('# List specs for a specific dimension:')}
  ccw spec list --dimension specs

  ${chalk.gray('# Rebuild index cache:')}
  ccw spec rebuild

  ${chalk.gray('# Rebuild single dimension:')}
  ccw spec rebuild --dimension specs

  ${chalk.gray('# Check system status:')}
  ccw spec status
`);
}

// ============================================================================
// Main Command Dispatcher
// ============================================================================

/**
 * Main spec command handler.
 *
 * Dispatches to subcommand action functions following the same switch
 * pattern used by hookCommand in commands/hook.ts.
 */
export async function specCommand(
  subcommand: string,
  args: string | string[],
  options: SpecOptions
): Promise<void> {
  switch (subcommand) {
    case 'load':
      await loadAction(options);
      break;
    case 'list':
    case 'ls':
      await listAction(options);
      break;
    case 'rebuild':
      await rebuildAction(options);
      break;
    case 'status':
      await statusAction(options);
      break;
    case 'init':
      await initAction();
      break;
    case 'help':
    case undefined:
      showHelp();
      break;
    default:
      console.error(chalk.red(`Unknown subcommand: ${subcommand}`));
      console.error(chalk.gray('Run "ccw spec help" for usage information'));
      process.exit(1);
  }
}
