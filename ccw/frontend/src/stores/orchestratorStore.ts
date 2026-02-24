// ========================================
// Orchestrator Store
// ========================================
// Zustand store for orchestration plan execution state machine.
// Manages multiple concurrent orchestration plans, step lifecycle,
// and execution-to-step mapping for WebSocket callback chain matching.
//
// NOTE: This is SEPARATE from executionStore.ts (which handles Flow DAG
// execution visualization). This store manages the plan-level state machine
// for automated step advancement.

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  OrchestrationPlan,
  OrchestrationStatus,
  StepStatus,
} from '../types/orchestrator';

// ========== Types ==========

/** Runtime state for a single orchestration step */
export interface StepRunState {
  /** Current step status */
  status: StepStatus;
  /** CLI execution ID assigned when the step starts executing */
  executionId?: string;
  /** Step execution result (populated on completion) */
  result?: unknown;
  /** Error message (populated on failure) */
  error?: string;
  /** ISO timestamp when step started executing */
  startedAt?: string;
  /** ISO timestamp when step completed/failed */
  completedAt?: string;
  /** Number of retry attempts for this step */
  retryCount: number;
}

/** Runtime state for an entire orchestration plan */
export interface OrchestrationRunState {
  /** The orchestration plan definition */
  plan: OrchestrationPlan;
  /** Current overall status of the plan */
  status: OrchestrationStatus;
  /** Index of the current step being executed (for sequential tracking) */
  currentStepIndex: number;
  /** Per-step runtime state keyed by step ID */
  stepStatuses: Record<string, StepRunState>;
  /** Maps executionId -> stepId for callback chain matching */
  executionIdMap: Record<string, string>;
  /** Optional session key for session-scoped orchestration */
  sessionKey?: string;
  /** Error message if the plan itself failed */
  error?: string;
}

export interface OrchestratorState {
  /** All active orchestration plans keyed by plan ID */
  activePlans: Record<string, OrchestrationRunState>;
}

export interface OrchestratorActions {
  /** Initialize and start an orchestration plan */
  startOrchestration: (plan: OrchestrationPlan, sessionKey?: string) => void;
  /** Pause a running orchestration */
  pauseOrchestration: (planId: string) => void;
  /** Resume a paused orchestration */
  resumeOrchestration: (planId: string) => void;
  /** Stop an orchestration (marks as failed) */
  stopOrchestration: (planId: string, error?: string) => void;
  /** Update a step's status with optional result or error */
  updateStepStatus: (
    planId: string,
    stepId: string,
    status: StepStatus,
    result?: { data?: unknown; error?: string }
  ) => void;
  /** Register an execution ID mapping for callback chain matching */
  registerExecution: (planId: string, stepId: string, executionId: string) => void;
  /** Retry a failed step (reset to pending, increment retryCount) */
  retryStep: (planId: string, stepId: string) => void;
  /** Skip a step (mark as skipped, treated as completed for dependency resolution) */
  skipStep: (planId: string, stepId: string) => void;
  /**
   * Internal: Find and return the next ready step ID.
   * Does NOT execute the step - only identifies it and updates currentStepIndex.
   * If no steps remain, marks plan as completed.
   * Returns the step ID if found, null otherwise.
   */
  _advanceToNextStep: (planId: string) => string | null;
  /**
   * Pure getter: Find the next step whose dependsOn are all completed/skipped.
   * Returns the step ID or null if none are ready.
   */
  getNextReadyStep: (planId: string) => string | null;
  /** Remove a completed/failed plan from active tracking */
  removePlan: (planId: string) => void;
  /** Clear all plans */
  clearAll: () => void;
}

export type OrchestratorStore = OrchestratorState & OrchestratorActions;

// ========== Helpers ==========

/**
 * Check if a step's dependencies are all satisfied (completed or skipped).
 */
function areDependenciesSatisfied(
  step: { dependsOn: string[] },
  stepStatuses: Record<string, StepRunState>
): boolean {
  return step.dependsOn.every((depId) => {
    const depState = stepStatuses[depId];
    return depState && (depState.status === 'completed' || depState.status === 'skipped');
  });
}

/**
 * Find the next ready step from a plan's steps that is pending and has all deps satisfied.
 */
function findNextReadyStep(
  plan: OrchestrationPlan,
  stepStatuses: Record<string, StepRunState>
): string | null {
  for (const step of plan.steps) {
    const state = stepStatuses[step.id];
    if (state && state.status === 'pending' && areDependenciesSatisfied(step, stepStatuses)) {
      return step.id;
    }
  }
  return null;
}

