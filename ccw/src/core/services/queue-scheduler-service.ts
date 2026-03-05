/**
 * Queue Scheduler Service
 *
 * Core scheduling engine managing task queue lifecycle with state machine,
 * dependency resolution, session pool management, and concurrency control.
 *
 * Integrates with:
 * - cli-session-manager.ts for PTY session creation and command execution
 * - websocket.ts for real-time state broadcasts via broadcastToClients
 * - queue-types.ts for type definitions
 *
 * Design decisions:
 * - In-memory state (no persistence) for simplicity; crash recovery deferred.
 * - processQueue() selection phase runs synchronously to avoid race conditions
 *   in session allocation; only execution is async.
 * - Session pool uses 3-tier allocation: resumeKey affinity -> idle reuse -> new creation.
 */

import type { CliSessionManager } from './cli-session-manager.js';
import type {
  QueueItem,
  QueueItemStatus,
  QueueSchedulerConfig,
  QueueSchedulerState,
  QueueSchedulerStatus,
  QueueWSMessage,
  SessionBinding,
} from '../../types/queue-types.js';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: QueueSchedulerConfig = {
  maxConcurrentSessions: 2,
  sessionIdleTimeoutMs: 5 * 60 * 1000,          // 5 minutes
  resumeKeySessionBindingTimeoutMs: 30 * 60 * 1000, // 30 minutes
};

/**
 * Valid state machine transitions.
 * Key = current status, Value = set of allowed target statuses.
 */
const VALID_TRANSITIONS: Record<QueueSchedulerStatus, Set<QueueSchedulerStatus>> = {
  idle:      new Set(['running']),
  running:   new Set(['paused', 'stopping']),
  paused:    new Set(['running', 'stopping']),
  stopping:  new Set(['completed', 'failed']),
  completed: new Set(['idle']),
  failed:    new Set(['idle']),
};

// ============================================================================
// QueueSchedulerService
// ============================================================================

export class QueueSchedulerService {
  private state: QueueSchedulerState;
  private broadcastFn: (data: unknown) => void;
  private cliSessionManager: CliSessionManager;

  /** Tracks in-flight execution promises by item_id. */
  private executingTasks = new Map<string, Promise<void>>();

  /** Interval handle for session idle cleanup. */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /** Guard to prevent re-entrant processQueue calls. */
  private processingLock = false;

