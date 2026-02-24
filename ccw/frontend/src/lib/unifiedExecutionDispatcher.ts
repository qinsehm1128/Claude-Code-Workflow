// ========================================
// Unified Execution Dispatcher
// ========================================
// Stateless dispatcher that resolves session strategy and dispatches
// OrchestrationStep execution to the CLI session API.

import type { OrchestrationStep, SessionStrategy } from '../types/orchestrator';
import { createCliSession, executeInCliSession } from './api';
import type { ExecuteInCliSessionInput } from './api';

// ========== Types ==========

/**
 * Options for dispatch execution.
 * These supplement the step's own configuration with runtime context.
 */
export interface DispatchOptions {
  /** Working directory for the CLI session (used when creating new sessions). */
  workingDir?: string;
  /** Execution category for tracking/filtering. */
  category?: ExecuteInCliSessionInput['category'];
  /** Resume key for session continuity. */
  resumeKey?: string;
  /** Resume strategy for the CLI execution. */
  resumeStrategy?: ExecuteInCliSessionInput['resumeStrategy'];
  /** Project path for API routing. */
  projectPath?: string;
}

/**
 * Result of a dispatched execution.
 * Provides the execution ID for callback registration and the resolved session key.
 */
export interface DispatchResult {
  /** Unique execution ID returned by the API, used for tracking and callback chains. */
  executionId: string;
  /** The session key used for execution (may differ from input if strategy created a new session). */
  sessionKey: string;
  /** Whether a new CLI session was created for this dispatch. */
  isNewSession: boolean;
}

// ========== Session Strategy Resolution ==========

interface ResolvedSession {
  sessionKey: string;
  isNewSession: boolean;
}

/**
 * Resolve the session key based on the step's session strategy.
 *
 * - 'reuse_default': Use the provided defaultSessionKey directly.
 * - 'new_session': Create a new PTY session via the API.
 * - 'specific_session': Use the step's targetSessionKey (must be provided).
 */
async function resolveSessionKey(
  strategy: SessionStrategy,
  defaultSessionKey: string,
  step: OrchestrationStep,
  options: DispatchOptions
): Promise<ResolvedSession> {
  switch (strategy) {
    case 'reuse_default':
      return { sessionKey: defaultSessionKey, isNewSession: false };

    case 'new_session': {
      const result = await createCliSession(
        {
          workingDir: options.workingDir,
          tool: step.tool,
        },
        options.projectPath
      );
      return { sessionKey: result.session.sessionKey, isNewSession: true };
    }

    case 'specific_session': {
      const targetKey = step.targetSessionKey;
      if (!targetKey) {
        throw new DispatchError(
          `Step "${step.id}" uses 'specific_session' strategy but no targetSessionKey is provided.`,
          'MISSING_TARGET_SESSION_KEY'
        );
      }
      return { sessionKey: targetKey, isNewSession: false };
    }

    default:
      throw new DispatchError(
        `Unknown session strategy: "${strategy}" on step "${step.id}".`,
        'UNKNOWN_SESSION_STRATEGY'
      );
  }
}

// ========== Error Type ==========

/**
 * Typed error for dispatch failures with an error code for programmatic handling.
 */
export class DispatchError extends Error {
  constructor(
    message: string,
    public readonly code: DispatchErrorCode
  ) {
    super(message);
    this.name = 'DispatchError';
  }
}

export type DispatchErrorCode =
  | 'MISSING_TARGET_SESSION_KEY'
  | 'UNKNOWN_SESSION_STRATEGY'
  | 'SESSION_CREATION_FAILED'
  | 'EXECUTION_FAILED';

// ========== Dispatcher ==========

/**
 * Dispatch an orchestration step for execution in a CLI session.
 *
 * This is a stateless utility function that:
 * 1. Resolves the session key based on the step's sessionStrategy.
 * 2. Calls executeInCliSession() with the resolved session and step parameters.
 * 3. Returns the executionId for callback chain registration.
 *
 * @param step - The orchestration step to execute.
 * @param sessionKey - The default session key (used when strategy is 'reuse_default').
 * @param options - Additional dispatch options.
 * @returns The dispatch result containing executionId and resolved sessionKey.
 * @throws {DispatchError} When session resolution or execution fails.
 */
export async function dispatch(
  step: OrchestrationStep,
  sessionKey: string,
  options: DispatchOptions = {}
): Promise<DispatchResult> {
  const strategy: SessionStrategy = step.sessionStrategy ?? 'reuse_default';

  // Step 1: Resolve session key
  let resolved: ResolvedSession;
  try {
    resolved = await resolveSessionKey(strategy, sessionKey, step, options);
  } catch (err) {
    if (err instanceof DispatchError) throw err;
    throw new DispatchError(
      `Failed to resolve session for step "${step.id}": ${err instanceof Error ? err.message : String(err)}`,
      'SESSION_CREATION_FAILED'
    );
  }

  // Step 2: Build execution input from step + options
  const executionInput: ExecuteInCliSessionInput = {
    tool: step.tool ?? 'gemini',
    prompt: step.instruction,
    mode: mapExecutionMode(step.mode),
    workingDir: options.workingDir,
    category: options.category,
    resumeKey: options.resumeKey ?? step.resumeKey,
    resumeStrategy: options.resumeStrategy,
    instructionType: step.instructionType,
    skillName: step.skillName,
  };

  // Step 3: Execute in the resolved session
  try {
    const result = await executeInCliSession(
      resolved.sessionKey,
      executionInput,
      options.projectPath
    );

    return {
      executionId: result.executionId,
      sessionKey: resolved.sessionKey,
      isNewSession: resolved.isNewSession,
    };
  } catch (err) {
    throw new DispatchError(
      `Execution failed for step "${step.id}" in session "${resolved.sessionKey}": ${err instanceof Error ? err.message : String(err)}`,
      'EXECUTION_FAILED'
    );
  }
}

/**
 * Map the orchestrator's ExecutionMode to the API's mode parameter.
 * The API accepts 'analysis' | 'write' | 'auto', while the orchestrator
 * uses a broader set including 'mainprocess' and 'async'.
 */
function mapExecutionMode(
  mode?: OrchestrationStep['mode']
): ExecuteInCliSessionInput['mode'] {
  if (!mode) return undefined;
  switch (mode) {
    case 'analysis':
      return 'analysis';
    case 'write':
      return 'write';
    default:
      // 'mainprocess', 'async', and any future modes default to 'auto'
      return 'auto';
  }
}