/**
 * Check if all steps are in a terminal state (completed, skipped, or failed).
 */
function areAllStepsTerminal(stepStatuses: Record<string, StepRunState>): boolean {
  return Object.values(stepStatuses).every(
    (s) => s.status === 'completed' || s.status === 'skipped' || s.status === 'failed'
  );
}

// ========== Initial State ==========

const initialState: OrchestratorState = {
  activePlans: {},
};

// ========== Store ==========

export const useOrchestratorStore = create<OrchestratorStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ========== Plan Lifecycle ==========

      startOrchestration: (plan: OrchestrationPlan, sessionKey?: string) => {
        // Initialize all step statuses as pending
        const stepStatuses: Record<string, StepRunState> = {};
        for (const step of plan.steps) {
          stepStatuses[step.id] = {
            status: 'pending',
            retryCount: 0,
          };
        }

        const runState: OrchestrationRunState = {
          plan,
          status: 'running',
          currentStepIndex: 0,
          stepStatuses,
          executionIdMap: {},
          sessionKey,
        };

        set(
          (state) => ({
            activePlans: {
              ...state.activePlans,
              [plan.id]: runState,
            },
          }),
          false,
          'startOrchestration'
        );
      },

      pauseOrchestration: (planId: string) => {
        set(
          (state) => {
            const existing = state.activePlans[planId];
            if (!existing || existing.status !== 'running') return state;

            return {
              activePlans: {
                ...state.activePlans,
                [planId]: {
                  ...existing,
                  status: 'paused',
                },
              },
            };
          },
          false,
          'pauseOrchestration'
        );
      },

      resumeOrchestration: (planId: string) => {
        set(
          (state) => {
            const existing = state.activePlans[planId];
            if (!existing || existing.status !== 'paused') return state;

            return {
              activePlans: {
                ...state.activePlans,
                [planId]: {
                  ...existing,
                  status: 'running',
                },
              },
            };
          },
          false,
          'resumeOrchestration'
        );
      },

      stopOrchestration: (planId: string, error?: string) => {
        set(
          (state) => {
            const existing = state.activePlans[planId];
            if (!existing) return state;

            return {
              activePlans: {
                ...state.activePlans,
                [planId]: {
                  ...existing,
                  status: 'failed',
                  error: error ?? 'Orchestration stopped by user',
                },
              },
            };
          },
          false,
          'stopOrchestration'
        );
      },

      // ========== Step State Updates ==========

      updateStepStatus: (
        planId: string,
        stepId: string,
        status: StepStatus,
        result?: { data?: unknown; error?: string }
      ) => {
        set(
          (state) => {
            const existing = state.activePlans[planId];
            if (!existing) return state;

            const stepState = existing.stepStatuses[stepId];
            if (!stepState) return state;

            const now = new Date().toISOString();
            const isStarting = status === 'running';
            const isTerminal =
              status === 'completed' || status === 'failed' || status === 'skipped';

            return {
              activePlans: {
                ...state.activePlans,
                [planId]: {
                  ...existing,
                  stepStatuses: {
                    ...existing.stepStatuses,
                    [stepId]: {
                      ...stepState,
                      status,
                      startedAt: isStarting ? now : stepState.startedAt,
                      completedAt: isTerminal ? now : stepState.completedAt,
                      result: result?.data ?? stepState.result,
                      error: result?.error ?? stepState.error,
                    },
                  },
                },
              },
            };
          },
          false,
          'updateStepStatus'
        );
      },

      registerExecution: (planId: string, stepId: string, executionId: string) => {
        set(
          (state) => {
            const existing = state.activePlans[planId];
            if (!existing) return state;

            return {
              activePlans: {
                ...state.activePlans,
                [planId]: {
                  ...existing,
                  executionIdMap: {
                    ...existing.executionIdMap,
                    [executionId]: stepId,
                  },
                },
              },
            };
          },
          false,
          'registerExecution'
        );
      },

      retryStep: (planId: string, stepId: string) => {
        set(
          (state) => {
            const existing = state.activePlans[planId];
            if (!existing) return state;

            const stepState = existing.stepStatuses[stepId];
            if (!stepState) return state;

            return {
              activePlans: {
                ...state.activePlans,
                [planId]: {
                  ...existing,
                  status: 'running',
                  stepStatuses: {
                    ...existing.stepStatuses,
                    [stepId]: {
                      ...stepState,
                      status: 'pending',
                      error: undefined,
                      result: undefined,
                      startedAt: undefined,
                      completedAt: undefined,
                      retryCount: stepState.retryCount + 1,
                    },
                  },
                },
              },
            };
          },
          false,
          'retryStep'
        );
      },

      skipStep: (planId: string, stepId: string) => {
        set(
          (state) => {
            const existing = state.activePlans[planId];
            if (!existing) return state;

            const stepState = existing.stepStatuses[stepId];
            if (!stepState) return state;

            return {
              activePlans: {
                ...state.activePlans,
                [planId]: {
                  ...existing,
                  stepStatuses: {
                    ...existing.stepStatuses,
                    [stepId]: {
                      ...stepState,
                      status: 'skipped',
                      completedAt: new Date().toISOString(),
                    },
                  },
                },
              },
            };
          },
          false,
          'skipStep'
        );
      },

      // ========== Step Advancement ==========

      _advanceToNextStep: (planId: string): string | null => {
        const state = get();
        const existing = state.activePlans[planId];
        if (!existing || existing.status !== 'running') return null;

        // Find the next step that is pending with all dependencies satisfied
        const nextStepId = findNextReadyStep(existing.plan, existing.stepStatuses);

        if (nextStepId) {
          // Update currentStepIndex to match the found step
          const stepIndex = existing.plan.steps.findIndex((s) => s.id === nextStepId);

          set(
            (prevState) => {
              const plan = prevState.activePlans[planId];
              if (!plan) return prevState;

              return {
                activePlans: {
                  ...prevState.activePlans,
                  [planId]: {
                    ...plan,
                    currentStepIndex: stepIndex >= 0 ? stepIndex : plan.currentStepIndex,
                  },
                },
              };
            },
            false,
            '_advanceToNextStep'
          );

          return nextStepId;
        }

        // No pending steps found - check if all are terminal
        if (areAllStepsTerminal(existing.stepStatuses)) {
          // Check if any step failed (and was not skipped)
          const hasFailed = Object.values(existing.stepStatuses).some(
            (s) => s.status === 'failed'
          );

          set(
            (prevState) => {
              const plan = prevState.activePlans[planId];
              if (!plan) return prevState;

              return {
                activePlans: {
                  ...prevState.activePlans,
                  [planId]: {
                    ...plan,
                    status: hasFailed ? 'failed' : 'completed',
                  },
                },
              };
            },
            false,
            '_advanceToNextStep/complete'
          );
        }

        return null;
      },

      getNextReadyStep: (planId: string): string | null => {
        const state = get();
        const existing = state.activePlans[planId];
        if (!existing || existing.status !== 'running') return null;

        return findNextReadyStep(existing.plan, existing.stepStatuses);
      },

      // ========== Cleanup ==========

      removePlan: (planId: string) => {
        set(
          (state) => {
            const { [planId]: _removed, ...remaining } = state.activePlans;
            return { activePlans: remaining };
          },
          false,
          'removePlan'
        );
      },

      clearAll: () => {
        set(initialState, false, 'clearAll');
      },
    }),
    { name: 'OrchestratorStore' }
  )
);

