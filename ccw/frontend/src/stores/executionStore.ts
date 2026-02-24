// ========================================
// Execution Store
// ========================================
// Zustand store for Orchestrator execution state management

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  ExecutionStore,
  ExecutionState,
  ExecutionStatus,
  NodeExecutionState,
  ExecutionLog,
  NodeExecutionOutput,
} from '../types/execution';
import type { ToolCallExecution } from '../types/toolCall';
import type { CliOutputLine } from './cliStreamStore';

// Constants
const MAX_LOGS = 500;

// Initial state
const initialState = {
  // Current execution
  currentExecution: null as ExecutionState | null,

  // Node execution states
  nodeStates: {} as Record<string, NodeExecutionState>,

  // Execution logs
  logs: [] as ExecutionLog[],
  maxLogs: MAX_LOGS,

  // Node output tracking
  nodeOutputs: {} as Record<string, NodeExecutionOutput>,

  // Tool call tracking
  nodeToolCalls: {} as Record<string, ToolCallExecution[]>,

  // Selected node for detail view
  selectedNodeId: null as string | null,

  // UI state
  isMonitorPanelOpen: false,
  autoScrollLogs: true,
};

export const useExecutionStore = create<ExecutionStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ========== Execution Lifecycle ==========

      startExecution: (execId: string, flowId: string) => {
        const now = new Date().toISOString();
        set(
          {
            currentExecution: {
              execId,
              flowId,
              status: 'running',
              startedAt: now,
              elapsedMs: 0,
            },
            nodeStates: {},
            logs: [],
          },
          false,
          'startExecution'
        );
      },

      setExecutionStatus: (status: ExecutionStatus, currentNodeId?: string) => {
        set(
          (state) => {
            if (!state.currentExecution) return state;
            return {
              currentExecution: {
                ...state.currentExecution,
                status,
                currentNodeId: currentNodeId ?? state.currentExecution.currentNodeId,
              },
            };
          },
          false,
          'setExecutionStatus'
        );
      },

      completeExecution: (status: 'completed' | 'failed') => {
        const now = new Date().toISOString();
        set(
          (state) => {
            if (!state.currentExecution) return state;
            const startTime = new Date(state.currentExecution.startedAt).getTime();
            const elapsedMs = Date.now() - startTime;
            return {
              currentExecution: {
                ...state.currentExecution,
                status,
                completedAt: now,
                elapsedMs,
                currentNodeId: undefined,
              },
            };
          },
          false,
          'completeExecution'
        );
      },

      clearExecution: () => {
        set(
          {
            currentExecution: null,
            nodeStates: {},
            logs: [],
          },
          false,
          'clearExecution'
        );
      },

      // ========== Node State Updates ==========

      setNodeStarted: (nodeId: string) => {
        const now = new Date().toISOString();
        set(
          (state) => ({
            nodeStates: {
              ...state.nodeStates,
              [nodeId]: {
                nodeId,
                status: 'running',
                startedAt: now,
              },
            },
          }),
          false,
          'setNodeStarted'
        );
      },

      setNodeCompleted: (nodeId: string, result?: unknown) => {
        const now = new Date().toISOString();
        set(
          (state) => ({
            nodeStates: {
              ...state.nodeStates,
              [nodeId]: {
                ...state.nodeStates[nodeId],
                nodeId,
                status: 'completed',
                completedAt: now,
                result,
              },
            },
          }),
          false,
          'setNodeCompleted'
        );
      },

      setNodeFailed: (nodeId: string, error: string) => {
        const now = new Date().toISOString();
        set(
          (state) => ({
            nodeStates: {
              ...state.nodeStates,
              [nodeId]: {
                ...state.nodeStates[nodeId],
                nodeId,
                status: 'failed',
                completedAt: now,
                error,
              },
            },
          }),
          false,
          'setNodeFailed'
        );
      },

      clearNodeStates: () => {
        set({ nodeStates: {} }, false, 'clearNodeStates');
      },

      // ========== Logs ==========

      addLog: (log: ExecutionLog) => {
        set(
          (state) => {
            const newLogs = [...state.logs, log];
            // Trim logs if exceeding max
            if (newLogs.length > state.maxLogs) {
              return { logs: newLogs.slice(-state.maxLogs) };
            }
            return { logs: newLogs };
          },
          false,
          'addLog'
        );
      },

      clearLogs: () => {
        set({ logs: [] }, false, 'clearLogs');
      },

      // ========== UI State ==========

      setMonitorPanelOpen: (open: boolean) => {
        set({ isMonitorPanelOpen: open }, false, 'setMonitorPanelOpen');
      },

      setAutoScrollLogs: (autoScroll: boolean) => {
        set({ autoScrollLogs: autoScroll }, false, 'setAutoScrollLogs');
      },

      // ========== Node Output Management ==========

      addNodeOutput: (nodeId: string, output: CliOutputLine) => {
        set(
          (state) => {
            const current = state.nodeOutputs[nodeId];
            if (!current) {
              // Create new node output
              return {
                nodeOutputs: {
                  ...state.nodeOutputs,
                  [nodeId]: {
                    nodeId,
                    outputs: [output],
                    toolCalls: [],
                    logs: [],
                    variables: {},
                    startTime: Date.now(),
                  },
                },
              };
            }
            // Append to existing output
            return {
              nodeOutputs: {
                ...state.nodeOutputs,
                [nodeId]: {
                  ...current,
                  outputs: [...current.outputs, output],
                },
              },
            };
          },
          false,
          'addNodeOutput'
        );
      },

      clearNodeOutputs: (nodeId: string) => {
        set(
          (state) => {
            const newOutputs = { ...state.nodeOutputs };
            delete newOutputs[nodeId];
            return { nodeOutputs: newOutputs };
          },
          false,
          'clearNodeOutputs'
        );
      },

      // ========== Tool Call Management ==========

      startToolCall: (
        nodeId: string,
        callId: string,
        data: { kind: ToolCallExecution['kind']; subtype?: string; description: string }
      ) => {
        const newToolCall: ToolCallExecution = {
          callId,
          nodeId,
          status: 'executing',
          kind: data.kind,
          subtype: data.subtype,
          description: data.description,
          startTime: Date.now(),
          outputLines: [],
          outputBuffer: {
            stdout: '',
            stderr: '',
            combined: '',
          },
        };

        set(
          (state) => {
            const currentCalls = state.nodeToolCalls[nodeId] || [];
            return {
              nodeToolCalls: {
                ...state.nodeToolCalls,
                [nodeId]: [...currentCalls, newToolCall],
              },
            };
          },
          false,
          'startToolCall'
        );
      },

      updateToolCall: (
        nodeId: string,
        callId: string,
        update: {
          status?: ToolCallExecution['status'];
          outputChunk?: string;
          stream?: 'stdout' | 'stderr';
        }
      ) => {
        set(
          (state) => {
            const calls = state.nodeToolCalls[nodeId];
            if (!calls) return state;

            const index = calls.findIndex((c) => c.callId === callId);
            if (index === -1) return state;

            const updatedCalls = [...calls];
            const current = updatedCalls[index];

            // Update status if provided
            if (update.status) {
              current.status = update.status;
              if (update.status !== 'executing' && !current.endTime) {
                current.endTime = Date.now();
                current.duration = current.endTime - current.startTime;
              }
            }

            // Append output chunk if provided
            if (update.outputChunk !== undefined) {
              const outputLine: CliOutputLine = {
                type: update.stream === 'stderr' ? 'stderr' : 'stdout',
                content: update.outputChunk,
                timestamp: Date.now(),
              };
              current.outputLines.push(outputLine);

              // Update buffer
              if (update.stream === 'stderr') {
                current.outputBuffer.stderr += update.outputChunk;
                current.outputBuffer.combined += update.outputChunk;
              } else {
                current.outputBuffer.stdout += update.outputChunk;
                current.outputBuffer.combined += update.outputChunk;
              }
            }

            updatedCalls[index] = current;

            return {
              nodeToolCalls: {
                ...state.nodeToolCalls,
                [nodeId]: updatedCalls,
              },
            };
          },
          false,
          'updateToolCall'
        );
      },

      completeToolCall: (
        nodeId: string,
        callId: string,
        result: {
          status: ToolCallExecution['status'];
          exitCode?: number;
          error?: string;
          result?: unknown;
        }
      ) => {
        set(
          (state) => {
            const calls = state.nodeToolCalls[nodeId];
            if (!calls) return state;

            const index = calls.findIndex((c) => c.callId === callId);
            if (index === -1) return state;

            const updatedCalls = [...calls];
            const current = { ...updatedCalls[index] };

            current.status = result.status;
            current.endTime = Date.now();
            current.duration = current.endTime - current.startTime;

            if (result.exitCode !== undefined) {
              current.exitCode = result.exitCode;
            }
            if (result.error !== undefined) {
              current.error = result.error;
            }
            if (result.result !== undefined) {
              current.result = result.result;
            }

            updatedCalls[index] = current;

            return {
              nodeToolCalls: {
                ...state.nodeToolCalls,
                [nodeId]: updatedCalls,
              },
            };
          },
          false,
          'completeToolCall'
        );
      },

      toggleToolCallExpanded: (nodeId: string, callId: string) => {
        set(
          (state) => {
            const calls = state.nodeToolCalls[nodeId];
            if (!calls) return state;

            const index = calls.findIndex((c) => c.callId === callId);
            if (index === -1) return state;

            const updatedCalls = [...calls];
            updatedCalls[index] = {
              ...updatedCalls[index],
              isExpanded: !updatedCalls[index].isExpanded,
            };

            return {
              nodeToolCalls: {
                ...state.nodeToolCalls,
                [nodeId]: updatedCalls,
              },
            };
          },
          false,
          'toggleToolCallExpanded'
        );
      },

      // ========== Node Selection ==========

      selectNode: (nodeId: string | null) => {
        set({ selectedNodeId: nodeId }, false, 'selectNode');
      },

      // ========== Getters ==========

      getNodeOutputs: (nodeId: string) => {
        return get().nodeOutputs[nodeId];
      },

      getToolCallsForNode: (nodeId: string) => {
        return get().nodeToolCalls[nodeId] || [];
      },
    }),
    { name: 'ExecutionStore' }
  )
);

