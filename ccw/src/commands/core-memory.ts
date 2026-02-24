/**
 * Core Memory Command - Simplified CLI for core memory management
 * Commands: list, import, export, summary, projects, cluster
 */

import chalk from 'chalk';
import {
  getCoreMemoryStore,
  listAllProjects,
  getMemoriesFromProject,
  exportMemories,
  importMemories
} from '../core/core-memory-store.js';
import { MemoryJobScheduler } from '../core/memory-job-scheduler.js';
import { notifyRefreshRequired } from '../tools/notifier.js';

interface CommandOptions {
  id?: string;
  tool?: 'gemini' | 'qwen';
  status?: string;
  json?: boolean;
  auto?: boolean;
  output?: string;
  from?: string;
  overwrite?: boolean;
  prefix?: string;
  all?: boolean;
  scope?: string;
  create?: boolean;
  name?: string;
  members?: string;
  format?: string;
  level?: string;
  type?: string;
  delete?: boolean;
  merge?: string;
  dedup?: boolean;
  unified?: boolean;
  topK?: string;
  minScore?: string;
  category?: string;
  tags?: string;
}

/**
 * Get project path from current working directory
 */
function getProjectPath(): string {
  return process.cwd();
}

/**
 * List all memories
 */
async function listAction(): Promise<void> {
  try {
    const store = getCoreMemoryStore(getProjectPath());
    const memories = store.getMemories({ limit: 100 });

    console.log(chalk.bold.cyan('\n  Core Memories\n'));

    if (memories.length === 0) {
      console.log(chalk.yellow('  No memories found\n'));
      return;
    }

    console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));

    for (const memory of memories) {
      const date = new Date(memory.updated_at).toLocaleString();
      const archived = memory.archived ? chalk.gray(' [archived]') : '';
      console.log(chalk.cyan(`  ${memory.id}`) + archived);
      console.log(chalk.white(`    ${memory.summary || memory.content.substring(0, 80)}${memory.content.length > 80 ? '...' : ''}`));
      console.log(chalk.gray(`    Updated: ${date}`));
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));
    }

    console.log(chalk.gray(`\n  Total: ${memories.length}\n`));

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Import text as a new memory
 */
