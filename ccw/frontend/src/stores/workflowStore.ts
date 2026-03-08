// ========================================
// Workflow Store
// ========================================
// Manages workflow sessions, tasks, and related data

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  WorkflowStore,
  WorkflowState,
  SessionMetadata,
  TaskData,
  LiteTaskSession,
  WorkflowFilters,
  WorkflowSorting,
} from '../types/store';
import { switchWorkspace as apiSwitchWorkspace, fetchRecentPaths, removeRecentPath as apiRemoveRecentPath } from '../lib/api';

// LocalStorage key for persisting projectPath
const STORAGE_KEY = 'ccw-workflow-store';

// Helper to load persisted projectPath from localStorage
const loadPersistedPath = (): string => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return data?.state?.projectPath || '';
    }
  } catch {
    // Ignore parse errors
  }
  return '';
};

// Helper to persist projectPath to localStorage
const persistPath = (projectPath: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      state: { projectPath },
      version: 1,
    }));
  } catch {
    // Ignore storage errors
  }
};

// Helper to generate session key from ID
const sessionKey = (sessionId: string): string => {
  return `session-${sessionId}`.replace(/[^a-zA-Z0-9-]/g, '-');
};

// Default filters
const defaultFilters: WorkflowFilters = {
  status: null,
  search: '',
  dateRange: { start: null, end: null },
};

// Default sorting
const defaultSorting: WorkflowSorting = {
  field: 'created_at',
  direction: 'desc',
};

