// ========================================
// Queue Scheduler Store
// ========================================
// Zustand store for queue scheduler state management.
// Handles WebSocket message dispatch, API actions, and provides
// granular selectors for efficient React re-renders.

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  QueueSchedulerStatus,
  QueueSchedulerConfig,
  QueueItem,
  QueueSchedulerState,
  QueueWSMessage,
  SessionBinding,
} from '../types/queue-frontend-types';

// ========== Default Config ==========

const DEFAULT_CONFIG: QueueSchedulerConfig = {
  maxConcurrentSessions: 2,
  sessionIdleTimeoutMs: 60_000,
  resumeKeySessionBindingTimeoutMs: 300_000,
};

// ========== Store State Interface ==========

/**
 * Store state extends the wire format QueueSchedulerState with
 * nullable fields for "not yet loaded" state.
 */
interface QueueSchedulerStoreState {
  status: QueueSchedulerStatus;
  items: QueueItem[];
  sessionPool: Record<string, SessionBinding>;
  config: QueueSchedulerConfig;
  currentConcurrency: number;
  lastActivityAt: string | null;
  error: string | null;
}

// ========== Actions Interface ==========

interface QueueSchedulerActions {
  /** Dispatch a WebSocket message to update store state */
  handleSchedulerMessage: (msg: QueueWSMessage) => void;
  /** Fetch initial state from GET /api/queue/scheduler/state */
  loadInitialState: () => Promise<void>;
  /** Submit items to the queue via POST /api/queue/execute (auto-starts if idle) */
  submitItems: (items: QueueItem[]) => Promise<void>;
  /** Start the queue scheduler via POST /api/queue/scheduler/start */
  startQueue: (items?: QueueItem[]) => Promise<void>;
  /** Pause the queue scheduler via POST /api/queue/scheduler/pause */
  pauseQueue: () => Promise<void>;
  /** Stop the queue scheduler via POST /api/queue/scheduler/stop */
  stopQueue: () => Promise<void>;
  /** Reset the queue scheduler via POST /api/queue/scheduler/reset */
  resetQueue: () => Promise<void>;
  /** Clear workspace-scoped scheduler state and invalidate stale loads */
  resetState: () => void;
  /** Update scheduler config via POST /api/queue/scheduler/config */
  updateConfig: (config: Partial<QueueSchedulerConfig>) => Promise<void>;
}

export type QueueSchedulerStore = QueueSchedulerStoreState & QueueSchedulerActions;

// ========== Initial State ==========

const initialState: QueueSchedulerStoreState = {
  status: 'idle',
  items: [],
  sessionPool: {},
  config: DEFAULT_CONFIG,
  currentConcurrency: 0,
  lastActivityAt: null,
  error: null,
};

let loadInitialStateRequestVersion = 0;

// ========== Store ==========