async function importAction(text: string): Promise<void> {
  if (!text || text.trim() === '') {
    console.error(chalk.red('Error: Text content is required'));
    console.error(chalk.gray('Usage: ccw core-memory import "your text content here"'));
    process.exit(1);
  }

  try {
    const store = getCoreMemoryStore(getProjectPath());
    const memory = store.upsertMemory({
      content: text.trim()
    });

    console.log(chalk.green(`✓ Created memory: ${memory.id}`));

    // Notify dashboard
    notifyRefreshRequired('memory').catch(() => { /* ignore */ });

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Export a memory as plain text (searches all projects if not found locally)
 */
async function exportAction(options: CommandOptions): Promise<void> {
  const { id } = options;

  if (!id) {
    console.error(chalk.red('Error: --id is required'));
    console.error(chalk.gray('Usage: ccw core-memory export --id <id>'));
    process.exit(1);
  }

  try {
    // First try current project
    const store = getCoreMemoryStore(getProjectPath());
    let memory = store.getMemory(id);

    // If not found, search all projects
    if (!memory) {
      const projects = listAllProjects();
      for (const project of projects) {
        try {
          const memories = getMemoriesFromProject(project.id);
          const found = memories.find(m => m.id === id);
          if (found) {
            memory = found;
            console.error(chalk.gray(`Found in project: ${project.id}`));
            break;
          }
        } catch {
          // Skip projects that can't be read
        }
      }
    }

    if (!memory) {
      console.error(chalk.red(`Error: Memory "${id}" not found in any project`));
      process.exit(1);
    }

    // Output plain text content
    console.log(memory.content);

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * List all projects with their memory counts
 */
async function projectsAction(options: CommandOptions): Promise<void> {
  try {
    const projects = listAllProjects();

    if (options.json) {
      console.log(JSON.stringify(projects, null, 2));
      return;
    }

    console.log(chalk.bold.cyan('\n  All CCW Projects\n'));

    if (projects.length === 0) {
      console.log(chalk.yellow('  No projects found\n'));
      return;
    }

    console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));

    for (const project of projects) {
      const hasData = project.memoriesCount > 0 || project.clustersCount > 0;
      const icon = hasData ? '●' : '○';
      const color = hasData ? chalk.cyan : chalk.gray;

      console.log(color(`  ${icon} ${project.id}`));
      console.log(chalk.white(`    Path: ${project.path}`));
      console.log(chalk.white(`    Memories: ${project.memoriesCount} | Clusters: ${project.clustersCount}`));
      if (project.lastUpdated) {
        console.log(chalk.gray(`    Last updated: ${new Date(project.lastUpdated).toLocaleString()}`));
      }
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));
    }

    console.log(chalk.gray(`\n  Total: ${projects.length} projects\n`));

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Import memories from file or another project
 */
async function importFromAction(source: string, options: CommandOptions): Promise<void> {
  if (!source) {
    console.error(chalk.red('Error: Source is required'));
    console.error(chalk.gray('Usage: ccw core-memory import-from <source>'));
    console.error(chalk.gray('       source: file.json or project-id'));
    process.exit(1);
  }

  try {
    const result = importMemories(getProjectPath(), source, {
      overwrite: options.overwrite,
      prefix: options.prefix
    });

    console.log(chalk.green(`✓ Import complete`));
    console.log(chalk.white(`  Imported: ${result.imported}`));
    console.log(chalk.white(`  Skipped: ${result.skipped} (already exist)`));

    if (result.imported > 0) {
      notifyRefreshRequired('memory').catch(() => { /* ignore */ });
    }

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * List memories from another project
 */
async function listFromAction(projectId: string, options: CommandOptions): Promise<void> {
  if (!projectId) {
    console.error(chalk.red('Error: Project ID is required'));
    console.error(chalk.gray('Usage: ccw core-memory list-from <project-id>'));
    console.error(chalk.gray('       Use "ccw core-memory projects" to see available projects'));
    process.exit(1);
  }

  try {
    const memories = getMemoriesFromProject(projectId);

    if (options.json) {
      console.log(JSON.stringify(memories, null, 2));
      return;
    }

    console.log(chalk.bold.cyan(`\n  Memories from ${projectId}\n`));

    if (memories.length === 0) {
      console.log(chalk.yellow('  No memories found\n'));
      return;
    }

    console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));

    for (const memory of memories) {
      const date = new Date(memory.updated_at).toLocaleString();
      const archived = memory.archived ? chalk.gray(' [archived]') : '';
      console.log(chalk.cyan(`  ${memory.id}`) + archived);
      console.log(chalk.white(`    ${memory.summary || memory.content.substring(0, 80)}${memory.content.length > 80 ? '...' : ''}`));
      console.log(chalk.gray(`    Updated: ${date}`));
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));
    }

    console.log(chalk.gray(`\n  Total: ${memories.length}\n`));

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Generate summary for a memory
 */
async function summaryAction(options: CommandOptions): Promise<void> {
  const { id, tool = 'gemini' } = options;

  if (!id) {
    console.error(chalk.red('Error: --id is required'));
    console.error(chalk.gray('Usage: ccw core-memory summary --id <id> [--tool gemini|qwen]'));
    process.exit(1);
  }

  try {
    const store = getCoreMemoryStore(getProjectPath());
    const memory = store.getMemory(id);

    if (!memory) {
      console.error(chalk.red(`Error: Memory "${id}" not found`));
      process.exit(1);
    }

    console.log(chalk.cyan(`Generating summary using ${tool}...`));

    const summary = await store.generateSummary(id, tool);

    console.log(chalk.green('\n✓ Summary generated:\n'));
    console.log(chalk.white(`  ${summary}\n`));

    // Notify dashboard
    notifyRefreshRequired('memory').catch(() => { /* ignore */ });

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * List all clusters
 */
async function clustersAction(options: CommandOptions): Promise<void> {
  try {
    const store = getCoreMemoryStore(getProjectPath());
    const clusters = store.listClusters(options.status);

    if (options.json) {
      console.log(JSON.stringify(clusters, null, 2));
      return;
    }

    if (clusters.length === 0) {
      console.log(chalk.yellow('\n  No clusters found. Run "ccw core-memory cluster --auto" to create clusters.\n'));
      return;
    }

    console.log(chalk.bold.cyan('\n  📦 Session Clusters\n'));
    console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));

    for (const cluster of clusters) {
      const members = store.getClusterMembers(cluster.id);
      console.log(chalk.cyan(`  ● ${cluster.name}`) + chalk.gray(` (${cluster.id})`));
      console.log(chalk.white(`    Status: ${cluster.status} | Sessions: ${members.length}`));
      console.log(chalk.gray(`    Updated: ${cluster.updated_at}`));
      if (cluster.intent) console.log(chalk.white(`    Intent: ${cluster.intent}`));
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));
    }

    console.log(chalk.gray(`\n  Total: ${clusters.length}\n`));

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * View cluster details or create new cluster
 */
async function clusterAction(clusterId: string | undefined, options: CommandOptions): Promise<void> {
  try {
    const store = getCoreMemoryStore(getProjectPath());

    // Auto clustering
    if (options.auto) {
      const { SessionClusteringService } = await import('../core/session-clustering-service.js');
      const service = new SessionClusteringService(getProjectPath());

      console.log(chalk.cyan('🔄 Running auto-clustering...'));
      const scope: 'all' | 'recent' | 'unclustered' =
        options.scope === 'all' || options.scope === 'recent' || options.scope === 'unclustered'
          ? options.scope
          : 'recent';
      const result = await service.autocluster({ scope });

      console.log(chalk.green(`✓ Created ${result.clustersCreated} clusters`));
      console.log(chalk.white(`  Processed ${result.sessionsProcessed} sessions`));
      console.log(chalk.white(`  Clustered ${result.sessionsClustered} sessions`));

      // Notify dashboard
      notifyRefreshRequired('memory').catch(() => { /* ignore */ });
      return;
    }

    // Deduplicate clusters
    if (options.dedup) {
      const { SessionClusteringService } = await import('../core/session-clustering-service.js');
      const service = new SessionClusteringService(getProjectPath());

      console.log(chalk.cyan('🔄 Deduplicating clusters...'));
      const result = await service.deduplicateClusters();

      console.log(chalk.green(`✓ Deduplication complete`));
      console.log(chalk.white(`  Merged: ${result.merged} clusters`));
      console.log(chalk.white(`  Deleted: ${result.deleted} empty clusters`));
      console.log(chalk.white(`  Remaining: ${result.remaining} clusters`));

      // Notify dashboard
      notifyRefreshRequired('memory').catch(() => { /* ignore */ });
      return;
    }

    // Delete cluster
    if (options.delete && clusterId) {
      const cluster = store.getCluster(clusterId);
      if (!cluster) {
        console.error(chalk.red(`Cluster not found: ${clusterId}`));
        process.exit(1);
      }

      const deleted = store.deleteCluster(clusterId);
      if (deleted) {
        console.log(chalk.green(`✓ Deleted cluster: ${clusterId}`));
        notifyRefreshRequired('memory').catch(() => { /* ignore */ });
      } else {
        console.error(chalk.red(`Failed to delete cluster: ${clusterId}`));
        process.exit(1);
      }
      return;
    }

    // Merge clusters
    if (options.merge && clusterId) {
      const targetCluster = store.getCluster(clusterId);
      if (!targetCluster) {
        console.error(chalk.red(`Target cluster not found: ${clusterId}`));
        process.exit(1);
      }

      const sourceIds = options.merge.split(',').map(s => s.trim());
      console.log(chalk.cyan(`🔄 Merging ${sourceIds.length} clusters into ${clusterId}...`));

      try {
        const membersMoved = store.mergeClusters(clusterId, sourceIds);
        console.log(chalk.green(`✓ Merged successfully`));
        console.log(chalk.white(`  Members moved: ${membersMoved}`));
        console.log(chalk.white(`  Clusters deleted: ${sourceIds.length}`));
        notifyRefreshRequired('memory').catch(() => { /* ignore */ });
      } catch (error) {
        console.error(chalk.red(`Failed to merge: ${(error as Error).message}`));
        process.exit(1);
      }
      return;
    }

    // Create new cluster
    if (options.create) {
      if (!options.name) {
        console.error(chalk.red('Error: --name is required for --create'));
        process.exit(1);
      }

      const cluster = store.createCluster({ name: options.name });
      console.log(chalk.green(`✓ Created cluster: ${cluster.id}`));

      // Add members if specified
      if (options.members) {
        const memberIds = options.members.split(',').map(s => s.trim());
        for (const memberId of memberIds) {
          // Detect session type from ID
          let sessionType = 'core_memory';
          if (memberId.startsWith('WFS-')) sessionType = 'workflow';
          else if (memberId.includes('-gemini') || memberId.includes('-qwen') || memberId.includes('-codex')) {
            sessionType = 'cli_history';
          }

          store.addClusterMember({
            cluster_id: cluster.id,
            session_id: memberId,
            session_type: sessionType as any,
            sequence_order: memberIds.indexOf(memberId) + 1,
            relevance_score: 1.0
          });
        }
        console.log(chalk.white(`  Added ${memberIds.length} members`));
      }

      // Notify dashboard
      notifyRefreshRequired('memory').catch(() => { /* ignore */ });
      return;
    }

    // View cluster details
    if (clusterId) {
      const cluster = store.getCluster(clusterId);
      if (!cluster) {
        console.error(chalk.red(`Cluster not found: ${clusterId}`));
        process.exit(1);
      }

      const members = store.getClusterMembers(clusterId);
      const relations = store.getClusterRelations(clusterId);

      console.log(chalk.bold.cyan(`\n  📦 Cluster: ${cluster.name}\n`));
      console.log(chalk.white(`  ID: ${cluster.id}`));
      console.log(chalk.white(`  Status: ${cluster.status}`));
      if (cluster.description) console.log(chalk.white(`  Description: ${cluster.description}`));
      if (cluster.intent) console.log(chalk.white(`  Intent: ${cluster.intent}`));

      if (members.length > 0) {
        console.log(chalk.bold.white('\n  📋 Sessions:'));
        for (const member of members) {
          const meta = store.getSessionMetadata(member.session_id);
          console.log(chalk.cyan(`     ${member.sequence_order}. ${member.session_id}`) + chalk.gray(` (${member.session_type})`));
          if (meta?.title) console.log(chalk.white(`        ${meta.title}`));
          if (meta?.token_estimate) console.log(chalk.gray(`        ~${meta.token_estimate} tokens`));
        }
      }

      if (relations.length > 0) {
        console.log(chalk.bold.white('\n  🔗 Relations:'));
        for (const rel of relations) {
          console.log(chalk.white(`     → ${rel.relation_type} ${rel.target_cluster_id}`));
        }
      }

      console.log();
      return;
    }

    // No action specified - show usage
    console.log(chalk.yellow('Usage: ccw core-memory cluster <id> or --auto or --create --name <name>'));

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Get progressive disclosure context
 */
async function contextAction(options: CommandOptions): Promise<void> {
  try {
    const { SessionClusteringService } = await import('../core/session-clustering-service.js');
    const service = new SessionClusteringService(getProjectPath());

    // Default to session-start for CLI usage
    const index = await service.getProgressiveIndex({
      type: 'session-start'
    });

    if (options.format === 'json') {
      console.log(JSON.stringify({ index }, null, 2));
    } else {
      console.log(index);
    }

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Load cluster context
 */
async function loadClusterAction(clusterId: string, options: CommandOptions): Promise<void> {
  if (!clusterId) {
    console.error(chalk.red('Error: Cluster ID is required'));
    console.error(chalk.gray('Usage: ccw core-memory load-cluster <id> [--level metadata|keyFiles|full]'));
    process.exit(1);
  }

  try {
    const store = getCoreMemoryStore(getProjectPath());

    const cluster = store.getCluster(clusterId);
    if (!cluster) {
      console.error(chalk.red(`Cluster not found: ${clusterId}`));
      process.exit(1);
    }

    const members = store.getClusterMembers(clusterId);
    const level = options.level || 'metadata';

    console.log(chalk.bold.cyan(`\n# Cluster: ${cluster.name}\n`));
    if (cluster.intent) console.log(chalk.white(`Intent: ${cluster.intent}\n`));

    console.log(chalk.bold.white('## Sessions\n'));

    for (const member of members) {
      const meta = store.getSessionMetadata(member.session_id);

      console.log(chalk.bold.cyan(`### ${member.sequence_order}. ${member.session_id}`));
      console.log(chalk.white(`Type: ${member.session_type}`));

      if (meta) {
        if (meta.title) console.log(chalk.white(`Title: ${meta.title}`));

        if (level === 'metadata') {
          if (meta.summary) console.log(chalk.white(`Summary: ${meta.summary}`));
        } else if (level === 'keyFiles' || level === 'full') {
          if (meta.summary) console.log(chalk.white(`Summary: ${meta.summary}`));
          if (meta.file_patterns) {
            const patterns = JSON.parse(meta.file_patterns as any);
            console.log(chalk.white(`Files: ${patterns.join(', ')}`));
          }
          if (meta.keywords) {
            const keywords = JSON.parse(meta.keywords as any);
            console.log(chalk.white(`Keywords: ${keywords.join(', ')}`));
          }
        }

        if (level === 'full') {
          // Load full content based on session type
          if (member.session_type === 'core_memory') {
            const memory = store.getMemory(member.session_id);
            if (memory) {
              console.log(chalk.white('\nContent:'));
              console.log(chalk.gray(memory.content));
            }
          }
        }
      }
      console.log();
    }

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Search sessions by keyword
 */
async function searchAction(keyword: string, options: CommandOptions): Promise<void> {
  // When --tags is provided, use tag-based filtering instead of keyword search
  if (options.tags) {
    const parsedTags = options.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (parsedTags.length === 0) {
      console.error(chalk.red('Error: --tags requires at least one tag'));
      console.error(chalk.gray('Usage: ccw core-memory search --tags tag1,tag2'));
      process.exit(1);
    }

    try {
      const store = getCoreMemoryStore(getProjectPath());
      const memories = store.getMemoriesByTags(parsedTags, { limit: 100 });

      if (memories.length === 0) {
        console.log(chalk.yellow(`\n  No memories found with tags: [${parsedTags.join(', ')}]\n`));
        return;
      }

      console.log(chalk.bold.cyan(`\n  Memories with tags [${parsedTags.join(', ')}]\n`));
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));

      for (const memory of memories) {
        const date = new Date(memory.updated_at).toLocaleString();
        const archived = memory.archived ? chalk.gray(' [archived]') : '';
        const tagDisplay = (memory.tags && memory.tags.length > 0) ? chalk.gray(` [${memory.tags.join(', ')}]`) : '';
        console.log(chalk.cyan(`  ${memory.id}`) + archived + tagDisplay);
        console.log(chalk.white(`    ${memory.summary || memory.content.substring(0, 80)}${memory.content.length > 80 ? '...' : ''}`));
        console.log(chalk.gray(`    Updated: ${date}`));
        console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));
      }

      console.log(chalk.gray(`\n  Total: ${memories.length}\n`));

    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
    return;
  }

  if (!keyword || keyword.trim() === '') {
    console.error(chalk.red('Error: Keyword is required'));
    console.error(chalk.gray('Usage: ccw core-memory search <keyword> [--type core|workflow|cli|all] [--tags tag1,tag2]'));
    process.exit(1);
  }

  try {
    const store = getCoreMemoryStore(getProjectPath());

    const results = store.searchSessionsByKeyword(keyword);

    if (results.length === 0) {
      console.log(chalk.yellow(`\n  No sessions found for: "${keyword}"\n`));
      return;
    }

    // Filter by type if specified
    let filtered = results;
    if (options.type && options.type !== 'all') {
      const typeMap: Record<string, string> = {
        core: 'core_memory',
        workflow: 'workflow',
        cli: 'cli_history'
      };
      filtered = results.filter(r => r.session_type === typeMap[options.type!]);
    }

    console.log(chalk.bold.cyan(`\n  🔍 Found ${filtered.length} sessions for "${keyword}"\n`));
    console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));

    for (const result of filtered) {
      console.log(chalk.cyan(`  ● ${result.session_id}`) + chalk.gray(` (${result.session_type})`));
      if (result.title) console.log(chalk.white(`    ${result.title}`));
      if (result.token_estimate) console.log(chalk.gray(`    ~${result.token_estimate} tokens`));
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));
    }

    console.log();

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

// ============================================================================
// Memory V2 CLI Subcommands
// ============================================================================

/**
 * Run batch extraction
 */
async function extractAction(options: CommandOptions): Promise<void> {
  try {
    const projectPath = getProjectPath();

    console.log(chalk.cyan('\n  Triggering memory extraction...\n'));

    const { MemoryExtractionPipeline } = await import('../core/memory-extraction-pipeline.js');
    const pipeline = new MemoryExtractionPipeline(projectPath);

    // Scan eligible sessions first
    const eligible = await pipeline.scanEligibleSessions();
    console.log(chalk.white(`  Eligible sessions: ${eligible.length}`));

    if (eligible.length === 0) {
      console.log(chalk.yellow('  No eligible sessions for extraction.\n'));
      return;
    }

    // Run extraction (synchronous for CLI - shows progress)
    console.log(chalk.cyan('  Running batch extraction...'));
    await pipeline.runBatchExtraction();

    const store = getCoreMemoryStore(projectPath);
    const stage1Count = store.countStage1Outputs();

    console.log(chalk.green(`\n  Extraction complete.`));
    console.log(chalk.white(`  Total stage1 outputs: ${stage1Count}\n`));

    notifyRefreshRequired('memory').catch(() => { /* ignore */ });

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Show extraction status
 */
async function extractStatusAction(options: CommandOptions): Promise<void> {
  try {
    const projectPath = getProjectPath();
    const store = getCoreMemoryStore(projectPath);
    const scheduler = new MemoryJobScheduler(store.getDb());

    const stage1Count = store.countStage1Outputs();
    const extractionJobs = scheduler.listJobs('extraction');

    if (options.json) {
      console.log(JSON.stringify({ total_stage1: stage1Count, jobs: extractionJobs }, null, 2));
      return;
    }

    console.log(chalk.bold.cyan('\n  Extraction Pipeline Status\n'));
    console.log(chalk.white(`  Stage 1 outputs: ${stage1Count}`));
    console.log(chalk.white(`  Extraction jobs: ${extractionJobs.length}`));

    if (extractionJobs.length > 0) {
      console.log(chalk.gray('\n  ─────────────────────────────────────────────────────────────────'));

      for (const job of extractionJobs) {
        const statusColor = job.status === 'done' ? chalk.green
          : job.status === 'error' ? chalk.red
          : job.status === 'running' ? chalk.yellow
          : chalk.gray;

        console.log(chalk.cyan(`  ${job.job_key}`) + chalk.white(` [${statusColor(job.status)}]`));
        if (job.last_error) console.log(chalk.red(`    Error: ${job.last_error}`));
        if (job.started_at) console.log(chalk.gray(`    Started: ${new Date(job.started_at * 1000).toLocaleString()}`));
        if (job.finished_at) console.log(chalk.gray(`    Finished: ${new Date(job.finished_at * 1000).toLocaleString()}`));
        console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));
      }
    }

    console.log();

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Run consolidation
 */
async function consolidateAction(options: CommandOptions): Promise<void> {
  try {
    const projectPath = getProjectPath();

    console.log(chalk.cyan('\n  Triggering memory consolidation...\n'));

    const { MemoryConsolidationPipeline } = await import('../core/memory-consolidation-pipeline.js');
    const pipeline = new MemoryConsolidationPipeline(projectPath);

    await pipeline.runConsolidation();

    const memoryMd = pipeline.getMemoryMdContent();

    console.log(chalk.green('  Consolidation complete.'));
    if (memoryMd) {
      console.log(chalk.white(`  MEMORY.md generated (${memoryMd.length} chars)`));
    }
    console.log();

    notifyRefreshRequired('memory').catch(() => { /* ignore */ });

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * List all V2 pipeline jobs
 */
async function jobsAction(options: CommandOptions): Promise<void> {
  try {
    const projectPath = getProjectPath();
    const store = getCoreMemoryStore(projectPath);
    const scheduler = new MemoryJobScheduler(store.getDb());

    const kind = options.type || undefined;
    const jobs = scheduler.listJobs(kind);

    if (options.json) {
      console.log(JSON.stringify({ jobs, total: jobs.length }, null, 2));
      return;
    }

    console.log(chalk.bold.cyan('\n  Memory V2 Pipeline Jobs\n'));

    if (jobs.length === 0) {
      console.log(chalk.yellow('  No jobs found.\n'));
      return;
    }

    // Summary counts
    const byStatus: Record<string, number> = {};
    for (const job of jobs) {
      byStatus[job.status] = (byStatus[job.status] || 0) + 1;
    }

    const statusParts = Object.entries(byStatus)
      .map(([s, c]) => `${s}: ${c}`)
      .join(' | ');
    console.log(chalk.white(`  Summary: ${statusParts}`));
    console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));

    for (const job of jobs) {
      const statusColor = job.status === 'done' ? chalk.green
        : job.status === 'error' ? chalk.red
        : job.status === 'running' ? chalk.yellow
        : chalk.gray;

      console.log(
        chalk.cyan(`  [${job.kind}]`) +
        chalk.white(` ${job.job_key}`) +
        ` [${statusColor(job.status)}]` +
        chalk.gray(` retries: ${job.retry_remaining}`)
      );
      if (job.last_error) console.log(chalk.red(`    Error: ${job.last_error}`));
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));
    }

    console.log(chalk.gray(`\n  Total: ${jobs.length}\n`));

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Unified vector+FTS search across all memory stores
 */
async function unifiedSearchAction(keyword: string, options: CommandOptions): Promise<void> {
  if (!keyword || keyword.trim() === '') {
    console.error(chalk.red('Error: Query is required'));
    console.error(chalk.gray('Usage: ccw core-memory search --unified <query> [--topK 20] [--minScore 0] [--category <cat>]'));
    process.exit(1);
  }

  try {
    const { UnifiedMemoryService } = await import('../core/unified-memory-service.js');
    const service = new UnifiedMemoryService(getProjectPath());

    const topK = parseInt(options.topK || '20', 10);
    const minScore = parseFloat(options.minScore || '0');
    const category = options.category || undefined;

    console.log(chalk.cyan(`\n  Unified search: "${keyword}" (topK=${topK}, minScore=${minScore})\n`));

    const results = await service.search(keyword, {
      limit: topK,
      minScore,
      category: category as any,
    });

    if (results.length === 0) {
      console.log(chalk.yellow('  No results found.\n'));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify({ query: keyword, total: results.length, results }, null, 2));
      return;
    }

    console.log(chalk.gray('  -----------------------------------------------------------------------'));

    for (const result of results) {
      const sources: string[] = [];
      if (result.rank_sources.vector_rank) sources.push(`vec:#${result.rank_sources.vector_rank}`);
      if (result.rank_sources.fts_rank) sources.push(`fts:#${result.rank_sources.fts_rank}`);
      if (result.rank_sources.heat_score) sources.push(`heat:${result.rank_sources.heat_score.toFixed(1)}`);

      const snippet = result.content.substring(0, 120).replace(/\n/g, ' ');

      console.log(
        chalk.cyan(`  ${result.source_id}`) +
        chalk.gray(` [${result.source_type}/${result.category}]`) +
        chalk.white(` score=${result.score.toFixed(4)}`)
      );
      console.log(chalk.gray(`    Sources: ${sources.join(' | ')}`));
      console.log(chalk.white(`    ${snippet}${result.content.length > 120 ? '...' : ''}`));
      console.log(chalk.gray('  -----------------------------------------------------------------------'));
    }

    console.log(chalk.gray(`\n  Total: ${results.length}\n`));

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Rebuild the unified HNSW vector index from scratch
 */
async function reindexAction(options: CommandOptions): Promise<void> {
  try {
    const { UnifiedVectorIndex, isUnifiedEmbedderAvailable } = await import('../core/unified-vector-index.js');

    if (!isUnifiedEmbedderAvailable()) {
      console.error(chalk.red('Error: Unified embedder is not available.'));
      console.error(chalk.gray('Ensure Python venv and embedder script are set up.'));
      process.exit(1);
    }

    const index = new UnifiedVectorIndex(getProjectPath());

    console.log(chalk.cyan('\n  Rebuilding unified vector index...\n'));

    const result = await index.reindexAll();

    if (!result.success) {
      console.error(chalk.red(`  Reindex failed: ${result.error}\n`));
      process.exit(1);
    }

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.green('  Reindex complete.'));
    if (result.hnsw_count !== undefined) {
      console.log(chalk.white(`  HNSW vectors: ${result.hnsw_count}`));
    }
    if (result.elapsed_time !== undefined) {
      console.log(chalk.white(`  Elapsed: ${result.elapsed_time.toFixed(2)}s`));
    }
    console.log();

  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

/**
 * Core Memory command entry point
 */
export async function coreMemoryCommand(
  subcommand: string,
  args: string | string[],
  options: CommandOptions
): Promise<void> {
  const argsArray = Array.isArray(args) ? args : (args ? [args] : []);
  const textArg = argsArray.join(' ');

  switch (subcommand) {
    case 'list':
      await listAction();
      break;

    case 'import':
      await importAction(textArg);
      break;

    case 'export':
      await exportAction(options);
      break;

    case 'summary':
      await summaryAction(options);
      break;

    case 'clusters':
      await clustersAction(options);
      break;

    case 'cluster':
      await clusterAction(argsArray[0], options);
      break;

    case 'context':
      await contextAction(options);
      break;

    case 'load-cluster':
      await loadClusterAction(textArg, options);
      break;

    case 'search':
      if (options.unified) {
        await unifiedSearchAction(textArg, options);
      } else {
        await searchAction(textArg, options);
      }
      break;

    case 'projects':
      await projectsAction(options);
      break;

    case 'import-from':
      await importFromAction(textArg, options);
      break;

    case 'list-from':
      await listFromAction(textArg, options);
      break;

    // Memory V2 subcommands
    case 'extract':
      await extractAction(options);
      break;

    case 'extract-status':
      await extractStatusAction(options);
      break;

    case 'consolidate':
      await consolidateAction(options);
      break;

    case 'jobs':
      await jobsAction(options);
      break;

    case 'reindex':
      await reindexAction(options);
      break;

    default:
      console.log(chalk.bold.cyan('\n  CCW Core Memory\n'));
      console.log('  Manage core memory entries and session clusters.\n');
      console.log(chalk.bold('  Basic Commands:'));
      console.log(chalk.white('    list                        ') + chalk.gray('List all memories'));
      console.log(chalk.white('    import "<text>"             ') + chalk.gray('Import text as new memory'));
      console.log(chalk.white('    export --id <id>            ') + chalk.gray('Export memory (searches all projects)'));
      console.log(chalk.white('    summary --id <id>           ') + chalk.gray('Generate AI summary'));
      console.log();
      console.log(chalk.bold('  Cross-Workspace Commands:'));
      console.log(chalk.white('    projects                    ') + chalk.gray('List all CCW projects'));
      console.log(chalk.white('    list-from <project-id>      ') + chalk.gray('List memories from another project'));
      console.log();
      console.log(chalk.bold('  Clustering Commands:'));
      console.log(chalk.white('    clusters [--status]         ') + chalk.gray('List all clusters'));
      console.log(chalk.white('    cluster [id]                ') + chalk.gray('View cluster details'));
      console.log(chalk.white('    cluster --auto              ') + chalk.gray('Run auto-clustering'));
      console.log(chalk.white('    cluster --dedup             ') + chalk.gray('Deduplicate similar clusters'));
      console.log(chalk.white('    cluster <id> --delete       ') + chalk.gray('Delete a cluster'));
      console.log(chalk.white('    cluster <id> --merge <ids>  ') + chalk.gray('Merge clusters into target'));
      console.log(chalk.white('    cluster --create --name     ') + chalk.gray('Create new cluster'));
      console.log(chalk.white('    context                     ') + chalk.gray('Get progressive index'));
      console.log(chalk.white('    load-cluster <id>           ') + chalk.gray('Load cluster context'));
      console.log(chalk.white('    search <keyword>            ') + chalk.gray('Search sessions'));
      console.log(chalk.white('    search --tags tag1,tag2     ') + chalk.gray('Filter memories by tags'));
      console.log(chalk.white('    search --unified <query>    ') + chalk.gray('Unified vector+FTS search'));
      console.log();
      console.log(chalk.bold('  Memory V2 Pipeline:'));
      console.log(chalk.white('    extract                     ') + chalk.gray('Run batch memory extraction'));
      console.log(chalk.white('    extract-status              ') + chalk.gray('Show extraction pipeline status'));
      console.log(chalk.white('    consolidate                 ') + chalk.gray('Run memory consolidation'));
      console.log(chalk.white('    jobs                        ') + chalk.gray('List all pipeline jobs'));
      console.log(chalk.white('    reindex                     ') + chalk.gray('Rebuild unified vector index'));
      console.log();
      console.log(chalk.bold('  Options:'));
      console.log(chalk.gray('    --id <id>                   Memory ID (for export/summary)'));
      console.log(chalk.gray('    --tool gemini|qwen          AI tool for summary (default: gemini)'));
      console.log(chalk.gray('    --json                      Output as JSON'));
      console.log(chalk.gray('    --scope <scope>             Auto-cluster scope (all/recent/unclustered)'));
      console.log(chalk.gray('    --dedup                     Deduplicate similar clusters'));
      console.log(chalk.gray('    --tags <tags>               Filter by tags (comma-separated)'));
      console.log(chalk.gray('    --delete                    Delete a cluster'));
      console.log(chalk.gray('    --merge <ids>               Merge source clusters into target'));
      console.log();
      console.log(chalk.bold('  Examples:'));
      console.log(chalk.gray('    ccw core-memory list'));
      console.log(chalk.gray('    ccw core-memory export --id CMEM-xxx    # Searches all projects'));
      console.log(chalk.gray('    ccw core-memory projects                # List all projects'));
      console.log(chalk.gray('    ccw core-memory list-from d--other-project'));
      console.log(chalk.gray('    ccw core-memory cluster --auto'));
      console.log(chalk.gray('    ccw core-memory cluster --dedup'));
      console.log(chalk.gray('    ccw core-memory extract                 # Run memory extraction'));
      console.log(chalk.gray('    ccw core-memory extract-status          # Check extraction state'));
      console.log(chalk.gray('    ccw core-memory consolidate             # Run consolidation'));
      console.log(chalk.gray('    ccw core-memory jobs                    # List pipeline jobs'));
      console.log();
  }
}
