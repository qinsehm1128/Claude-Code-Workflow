/**
 * RecoveryHandler - Session Recovery and PreCompact Handler
 *
 * Handles PreCompact hook events and session recovery for state preservation
 * during context compaction and session restarts.
 *
 * Features:
 *   - PreCompact checkpoint creation before context compaction
 *   - Session recovery detection and message injection
 *   - Mutex lock to prevent concurrent compaction operations
 *
 * Based on oh-my-claudecode pre-compact pattern.
 */

import type { Checkpoint, CheckpointTrigger } from '../services/checkpoint-service.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Input from PreCompact hook event
 */
export interface PreCompactInput {
  /** Session ID */
  session_id: string;
  /** Path to transcript file */
  transcript_path?: string;
  /** Current working directory */
  cwd: string;
  /** Permission mode */
  permission_mode?: string;
  /** Hook event name */
  hook_event_name: 'PreCompact';
  /** Trigger type */
  trigger: 'manual' | 'auto';
  /** Custom instructions */
  custom_instructions?: string;
}

/**
 * Output for hook handlers
 */
export interface HookOutput {
  /** Whether to continue with the operation */
  continue: boolean;
  /** System message for context injection */
  systemMessage?: string;
}

/**
 * Options for RecoveryHandler
 */
export interface RecoveryHandlerOptions {
  /** Project root path */
  projectPath: string;
  /** Enable logging */
  enableLogging?: boolean;
}

// =============================================================================
// Compaction Mutex
// =============================================================================

/**
 * Per-directory in-flight compaction promises.
 * When a compaction is already running for a directory, new callers
 * await the existing promise instead of running concurrently.
 * This prevents race conditions when multiple subagent results
 * arrive simultaneously (swarm/ultrawork).
 */
const inflightCompactions = new Map<string, Promise<HookOutput>>();

/**
 * Queue depth counter per directory for diagnostics.
 * Tracks how many callers are waiting on an in-flight compaction.
 */
const compactionQueueDepth = new Map<string, number>();

// =============================================================================
// RecoveryHandler Class
// =============================================================================

/**
 * Handler for PreCompact hook events and session recovery
 */
export class RecoveryHandler {
  private projectPath: string;
  private enableLogging: boolean;

  constructor(options: RecoveryHandlerOptions) {
    this.projectPath = options.projectPath;
    this.enableLogging = options.enableLogging ?? false;
  }

  // ---------------------------------------------------------------------------
  // Public: PreCompact Handler
  // ---------------------------------------------------------------------------

  /**
   * Handle PreCompact hook event
   *
   * Creates a checkpoint before compaction to preserve state.
   * Uses mutex to prevent concurrent compaction for the same directory.
   *
   * @param input - PreCompact hook input
   * @returns Promise resolving to hook output with checkpoint summary
   */
  async handlePreCompact(input: PreCompactInput): Promise<HookOutput> {
    const directory = input.cwd || this.projectPath;

    // Check for in-flight compaction
    const inflight = inflightCompactions.get(directory);
    if (inflight) {
      const depth = (compactionQueueDepth.get(directory) ?? 0) + 1;
      compactionQueueDepth.set(directory, depth);
      try {
        // Await the existing compaction result
        return await inflight;
      } finally {
        const current = compactionQueueDepth.get(directory) ?? 1;
        if (current <= 1) {
          compactionQueueDepth.delete(directory);
        } else {
          compactionQueueDepth.set(directory, current - 1);
        }
      }
    }

    // No in-flight compaction - run it and register the promise
    const compactionPromise = this.doHandlePreCompact(input);
    inflightCompactions.set(directory, compactionPromise);

    try {
      return await compactionPromise;
    } finally {
      inflightCompactions.delete(directory);
    }
  }