// ========== Selectors ==========

/** Select all active plans */
export const selectActivePlans = (state: OrchestratorStore) => state.activePlans;

/** Select a specific plan by ID */
export const selectPlan =
  (planId: string) =>
  (state: OrchestratorStore): OrchestrationRunState | undefined =>
    state.activePlans[planId];

/** Select the step statuses for a plan */
export const selectStepStatuses =
  (planId: string) =>
  (state: OrchestratorStore): Record<string, StepRunState> | undefined =>
    state.activePlans[planId]?.stepStatuses;

/** Select a specific step's run state */
export const selectStepRunState =
  (planId: string, stepId: string) =>
  (state: OrchestratorStore): StepRunState | undefined =>
    state.activePlans[planId]?.stepStatuses[stepId];

/** Check if any plan is currently running */
export const selectHasRunningPlan = (state: OrchestratorStore): boolean =>
  Object.values(state.activePlans).some((p) => p.status === 'running');

/** Get the count of active (non-terminal) plans */
export const selectActivePlanCount = (state: OrchestratorStore): number =>
  Object.values(state.activePlans).filter(
    (p) => p.status === 'running' || p.status === 'paused'
  ).length;

/** Look up which plan and step an executionId belongs to */
export const selectPlanStepByExecutionId =
  (executionId: string) =>
  (
    state: OrchestratorStore
  ): { planId: string; stepId: string } | undefined => {
    for (const [planId, runState] of Object.entries(state.activePlans)) {
      const stepId = runState.executionIdMap[executionId];
      if (stepId) {
        return { planId, stepId };
      }
    }
    return undefined;
  };
