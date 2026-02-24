// ========================================
// Session Manager Store
// ========================================
// Zustand store for terminal dashboard session management.
// Manages session groups, layout, active terminal, terminal metadata,
// and monitor Web Worker lifecycle.
// Consumes cliSessionStore data via getState() pattern (no data duplication).

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  MonitorAlert,
  SessionGroup,
  SessionLayout,
  SessionManagerState,
  SessionManagerStore,
  TerminalMeta,
  TerminalStatus,
} from '../types/terminal-dashboard';
import { pauseCliSession, resumeCliSession, closeCliSession, createCliSession } from '../lib/api';
import { useCliSessionStore } from './cliSessionStore';
import { useWorkflowStore, selectProjectPath } from './workflowStore';

// ========== Initial State ==========

const initialState: SessionManagerState = {
  groups: [],
  layout: { grid: '1x1', splits: [1] },
  activeTerminalId: null,
  terminalMetas: {},
};

// ========== Worker Ref (non-reactive, outside Zustand) ==========

/** Module-level worker reference. Worker objects are not serializable. */
let _workerRef: Worker | null = null;

// ========== WebSocket Session Lock Message Handler ==========

/**
 * Handle CLI_SESSION_LOCKED WebSocket message from backend.
 * Updates session metadata to reflect locked state.
 */
export function handleSessionLockedMessage(payload: {
  sessionKey: string;
  reason: string;
  executionId?: string;
  timestamp: string;
}): void {
  const store = useSessionManagerStore.getState();
  store.updateTerminalMeta(payload.sessionKey, {
    status: 'locked',
    isLocked: true,
    lockReason: payload.reason,
    lockedByExecutionId: payload.executionId,
    lockedAt: payload.timestamp,
  });
}

/**
 * Handle CLI_SESSION_UNLOCKED WebSocket message from backend.
 * Updates session metadata to reflect unlocked state.
 */
export function handleSessionUnlockedMessage(payload: {
  sessionKey: string;
  timestamp: string;
}): void {
  const store = useSessionManagerStore.getState();
  const existing = store.terminalMetas[payload.sessionKey];
  // Only unlock if currently locked
  if (existing?.isLocked) {
    store.updateTerminalMeta(payload.sessionKey, {
      status: 'active',
      isLocked: false,
      lockReason: undefined,
      lockedByExecutionId: undefined,
      lockedAt: undefined,
    });
  }
}

// ========== Worker Message Handler ==========

function _handleWorkerMessage(event: MessageEvent<MonitorAlert>): void {
  const msg = event.data;
  if (msg.type !== 'alert') return;

  const { sessionId, severity, message } = msg;

  // Map severity to terminal status
  const statusMap: Record<string, TerminalStatus> = {
    critical: 'error',
    warning: 'idle',
  };

  const store = useSessionManagerStore.getState();
  const existing = store.terminalMetas[sessionId];
  const currentAlertCount = existing?.alertCount ?? 0;

  store.updateTerminalMeta(sessionId, {
    status: statusMap[severity] ?? 'idle',
    alertCount: currentAlertCount + 1,
  });

  // Log for debugging (non-intrusive)
  if (import.meta.env.DEV) {
    console.debug(`[MonitorWorker] ${severity}: ${message} (session=${sessionId})`);
  }
}

// ========== Store ==========

