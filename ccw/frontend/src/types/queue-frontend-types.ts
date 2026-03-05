// ========================================
// Queue Scheduler Frontend Types
// ========================================
// Frontend type definitions for the queue scheduling system.
// Mirrors backend queue-types.ts for wire format compatibility.

// ========== Item Status ==========

/**
 * Status of a single queue item through its lifecycle.
 * Must match backend QueueItemStatus exactly.
 */
export type QueueItemStatus =
  | 'pending'     // Submitted, awaiting dependency check
  | 'queued'      // Dependencies met, waiting for session
  | 'ready'       // Ready for execution
  | 'executing'   // Running in an allocated CLI session
  | 'completed'   // Finished successfully
  | 'failed'      // Finished with error
  | 'blocked'     // Waiting on depends_on items to complete
  | 'cancelled';  // Cancelled by user

// ========== Scheduler Status ==========

/**
 * Status of the scheduler service itself.
 * Must match backend QueueSchedulerStatus exactly.
 */
export type QueueSchedulerStatus =
  | 'idle'        // No active queue, waiting for items
  | 'running'     // Actively processing queue items
  | 'paused'      // User-paused, no new items dispatched
  | 'stopping'    // Graceful stop in progress, waiting for executing items
  | 'completed'   // All items processed successfully
  | 'failed';     // Queue terminated due to critical error

// ========== Scheduler Config ==========

/**
 * Configuration for the queue scheduler.
 * Must match backend QueueSchedulerConfig exactly.
 */
export interface QueueSchedulerConfig {
  /** Maximum number of concurrent CLI sessions executing tasks */
  maxConcurrentSessions: number;
  /** Idle timeout (ms) before releasing a session from the pool */
  sessionIdleTimeoutMs: number;
  /** Timeout (ms) for resumeKey-to-session binding affinity */
  resumeKeySessionBindingTimeoutMs: number;
}

// ========== Queue Item ==========

/**
 * A single task item in the execution queue.
 * Must match backend QueueItem exactly.
 */
export interface QueueItem {
  /** Unique identifier for this queue item */
  item_id: string;
  /** Reference to the parent issue (if applicable) */
  issue_id?: string;
  /** Current status of the item */
  status: QueueItemStatus;
  /** CLI tool to use for execution (e.g., 'gemini', 'claude') */
  tool: string;
  /** Prompt/instruction to send to the CLI tool */
  prompt: string;
  /** Execution mode */
  mode?: 'analysis' | 'write' | 'auto';
  /** Resume key for session affinity and conversation continuity */
  resumeKey?: string;
  /** Strategy for resuming a previous CLI session */
  resumeStrategy?: string;
  /** Item IDs that must complete before this item can execute */
  depends_on: string[];
  /** Numeric order for scheduling priority within a group. Lower = earlier */
  execution_order: number;
  /** Logical grouping for related items (e.g., same issue) */
  execution_group?: string;
  /** Session key assigned when executing */
  sessionKey?: string;
  /** Timestamp when item was added to the queue */
  createdAt: string;
  /** Timestamp when execution started */
  startedAt?: string;
  /** Timestamp when execution completed (success or failure) */
  completedAt?: string;
  /** Error message if status is 'failed' */
  error?: string;
  /** Output from CLI execution */
  output?: string;
  /** Arbitrary metadata for extensibility */
  metadata?: Record<string, unknown>;
}

// ========== Session Binding ==========

/**
 * Tracks a session bound to a resumeKey for affinity-based allocation.
 * Must match backend SessionBinding exactly.
 */
export interface SessionBinding {
  /** The CLI session key from CliSessionManager */
  sessionKey: string;
  /** Timestamp of last activity on this binding */
  lastUsed: string;
}

// ========== Scheduler State ==========

/**
 * Complete snapshot of the scheduler state.
 * Must match backend QueueSchedulerState exactly.
 */
export interface QueueSchedulerState {
  /** Current scheduler status */
  status: QueueSchedulerStatus;
  /** All items in the queue */
  items: QueueItem[];
  /** Session pool: resumeKey -> SessionBinding */
  sessionPool: Record<string, SessionBinding>;
  /** Active scheduler configuration */
  config: QueueSchedulerConfig;
  /** Number of currently executing tasks */
  currentConcurrency: number;
  /** Timestamp of last scheduler activity */
  lastActivityAt: string;
  /** Error message if scheduler status is 'failed' */
  error?: string;
}

// ========== WebSocket Message Types ==========

/**
 * Discriminator values for queue-related WebSocket messages.
 */
export type QueueWSMessageType =
  | 'QUEUE_SCHEDULER_STATE_UPDATE'
  | 'QUEUE_ITEM_ADDED'
  | 'QUEUE_ITEM_UPDATED'
  | 'QUEUE_ITEM_REMOVED'
  | 'QUEUE_SCHEDULER_CONFIG_UPDATED';

// ========== WebSocket Messages (Discriminated Union) ==========

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
 * Use `msg.type` as the discriminator in switch statements.
 */
export type QueueWSMessage =
  | QueueSchedulerStateUpdateMessage
  | QueueItemAddedMessage
  | QueueItemUpdatedMessage
  | QueueItemRemovedMessage
  | QueueSchedulerConfigUpdatedMessage;