  /**
   * Internal PreCompact handler (unserialized)
   */
  private async doHandlePreCompact(input: PreCompactInput): Promise<HookOutput> {
    this.log(`Creating checkpoint for session ${input.session_id} (trigger: ${input.trigger})`);

    try {
      // Import services dynamically
      const { CheckpointService } = await import('../services/checkpoint-service.js');
      const { ModeRegistryService } = await import('../services/mode-registry-service.js');

      // Create checkpoint service
      const checkpointService = new CheckpointService({
        projectPath: this.projectPath,
        enableLogging: this.enableLogging
      });

      // Get mode registry for active modes
      const modeRegistry = new ModeRegistryService({
        projectPath: this.projectPath,
        enableLogging: this.enableLogging
      });

      // Collect active mode states
      const activeModes = modeRegistry.getActiveModes(input.session_id);
      const modeStates: Record<string, { active: boolean; phase?: string; activatedAt?: string }> = {};

      for (const mode of activeModes) {
        modeStates[mode] = {
          active: true,
          activatedAt: new Date().toISOString()
        };
      }

      // Create checkpoint
      const trigger: CheckpointTrigger = input.trigger === 'manual' ? 'manual' : 'compact';
      const checkpoint = await checkpointService.createCheckpoint(
        input.session_id,
        trigger,
        {
          modeStates: modeStates as any,
          workflowState: null,
          memoryContext: null
        }
      );

      // Save checkpoint
      await checkpointService.saveCheckpoint(checkpoint);

      // Format recovery message
      const systemMessage = checkpointService.formatRecoveryMessage(checkpoint);

      this.log(`Checkpoint created: ${checkpoint.id}`);

      return {
        continue: true,
        systemMessage
      };
    } catch (error) {
      this.log(`Error creating checkpoint: ${(error as Error).message}`);

      // Return success even on error - don't block compaction
      return {
        continue: true,
        systemMessage: `[PRECOMPACT WARNING] Checkpoint creation failed: ${(error as Error).message}. Proceeding with compaction.`
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Public: Recovery Detection
  // ---------------------------------------------------------------------------

  /**
   * Check for recoverable checkpoint for a session
   *
   * @param sessionId - The session ID to check
   * @returns The most recent checkpoint or null if none found
   */
  async checkRecovery(sessionId: string): Promise<Checkpoint | null> {
    try {
      const { CheckpointService } = await import('../services/checkpoint-service.js');

      const checkpointService = new CheckpointService({
        projectPath: this.projectPath,
        enableLogging: this.enableLogging
      });

      const checkpoint = await checkpointService.getLatestCheckpoint(sessionId);

      if (checkpoint) {
        this.log(`Found recoverable checkpoint: ${checkpoint.id} (trigger: ${checkpoint.trigger})`);
      }

      return checkpoint;
    } catch (error) {
      this.log(`Error checking recovery: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Generate recovery message for context injection
   *
   * @param checkpoint - The checkpoint to format
   * @returns Formatted recovery message
   */
  async formatRecoveryMessage(checkpoint: Checkpoint): Promise<string> {
    try {
      const { CheckpointService } = await import('../services/checkpoint-service.js');

      const checkpointService = new CheckpointService({
        projectPath: this.projectPath,
        enableLogging: false
      });

      return checkpointService.formatRecoveryMessage(checkpoint);
    } catch (error) {
      // Fallback to basic format
      return `# Session Recovery

**Checkpoint ID:** ${checkpoint.id}
**Created:** ${checkpoint.created_at}
**Trigger:** ${checkpoint.trigger}
**Session:** ${checkpoint.session_id}

*This checkpoint was created to preserve session state.*`;
    }
  }

  // ---------------------------------------------------------------------------
  // Public: Mutex Status
  // ---------------------------------------------------------------------------

  /**
   * Check if compaction is currently in progress for a directory
   *
   * @param directory - The directory to check
   * @returns true if compaction is in progress
   */
  isCompactionInProgress(directory: string): boolean {
    return inflightCompactions.has(directory);
  }

  /**
   * Get the number of callers queued behind an in-flight compaction
   *
   * @param directory - The directory to check
   * @returns Number of queued callers (0 if no compaction in progress)
   */
  getCompactionQueueDepth(directory: string): number {
    return compactionQueueDepth.get(directory) ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Private: Utility Methods
  // ---------------------------------------------------------------------------

  /**
   * Log a message if logging is enabled
   */
  private log(message: string): void {
    if (this.enableLogging) {
      const timestamp = new Date().toISOString();
      console.log(`[RecoveryHandler ${timestamp}] ${message}`);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a RecoveryHandler instance
 *
 * @param options - Handler options
 * @returns RecoveryHandler instance
 */
export function createRecoveryHandler(options: RecoveryHandlerOptions): RecoveryHandler {
  return new RecoveryHandler(options);
}

// =============================================================================
// Default Export
// =============================================================================

export default RecoveryHandler;
