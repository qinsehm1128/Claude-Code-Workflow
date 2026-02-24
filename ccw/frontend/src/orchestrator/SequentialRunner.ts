// ========================================
// Sequential Runner
// ========================================
// Manages PTY session lifecycle and step-by-step command dispatch for
// orchestration plans. Creates/reuses CLI sessions and dispatches
// steps sequentially, resolving runtime variables between steps.
//
// Integration pattern:
//   1. SequentialRunner.start() -> dispatches first step
//   2. WebSocket CLI_COMPLETED -> useCompletionCallbackChain -> store update
//   3. Store subscription detects step completion -> executeStep(nextStepId)
//   4. Repeat until all steps complete
//
// Uses store subscription (Option B) for clean separation between
// the callback chain (which updates the store) and the runner
// (which reacts to store changes by dispatching the next step).

import type { OrchestrationPlan } from '../types/orchestrator';
import { dispatch } from '../lib/unifiedExecutionDispatcher';
import type { DispatchOptions } from '../lib/unifiedExecutionDispatcher';
import { createCliSession } from '../lib/api';
import { useOrchestratorStore } from '../stores/orchestratorStore';
import type { OrchestrationRunState, StepRunState } from '../stores/orchestratorStore';

// ========== Types ==========

/** Configuration options for starting an orchestration plan */
export interface StartOptions {
  /** Working directory for session creation */
  workingDir?: string;
  /** Project path for API routing */
  projectPath?: string;
  /** Execution category for tracking */
  category?: DispatchOptions['category'];
}

/** Tracks active subscriptions per plan for cleanup */
interface PlanSubscription {
  /** Zustand unsubscribe function */
  unsubscribe: () => void;
  /** The plan ID being tracked */
  planId: string;
  /** Set of step IDs that have already been dispatched (prevents double-dispatch) */
  dispatchedSteps: Set<string>;
  /** Options passed at start() for reuse during step dispatches */
  options: StartOptions;
}

// ========== Module State ==========

/** Active subscriptions keyed by plan ID */
const activeSubscriptions = new Map<string, PlanSubscription>();

// ========== Public API ==========

/**
 * Start executing an orchestration plan.
 *
 * 1. Registers the plan in the orchestratorStore
 * 2. Creates a new CLI session if needed (based on plan's defaultSessionStrategy)
 * 3. Subscribes to store changes for automated step advancement
 * 4. Dispatches the first ready step
 *
 * @param plan - The orchestration plan to execute
 * @param sessionKey - Optional existing session key to reuse
 * @param options - Additional options for session creation and dispatch
 */
export async function start(
  plan: OrchestrationPlan,
  sessionKey?: string,
  options: StartOptions = {}
): Promise<void> {
  const store = useOrchestratorStore.getState();

  // Clean up any existing subscription for this plan
  stop(plan.id);

  // Resolve session key
  let resolvedSessionKey = sessionKey;
  if (!resolvedSessionKey && plan.defaultSessionStrategy === 'new_session') {
    const result = await createCliSession(
      {
        workingDir: options.workingDir,
        tool: plan.steps[0]?.tool,
      },
      options.projectPath
    );
    resolvedSessionKey = result.session.sessionKey;
  }

  // Initialize plan in the store
  store.startOrchestration(plan, resolvedSessionKey);

  // Subscribe to store changes for automated step advancement
  const subscription = subscribeToStepAdvancement(plan.id, options);
  activeSubscriptions.set(plan.id, subscription);

  // Dispatch the first ready step
  const firstStepId = store.getNextReadyStep(plan.id);
  if (firstStepId) {
    subscription.dispatchedSteps.add(firstStepId);
    await executeStep(plan.id, firstStepId, options);
  }
}

/**
 * Execute a specific step within a plan.
 *
 * 1. Resolves runtime variables in the step instruction
 * 2. Resolves contextRefs from previous step outputs
 * 3. Updates step status to 'running'
 * 4. Dispatches execution via UnifiedExecutionDispatcher
 * 5. Registers the executionId for callback chain matching
 *
 * @param planId - The plan containing the step
 * @param stepId - The step to execute
 * @param options - Dispatch options (workingDir, projectPath, etc.)
 */