// Initial state - load persisted projectPath from localStorage
const initialState: WorkflowState = {
  // Core data
  workflowData: {
    activeSessions: [],
    archivedSessions: [],
  },
  projectPath: loadPersistedPath(),
  recentPaths: [],
  serverPlatform: 'win32',

  // Data stores
  sessionDataStore: {},
  liteTaskDataStore: {},
  taskJsonStore: {},

  // Active session
  activeSessionId: null,

  // Filters and sorting
  filters: defaultFilters,
  sorting: defaultSorting,

};

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set, get) => ({
        ...initialState,

      // ========== Session Actions ==========

      setSessions: (active: SessionMetadata[], archived: SessionMetadata[]) => {
        const sessionDataStore: Record<string, SessionMetadata> = {};

        // Build sessionDataStore from both arrays
        [...active, ...archived].forEach((session) => {
          const key = sessionKey(session.session_id);
          sessionDataStore[key] = session;
        });

        set(
          {
            workflowData: {
              activeSessions: active,
              archivedSessions: archived,
            },
            sessionDataStore,
          },
          false
        );
      },

      addSession: (session: SessionMetadata) => {
        const key = sessionKey(session.session_id);

        set(
          (state) => ({
            workflowData: {
              ...state.workflowData,
              activeSessions: [...state.workflowData.activeSessions, session],
            },
            sessionDataStore: {
              ...state.sessionDataStore,
              [key]: session,
            },
          }),
          false
        );
      },

      updateSession: (sessionId: string, updates: Partial<SessionMetadata>) => {
        const key = sessionKey(sessionId);

        set(
          (state: WorkflowState) => {
            const session = state.sessionDataStore[key];
            if (!session) return state;

            const updatedSession = { ...session, ...updates, updated_at: new Date().toISOString() };

            // Update in the appropriate array
            const isActive = session.location === 'active';
            const targetArray = isActive ? 'activeSessions' : 'archivedSessions';

            return {
              sessionDataStore: {
                ...state.sessionDataStore,
                [key]: updatedSession,
              },
              workflowData: {
                ...state.workflowData,
                [targetArray]: state.workflowData[targetArray].map((s) =>
                  s.session_id === sessionId ? updatedSession : s
                ),
              },
            };
          },
          false
        );
      },

      removeSession: (sessionId: string) => {
        const key = sessionKey(sessionId);

        set(
          (state: WorkflowState) => {
            const { [key]: removed, ...remainingStore } = state.sessionDataStore;

            return {
              sessionDataStore: remainingStore,
              workflowData: {
                activeSessions: state.workflowData.activeSessions.filter(
                  (s) => s.session_id !== sessionId
                ),
                archivedSessions: state.workflowData.archivedSessions.filter(
                  (s) => s.session_id !== sessionId
                ),
              },
            };
          },
          false
        );
      },

      archiveSession: (sessionId: string) => {
        const key = sessionKey(sessionId);

        set(
          (state: WorkflowState) => {
            const session = state.sessionDataStore[key];
            if (!session || session.location === 'archived') return state;

            const archivedSession: SessionMetadata = {
              ...session,
              location: 'archived',
              status: 'archived',
              updated_at: new Date().toISOString(),
            };

            return {
              sessionDataStore: {
                ...state.sessionDataStore,
                [key]: archivedSession,
              },
              workflowData: {
                activeSessions: state.workflowData.activeSessions.filter(
                  (s) => s.session_id !== sessionId
                ),
                archivedSessions: [...state.workflowData.archivedSessions, archivedSession],
              },
            };
          },
          false
        );
      },

      // ========== Task Actions ==========

      addTask: (sessionId: string, task: TaskData) => {
        const key = sessionKey(sessionId);

        set(
          (state: WorkflowState) => {
            const session = state.sessionDataStore[key];
            if (!session) return state;

            // Check for duplicate
            const existingTask = session.tasks?.find((t) => t.task_id === task.task_id);
            if (existingTask) return state;

            const updatedSession: SessionMetadata = {
              ...session,
              tasks: [...(session.tasks || []), task],
              updated_at: new Date().toISOString(),
            };

            return {
              sessionDataStore: {
                ...state.sessionDataStore,
                [key]: updatedSession,
              },
            };
          },
          false
        );
      },

      updateTask: (sessionId: string, taskId: string, updates: Partial<TaskData>) => {
        const key = sessionKey(sessionId);

        set(
          (state: WorkflowState) => {
            const session = state.sessionDataStore[key];
            if (!session?.tasks) return state;

            const updatedTasks = session.tasks.map((task) =>
              task.task_id === taskId
                ? { ...task, ...updates, updated_at: new Date().toISOString() }
                : task
            );

            const updatedSession: SessionMetadata = {
              ...session,
              tasks: updatedTasks,
              updated_at: new Date().toISOString(),
            };

            return {
              sessionDataStore: {
                ...state.sessionDataStore,
                [key]: updatedSession,
              },
            };
          },
          false
        );
      },

      removeTask: (sessionId: string, taskId: string) => {
        const key = sessionKey(sessionId);

        set(
          (state: WorkflowState) => {
            const session = state.sessionDataStore[key];
            if (!session?.tasks) return state;

            const updatedSession: SessionMetadata = {
              ...session,
              tasks: session.tasks.filter((t) => t.task_id !== taskId),
              updated_at: new Date().toISOString(),
            };

            return {
              sessionDataStore: {
                ...state.sessionDataStore,
                [key]: updatedSession,
              },
            };
          },
          false
        );
      },

      // ========== Lite Task Actions ==========

      setLiteTaskSession: (key: string, session: LiteTaskSession) => {
        set(
          (state) => ({
            liteTaskDataStore: {
              ...state.liteTaskDataStore,
              [key]: session,
            },
          }),
          false
        );
      },

      removeLiteTaskSession: (key: string) => {
        set(
          (state) => {
            const { [key]: removed, ...remaining } = state.liteTaskDataStore;
            return { liteTaskDataStore: remaining };
          },
          false
        );
      },

      // ========== Task JSON Store ==========

      setTaskJson: (key: string, data: unknown) => {
        set(
          (state) => ({
            taskJsonStore: {
              ...state.taskJsonStore,
              [key]: data,
            },
          }),
          false
        );
      },

      removeTaskJson: (key: string) => {
        set(
          (state) => {
            const { [key]: removed, ...remaining } = state.taskJsonStore;
            return { taskJsonStore: remaining };
          },
          false
        );
      },

      // ========== Active Session ==========

      setActiveSessionId: (sessionId: string | null) => {
        set({ activeSessionId: sessionId }, false);
      },

      // ========== Project Path ==========

      setProjectPath: (path: string) => {
        set({ projectPath: path }, false);
      },

      addRecentPath: (path: string) => {
        set(
          (state: WorkflowState) => {
            // Remove if exists, add to front
            const filtered = state.recentPaths.filter((p) => p !== path);
            const updated = [path, ...filtered].slice(0, 10); // Keep max 10
            return { recentPaths: updated };
          },
          false
        );
      },

      setServerPlatform: (platform: 'win32' | 'darwin' | 'linux') => {
        set({ serverPlatform: platform }, false);
      },

      // ========== Workspace Actions ==========

      switchWorkspace: async (path: string) => {
        const response = await apiSwitchWorkspace(path);
        const sessionDataStore: Record<string, SessionMetadata> = {};

        // Build sessionDataStore from both arrays
        [...response.activeSessions, ...response.archivedSessions].forEach((session) => {
          const key = sessionKey(session.session_id);
          sessionDataStore[key] = session;
        });

        set(
          {
            projectPath: response.projectPath,
            recentPaths: response.recentPaths,
            workflowData: {
              activeSessions: response.activeSessions,
              archivedSessions: response.archivedSessions,
            },
            sessionDataStore,
          },
          false
        );

        // Persist projectPath to localStorage manually
        persistPath(response.projectPath);

        // Trigger query invalidation callback
        const callback = get()._invalidateQueriesCallback;
        if (callback) {
          callback();
        }
      },

      removeRecentPath: async (path: string) => {
        const updatedPaths = await apiRemoveRecentPath(path);
        set({ recentPaths: updatedPaths }, false);
      },

      refreshRecentPaths: async () => {
        const paths = await fetchRecentPaths();
        set({ recentPaths: paths }, false);
      },

      registerQueryInvalidator: (callback: () => void) => {
        set({ _invalidateQueriesCallback: callback }, false);
      },

      // ========== Filters and Sorting ==========

      setFilters: (filters: Partial<WorkflowFilters>) => {
        set(
          (state) => ({
            filters: { ...state.filters, ...filters },
          }),
          false
        );
      },

      setSorting: (sorting: Partial<WorkflowSorting>) => {
        set(
          (state) => ({
            sorting: { ...state.sorting, ...sorting },
          }),
          false
        );
      },

      resetFilters: () => {
        set({ filters: defaultFilters, sorting: defaultSorting }, false);
      },

      // ========== Computed Selectors ==========

      getActiveSession: () => {
        const { activeSessionId, sessionDataStore } = get();
        if (!activeSessionId) return null;
        const key = sessionKey(activeSessionId);
        return sessionDataStore[key] || null;
      },

      getFilteredSessions: () => {
        const { workflowData, filters, sorting } = get();

        // Combine active and archived based on filter
        let sessions = [...workflowData.activeSessions, ...workflowData.archivedSessions];

        // Apply status filter
        if (filters.status && filters.status.length > 0) {
          sessions = sessions.filter((s) => filters.status!.includes(s.status));
        }

        // Apply search filter
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          sessions = sessions.filter(
            (s) =>
              s.session_id.toLowerCase().includes(searchLower) ||
              s.title?.toLowerCase().includes(searchLower) ||
              s.description?.toLowerCase().includes(searchLower)
          );
        }

        // Apply date range filter
        if (filters.dateRange.start || filters.dateRange.end) {
          sessions = sessions.filter((s) => {
            const createdAt = new Date(s.created_at);
            if (filters.dateRange.start && createdAt < filters.dateRange.start) return false;
            if (filters.dateRange.end && createdAt > filters.dateRange.end) return false;
            return true;
          });
        }

        // Apply sorting
        sessions.sort((a, b) => {
          let comparison = 0;

          switch (sorting.field) {
            case 'created_at':
              comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              break;
            case 'updated_at':
              comparison =
                new Date(a.updated_at || a.created_at).getTime() -
                new Date(b.updated_at || b.created_at).getTime();
              break;
            case 'title':
              comparison = (a.title || a.session_id).localeCompare(b.title || b.session_id);
              break;
            case 'status':
              comparison = a.status.localeCompare(b.status);
              break;
          }

          return sorting.direction === 'desc' ? -comparison : comparison;
        });

        return sessions;
      },

      getSessionByKey: (key: string) => {
        return get().sessionDataStore[key];
      },
      }),
      {
        name: 'ccw-workflow-store',
        // Only persist projectPath - minimal state for workspace switching
        partialize: (state) => ({
          projectPath: state.projectPath,
        }),
        // Skip automatic hydration to avoid TDZ error during module initialization
        // Hydration will be triggered manually in AppShell after mount
        skipHydration: true,
      }
    )
);

// Selectors for common access patterns
export const selectWorkflowData = (state: WorkflowStore) => state.workflowData;
export const selectActiveSessions = (state: WorkflowStore) => state.workflowData.activeSessions;
export const selectArchivedSessions = (state: WorkflowStore) => state.workflowData.archivedSessions;
export const selectActiveSessionId = (state: WorkflowStore) => state.activeSessionId;
export const selectProjectPath = (state: WorkflowStore) => state.projectPath;
export const selectFilters = (state: WorkflowStore) => state.filters;
export const selectSorting = (state: WorkflowStore) => state.sorting;