  constructor(
    broadcastToClients: (data: unknown) => void,
    cliSessionManager: CliSessionManager,
    config?: Partial<QueueSchedulerConfig>,
  ) {
    this.broadcastFn = broadcastToClients;
    this.cliSessionManager = cliSessionManager;

    const mergedConfig: QueueSchedulerConfig = { ...DEFAULT_CONFIG, ...config };

    this.state = {
      status: 'idle',
      items: [],
      sessionPool: {},
      config: mergedConfig,
      currentConcurrency: 0,
      lastActivityAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Start the scheduler with an initial set of items.
   * Transitions: idle -> running.
   */
  start(items: QueueItem[]): void {
    this.validateTransition('running');
    this.state.status = 'running';
    this.state.error = undefined;
    this.touchActivity();

    // Resolve initial statuses based on dependency graph
    for (const item of items) {
      const resolved = this.resolveInitialStatus(item, items);
      this.state.items.push({ ...item, status: resolved });
    }

    this.startCleanupInterval();
    this.broadcastStateUpdate();

    // Kick off the scheduling loop (non-blocking)
    void this.processQueue();
  }

  /**
   * Pause the scheduler. Running tasks continue to completion but no new tasks start.
   * Transitions: running -> paused.
   */
  pause(): void {
    this.validateTransition('paused');
    this.state.status = 'paused';
    this.touchActivity();
    this.broadcastStateUpdate();
  }

  /**
   * Resume from paused state.
   * Transitions: paused -> running.
   */
  resume(): void {
    this.validateTransition('running');
    this.state.status = 'running';
    this.touchActivity();
    this.broadcastStateUpdate();
    void this.processQueue();
  }

  /**
   * Request graceful stop. Waits for executing tasks to finish.
   * Transitions: running|paused -> stopping -> completed|failed.
   */
  async stop(): Promise<void> {
    this.validateTransition('stopping');
    this.state.status = 'stopping';
    this.touchActivity();
    this.broadcastStateUpdate();

    // Wait for all in-flight executions
    if (this.executingTasks.size > 0) {
      await Promise.allSettled(Array.from(this.executingTasks.values()));
    }

    // Determine final status
    const hasFailures = this.state.items.some(i => i.status === 'failed');
    const finalStatus: QueueSchedulerStatus = hasFailures ? 'failed' : 'completed';
    this.state.status = finalStatus;

    // Cancel any remaining pending/queued/blocked items
    for (const item of this.state.items) {
      if (item.status === 'pending' || item.status === 'queued' || item.status === 'ready' || item.status === 'blocked') {
        item.status = 'cancelled';
        item.completedAt = new Date().toISOString();
      }
    }

    this.stopCleanupInterval();
    this.touchActivity();
    this.broadcastStateUpdate();
  }

  /**
   * Reset the scheduler back to idle, clearing all items and session pool.
   * Transitions: completed|failed -> idle.
   */
  reset(): void {
    this.validateTransition('idle');
    this.state.status = 'idle';
    this.state.items = [];
    this.state.sessionPool = {};
    this.state.currentConcurrency = 0;
    this.state.error = undefined;
    this.executingTasks.clear();
    this.stopCleanupInterval();
    this.touchActivity();
    this.broadcastStateUpdate();
  }

  /**
   * Add a single item to the queue while the scheduler is running.
   */
  addItem(item: QueueItem): void {
    const resolved = this.resolveInitialStatus(item, this.state.items);
    const newItem = { ...item, status: resolved };
    this.state.items.push(newItem);
    this.touchActivity();

    this.broadcast({
      type: 'QUEUE_ITEM_ADDED',
      item: newItem,
      timestamp: new Date().toISOString(),
    });

    // Trigger scheduling if running
    if (this.state.status === 'running') {
      void this.processQueue();
    }
  }

  /**
   * Remove an item from the queue. Only non-executing items can be removed.
   */
  removeItem(itemId: string): boolean {
    const idx = this.state.items.findIndex(i => i.item_id === itemId);
    if (idx === -1) return false;

    const item = this.state.items[idx];
    if (item.status === 'executing') return false;

    this.state.items.splice(idx, 1);
    this.touchActivity();

    this.broadcast({
      type: 'QUEUE_ITEM_REMOVED',
      item_id: itemId,
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Update scheduler configuration at runtime.
   */
  updateConfig(partial: Partial<QueueSchedulerConfig>): void {
    Object.assign(this.state.config, partial);
    this.touchActivity();

    this.broadcast({
      type: 'QUEUE_SCHEDULER_CONFIG_UPDATED',
      config: { ...this.state.config },
      timestamp: new Date().toISOString(),
    });

    // If maxConcurrentSessions increased, try to schedule more
    if (partial.maxConcurrentSessions !== undefined && this.state.status === 'running') {
      void this.processQueue();
    }
  }

  /**
   * Get a snapshot of the current scheduler state.
   */
  getState(): QueueSchedulerState {
    return {
      ...this.state,
      items: this.state.items.map(i => ({ ...i })),
      sessionPool: { ...this.state.sessionPool },
      config: { ...this.state.config },
    };
  }

  /**
   * Get a specific item by ID.
   */
  getItem(itemId: string): QueueItem | undefined {
    return this.state.items.find(i => i.item_id === itemId);
  }

  // ==========================================================================
  // Core Scheduling Loop
  // ==========================================================================

  /**
   * Main scheduling loop. Resolves dependencies, selects ready tasks,
   * allocates sessions, and triggers execution.
   *
   * The selection phase is synchronous (guarded by processingLock) to prevent
   * race conditions in session allocation. Only execution is async.
   */
  private async processQueue(): Promise<void> {
    // Guard: prevent re-entrant calls
    if (this.processingLock) return;
    this.processingLock = true;

    try {
      while (this.state.status === 'running') {
        // Step 1: Check preconditions
        if (this.state.currentConcurrency >= this.state.config.maxConcurrentSessions) {
          break;
        }

        // Step 2: Resolve blocked items whose dependencies are now completed
        this.resolveDependencies();

        // Step 3: Select next task to execute
        const candidate = this.selectNextTask();
        if (!candidate) {
          // Check if everything is done
          this.checkCompletion();
          break;
        }

        // Step 4: Allocate a session
        const sessionKey = this.allocateSession(candidate);
        if (!sessionKey) {
          // Could not allocate a session (all slots busy)
          break;
        }

        // Step 5: Mark as executing and launch
        candidate.status = 'executing';
        candidate.sessionKey = sessionKey;
        candidate.startedAt = new Date().toISOString();
        this.state.currentConcurrency++;
        this.touchActivity();

        this.broadcastItemUpdate(candidate);

        // Step 6: Execute asynchronously
        const execPromise = this.executeTask(candidate, sessionKey);
        this.executingTasks.set(candidate.item_id, execPromise);

        // Chain cleanup and re-trigger
        void execPromise.then(() => {
          this.executingTasks.delete(candidate.item_id);
          // Re-trigger scheduling on completion
          if (this.state.status === 'running') {
            void this.processQueue();
          }
        });
      }
    } finally {
      this.processingLock = false;
    }
  }

  /**
   * Resolve blocked items whose depends_on are all completed.
   */
  private resolveDependencies(): void {
    const completedIds = new Set(
      this.state.items
        .filter(i => i.status === 'completed')
        .map(i => i.item_id),
    );

    for (const item of this.state.items) {
      if (item.status !== 'blocked' && item.status !== 'pending') continue;

      if (item.depends_on.length === 0) {
        if (item.status === 'pending') {
          item.status = 'queued';
          this.broadcastItemUpdate(item);
        }
        continue;
      }

      // Check if any dependency failed
      const anyDepFailed = item.depends_on.some(depId => {
        const dep = this.state.items.find(i => i.item_id === depId);
        return dep && (dep.status === 'failed' || dep.status === 'cancelled');
      });
      if (anyDepFailed) {
        item.status = 'cancelled';
        item.completedAt = new Date().toISOString();
        item.error = 'Dependency failed or was cancelled';
        this.broadcastItemUpdate(item);
        continue;
      }

      const allDepsComplete = item.depends_on.every(depId => completedIds.has(depId));
      if (allDepsComplete) {
        item.status = 'queued';
        this.broadcastItemUpdate(item);
      } else if (item.status === 'pending') {
        item.status = 'blocked';
        this.broadcastItemUpdate(item);
      }
    }
  }

  /**
   * Select the next queued task by execution_order, then createdAt.
   */
  private selectNextTask(): QueueItem | undefined {
    const queued = this.state.items.filter(i => i.status === 'queued');
    if (queued.length === 0) return undefined;

    queued.sort((a, b) => {
      if (a.execution_order !== b.execution_order) {
        return a.execution_order - b.execution_order;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });

    return queued[0];
  }

  // ==========================================================================
  // Session Pool Management
  // ==========================================================================

  /**
   * 3-tier session allocation strategy:
   * 1. ResumeKey affinity: if the item has a resumeKey and we have a bound session, reuse it.
   * 2. Idle session reuse: find any session in the pool not currently executing.
   * 3. New session creation: create a new session via CliSessionManager if under the limit.
   *
   * Returns sessionKey or null if no session available.
   */
  private allocateSession(item: QueueItem): string | null {
    const now = new Date();

    // Tier 1: ResumeKey affinity
    if (item.resumeKey) {
      const binding = this.state.sessionPool[item.resumeKey];
      if (binding) {
        const bindingAge = now.getTime() - new Date(binding.lastUsed).getTime();
        if (bindingAge < this.state.config.resumeKeySessionBindingTimeoutMs) {
          // Verify the session still exists in CliSessionManager
          if (this.cliSessionManager.hasSession(binding.sessionKey)) {
            binding.lastUsed = now.toISOString();
            return binding.sessionKey;
          }
          // Session gone, remove stale binding
          delete this.state.sessionPool[item.resumeKey];
        } else {
          // Binding expired
          delete this.state.sessionPool[item.resumeKey];
        }
      }
    }

    // Tier 2: Idle session reuse
    const executingSessionKeys = new Set(
      this.state.items
        .filter(i => i.status === 'executing' && i.sessionKey)
        .map(i => i.sessionKey!),
    );

    for (const [resumeKey, binding] of Object.entries(this.state.sessionPool)) {
      if (!executingSessionKeys.has(binding.sessionKey)) {
        // This session is idle in the pool
        if (this.cliSessionManager.hasSession(binding.sessionKey)) {
          binding.lastUsed = now.toISOString();
          // Rebind to new resumeKey if different
          if (item.resumeKey && item.resumeKey !== resumeKey) {
            this.state.sessionPool[item.resumeKey] = binding;
          }
          return binding.sessionKey;
        }
        // Stale session, clean up
        delete this.state.sessionPool[resumeKey];
      }
    }

    // Tier 3: New session creation
    const activeSessions = this.cliSessionManager.listSessions();
    // Count sessions managed by our pool (not all sessions globally)
    const poolSessionKeys = new Set(
      Object.values(this.state.sessionPool).map(b => b.sessionKey),
    );
    const ourActiveCount = activeSessions.filter(s => poolSessionKeys.has(s.sessionKey)).length;

    if (ourActiveCount < this.state.config.maxConcurrentSessions) {
      try {
        const newSession = this.cliSessionManager.createSession({
          workingDir: this.cliSessionManager.getProjectRoot(),
          tool: item.tool,
          resumeKey: item.resumeKey,
        });

        const binding: SessionBinding = {
          sessionKey: newSession.sessionKey,
          lastUsed: now.toISOString(),
        };

        // Bind to resumeKey if available, otherwise use item_id as key
        const poolKey = item.resumeKey || item.item_id;
        this.state.sessionPool[poolKey] = binding;

        return newSession.sessionKey;
      } catch (err) {
        console.error('[QueueScheduler] Failed to create session:', (err as Error).message);
        return null;
      }
    }

    return null;
  }

  /**
   * Release a session back to the pool after task completion.
   */
  private releaseSession(item: QueueItem): void {
    if (!item.sessionKey) return;

    // Update the binding's lastUsed timestamp
    const poolKey = item.resumeKey || item.item_id;
    const binding = this.state.sessionPool[poolKey];
    if (binding && binding.sessionKey === item.sessionKey) {
      binding.lastUsed = new Date().toISOString();
    }
  }

  // ==========================================================================
  // Task Execution
  // ==========================================================================

  /**
   * Execute a single queue item via CliSessionManager.
   */
  private async executeTask(item: QueueItem, sessionKey: string): Promise<void> {
    try {
      this.cliSessionManager.execute(sessionKey, {
        tool: item.tool,
        prompt: item.prompt,
        mode: item.mode,
        resumeKey: item.resumeKey,
        resumeStrategy: item.resumeStrategy,
      });

      // Mark as completed (fire-and-forget execution model for PTY sessions)
      // The actual CLI execution is async in the PTY; we mark completion
      // after the command is sent. Real completion tracking requires
      // hook callbacks or output parsing (future enhancement).
      item.status = 'completed';
      item.completedAt = new Date().toISOString();
    } catch (err) {
      item.status = 'failed';
      item.completedAt = new Date().toISOString();
      item.error = (err as Error).message;
    }

    // Update concurrency and release session
    this.state.currentConcurrency = Math.max(0, this.state.currentConcurrency - 1);
    this.releaseSession(item);
    this.touchActivity();
    this.broadcastItemUpdate(item);
  }

  // ==========================================================================
  // State Machine
  // ==========================================================================

  /**
   * Validate that the requested transition is allowed.
   * Throws if the transition is invalid.
   */
  private validateTransition(target: QueueSchedulerStatus): void {
    const allowed = VALID_TRANSITIONS[this.state.status];
    if (!allowed || !allowed.has(target)) {
      throw new Error(
        `Invalid state transition: ${this.state.status} -> ${target}. ` +
        `Allowed transitions from '${this.state.status}': [${Array.from(allowed || []).join(', ')}]`,
      );
    }
  }

  /**
   * Determine initial status for an item based on its dependencies.
   */
  private resolveInitialStatus(item: QueueItem, allItems: QueueItem[]): QueueItemStatus {
    if (item.depends_on.length === 0) {
      return 'queued';
    }
    // Check if all dependencies are already completed
    const completedIds = new Set(
      allItems.filter(i => i.status === 'completed').map(i => i.item_id),
    );
    const allResolved = item.depends_on.every(id => completedIds.has(id));
    return allResolved ? 'queued' : 'blocked';
  }

  /**
   * Check if all items are in a terminal state, and transition scheduler accordingly.
   */
  private checkCompletion(): void {
    if (this.state.status !== 'running') return;
    if (this.executingTasks.size > 0) return;

    const allTerminal = this.state.items.every(
      i => i.status === 'completed' || i.status === 'failed' || i.status === 'cancelled',
    );

    if (!allTerminal) return;

    const hasFailures = this.state.items.some(i => i.status === 'failed');
    // Transition through stopping to final state
    this.state.status = 'stopping';
    this.state.status = hasFailures ? 'failed' : 'completed';
    this.stopCleanupInterval();
    this.touchActivity();
    this.broadcastStateUpdate();
  }

  // ==========================================================================
  // Session Cleanup
  // ==========================================================================

  /**
   * Start periodic cleanup of idle sessions from the pool.
   */
  private startCleanupInterval(): void {
    this.stopCleanupInterval();
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleSessions();
    }, 60_000);

    // Prevent the timer from keeping the process alive
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  private stopCleanupInterval(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Remove sessions from the pool that have been idle beyond the timeout.
   */
  private cleanupIdleSessions(): void {
    const now = Date.now();
    const timeoutMs = this.state.config.sessionIdleTimeoutMs;

    const executingSessionKeys = new Set(
      this.state.items
        .filter(i => i.status === 'executing' && i.sessionKey)
        .map(i => i.sessionKey!),
    );

    for (const [key, binding] of Object.entries(this.state.sessionPool)) {
      // Skip sessions currently in use
      if (executingSessionKeys.has(binding.sessionKey)) continue;

      const idleMs = now - new Date(binding.lastUsed).getTime();
      if (idleMs >= timeoutMs) {
        // Close the session in CliSessionManager
        try {
          this.cliSessionManager.close(binding.sessionKey);
        } catch {
          // Session may already be gone
        }
        delete this.state.sessionPool[key];
      }
    }
  }

  // ==========================================================================
  // Broadcasting
  // ==========================================================================

  private broadcast(message: QueueWSMessage): void {
    try {
      this.broadcastFn(message);
    } catch {
      // Ignore broadcast errors
    }
  }

  private broadcastStateUpdate(): void {
    this.broadcast({
      type: 'QUEUE_SCHEDULER_STATE_UPDATE',
      state: this.getState(),
      timestamp: new Date().toISOString(),
    });
  }

  private broadcastItemUpdate(item: QueueItem): void {
    this.broadcast({
      type: 'QUEUE_ITEM_UPDATED',
      item: { ...item },
      timestamp: new Date().toISOString(),
    });
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private touchActivity(): void {
    this.state.lastActivityAt = new Date().toISOString();
  }
}
