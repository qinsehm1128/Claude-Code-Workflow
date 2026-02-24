/**
 * CheckpointService - Session Checkpoint Management
 *
 * Creates and manages session checkpoints for state preservation during
 * context compaction and workflow transitions.
 *
 * Features:
 *   - Checkpoint creation with workflow and mode state
 *   - Checkpoint storage in .workflow/checkpoints/
 *   - Automatic cleanup of old checkpoints (keeps last 10)
 *   - Recovery message formatting for context injection
 *
 * Based on oh-my-claudecode pre-compact pattern.
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync
} from 'fs';
import { join, basename } from 'path';
import { ExecutionMode, MODE_CONFIGS } from './mode-registry-service.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Checkpoint trigger type
 */
export type CheckpointTrigger = 'manual' | 'auto' | 'compact' | 'mode-switch' | 'session-end';

/**
 * Workflow state snapshot
 */
export interface WorkflowStateSnapshot {
  /** Workflow type identifier */
  type: string;
  /** Current phase of the workflow */
  phase: string;
  /** Task IDs in pending state */
  pending: string[];
  /** Task IDs in completed state */
  completed: string[];
  /** Additional workflow metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Mode state snapshot for a single mode
 */
export interface ModeStateSnapshot {
  /** Whether the mode is active */
  active: boolean;
  /** Mode-specific phase or stage */
  phase?: string;
  /** ISO timestamp when mode was activated */
  activatedAt?: string;
  /** Additional mode-specific data */
  data?: Record<string, unknown>;
}

/**
 * Memory context snapshot
 */
export interface MemoryContextSnapshot {
  /** Brief summary of accumulated context */
  summary: string;
  /** Key entities identified in the session */
  keyEntities: string[];
  /** Important decisions made */
  decisions?: string[];
  /** Open questions or blockers */
  openQuestions?: string[];
}

/**
 * Full checkpoint data structure
 */
export interface Checkpoint {
  /** Unique checkpoint ID (timestamp-sessionId) */
  id: string;
  /** ISO timestamp of checkpoint creation */
  created_at: string;
  /** What triggered the checkpoint */
  trigger: CheckpointTrigger;
  /** Session ID this checkpoint belongs to */
  session_id: string;
  /** Project path */
  project_path: string;
  /** Workflow state snapshot */
  workflow_state: WorkflowStateSnapshot | null;
  /** Active mode states */
  mode_states: Partial<Record<ExecutionMode, ModeStateSnapshot>>;
  /** Memory context summary */
  memory_context: MemoryContextSnapshot | null;
  /** TODO summary if available */
  todo_summary?: {
    pending: number;
    in_progress: number;
    completed: number;
  };
}

/**
 * Checkpoint metadata for listing
 */
export interface CheckpointMeta {
  /** Checkpoint ID */
  id: string;
  /** Creation timestamp */
  created_at: string;
  /** Session ID */
  session_id: string;
  /** Trigger type */
  trigger: CheckpointTrigger;
  /** File path */
  path: string;
}

/**
 * Options for checkpoint service
 */
export interface CheckpointServiceOptions {
  /** Project root path */
  projectPath: string;
  /** Maximum checkpoints to keep per session (default: 10) */
  maxCheckpointsPerSession?: number;
  /** Enable logging */
  enableLogging?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Default maximum checkpoints to keep per session */
const DEFAULT_MAX_CHECKPOINTS = 10;

/** Checkpoint directory name within .workflow */
const CHECKPOINT_DIR_NAME = 'checkpoints';

// =============================================================================
// CheckpointService Class
// =============================================================================

/**
 * Service for managing session checkpoints
 */
export class CheckpointService {
  private projectPath: string;
  private checkpointsDir: string;
  private maxCheckpoints: number;
  private enableLogging: boolean;

  constructor(options: CheckpointServiceOptions) {
    this.projectPath = options.projectPath;
    this.checkpointsDir = join(this.projectPath, '.workflow', CHECKPOINT_DIR_NAME);
    this.maxCheckpoints = options.maxCheckpointsPerSession ?? DEFAULT_MAX_CHECKPOINTS;
    this.enableLogging = options.enableLogging ?? false;
  }

  // ---------------------------------------------------------------------------
  // Public: Checkpoint Creation
  // ---------------------------------------------------------------------------

  /**
   * Create a checkpoint for a session
   *
   * @param sessionId - The session ID
   * @param trigger - What triggered the checkpoint
   * @param options - Optional additional data
   * @returns Promise resolving to the created checkpoint
   */
  async createCheckpoint(
    sessionId: string,
    trigger: CheckpointTrigger,
    options?: {
      workflowState?: WorkflowStateSnapshot | null;
      modeStates?: Partial<Record<ExecutionMode, ModeStateSnapshot>>;
      memoryContext?: MemoryContextSnapshot | null;
      todoSummary?: { pending: number; in_progress: number; completed: number };
    }
  ): Promise<Checkpoint> {
    const timestamp = new Date().toISOString();
    const checkpointId = this.generateCheckpointId(sessionId, timestamp);

    const checkpoint: Checkpoint = {
      id: checkpointId,
      created_at: timestamp,
      trigger,
      session_id: sessionId,
      project_path: this.projectPath,
      workflow_state: options?.workflowState ?? null,
      mode_states: options?.modeStates ?? {},
      memory_context: options?.memoryContext ?? null,
      todo_summary: options?.todoSummary
    };

    this.log(`Created checkpoint ${checkpointId} for session ${sessionId} (trigger: ${trigger})`);
    return checkpoint;
  }

