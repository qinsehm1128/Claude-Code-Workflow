/**
 * Memory Consolidation Pipeline - Phase 2 Global Consolidation
 *
 * Orchestrates the global memory consolidation process:
 *   Lock -> Materialize -> Agent -> Monitor -> Done
 *
 * Phase 1 outputs (per-session extractions stored in stage1_outputs DB table)
 * are materialized to disk as rollout_summaries/*.md + raw_memories.md,
 * then a CLI agent (--mode write) reads those files and produces MEMORY.md.
 *
 * The pipeline uses lease-based locking via MemoryJobScheduler to ensure
 * only one consolidation runs at a time, with heartbeat-based lease renewal.
 */

import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { MemoryJobScheduler, type ClaimResult } from './memory-job-scheduler.js';
import { getCoreMemoryStore, type Stage1Output } from './core-memory-store.js';
import { getProjectPaths, ensureStorageDir } from '../config/storage-paths.js';
import {
  HEARTBEAT_INTERVAL_SECONDS,
  MAX_RAW_MEMORIES_FOR_GLOBAL,
} from './memory-v2-config.js';
import {
  CONSOLIDATION_SYSTEM_PROMPT,
  buildConsolidationPrompt,
} from './memory-consolidation-prompts.js';

// -- Types --

export interface ConsolidationStatus {
  status: 'idle' | 'running' | 'completed' | 'error';
  lastRun?: number;
  memoryMdExists: boolean;
  inputCount: number;
  lastError?: string;
}

export interface MaterializationResult {
  summariesWritten: number;
  summariesPruned: number;
  rawMemoriesSize: number;
}

// -- Constants --

const JOB_KIND = 'memory_consolidate_global';
const JOB_KEY = 'global';
const MAX_CONCURRENT = 1;
const AGENT_TIMEOUT_MS = 300_000; // 5 minutes
const DEFAULT_CLI_TOOL = 'gemini';

// -- Utility --

/**
 * Sanitize a thread ID for use as a filename.
 * Replaces filesystem-unsafe characters with underscores.
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}

// -- Standalone Functions --

/**
 * Write one .md file per stage1_output to rollout_summaries/, prune orphans.
 *
 * Each file is named {sanitized_thread_id}.md and contains the rollout_summary.
 * Files in the directory that do not correspond to any DB row are deleted.
 */
export function syncRolloutSummaries(
  memoryHome: string,
  outputs: Stage1Output[]
): MaterializationResult {
  const summariesDir = join(memoryHome, 'rollout_summaries');
  ensureStorageDir(summariesDir);

  // Build set of expected filenames
  const expectedFiles = new Set<string>();
  let summariesWritten = 0;

  for (const output of outputs) {
    const filename = `${sanitizeFilename(output.thread_id)}.md`;
    expectedFiles.add(filename);
    const filePath = join(summariesDir, filename);

    // Write summary content with thread header
    const content = [
      `# Session: ${output.thread_id}`,
      `> Generated: ${new Date(output.generated_at * 1000).toISOString()}`,
      `> Source updated: ${new Date(output.source_updated_at * 1000).toISOString()}`,
      '',
      output.rollout_summary,
    ].join('\n');

    writeFileSync(filePath, content, 'utf-8');
    summariesWritten++;
  }

  // Prune orphan files not in DB
  let summariesPruned = 0;
  const existingFiles = readdirSync(summariesDir);
  for (const file of existingFiles) {
    if (file.endsWith('.md') && !expectedFiles.has(file)) {
      unlinkSync(join(summariesDir, file));
      summariesPruned++;
    }
  }

  return {
    summariesWritten,
    summariesPruned,
    rawMemoriesSize: 0, // Not applicable for this function
  };
}

/**
 * Concatenate the latest raw_memory entries into raw_memories.md with thread headers.
 *
 * Entries are sorted by generated_at descending, limited to maxCount.
 * Format per entry:
 *   ## Thread: {thread_id}
 *   {raw_memory content}
 *   ---
 *
 * @returns The byte size of the written raw_memories.md file.
 */
export function rebuildRawMemories(
  memoryHome: string,
  outputs: Stage1Output[],
  maxCount: number
): number {
  ensureStorageDir(memoryHome);

  // Sort by generated_at descending, take up to maxCount
  const sorted = [...outputs]
    .sort((a, b) => b.generated_at - a.generated_at)
    .slice(0, maxCount);

  const sections: string[] = [];
  for (const output of sorted) {
    sections.push(
      `## Thread: ${output.thread_id}`,
      `> Generated: ${new Date(output.generated_at * 1000).toISOString()}`,
      '',
      output.raw_memory,
      '',
      '---',
      '',
    );
  }

  const content = sections.join('\n');
  const filePath = join(memoryHome, 'raw_memories.md');
  writeFileSync(filePath, content, 'utf-8');

  return Buffer.byteLength(content, 'utf-8');
}

