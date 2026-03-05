/**
 * Queue Scheduler Type Definitions
 * TypeScript types for queue scheduling, dependency resolution, and session management.
 */

import type { CliSessionResumeStrategy } from '../core/services/cli-session-command-builder.js';

// ============================================================================
// Status Enums
// ============================================================================

/**
 * Status of a single queue item through its lifecycle.
 *
 * Transitions:
 *   pending -> queued -> ready -> executing -> completed | failed
 *   pending -> blocked (has unresolved depends_on)
 *   blocked -> queued (all depends_on completed)
 *   any -> cancelled (user cancellation)
 */
export type QueueItemStatus =
  | 'pending'
  | 'queued'
  | 'ready'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'cancelled';

/**
 * Status of the scheduler state machine.
 *
 * Transitions:
 *   idle -> running (start)
 *   running -> paused (pause)
 *   running -> stopping (stop requested, waiting for executing tasks)
 *   paused -> running (resume)
 *   stopping -> completed (all executing tasks finished successfully)
 *   stopping -> failed (executing task failure during stop)
 */
export type QueueSchedulerStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'completed'
  | 'failed';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the queue scheduler.
 */
export interface QueueSchedulerConfig {
  /** Maximum number of concurrent CLI sessions executing tasks. */
  maxConcurrentSessions: number;
  /** Idle timeout (ms) before releasing a session from the pool. */
  sessionIdleTimeoutMs: number;
  /** Timeout (ms) for resumeKey-to-session binding affinity. */
  resumeKeySessionBindingTimeoutMs: number;
}

// ============================================================================
// Core Entities
// ============================================================================

/**
 * A single task item in the execution queue.
 */
export interface QueueItem {
  /** Unique identifier for this queue item. */
  item_id: string;
  /** Reference to the parent issue (if applicable). */
  issue_id?: string;
  /** Current status of the item. */
  status: QueueItemStatus;
  /** CLI tool to use for execution (e.g., 'gemini', 'claude'). */
  tool: string;
  /** Prompt/instruction to send to the CLI tool. */
  prompt: string;
  /** Execution mode. */
  mode?: 'analysis' | 'write' | 'auto';
  /** Resume key for session affinity and conversation continuity. */
  resumeKey?: string;
  /** Strategy for resuming a previous CLI session. */
  resumeStrategy?: CliSessionResumeStrategy;
  /** Item IDs that must complete before this item can execute. */
  depends_on: string[];
  /** Numeric order for scheduling priority within a group. Lower = earlier. */
  execution_order: number;
  /** Logical grouping for related items (e.g., same issue). */
  execution_group?: string;
  /** Session key assigned when executing. */
  sessionKey?: string;
  /** Timestamp when item was added to the queue. */
  createdAt: string;
  /** Timestamp when execution started. */
  startedAt?: string;
  /** Timestamp when execution completed (success or failure). */
  completedAt?: string;
  /** Error message if status is 'failed'. */
  error?: string;
  /** Output from CLI execution. */
  output?: string;
  /** Arbitrary metadata for extensibility. */
  metadata?: Record<string, unknown>;
}

/**
 * Tracks a session bound to a resumeKey for affinity-based allocation.
 */
export interface SessionBinding {
  /** The CLI session key from CliSessionManager. */
  sessionKey: string;
  /** Timestamp of last activity on this binding. */
  lastUsed: string;
}

/**
 * Complete snapshot of the scheduler state, used for WS broadcast and API responses.
 */
export interface QueueSchedulerState {
  /** Current scheduler status. */
  status: QueueSchedulerStatus;
  /** All items in the queue (pending, executing, completed, etc.). */
  items: QueueItem[];
  /** Session pool: resumeKey -> SessionBinding. */
  sessionPool: Record<string, SessionBinding>;
  /** Active scheduler configuration. */
  config: QueueSchedulerConfig;
  /** Number of currently executing tasks. */
  currentConcurrency: number;
  /** Timestamp of last scheduler activity. */
  lastActivityAt: string;
  /** Error message if scheduler status is 'failed'. */
  error?: string;
}

// ============================================================================
// WebSocket Message Types
// ============================================================================

/**
 * Discriminator values for queue-related WebSocket messages.
 */
export type QueueWSMessageType =
  | 'QUEUE_SCHEDULER_STATE_UPDATE'
  | 'QUEUE_ITEM_ADDED'
  | 'QUEUE_ITEM_UPDATED'
  | 'QUEUE_ITEM_REMOVED'
  | 'QUEUE_SCHEDULER_CONFIG_UPDATED';

/**
 * Full scheduler state broadcast (sent on start/pause/stop/complete).
 */
export interface QueueSchedulerStateUpdateMessage {
  type: 'QUEUE_SCHEDULER_STATE_UPDATE';
  state: QueueSchedulerState;
  timestamp: string;
}

/**
 * Broadcast when a new item is added to the queue.
 */
export interface QueueItemAddedMessage {
  type: 'QUEUE_ITEM_ADDED';
  item: QueueItem;
  timestamp: string;
}

/**
 * Broadcast when an item's status or data changes.
 */
export interface QueueItemUpdatedMessage {
  type: 'QUEUE_ITEM_UPDATED';
  item: QueueItem;
  timestamp: string;
}

/**
 * Broadcast when an item is removed from the queue.
 */
export interface QueueItemRemovedMessage {
  type: 'QUEUE_ITEM_REMOVED';
  item_id: string;
  timestamp: string;
}

/**
 * Broadcast when scheduler configuration is updated.
 */
export interface QueueSchedulerConfigUpdatedMessage {
  type: 'QUEUE_SCHEDULER_CONFIG_UPDATED';
  config: QueueSchedulerConfig;
  timestamp: string;
}

/**
 * Discriminated union of all queue WebSocket messages.
 */
export type QueueWSMessage =
  | QueueSchedulerStateUpdateMessage
  | QueueItemAddedMessage
  | QueueItemUpdatedMessage
  | QueueItemRemovedMessage
  | QueueSchedulerConfigUpdatedMessage;
