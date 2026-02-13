// ========================================
// Queue Execution Store
// ========================================
// Zustand store for unified queue execution state management.
// Tracks both InSession and Orchestrator execution paths,
// bridging them into a single observable state for UI consumption.

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ========== Types ==========

export type QueueExecutionType = 'session' | 'orchestrator';

export type QueueExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

export type QueueExecutionMode = 'analysis' | 'write';

export interface QueueExecution {
  /** Unique execution identifier */
  id: string;
  /** Associated queue item ID */
  queueItemId: string;
  /** Associated issue ID */
  issueId: string;
  /** Associated solution ID */
  solutionId: string;
  /** Execution path type */
  type: QueueExecutionType;
  /** CLI session key (session type only) */
  sessionKey?: string;
  /** Orchestrator flow ID (orchestrator type only) */
  flowId?: string;
  /** Orchestrator execution ID (orchestrator type only) */
  execId?: string;
  /** CLI tool used for execution */
  tool: string;
  /** Execution mode */
  mode: QueueExecutionMode;
  /** Current execution status */
  status: QueueExecutionStatus;
  /** ISO timestamp when execution started */
  startedAt: string;
  /** ISO timestamp when execution completed or failed */
  completedAt?: string;
  /** Error message if execution failed */
  error?: string;
}

export interface QueueExecutionStats {
  running: number;
  completed: number;
  failed: number;
  total: number;
}

export interface QueueExecutionState {
  /** All tracked executions keyed by execution ID */
  executions: Record<string, QueueExecution>;
}

export interface QueueExecutionActions {
  /** Add a new execution to the store */
  addExecution: (exec: QueueExecution) => void;
  /** Update the status of an existing execution */
  updateStatus: (id: string, status: QueueExecutionStatus, error?: string) => void;
  /** Remove a single execution by ID */
  removeExecution: (id: string) => void;
  /** Remove all completed and failed executions */
  clearCompleted: () => void;
}

export type QueueExecutionStore = QueueExecutionState & QueueExecutionActions;

// ========== Initial State ==========

const initialState: QueueExecutionState = {
  executions: {},
};

// ========== Store ==========

export const useQueueExecutionStore = create<QueueExecutionStore>()(
  devtools(
    (set) => ({
      ...initialState,

      // ========== Execution Lifecycle ==========

      addExecution: (exec: QueueExecution) => {
        set(
          (state) => ({
            executions: {
              ...state.executions,
              [exec.id]: exec,
            },
          }),
          false,
          'addExecution'
        );
      },

      updateStatus: (id: string, status: QueueExecutionStatus, error?: string) => {
        set(
          (state) => {
            const existing = state.executions[id];
            if (!existing) return state;

            const isTerminal = status === 'completed' || status === 'failed';
            return {
              executions: {
                ...state.executions,
                [id]: {
                  ...existing,
                  status,
                  completedAt: isTerminal ? new Date().toISOString() : existing.completedAt,
                  error: error ?? existing.error,
                },
              },
            };
          },
          false,
          'updateStatus'
        );
      },

      removeExecution: (id: string) => {
        set(
          (state) => {
            const { [id]: _removed, ...remaining } = state.executions;
            return { executions: remaining };
          },
          false,
          'removeExecution'
        );
      },

      clearCompleted: () => {
        set(
          (state) => {
            const active: Record<string, QueueExecution> = {};
            for (const [id, exec] of Object.entries(state.executions)) {
              if (exec.status !== 'completed' && exec.status !== 'failed') {
                active[id] = exec;
              }
            }
            return { executions: active };
          },
          false,
          'clearCompleted'
        );
      },
    }),
    { name: 'QueueExecutionStore' }
  )
);

// ========== Selectors ==========

/** Select all executions as a record */
export const selectQueueExecutions = (state: QueueExecutionStore) => state.executions;

/** Select only currently running executions */
export const selectActiveExecutions = (state: QueueExecutionStore): QueueExecution[] => {
  return Object.values(state.executions).filter((exec) => exec.status === 'running');
};

/** Select executions for a specific queue item */
export const selectByQueueItem =
  (queueItemId: string) =>
  (state: QueueExecutionStore): QueueExecution[] => {
    return Object.values(state.executions).filter(
      (exec) => exec.queueItemId === queueItemId
    );
  };

/** Compute execution statistics by status */
export const selectExecutionStats = (state: QueueExecutionStore): QueueExecutionStats => {
  const all = Object.values(state.executions);
  return {
    running: all.filter((e) => e.status === 'running').length,
    completed: all.filter((e) => e.status === 'completed').length,
    failed: all.filter((e) => e.status === 'failed').length,
    total: all.length,
  };
};

/** Check if any execution is currently running */
export const selectHasActiveExecution = (state: QueueExecutionStore): boolean => {
  return Object.values(state.executions).some((exec) => exec.status === 'running');
};