export const useSessionManagerStore = create<SessionManagerStore>()(
  devtools(
    (set) => ({
      ...initialState,

      // ========== Group Management ==========

      createGroup: (name: string) => {
        const id = `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newGroup: SessionGroup = { id, name, sessionIds: [] };
        set(
          (state) => ({ groups: [...state.groups, newGroup] }),
          false,
          'createGroup'
        );
      },

      removeGroup: (groupId: string) => {
        set(
          (state) => ({ groups: state.groups.filter((g) => g.id !== groupId) }),
          false,
          'removeGroup'
        );
      },

      moveSessionToGroup: (sessionId: string, groupId: string) => {
        set(
          (state) => {
            const nextGroups = state.groups.map((group) => {
              // Remove session from its current group
              const filtered = group.sessionIds.filter((id) => id !== sessionId);
              // Add to target group
              if (group.id === groupId) {
                return { ...group, sessionIds: [...filtered, sessionId] };
              }
              return { ...group, sessionIds: filtered };
            });
            return { groups: nextGroups };
          },
          false,
          'moveSessionToGroup'
        );
      },

      // ========== Terminal Selection ==========

      setActiveTerminal: (sessionId: string | null) => {
        set({ activeTerminalId: sessionId }, false, 'setActiveTerminal');
      },

      // ========== Terminal Metadata ==========

      updateTerminalMeta: (sessionId: string, meta: Partial<TerminalMeta>) => {
        set(
          (state) => {
            const existing = state.terminalMetas[sessionId] ?? {
              title: sessionId,
              status: 'idle' as const,
              alertCount: 0,
            };
            return {
              terminalMetas: {
                ...state.terminalMetas,
                [sessionId]: { ...existing, ...meta },
              },
            };
          },
          false,
          'updateTerminalMeta'
        );
      },

      // ========== Layout Management ==========

      setGroupLayout: (layout: SessionLayout) => {
        set({ layout }, false, 'setGroupLayout');
      },

      // ========== Monitor Worker Lifecycle ==========

      spawnMonitor: () => {
        // Idempotent: only create if not already running
        if (_workerRef) return;
        try {
          _workerRef = new Worker(
            new URL('../workers/monitor.worker.ts', import.meta.url),
            { type: 'module' }
          );
          _workerRef.onmessage = _handleWorkerMessage;
          _workerRef.onerror = (err) => {
            if (import.meta.env.DEV) {
              console.error('[MonitorWorker] error:', err);
            }
          };
        } catch {
          // Worker creation can fail in environments without worker support
          _workerRef = null;
        }
      },

      terminateMonitor: () => {
        if (!_workerRef) return;
        _workerRef.terminate();
        _workerRef = null;
      },

      feedMonitor: (sessionId: string, text: string) => {
        // Lazily spawn worker on first feed call
        if (!_workerRef) {
          useSessionManagerStore.getState().spawnMonitor();
        }
        if (_workerRef) {
          _workerRef.postMessage({ type: 'output', sessionId, text });
        }
      },

      // ========== Session Lifecycle Actions ==========

      pauseSession: async (terminalId: string) => {
        const projectPath = selectProjectPath(useWorkflowStore.getState());
        try {
          await pauseCliSession(terminalId, projectPath ?? undefined);
          set(
            (state) => {
              const existing = state.terminalMetas[terminalId];
              if (!existing) return state;
              return {
                terminalMetas: {
                  ...state.terminalMetas,
                  [terminalId]: { ...existing, status: 'paused' as TerminalStatus },
                },
              };
            },
            false,
            'pauseSession'
          );
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error('[SessionManager] pauseSession error:', error);
          }
          throw error;
        }
      },

      resumeSession: async (terminalId: string) => {
        const projectPath = selectProjectPath(useWorkflowStore.getState());
        // First update to 'resuming' status
        set(
          (state) => {
            const existing = state.terminalMetas[terminalId];
            if (!existing) return state;
            return {
              terminalMetas: {
                ...state.terminalMetas,
                [terminalId]: { ...existing, status: 'resuming' as TerminalStatus },
              },
            };
          },
          false,
          'resumeSession/pending'
        );
        try {
          await resumeCliSession(terminalId, projectPath ?? undefined);
          // On success, update to 'active' status
          set(
            (state) => {
              const existing = state.terminalMetas[terminalId];
              if (!existing) return state;
              return {
                terminalMetas: {
                  ...state.terminalMetas,
                  [terminalId]: { ...existing, status: 'active' as TerminalStatus },
                },
              };
            },
            false,
            'resumeSession/fulfilled'
          );
        } catch (error) {
          // On error, revert to 'paused' status
          set(
            (state) => {
              const existing = state.terminalMetas[terminalId];
              if (!existing) return state;
              return {
                terminalMetas: {
                  ...state.terminalMetas,
                  [terminalId]: { ...existing, status: 'paused' as TerminalStatus },
                },
              };
            },
            false,
            'resumeSession/rejected'
          );
          if (import.meta.env.DEV) {
            console.error('[SessionManager] resumeSession error:', error);
          }
          throw error;
        }
      },

      restartSession: async (terminalId: string) => {
        const projectPath = selectProjectPath(useWorkflowStore.getState());
        const cliStore = useCliSessionStore.getState();
        const session = cliStore.sessions[terminalId];

        if (!session) {
          throw new Error(`Session not found: ${terminalId}`);
        }

        // Store session config for recreation
        const sessionConfig = {
          workingDir: session.workingDir,
          tool: session.tool,
          model: session.model,
          resumeKey: session.resumeKey,
          shellKind: session.shellKind,
        };

        // Map shellKind to preferredShell for API
        const mapShellKind = (kind: string): 'bash' | 'pwsh' | 'cmd' => {
          if (kind === 'pwsh' || kind === 'powershell') return 'pwsh';
          if (kind === 'cmd') return 'cmd';
          return 'bash'; // 'git-bash', 'wsl-bash', or fallback
        };

        try {
          // Close existing session
          await closeCliSession(terminalId, projectPath ?? undefined);

          // Create new session with same config
          const result = await createCliSession(
            {
              workingDir: sessionConfig.workingDir,
              preferredShell: mapShellKind(sessionConfig.shellKind),
              tool: sessionConfig.tool,
              model: sessionConfig.model,
              resumeKey: sessionConfig.resumeKey,
            },
            projectPath ?? undefined
          );

          // Update terminal meta to active status
          set(
            (state) => {
              const existing = state.terminalMetas[terminalId];
              if (!existing) return state;
              return {
                terminalMetas: {
                  ...state.terminalMetas,
                  [terminalId]: { ...existing, status: 'active' as TerminalStatus, alertCount: 0 },
                },
              };
            },
            false,
            'restartSession'
          );

          return result;
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error('[SessionManager] restartSession error:', error);
          }
          throw error;
        }
      },

      closeSession: async (terminalId: string) => {
        const projectPath = selectProjectPath(useWorkflowStore.getState());
        const cliStore = useCliSessionStore.getState();

        try {
          // Call backend API to terminate PTY session
          await closeCliSession(terminalId, projectPath ?? undefined);

          // Remove session from cliSessionStore
          cliStore.removeSession(terminalId);

          // Remove terminal meta
          set(
            (state) => {
              const nextMetas = { ...state.terminalMetas };
              delete nextMetas[terminalId];
              return { terminalMetas: nextMetas };
            },
            false,
            'closeSession'
          );
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error('[SessionManager] closeSession error:', error);
          }
          throw error;
        }
      },

      // ========== Session Lock Actions ==========

      lockSession: (sessionId: string, reason: string, executionId?: string) => {
        set(
          (state) => {
            const existing = state.terminalMetas[sessionId];
            if (!existing) return state;
            return {
              terminalMetas: {
                ...state.terminalMetas,
                [sessionId]: {
                  ...existing,
                  status: 'locked' as TerminalStatus,
                  isLocked: true,
                  lockReason: reason,
                  lockedByExecutionId: executionId,
                  lockedAt: new Date().toISOString(),
                },
              },
            };
          },
          false,
          'lockSession'
        );
      },

      unlockSession: (sessionId: string) => {
        set(
          (state) => {
            const existing = state.terminalMetas[sessionId];
            if (!existing) return state;
            return {
              terminalMetas: {
                ...state.terminalMetas,
                [sessionId]: {
                  ...existing,
                  status: 'active' as TerminalStatus,
                  isLocked: false,
                  lockReason: undefined,
                  lockedByExecutionId: undefined,
                  lockedAt: undefined,
                },
              },
            };
          },
          false,
          'unlockSession'
        );
      },
    }),
    { name: 'SessionManagerStore' }
  )
);

// ========== Selectors ==========

/** Select all session groups */
export const selectGroups = (state: SessionManagerStore) => state.groups;

/** Select current terminal layout */
export const selectLayout = (state: SessionManagerStore) => state.layout;

/** Select active terminal session key */
export const selectSessionManagerActiveTerminalId = (state: SessionManagerStore) =>
  state.activeTerminalId;

/** Select all terminal metadata records */
export const selectTerminalMetas = (state: SessionManagerStore) => state.terminalMetas;

/** Select terminal metadata for a specific session */
export const selectTerminalMeta =
  (sessionId: string) =>
  (state: SessionManagerStore): TerminalMeta | undefined =>
    state.terminalMetas[sessionId];
