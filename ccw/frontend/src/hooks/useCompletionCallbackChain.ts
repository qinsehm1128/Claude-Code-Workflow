// ========================================
// useCompletionCallbackChain Hook
// ========================================
// Watches for WebSocket CLI_COMPLETED and CLI_ERROR events and connects
// them to the orchestratorStore for automated step advancement.
//
// This hook bridges the WebSocket event layer with the orchestration
// state machine, enabling the feedback loop:
//   CLI execution completes -> WebSocket event -> store update -> next step
//
// Usage: Mount this hook once at the App level to enable callback chain processing.

import { useEffect } from 'react';
import { useNotificationStore } from '@/stores';
import { useOrchestratorStore } from '@/stores/orchestratorStore';
import type { WebSocketMessage } from '@/types/store';
import type { ErrorHandlingStrategy } from '@/types/orchestrator';

// ========== Payload Types ==========

interface CliCompletedPayload {
  executionId: string;
  success: boolean;
  duration?: number;
  result?: unknown;
}

interface CliErrorPayload {
  executionId: string;
  error: string;
  exitCode?: number;
}

// ========== Hook ==========

/**
 * Hook that subscribes to WebSocket completion events and updates
 * the orchestratorStore accordingly. Enables automated step advancement
 * by connecting CLI execution results to the orchestration state machine.
 *
 * On CLI_COMPLETED:
 *   1. Look up executionId in all active plans' executionIdMap
 *   2. Call updateStepStatus(planId, stepId, 'completed')
 *   3. Call _advanceToNextStep(planId) to identify the next ready step
 *
 * On CLI_ERROR / CLI_COMPLETED with success=false:
 *   1. Look up executionId in all active plans' executionIdMap
 *   2. Call updateStepStatus(planId, stepId, 'failed', error)
 *   3. Apply error handling strategy from the step or plan defaults
 */
export function useCompletionCallbackChain(): void {
  const wsLastMessage = useNotificationStore((state) => state.wsLastMessage);

  useEffect(() => {
    if (!wsLastMessage) return;

    const { type, payload } = wsLastMessage as WebSocketMessage & {
      payload?: unknown;
    };

    // Only process CLI completion/error events
    if (type !== 'CLI_COMPLETED' && type !== 'CLI_ERROR') return;

    // Access store state directly (zustand pattern for non-rendering access)
    const store = useOrchestratorStore.getState();

    if (type === 'CLI_COMPLETED') {
      handleCliCompleted(store, payload as CliCompletedPayload | undefined);
    } else if (type === 'CLI_ERROR') {
      handleCliError(store, payload as CliErrorPayload | undefined);
    }
  }, [wsLastMessage]);
}

// ========== Event Handlers ==========

function handleCliCompleted(
  store: ReturnType<typeof useOrchestratorStore.getState>,
  payload: CliCompletedPayload | undefined
): void {
  if (!payload?.executionId) return;

  const { executionId, success, result } = payload;

  // Find which plan/step this execution belongs to
  const match = findPlanStepByExecutionId(store, executionId);
  if (!match) return; // Not an orchestrated execution

  const { planId, stepId } = match;

  if (success) {
    // Step completed successfully
    store.updateStepStatus(planId, stepId, 'completed', { data: result });
    // Advance to the next ready step (does not execute, only identifies)
    store._advanceToNextStep(planId);
  } else {
    // CLI_COMPLETED with success=false is treated as a failure
    handleStepFailure(store, planId, stepId, 'CLI execution completed with failure status');
  }
}

function handleCliError(
  store: ReturnType<typeof useOrchestratorStore.getState>,
  payload: CliErrorPayload | undefined
): void {
  if (!payload?.executionId) return;

  const { executionId, error } = payload;

  // Find which plan/step this execution belongs to
  const match = findPlanStepByExecutionId(store, executionId);
  if (!match) return; // Not an orchestrated execution

  const { planId, stepId } = match;
  handleStepFailure(store, planId, stepId, error);
}

// ========== Helpers ==========

/**
 * Look up which plan and step an executionId belongs to by scanning
 * all active plans' executionIdMap.
 */
function findPlanStepByExecutionId(
  store: ReturnType<typeof useOrchestratorStore.getState>,
  executionId: string
): { planId: string; stepId: string } | undefined {
  for (const [planId, runState] of Object.entries(store.activePlans)) {
    const stepId = runState.executionIdMap[executionId];
    if (stepId) {
      return { planId, stepId };
    }
  }
  return undefined;
}

/**
 * Resolve the effective error handling strategy for a step.
 * Step-level errorHandling overrides plan-level defaults.
 */
function getEffectiveErrorStrategy(
  store: ReturnType<typeof useOrchestratorStore.getState>,
  planId: string,
  stepId: string
): ErrorHandlingStrategy {
  const runState = store.activePlans[planId];
  if (!runState) return 'pause_on_error';

  // Find the step definition
  const stepDef = runState.plan.steps.find((s) => s.id === stepId);

  // Step-level strategy overrides plan-level default
  return (
    stepDef?.errorHandling?.strategy ??
    runState.plan.defaultErrorHandling.strategy ??
    'pause_on_error'
  );
}

/**
 * Handle step failure by applying the appropriate error handling strategy.
 */
function handleStepFailure(
  store: ReturnType<typeof useOrchestratorStore.getState>,
  planId: string,
  stepId: string,
  errorMessage: string
): void {
  // Mark the step as failed
  store.updateStepStatus(planId, stepId, 'failed', { error: errorMessage });

  // Determine error handling strategy
  const strategy = getEffectiveErrorStrategy(store, planId, stepId);

  switch (strategy) {
    case 'pause_on_error':
      // Pause the orchestration for user intervention
      store.pauseOrchestration(planId);
      break;

    case 'skip':
      // Skip this step and advance to the next
      store.skipStep(planId, stepId);
      store._advanceToNextStep(planId);
      break;

    case 'stop':
      // Stop the entire orchestration
      store.stopOrchestration(planId, `Step "${stepId}" failed: ${errorMessage}`);
      break;

    default:
      // Fallback: pause on error
      store.pauseOrchestration(planId);
      break;
  }
}

export default useCompletionCallbackChain;
