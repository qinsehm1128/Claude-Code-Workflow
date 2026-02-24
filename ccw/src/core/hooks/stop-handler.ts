/**
 * StopHandler - Unified stop hook handler with Soft Enforcement
 *
 * Handles Stop hook events with priority-based checking:
 *   1. context-limit: Always allow stop (deadlock prevention)
 *   2. user-abort: Respect user intent
 *   3. active-workflow: Inject continuation message
 *   4. active-mode: Inject continuation message (uses ModeRegistryService)
 *
 * Design:
 *   - ALWAYS returns continue: true (Soft Enforcement)
 *   - Injects continuation message instead of blocking
 *   - Logs all stop events for debugging
 *   - Integrates with ModeRegistryService for mode state detection
 */

import { isContextLimitStop } from './context-limit-detector.js';
import { isUserAbort, type StopContext } from './user-abort-detector.js';
import type { ExecutionMode } from '../services/mode-registry-service.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Extended stop context with additional fields
 */
export interface ExtendedStopContext extends StopContext {
  /** Session ID */
  session_id?: string;
  /** Session ID (camelCase variant) */
  sessionId?: string;
  /** Project path */
  project_path?: string;
  /** Project path (camelCase variant) */
  projectPath?: string;
  /** Current active mode */
  active_mode?: 'analysis' | 'write' | 'review' | 'auto';
  /** Current active mode (camelCase variant) */
  activeMode?: 'analysis' | 'write' | 'review' | 'auto';
  /** Whether there's an active workflow */
  active_workflow?: boolean;
  /** Whether there's an active workflow (camelCase variant) */
  activeWorkflow?: boolean;
}

/**
 * Result of stop handling
 */
export interface StopResult {
  /** ALWAYS true - we never block stops */
  continue: true;
  /** Optional continuation message to inject */
  message?: string;
  /** Which handler was triggered */
  mode?: 'context-limit' | 'user-abort' | 'active-workflow' | 'active-mode' | 'none';
  /** Additional metadata */
  metadata?: {
    /** Reason for stop (from context) */
    reason?: string;
    /** Whether user requested stop */
    userRequested?: boolean;
    /** Session ID */
    sessionId?: string;
    /** Active mode if any */
    activeMode?: string;
    /** Whether workflow was active */
    activeWorkflow?: boolean;
  };
}

/**
 * Options for StopHandler
 */
export interface StopHandlerOptions {
  /** Whether to enable logging */
  enableLogging?: boolean;
  /** Custom message for workflow continuation */
  workflowContinuationMessage?: string;
  /** Custom message for mode continuation */
  modeContinuationMessage?: string;
  /** Project path for ModeRegistryService */
  projectPath?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Default workflow continuation message */
const DEFAULT_WORKFLOW_MESSAGE = `[WORKFLOW CONTINUATION]
An active workflow is in progress.

If you intended to stop:
- Use explicit cancellation command to exit cleanly
- Otherwise, continue with your workflow tasks

`;

/** Default mode continuation message */
const DEFAULT_MODE_MESSAGE = `[MODE CONTINUATION]
An active mode is set for this session.

Mode: {mode}

Continue with your current task, or use cancellation command to exit.

`;

// =============================================================================
// StopHandler
// =============================================================================

/**
 * Handler for Stop hook events
 *
 * This handler implements Soft Enforcement: it never blocks stops,
 * but injects continuation messages to encourage task completion.
 */
export class StopHandler {
  private enableLogging: boolean;
  private workflowContinuationMessage: string;
  private modeContinuationMessage: string;
  private projectPath?: string;

  constructor(options: StopHandlerOptions = {}) {
    this.enableLogging = options.enableLogging ?? false;
    this.workflowContinuationMessage =
      options.workflowContinuationMessage ?? DEFAULT_WORKFLOW_MESSAGE;
    this.modeContinuationMessage =
      options.modeContinuationMessage ?? DEFAULT_MODE_MESSAGE;
    this.projectPath = options.projectPath;
  }

  // ---------------------------------------------------------------------------
  // Public: Main Handler
  // ---------------------------------------------------------------------------