export const useQueueSchedulerStore = create<QueueSchedulerStore>()(
  devtools(
    (set) => ({
      ...initialState,

      // ========== WebSocket Message Handler ==========

      handleSchedulerMessage: (msg: QueueWSMessage) => {
        switch (msg.type) {
          case 'QUEUE_SCHEDULER_STATE_UPDATE':
            // Backend sends full state snapshot
            set(
              {
                status: msg.state.status,
                items: msg.state.items,
                sessionPool: msg.state.sessionPool,
                config: msg.state.config,
                currentConcurrency: msg.state.currentConcurrency,
                lastActivityAt: msg.state.lastActivityAt,
                error: msg.state.error ?? null,
              },
              false,
              'handleSchedulerMessage/QUEUE_SCHEDULER_STATE_UPDATE'
            );
            break;

          case 'QUEUE_ITEM_ADDED':
            set(
              (state) => ({
                items: [...state.items, msg.item],
              }),
              false,
              'handleSchedulerMessage/QUEUE_ITEM_ADDED'
            );
            break;

          case 'QUEUE_ITEM_UPDATED':
            set(
              (state) => ({
                items: state.items.map((item) =>
                  item.item_id === msg.item.item_id ? msg.item : item
                ),
              }),
              false,
              'handleSchedulerMessage/QUEUE_ITEM_UPDATED'
            );
            break;

          case 'QUEUE_ITEM_REMOVED':
            set(
              (state) => ({
                items: state.items.filter((item) => item.item_id !== msg.item_id),
              }),
              false,
              'handleSchedulerMessage/QUEUE_ITEM_REMOVED'
            );
            break;

          case 'QUEUE_SCHEDULER_CONFIG_UPDATED':
            set(
              {
                config: msg.config,
              },
              false,
              'handleSchedulerMessage/QUEUE_SCHEDULER_CONFIG_UPDATED'
            );
            break;

          // No default - all 5 message types are handled exhaustively
        }
      },

      // ========== API Actions ==========

      submitItems: async (items: QueueItem[]) => {
        try {
          const response = await fetch('/api/queue/execute', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items }),
          });
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || body.message || response.statusText);
          }
          // State will be updated via WebSocket broadcast from backend
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error('[QueueScheduler] submitItems error:', message);
          set({ error: message }, false, 'submitItems/error');
          throw error;
        }
      },

      loadInitialState: async () => {
        const requestVersion = ++loadInitialStateRequestVersion;

        try {
          const response = await fetch('/api/queue/scheduler/state', {
            credentials: 'same-origin',
          });
          if (!response.ok) {
            throw new Error(`Failed to load scheduler state: ${response.statusText}`);
          }
          const data: QueueSchedulerState = await response.json();

          if (requestVersion !== loadInitialStateRequestVersion) {
            return;
          }

          set(
            {
              status: data.status,
              items: data.items,
              sessionPool: data.sessionPool,
              config: data.config,
              currentConcurrency: data.currentConcurrency,
              lastActivityAt: data.lastActivityAt,
              error: data.error ?? null,
            },
            false,
            'loadInitialState'
          );
        } catch (error) {
          if (requestVersion !== loadInitialStateRequestVersion) {
            return;
          }

          // Silently ignore network errors (backend not connected)
          // Only log non-network errors
          const message = error instanceof Error ? error.message : 'Unknown error';
          const isNetworkError =
            message.includes('Failed to fetch') ||
            message.includes('NetworkError') ||
            message.includes('Network request failed') ||
            message.includes('ERR_CONNECTION_REFUSED') ||
            message.includes('ERR_CONNECTION_RESET');

          if (!isNetworkError) {
            console.error('[QueueScheduler] loadInitialState error:', message);
            set({ error: message }, false, 'loadInitialState/error');
          }
          // For network errors, keep state as-is without showing error
        }
      },

      startQueue: async (items?: QueueItem[]) => {
        try {
          const body = items ? { items } : {};
          const response = await fetch('/api/queue/scheduler/start', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || body.message || response.statusText);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error('[QueueScheduler] startQueue error:', message);
          set({ error: message }, false, 'startQueue/error');
        }
      },

      pauseQueue: async () => {
        try {
          const response = await fetch('/api/queue/scheduler/pause', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || body.message || response.statusText);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error('[QueueScheduler] pauseQueue error:', message);
          set({ error: message }, false, 'pauseQueue/error');
        }
      },

      stopQueue: async () => {
        try {
          const response = await fetch('/api/queue/scheduler/stop', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || body.message || response.statusText);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error('[QueueScheduler] stopQueue error:', message);
          set({ error: message }, false, 'stopQueue/error');
        }
      },

      resetQueue: async () => {
        try {
          const response = await fetch('/api/queue/scheduler/reset', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || body.message || response.statusText);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error('[QueueScheduler] resetQueue error:', message);
          set({ error: message }, false, 'resetQueue/error');
        }
      },

      resetState: () => {
        loadInitialStateRequestVersion += 1;
        set({ ...initialState }, false, 'resetState');
      },

      updateConfig: async (config: Partial<QueueSchedulerConfig>) => {
        try {
          const response = await fetch('/api/queue/scheduler/config', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
          });
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || body.message || response.statusText);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error('[QueueScheduler] updateConfig error:', message);
          set({ error: message }, false, 'updateConfig/error');
        }
      },
    }),
    { name: 'QueueSchedulerStore' }
  )
);