/**
 * Read MEMORY.md content for session prompt injection.
 *
 * @param projectPath - Project root path (used to resolve storage paths)
 * @returns MEMORY.md content string, or null if the file does not exist
 */
export function getMemoryMdContent(projectPath: string): string | null {
  const paths = getProjectPaths(projectPath);
  const memoryMdPath = paths.memoryV2.memoryMd;

  if (!existsSync(memoryMdPath)) {
    return null;
  }

  try {
    return readFileSync(memoryMdPath, 'utf-8');
  } catch {
    return null;
  }
}

// -- Pipeline Class --

/**
 * MemoryConsolidationPipeline orchestrates global memory consolidation:
 *   1. Claim global lock via job scheduler
 *   2. Materialize Phase 1 outputs to disk (rollout_summaries/ + raw_memories.md)
 *   3. Invoke consolidation agent via executeCliTool --mode write
 *   4. Monitor with heartbeat lease renewal
 *   5. Mark job as succeeded or failed
 */
export class MemoryConsolidationPipeline {
  private projectPath: string;
  private store: ReturnType<typeof getCoreMemoryStore>;
  private scheduler: MemoryJobScheduler;
  private memoryHome: string;
  private cliTool: string;

  constructor(projectPath: string, cliTool?: string) {
    this.projectPath = projectPath;
    this.store = getCoreMemoryStore(projectPath);
    this.scheduler = new MemoryJobScheduler(this.store.getDb());
    this.memoryHome = getProjectPaths(projectPath).memoryV2.root;
    this.cliTool = cliTool || DEFAULT_CLI_TOOL;
  }

  /**
   * Attempt to claim the global consolidation lock.
   *
   * Before claiming, ensures the job row exists and checks dirtiness.
   * The job scheduler handles the actual concurrency control.
   */
  claimGlobalLock(): ClaimResult {
    return this.scheduler.claimJob(JOB_KIND, JOB_KEY, MAX_CONCURRENT);
  }

  /**
   * Materialize rollout summaries from DB to disk.
   * Writes one .md file per stage1_output row, prunes orphan files.
   */
  materializeSummaries(): MaterializationResult {
    const outputs = this.store.listStage1Outputs();
    return syncRolloutSummaries(this.memoryHome, outputs);
  }

  /**
   * Rebuild raw_memories.md from DB entries.
   * Concatenates the latest entries up to MAX_RAW_MEMORIES_FOR_GLOBAL.
   */
  materializeRawMemories(): number {
    const outputs = this.store.listStage1Outputs();
    return rebuildRawMemories(
      this.memoryHome,
      outputs,
      MAX_RAW_MEMORIES_FOR_GLOBAL
    );
  }

  /**
   * Run the consolidation agent via executeCliTool with --mode write.
   * Starts a heartbeat timer to keep the lease alive during agent execution.
   *
   * @param token - Ownership token from claimGlobalLock
   * @returns true if agent completed successfully, false otherwise
   */
  async runConsolidationAgent(token: string): Promise<boolean> {
    // Lazy import to avoid circular dependencies at module load time
    const { executeCliTool } = await import('../tools/cli-executor-core.js');

    // Determine input state for prompt
    const summariesDir = join(this.memoryHome, 'rollout_summaries');
    let summaryCount = 0;
    if (existsSync(summariesDir)) {
      summaryCount = readdirSync(summariesDir).filter(f => f.endsWith('.md')).length;
    }
    const hasExistingMemoryMd = existsSync(join(this.memoryHome, 'MEMORY.md'));

    // Ensure skills directory exists
    ensureStorageDir(join(this.memoryHome, 'skills'));

    // Build the full prompt
    const userPrompt = buildConsolidationPrompt(summaryCount, hasExistingMemoryMd);
    const fullPrompt = `${CONSOLIDATION_SYSTEM_PROMPT}\n\n${userPrompt}`;

    // Start heartbeat timer
    const heartbeatMs = HEARTBEAT_INTERVAL_SECONDS * 1000;
    const heartbeatTimer = setInterval(() => {
      const renewed = this.scheduler.heartbeat(JOB_KIND, JOB_KEY, token);
      if (!renewed) {
        // Heartbeat rejected - lease was lost
        clearInterval(heartbeatTimer);
      }
    }, heartbeatMs);

    try {
      // Execute the consolidation agent
      const result = await Promise.race([
        executeCliTool({
          tool: this.cliTool,
          prompt: fullPrompt,
          mode: 'write',
          cd: this.memoryHome,
          category: 'internal',
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Consolidation agent timed out')),
            AGENT_TIMEOUT_MS
          )
        ),
      ]);

      return result.success;
    } finally {
      clearInterval(heartbeatTimer);
    }
  }

  /**
   * Verify that Phase 1 artifacts were not modified by the agent.
   * Compares file count in rollout_summaries/ before and after agent run.
   *
   * @param expectedSummaryCount - Number of summaries before agent run
   * @returns true if artifacts are intact
   */
  verifyPhase1Integrity(expectedSummaryCount: number): boolean {
    const summariesDir = join(this.memoryHome, 'rollout_summaries');
    if (!existsSync(summariesDir)) return expectedSummaryCount === 0;

    const currentCount = readdirSync(summariesDir).filter(f => f.endsWith('.md')).length;
    return currentCount === expectedSummaryCount;
  }