  /**
   * Handle a stop event
   *
   * Priority order:
   *   1. context-limit: Always allow (deadlock prevention)
   *   2. user-abort: Respect user intent
   *   3. active-workflow: Inject continuation message
   *   4. active-mode: Inject continuation message (via ModeRegistryService)
   *
   * @param context - Stop context from hook event
   * @returns Stop result (always continue: true)
   */
  async handleStop(context?: ExtendedStopContext): Promise<StopResult> {
    this.log('Handling stop event...');

    // Extract common fields with both naming conventions
    const sessionId = context?.session_id ?? context?.sessionId;
    const activeMode = context?.active_mode ?? context?.activeMode;
    const activeWorkflow = context?.active_workflow ?? context?.activeWorkflow;
    const userRequested = context?.user_requested ?? context?.userRequested;

    // Get stop reason
    const reason = context?.stop_reason ?? context?.stopReason ?? '';
    const endTurnReason = context?.end_turn_reason ?? context?.endTurnReason ?? '';
    const fullReason = `${reason} ${endTurnReason}`.trim();

    this.log(`Context: sessionId=${sessionId}, reason="${fullReason}", userRequested=${userRequested}`);

    // Priority 1: Context Limit - CRITICAL: Never block
    // Blocking context-limit stops causes deadlock (can't compact if can't stop)
    if (isContextLimitStop(context)) {
      this.log('Context limit detected - allowing stop');
      return {
        continue: true,
        mode: 'context-limit',
        metadata: {
          reason: fullReason,
          sessionId,
          userRequested
        }
      };
    }

    // Priority 2: User Abort - Respect user intent
    if (isUserAbort(context)) {
      this.log('User abort detected - respecting user intent');
      return {
        continue: true,
        mode: 'user-abort',
        metadata: {
          reason: fullReason,
          userRequested: true,
          sessionId
        }
      };
    }

    // Priority 3: Active Workflow - Inject continuation message
    if (activeWorkflow) {
      this.log('Active workflow detected - injecting continuation message');
      return {
        continue: true,
        message: this.workflowContinuationMessage,
        mode: 'active-workflow',
        metadata: {
          reason: fullReason,
          sessionId,
          activeWorkflow: true
        }
      };
    }

    // Priority 4: Active Mode - Check via ModeRegistryService
    if (this.projectPath && sessionId) {
      try {
        const { ModeRegistryService } = await import('../services/mode-registry-service.js');
        const modeRegistry = new ModeRegistryService({
          projectPath: this.projectPath,
          enableLogging: this.enableLogging
        });

        const activeModes = modeRegistry.getActiveModes(sessionId);
        if (activeModes.length > 0) {
          const primaryMode = activeModes[0];
          const modeConfig = (await import('../services/mode-registry-service.js')).MODE_CONFIGS[primaryMode];
          const modeName = modeConfig?.name ?? primaryMode;

          this.log(`Active mode "${modeName}" detected via ModeRegistryService - injecting continuation message`);
          const message = this.modeContinuationMessage.replace('{mode}', modeName);
          return {
            continue: true,
            message,
            mode: 'active-mode',
            metadata: {
              reason: fullReason,
              sessionId,
              activeMode: primaryMode
            }
          };
        }
      } catch (error) {
        this.log(`Error checking mode registry: ${(error as Error).message}`);
        // Fall through to check context-based active mode
      }
    }

    // Fallback: Check active mode from context
    if (activeMode) {
      this.log(`Active mode "${activeMode}" detected from context - injecting continuation message`);
      const message = this.modeContinuationMessage.replace('{mode}', String(activeMode));
      return {
        continue: true,
        message,
        mode: 'active-mode',
        metadata: {
          reason: fullReason,
          sessionId,
          activeMode: String(activeMode)
        }
      };
    }

    // Default: No special handling needed
    this.log('No special handling needed - allowing stop');
    return {
      continue: true,
      mode: 'none',
      metadata: {
        reason: fullReason,
        sessionId,
        userRequested
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Public: Utility Methods
  // ---------------------------------------------------------------------------

  /**
   * Check if a stop should trigger continuation message
   *
   * @param context - Stop context
   * @returns true if continuation message should be injected
   */
  async shouldInjectContinuation(context?: ExtendedStopContext): Promise<boolean> {
    // Context limit and user abort don't get continuation
    if (isContextLimitStop(context) || isUserAbort(context)) {
      return false;
    }

    // Active workflow gets continuation
    const activeWorkflow = context?.active_workflow ?? context?.activeWorkflow;
    if (activeWorkflow) {
      return true;
    }

    // Check via ModeRegistryService if projectPath is available
    const sessionId = context?.session_id ?? context?.sessionId;
    if (this.projectPath && sessionId) {
      try {
        const { ModeRegistryService } = await import('../services/mode-registry-service.js');
        const modeRegistry = new ModeRegistryService({
          projectPath: this.projectPath,
          enableLogging: false
        });

        if (modeRegistry.isAnyModeActive(sessionId)) {
          return true;
        }
      } catch {
        // Fall through to context-based check
      }
    }

    // Fallback: Check active mode from context
    const activeMode = context?.active_mode ?? context?.activeMode;
    return Boolean(activeMode);
  }

  /**
   * Get the stop reason from context
   *
   * @param context - Stop context
   * @returns Normalized stop reason
   */
  getStopReason(context?: ExtendedStopContext): string {
    const reason = context?.stop_reason ?? context?.stopReason ?? '';
    const endTurnReason = context?.end_turn_reason ?? context?.endTurnReason ?? '';
    return `${reason} ${endTurnReason}`.trim() || 'unknown';
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
      console.log(`[StopHandler ${timestamp}] ${message}`);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a StopHandler instance
 *
 * @param options - Handler options
 * @returns StopHandler instance
 */
export function createStopHandler(options?: StopHandlerOptions): StopHandler {
  return new StopHandler(options);
}

// =============================================================================
// Default Export
// =============================================================================

/** Default StopHandler instance */
export const defaultStopHandler = new StopHandler();