// ========== Selectors ==========

/** Stable empty array to avoid new references on each call */
const EMPTY_ITEMS: QueueItem[] = [];

/** Select current scheduler status */
export const selectQueueSchedulerStatus = (state: QueueSchedulerStore): QueueSchedulerStatus =>
  state?.status ?? 'idle';

/** Select all queue items */
export const selectQueueItems = (state: QueueSchedulerStore): QueueItem[] =>
  state?.items ?? EMPTY_ITEMS;

/**
 * Select items that are ready to execute (status 'queued' or 'pending').
 * WARNING: Returns new array each call - use with useMemo in components.
 */
export const selectReadyItems = (state: QueueSchedulerStore): QueueItem[] => {
  const ready = state.items.filter(
    (item) => item.status === 'queued' || item.status === 'pending'
  );
  return ready.length === 0 ? EMPTY_ITEMS : ready;
};

/**
 * Select items that are blocked (status 'blocked').
 * WARNING: Returns new array each call - use with useMemo in components.
 */
export const selectBlockedItems = (state: QueueSchedulerStore): QueueItem[] => {
  const blocked = state.items.filter((item) => item.status === 'blocked');
  return blocked.length === 0 ? EMPTY_ITEMS : blocked;
};

/**
 * Select items currently executing (status 'executing').
 * WARNING: Returns new array each call - use with useMemo in components.
 */
export const selectExecutingItems = (state: QueueSchedulerStore): QueueItem[] => {
  const executing = state.items.filter((item) => item.status === 'executing');
  return executing.length === 0 ? EMPTY_ITEMS : executing;
};

/**
 * Calculate overall scheduler progress as a percentage (0-100).
 * Progress = (completed + failed) / total * 100.
 * Returns 0 when there are no items.
 */
export const selectSchedulerProgress = (state: QueueSchedulerStore): number => {
  if (!state) return 0;
  const items = state.items ?? EMPTY_ITEMS;
  const total = items.length;
  if (total === 0) return 0;
  const terminal = items.filter(
    (item) => item.status === 'completed' || item.status === 'failed'
  ).length;
  return Math.round((terminal / total) * 100);
};

/** Select scheduler config */
export const selectSchedulerConfig = (state: QueueSchedulerStore): QueueSchedulerConfig =>
  state.config;

/** Select session pool */
export const selectSessionPool = (state: QueueSchedulerStore): Record<string, SessionBinding> =>
  state.sessionPool;

/** Select current concurrency */
export const selectCurrentConcurrency = (state: QueueSchedulerStore): number =>
  state.currentConcurrency;

/** Select scheduler error */
export const selectSchedulerError = (state: QueueSchedulerStore): string | null =>
  state.error;

// ========== Auto-initialization ==========

/**
 * Flag to prevent multiple initialization calls.
 * This is set outside the store to avoid triggering re-renders.
 */
let schedulerInitialized = false;

/**
 * Initialize the queue scheduler state once.
 * Safe to call multiple times - will only initialize once.
 */
export function initializeScheduler(): void {
  if (!schedulerInitialized) {
    schedulerInitialized = true;
    useQueueSchedulerStore.getState().loadInitialState().catch((error) => {
      console.error('[QueueScheduler] Failed to initialize:', error);
      // Reset flag on error to allow retry
      schedulerInitialized = false;
    });
  }
}

// Auto-initialize when this module is imported (deferred to next tick)
if (typeof window !== 'undefined') {
  // Defer initialization to avoid blocking initial render
  // and to ensure all store subscriptions are set up first
  setTimeout(() => {
    initializeScheduler();
  }, 100);
}