export async function executeStep(
  planId: string,
  stepId: string,
  options: StartOptions = {}
): Promise<void> {
  const store = useOrchestratorStore.getState();
  const runState = store.activePlans[planId];
  if (!runState) {
    console.error(`[SequentialRunner] Plan "${planId}" not found in store`);
    return;
  }

  // Find the step definition
  const step = runState.plan.steps.find((s) => s.id === stepId);
  if (!step) {
    console.error(`[SequentialRunner] Step "${stepId}" not found in plan "${planId}"`);
    return;
  }

  // Collect previous step outputs for variable interpolation
  const stepOutputs = collectStepOutputs(runState);

  // Resolve runtime variables in the instruction
  const resolvedInstruction = interpolateInstruction(
    step.instruction,
    runState.plan.variables,
    stepOutputs
  );

  // Resolve contextRefs - append previous step outputs as context
  const contextSuffix = resolveContextRefs(step.contextRefs, stepOutputs);
  const finalInstruction = contextSuffix
    ? `${resolvedInstruction}\n\n--- Context from previous steps ---\n${contextSuffix}`
    : resolvedInstruction;

  // Create a modified step with the resolved instruction for dispatch
  const resolvedStep = { ...step, instruction: finalInstruction };

  // Mark step as running
  store.updateStepStatus(planId, stepId, 'running');

  try {
    // Dispatch via UnifiedExecutionDispatcher
    const result = await dispatch(resolvedStep, runState.sessionKey ?? '', {
      workingDir: options.workingDir,
      projectPath: options.projectPath,
      category: options.category,
      resumeKey: step.resumeKey,
    });

    // Register executionId for callback chain matching
    store.registerExecution(planId, stepId, result.executionId);

    // If dispatch created a new session and plan had no session, update the run state
    if (result.isNewSession && !runState.sessionKey) {
      // Update session key on the run state by re-reading store
      // The session key is now tracked on the dispatch result
      // Future steps in this plan will use this session via the store's sessionKey
      const currentState = useOrchestratorStore.getState();
      const currentRunState = currentState.activePlans[planId];
      if (currentRunState && !currentRunState.sessionKey) {
        // The store does not expose a setSessionKey action, so we rely on
        // the dispatch result's sessionKey being used by subsequent steps.
        // This is handled by resolveSessionKey in the dispatcher using
        // the step's sessionStrategy or reuse_default with the plan's sessionKey.
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[SequentialRunner] Failed to dispatch step "${stepId}":`, errorMessage);
    store.updateStepStatus(planId, stepId, 'failed', { error: errorMessage });
    // Error handling (pause/skip/stop) is handled by useCompletionCallbackChain
    // but since this is a dispatch failure (not a CLI completion failure),
    // we need to apply error handling here too
    applyDispatchErrorHandling(planId, stepId);
  }
}

/**
 * Called when _advanceToNextStep identifies a next step.
 * If nextStepId is not null, dispatches execution for that step.
 * If null, orchestration is complete (store already updated).
 *
 * @param planId - The plan ID
 * @param nextStepId - The next step to execute, or null if complete
 * @param options - Dispatch options
 */
export async function onStepAdvanced(
  planId: string,
  nextStepId: string | null,
  options: StartOptions = {}
): Promise<void> {
  if (nextStepId) {
    await executeStep(planId, nextStepId, options);
  }
  // If null, orchestration is complete - store already updated by _advanceToNextStep
}

/**
 * Stop tracking a plan and clean up its store subscription.
 *
 * @param planId - The plan to stop tracking
 */
export function stop(planId: string): void {
  const subscription = activeSubscriptions.get(planId);
  if (subscription) {
    subscription.unsubscribe();
    activeSubscriptions.delete(planId);
  }
}

/**
 * Stop all active plan subscriptions.
 */
export function stopAll(): void {
  for (const [planId] of activeSubscriptions) {
    stop(planId);
  }
}

// ========== Variable Interpolation ==========

/**
 * Replace {{variableName}} placeholders in an instruction string with
 * values from the plan variables and previous step outputs.
 *
 * Supports:
 * - Simple replacement: {{variableName}} -> value from variables map
 * - Step output reference: {{stepOutputName}} -> value from step outputs
 * - Nested dot-notation: {{step1.output.field}} -> nested property access
 *
 * @param instruction - The instruction template string
 * @param variables - Plan-level variables
 * @param stepOutputs - Collected outputs from completed steps
 * @returns The interpolated instruction string
 */
export function interpolateInstruction(
  instruction: string,
  variables: Record<string, unknown>,
  stepOutputs: Record<string, unknown>
): string {
  return instruction.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const trimmedKey = key.trim();

    // Try plan variables first (simple key)
    if (trimmedKey in variables) {
      return formatValue(variables[trimmedKey]);
    }

    // Try step outputs (simple key)
    if (trimmedKey in stepOutputs) {
      return formatValue(stepOutputs[trimmedKey]);
    }

    // Try nested dot-notation in step outputs
    const nestedValue = resolveNestedPath(trimmedKey, stepOutputs);
    if (nestedValue !== undefined) {
      return formatValue(nestedValue);
    }

    // Try nested dot-notation in plan variables
    const nestedVarValue = resolveNestedPath(trimmedKey, variables);
    if (nestedVarValue !== undefined) {
      return formatValue(nestedVarValue);
    }

    // Unresolved placeholder - leave as-is
    return `{{${trimmedKey}}}`;
  });
}

// ========== Internal Helpers ==========

/**
 * Subscribe to orchestratorStore changes for a specific plan.
 * When a step transitions to 'completed' or 'skipped', check if there is
 * a new ready step and dispatch it.
 *
 * This implements Option B (store subscription) for clean separation
 * between the callback chain (store updates) and the runner (step dispatch).
 */
function subscribeToStepAdvancement(
  planId: string,
  options: StartOptions
): PlanSubscription {
  const dispatchedSteps = new Set<string>();

  // Track previous step statuses to detect transitions
  let previousStatuses: Record<string, StepRunState> | undefined;

  const unsubscribe = useOrchestratorStore.subscribe((state) => {
    const runState = state.activePlans[planId];
    if (!runState || runState.status !== 'running') return;

    const currentStatuses = runState.stepStatuses;

    // On first call, just capture the initial state
    if (!previousStatuses) {
      previousStatuses = currentStatuses;
      return;
    }

    // Detect if any step just transitioned to a terminal state (completed/skipped)
    let hasNewCompletion = false;
    for (const [stepId, stepState] of Object.entries(currentStatuses)) {
      const prevState = previousStatuses[stepId];
      if (!prevState) continue;

      const wasTerminal =
        prevState.status === 'completed' || prevState.status === 'skipped';
      const isTerminal =
        stepState.status === 'completed' || stepState.status === 'skipped';

      if (!wasTerminal && isTerminal) {
        hasNewCompletion = true;
        break;
      }
    }

    previousStatuses = currentStatuses;

    if (!hasNewCompletion) return;

    // A step just completed - check if _advanceToNextStep was already called
    // (by useCompletionCallbackChain). We detect the next ready step.
    const store = useOrchestratorStore.getState();
    const nextStepId = store.getNextReadyStep(planId);

    if (nextStepId && !dispatchedSteps.has(nextStepId)) {
      dispatchedSteps.add(nextStepId);
      // Dispatch asynchronously to avoid blocking the subscription callback
      onStepAdvanced(planId, nextStepId, options).catch((err) => {
        console.error(
          `[SequentialRunner] Failed to advance to step "${nextStepId}":`,
          err
        );
      });
    }
  });

  return {
    unsubscribe,
    planId,
    dispatchedSteps,
    options,
  };
}

/**
 * Collect output results from completed steps, keyed by outputName.
 */
function collectStepOutputs(
  runState: OrchestrationRunState
): Record<string, unknown> {
  const outputs: Record<string, unknown> = {};

  for (const step of runState.plan.steps) {
    if (!step.outputName) continue;

    const stepState = runState.stepStatuses[step.id];
    if (stepState && (stepState.status === 'completed' || stepState.status === 'skipped')) {
      outputs[step.outputName] = stepState.result;
    }
  }

  return outputs;
}

/**
 * Resolve contextRefs by looking up output values from previous steps
 * and formatting them as a context string to append to the instruction.
 */
function resolveContextRefs(
  contextRefs: string[] | undefined,
  stepOutputs: Record<string, unknown>
): string {
  if (!contextRefs || contextRefs.length === 0) return '';

  const parts: string[] = [];

  for (const ref of contextRefs) {
    const value = stepOutputs[ref];
    if (value !== undefined) {
      parts.push(`[${ref}]:\n${formatValue(value)}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Resolve a dot-notation path against an object.
 * E.g., "step1.output.field" resolves by traversing the nested structure.
 */
function resolveNestedPath(
  path: string,
  obj: Record<string, unknown>
): unknown | undefined {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Format a value for insertion into an instruction string.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // For objects/arrays, produce a JSON string
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Apply error handling for dispatch-level failures (not CLI completion failures).
 * This mirrors the error handling in useCompletionCallbackChain but is needed
 * when the dispatch itself fails before a CLI execution starts.
 */
function applyDispatchErrorHandling(planId: string, stepId: string): void {
  const store = useOrchestratorStore.getState();
  const runState = store.activePlans[planId];
  if (!runState) return;

  const stepDef = runState.plan.steps.find((s) => s.id === stepId);
  const strategy =
    stepDef?.errorHandling?.strategy ??
    runState.plan.defaultErrorHandling.strategy ??
    'pause_on_error';

  switch (strategy) {
    case 'pause_on_error':
      store.pauseOrchestration(planId);
      break;
    case 'skip':
      store.skipStep(planId, stepId);
      store._advanceToNextStep(planId);
      break;
    case 'stop':
      store.stopOrchestration(
        planId,
        `Dispatch failed for step "${stepId}"`
      );
      break;
    default:
      store.pauseOrchestration(planId);
      break;
  }
}