  /**
   * Get the current consolidation status.
   */
  getStatus(): ConsolidationStatus {
    const jobStatus = this.scheduler.getJobStatus(JOB_KIND, JOB_KEY);
    const inputCount = this.store.countStage1Outputs();
    const memoryMdExists = existsSync(join(this.memoryHome, 'MEMORY.md'));

    if (!jobStatus) {
      return {
        status: 'idle',
        memoryMdExists,
        inputCount,
      };
    }

    const statusMap: Record<string, ConsolidationStatus['status']> = {
      pending: 'idle',
      running: 'running',
      done: 'completed',
      error: 'error',
    };

    return {
      status: statusMap[jobStatus.status] || 'idle',
      lastRun: jobStatus.finished_at,
      memoryMdExists,
      inputCount,
      lastError: jobStatus.last_error,
    };
  }

  /**
   * Read MEMORY.md content for session prompt injection.
   * Convenience method that delegates to the standalone function.
   */
  getMemoryMdContent(): string | null {
    return getMemoryMdContent(this.projectPath);
  }

  /**
   * Run the full consolidation pipeline.
   *
   * Pipeline flow:
   *   1. Check if there are inputs to process
   *   2. Claim global lock
   *   3. Materialize Phase 1 outputs to disk
   *   4. Run consolidation agent with heartbeat
   *   5. Verify Phase 1 integrity
   *   6. Mark job as succeeded or failed
   *
   * @returns Final consolidation status
   */
  async runConsolidation(): Promise<ConsolidationStatus> {
    // Step 1: Check inputs
    const inputCount = this.store.countStage1Outputs();
    if (inputCount === 0) {
      return {
        status: 'idle',
        memoryMdExists: existsSync(join(this.memoryHome, 'MEMORY.md')),
        inputCount: 0,
      };
    }

    // Step 2: Claim global lock
    const claim = this.claimGlobalLock();
    if (!claim.claimed || !claim.ownership_token) {
      return {
        status: claim.reason === 'already_running' ? 'running' : 'idle',
        memoryMdExists: existsSync(join(this.memoryHome, 'MEMORY.md')),
        inputCount,
        lastError: claim.reason
          ? `Lock not acquired: ${claim.reason}`
          : undefined,
      };
    }

    const token = claim.ownership_token;

    try {
      // Step 3: Materialize Phase 1 outputs to disk
      const matResult = this.materializeSummaries();
      const rawMemoriesSize = this.materializeRawMemories();

      const expectedSummaryCount = matResult.summariesWritten;

      // Step 4: Run consolidation agent with heartbeat
      const agentSuccess = await this.runConsolidationAgent(token);

      if (!agentSuccess) {
        this.scheduler.markFailed(
          JOB_KIND,
          JOB_KEY,
          token,
          'Consolidation agent returned failure'
        );
        return {
          status: 'error',
          memoryMdExists: existsSync(join(this.memoryHome, 'MEMORY.md')),
          inputCount,
          lastError: 'Consolidation agent returned failure',
        };
      }

      // Step 5: Verify Phase 1 integrity
      if (!this.verifyPhase1Integrity(expectedSummaryCount)) {
        this.scheduler.markFailed(
          JOB_KIND,
          JOB_KEY,
          token,
          'Phase 1 artifacts were modified during consolidation'
        );
        return {
          status: 'error',
          memoryMdExists: existsSync(join(this.memoryHome, 'MEMORY.md')),
          inputCount,
          lastError: 'Phase 1 artifacts were modified during consolidation',
        };
      }

      // Step 6: Check that MEMORY.md was actually produced
      const memoryMdExists = existsSync(join(this.memoryHome, 'MEMORY.md'));
      if (!memoryMdExists) {
        this.scheduler.markFailed(
          JOB_KIND,
          JOB_KEY,
          token,
          'Agent completed but MEMORY.md was not produced'
        );
        return {
          status: 'error',
          memoryMdExists: false,
          inputCount,
          lastError: 'Agent completed but MEMORY.md was not produced',
        };
      }

      // Step 7: Mark success with watermark
      // Use the current input count as the success watermark
      const watermark = inputCount;
      this.scheduler.markSucceeded(JOB_KIND, JOB_KEY, token, watermark);

      return {
        status: 'completed',
        lastRun: Math.floor(Date.now() / 1000),
        memoryMdExists: true,
        inputCount,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      this.scheduler.markFailed(JOB_KIND, JOB_KEY, token, errorMessage);

      return {
        status: 'error',
        memoryMdExists: existsSync(join(this.memoryHome, 'MEMORY.md')),
        inputCount,
        lastError: errorMessage,
      };
    }
  }
}