// Selectors for common access patterns
const EMPTY_TOOL_CALLS: never[] = [];
export const selectCurrentExecution = (state: ExecutionStore) => state.currentExecution;
export const selectNodeStates = (state: ExecutionStore) => state.nodeStates;
export const selectLogs = (state: ExecutionStore) => state.logs;
export const selectIsMonitorPanelOpen = (state: ExecutionStore) => state.isMonitorPanelOpen;
export const selectAutoScrollLogs = (state: ExecutionStore) => state.autoScrollLogs;

// Node output selectors (new)
export const selectNodeOutputs = (state: ExecutionStore, nodeId: string) =>
  state.nodeOutputs[nodeId];
export const selectNodeToolCalls = (state: ExecutionStore, nodeId: string) =>
  state.nodeToolCalls[nodeId] || EMPTY_TOOL_CALLS;
export const selectSelectedNodeId = (state: ExecutionStore) => state.selectedNodeId;

// Helper to check if execution is active
export const selectIsExecuting = (state: ExecutionStore) => {
  return state.currentExecution?.status === 'running';
};

// Helper to get node status
export const selectNodeStatus = (nodeId: string) => (state: ExecutionStore) => {
  return state.nodeStates[nodeId]?.status ?? 'pending';
};

// Helper to get selected node's tool calls
export const selectSelectedNodeToolCalls = (state: ExecutionStore) => {
  if (!state.selectedNodeId) return EMPTY_TOOL_CALLS;
  return state.nodeToolCalls[state.selectedNodeId] || EMPTY_TOOL_CALLS;
};