  /**
   * Save a checkpoint to disk
   *
   * @param checkpoint - The checkpoint to save
   * @returns The checkpoint ID
   */
  async saveCheckpoint(checkpoint: Checkpoint): Promise<string> {
    this.ensureCheckpointsDir();

    const filename = `${checkpoint.id}.json`;
    const filepath = join(this.checkpointsDir, filename);

    try {
      writeFileSync(filepath, JSON.stringify(checkpoint, null, 2), 'utf-8');
      this.log(`Saved checkpoint to ${filepath}`);

      // Clean up old checkpoints for this session
      await this.cleanupOldCheckpoints(checkpoint.session_id);

      return checkpoint.id;
    } catch (error) {
      this.log(`Error saving checkpoint: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Load a checkpoint from disk
   *
   * @param checkpointId - The checkpoint ID to load
   * @returns The checkpoint or null if not found
   */
  async loadCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
    const filepath = join(this.checkpointsDir, `${checkpointId}.json`);

    if (!existsSync(filepath)) {
      this.log(`Checkpoint not found: ${checkpointId}`);
      return null;
    }

    try {
      const content = readFileSync(filepath, 'utf-8');
      const checkpoint = JSON.parse(content) as Checkpoint;
      this.log(`Loaded checkpoint ${checkpointId}`);
      return checkpoint;
    } catch (error) {
      this.log(`Error loading checkpoint ${checkpointId}: ${(error as Error).message}`);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Public: Checkpoint Listing
  // ---------------------------------------------------------------------------

  /**
   * List all checkpoints, optionally filtered by session
   *
   * @param sessionId - Optional session ID to filter by
   * @returns Array of checkpoint metadata
   */
  async listCheckpoints(sessionId?: string): Promise<CheckpointMeta[]> {
    if (!existsSync(this.checkpointsDir)) {
      return [];
    }

    try {
      const files = readdirSync(this.checkpointsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => join(this.checkpointsDir, f));

      const checkpoints: CheckpointMeta[] = [];

      for (const filepath of files) {
        try {
          const content = readFileSync(filepath, 'utf-8');
          const checkpoint = JSON.parse(content) as Checkpoint;

          // Filter by session if provided
          if (sessionId && checkpoint.session_id !== sessionId) {
            continue;
          }

          checkpoints.push({
            id: checkpoint.id,
            created_at: checkpoint.created_at,
            session_id: checkpoint.session_id,
            trigger: checkpoint.trigger,
            path: filepath
          });
        } catch {
          // Skip invalid checkpoint files
        }
      }

      // Sort by creation time (newest first)
      checkpoints.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return checkpoints;
    } catch (error) {
      this.log(`Error listing checkpoints: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Get the most recent checkpoint for a session
   *
   * @param sessionId - The session ID
   * @returns The most recent checkpoint or null
   */
  async getLatestCheckpoint(sessionId: string): Promise<Checkpoint | null> {
    const checkpoints = await this.listCheckpoints(sessionId);
    if (checkpoints.length === 0) {
      return null;
    }

    return this.loadCheckpoint(checkpoints[0].id);
  }

  // ---------------------------------------------------------------------------
  // Public: Recovery Message Formatting
  // ---------------------------------------------------------------------------

  /**
   * Format a checkpoint as a recovery message for context injection
   *
   * @param checkpoint - The checkpoint to format
   * @returns Formatted markdown string
   */
  formatRecoveryMessage(checkpoint: Checkpoint): string {
    const lines: string[] = [
      '# Session Checkpoint Recovery',
      '',
      `**Checkpoint ID:** ${checkpoint.id}`,
      `**Created:** ${checkpoint.created_at}`,
      `**Trigger:** ${checkpoint.trigger}`,
      `**Session:** ${checkpoint.session_id}`,
      ''
    ];

    // Workflow state section
    if (checkpoint.workflow_state) {
      const ws = checkpoint.workflow_state;
      lines.push('## Workflow State');
      lines.push('');
      lines.push(`- **Type:** ${ws.type}`);
      lines.push(`- **Phase:** ${ws.phase}`);
      if (ws.pending.length > 0) {
        lines.push(`- **Pending Tasks:** ${ws.pending.length}`);
      }
      if (ws.completed.length > 0) {
        lines.push(`- **Completed Tasks:** ${ws.completed.length}`);
      }
      lines.push('');
    }

    // Active modes section
    const activeModes = Object.entries(checkpoint.mode_states)
      .filter(([, state]) => state.active);

    if (activeModes.length > 0) {
      lines.push('## Active Modes');
      lines.push('');

      for (const [mode, state] of activeModes) {
        const modeConfig = MODE_CONFIGS[mode as ExecutionMode];
        const modeName = modeConfig?.name ?? mode;
        lines.push(`- **${modeName}**`);
        if (state.phase) {
          lines.push(`  - Phase: ${state.phase}`);
        }
        if (state.activatedAt) {
          const age = Math.round(
            (Date.now() - new Date(state.activatedAt).getTime()) / 60000
          );
          lines.push(`  - Active for: ${age} minutes`);
        }
      }
      lines.push('');
    }

    // TODO summary section
    if (checkpoint.todo_summary) {
      const todo = checkpoint.todo_summary;
      const total = todo.pending + todo.in_progress + todo.completed;

      if (total > 0) {
        lines.push('## TODO Summary');
        lines.push('');
        lines.push(`- Pending: ${todo.pending}`);
        lines.push(`- In Progress: ${todo.in_progress}`);
        lines.push(`- Completed: ${todo.completed}`);
        lines.push('');
      }
    }

    // Memory context section
    if (checkpoint.memory_context) {
      const mem = checkpoint.memory_context;
      lines.push('## Context Memory');
      lines.push('');

      if (mem.summary) {
        lines.push(mem.summary);
        lines.push('');
      }

      if (mem.keyEntities.length > 0) {
        lines.push(`**Key Entities:** ${mem.keyEntities.join(', ')}`);
        lines.push('');
      }

      if (mem.decisions && mem.decisions.length > 0) {
        lines.push('**Decisions Made:**');
        for (const decision of mem.decisions) {
          lines.push(`- ${decision}`);
        }
        lines.push('');
      }

      if (mem.openQuestions && mem.openQuestions.length > 0) {
        lines.push('**Open Questions:**');
        for (const question of mem.openQuestions) {
          lines.push(`- ${question}`);
        }
        lines.push('');
      }
    }

    // Recovery instructions
    lines.push('---');
    lines.push('');
    lines.push('*This checkpoint was created to preserve session state.*');
    lines.push('*Review the information above to resume work effectively.*');

    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Public: Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Delete a specific checkpoint
   *
   * @param checkpointId - The checkpoint ID to delete
   * @returns true if deleted successfully
   */
  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    const filepath = join(this.checkpointsDir, `${checkpointId}.json`);

    if (!existsSync(filepath)) {
      return false;
    }

    try {
      unlinkSync(filepath);
      this.log(`Deleted checkpoint ${checkpointId}`);
      return true;
    } catch (error) {
      this.log(`Error deleting checkpoint ${checkpointId}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Clean up old checkpoints for a session, keeping only the most recent
   *
   * @param sessionId - The session ID
   * @returns Number of checkpoints removed
   */
  async cleanupOldCheckpoints(sessionId: string): Promise<number> {
    const checkpoints = await this.listCheckpoints(sessionId);

    if (checkpoints.length <= this.maxCheckpoints) {
      return 0;
    }

    // Remove oldest checkpoints (those beyond the limit)
    const toRemove = checkpoints.slice(this.maxCheckpoints);
    let removed = 0;

    for (const meta of toRemove) {
      if (await this.deleteCheckpoint(meta.id)) {
        removed++;
      }
    }

    this.log(`Cleaned up ${removed} old checkpoints for session ${sessionId}`);
    return removed;
  }

  // ---------------------------------------------------------------------------
  // Public: Utility
  // ---------------------------------------------------------------------------

  /**
   * Get the checkpoints directory path
   */
  getCheckpointsDir(): string {
    return this.checkpointsDir;
  }

  /**
   * Ensure the checkpoints directory exists
   */
  ensureCheckpointsDir(): void {
    if (!existsSync(this.checkpointsDir)) {
      mkdirSync(this.checkpointsDir, { recursive: true });
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Helper Methods
  // ---------------------------------------------------------------------------

  /**
   * Generate a unique checkpoint ID
   */
  private generateCheckpointId(sessionId: string, timestamp: string): string {
    // Format: YYYY-MM-DDTHH-mm-ss-sessionId
    const safeTimestamp = timestamp.replace(/[:.]/g, '-').substring(0, 19);
    return `${safeTimestamp}-${sessionId.substring(0, 8)}`;
  }

  /**
   * Log a message if logging is enabled
   */
  private log(message: string): void {
    if (this.enableLogging) {
      console.log(`[CheckpointService] ${message}`);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a CheckpointService instance
 *
 * @param projectPath - Project root path
 * @param options - Optional configuration
 * @returns CheckpointService instance
 */
export function createCheckpointService(
  projectPath: string,
  options?: Partial<CheckpointServiceOptions>
): CheckpointService {
  return new CheckpointService({
    projectPath,
    ...options
  });
}
