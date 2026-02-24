/**
 * SessionEndService - Unified session end handling
 *
 * Provides centralized management for session-end tasks:
 *   - Task registration with priority
 *   - Async execution with error handling
 *   - Built-in tasks: incremental-embedding, clustering, heat-scores
 *
 * Design:
 *   - Best-effort execution (failures logged but don't block)
 *   - Priority-based ordering
 *   - Support for async background execution
 */

// =============================================================================
// Types
// =============================================================================

/**
 * A task to be executed at session end
 */
export interface EndTask {
  /** Unique task type identifier */
  type: string;
  /** Task priority (higher = executed first) */
  priority: number;
  /** Whether to run asynchronously in background */
  async: boolean;
  /** Task handler function */
  handler: () => Promise<void>;
  /** Optional description */
  description?: string;
}

/**
 * Result of a task execution
 */
export interface TaskResult {
  /** Task type identifier */
  type: string;
  /** Whether the task succeeded */
  success: boolean;
  /** Execution duration in milliseconds */
  duration: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Options for SessionEndService
 */
export interface SessionEndServiceOptions {
  /** Project root path */
  projectPath: string;
  /** Whether to log task execution */
  enableLogging?: boolean;
}

/**
 * Summary of session end execution
 */
export interface SessionEndSummary {
  /** Total tasks executed */
  totalTasks: number;
  /** Number of successful tasks */
  successful: number;
  /** Number of failed tasks */
  failed: number;
  /** Total execution time in milliseconds */
  totalDuration: number;
  /** Individual task results */
  results: TaskResult[];
}

// =============================================================================
// Built-in Task Types
// =============================================================================

/** Task type for incremental vector embedding */
export const TASK_INCREMENTAL_EMBEDDING = 'incremental-embedding';

/** Task type for incremental clustering */
export const TASK_INCREMENTAL_CLUSTERING = 'incremental-clustering';

/** Task type for heat score updates */
export const TASK_HEAT_SCORE_UPDATE = 'heat-score-update';

// =============================================================================
// SessionEndService
// =============================================================================

/**
 * Service for managing and executing session-end tasks
 *
 * This service provides a unified interface for registering and executing
 * background tasks when a session ends. Tasks are executed best-effort
 * with proper error handling and logging.
 */
export class SessionEndService {
  private projectPath: string;
  private enableLogging: boolean;
  private tasks: Map<string, EndTask> = new Map();

  constructor(options: SessionEndServiceOptions) {
    this.projectPath = options.projectPath;
    this.enableLogging = options.enableLogging ?? false;
  }

  // ---------------------------------------------------------------------------
  // Public: Task Registration
  // ---------------------------------------------------------------------------

  /**
   * Register a session-end task
   *
   * @param task - Task to register
   * @returns true if task was registered (false if type already exists)
   */
  registerEndTask(task: EndTask): boolean {
    if (this.tasks.has(task.type)) {
      this.log(`Task "${task.type}" already registered, skipping`);
      return false;
    }

    this.tasks.set(task.type, task);
    this.log(`Registered task "${task.type}" with priority ${task.priority}`);
    return true;
  }

  /**
   * Unregister a session-end task
   *
   * @param type - Task type to unregister
   * @returns true if task was removed
   */
  unregisterEndTask(type: string): boolean {
    const removed = this.tasks.delete(type);
    if (removed) {
      this.log(`Unregistered task "${type}"`);
    }
    return removed;
  }

  /**
   * Check if a task type is registered
   *
   * @param type - Task type to check
   * @returns true if task is registered
   */
  hasTask(type: string): boolean {
    return this.tasks.has(type);
  }

  /**
   * Get all registered task types
   *
   * @returns Array of task types
   */
  getRegisteredTasks(): string[] {
    return Array.from(this.tasks.keys());
  }

  // ---------------------------------------------------------------------------
  // Public: Task Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute all registered session-end tasks
   *
   * Tasks are executed in priority order (highest first).
   * Failures are logged but don't prevent other tasks from running.
   *
   * @param sessionId - Session ID for context
   * @returns Summary of execution results
   */
  async executeEndTasks(sessionId: string): Promise<SessionEndSummary> {
    const startTime = Date.now();
    const results: TaskResult[] = [];

    // Sort tasks by priority (descending)
    const sortedTasks = Array.from(this.tasks.values()).sort(
      (a, b) => b.priority - a.priority
    );

    this.log(`Executing ${sortedTasks.length} session-end tasks for session ${sessionId}`);

    // Execute tasks concurrently
    const executionPromises = sortedTasks.map(async (task) => {
      const taskStart = Date.now();

      try {
        this.log(`Starting task "${task.type}"...`);
        await task.handler();

        const duration = Date.now() - taskStart;
        this.log(`Task "${task.type}" completed in ${duration}ms`);

        return {
          type: task.type,
          success: true,
          duration
        } as TaskResult;
      } catch (err) {
        const duration = Date.now() - taskStart;
        const errorMessage = (err as Error).message || 'Unknown error';
        this.log(`Task "${task.type}" failed: ${errorMessage}`);

        return {
          type: task.type,
          success: false,
          duration,
          error: errorMessage
        } as TaskResult;
      }
    });

    // Wait for all tasks to complete
    const taskResults = await Promise.allSettled(executionPromises);

    // Collect results
    for (const result of taskResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // This shouldn't happen as we catch errors inside the task
        results.push({
          type: 'unknown',
          success: false,
          duration: 0,
          error: result.reason?.message || 'Task promise rejected'
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;

    this.log(
      `Session-end tasks completed: ${successful}/${results.length} successful, ` +
        `${totalDuration}ms total`
    );

    return {
      totalTasks: results.length,
      successful,
      failed,
      totalDuration,
      results
    };
  }

  /**
   * Execute only async (background) tasks
   *
   * This is useful for fire-and-forget background processing.
   *
   * @param sessionId - Session ID for context
   * @returns Promise that resolves immediately (tasks run in background)
   */
  executeBackgroundTasks(sessionId: string): void {
    const asyncTasks = Array.from(this.tasks.values())
      .filter((t) => t.async)
      .sort((a, b) => b.priority - a.priority);

    if (asyncTasks.length === 0) {
      return;
    }

    // Fire-and-forget
    Promise.all(
      asyncTasks.map(async (task) => {
        try {
          this.log(`Background task "${task.type}" starting...`);
          await task.handler();
          this.log(`Background task "${task.type}" completed`);
        } catch (err) {
          this.log(`Background task "${task.type}" failed: ${(err as Error).message}`);
        }
      })
    ).catch(() => {
      // Ignore errors - background tasks are best-effort
    });
  }

  // ---------------------------------------------------------------------------
  // Public: Built-in Tasks
  // ---------------------------------------------------------------------------

  /**
   * Register built-in session-end tasks
   *
   * This registers the standard tasks:
   *   - incremental-embedding (priority 100)
   *   - incremental-clustering (priority 50)
   *   - heat-score-update (priority 25)
   *
   * @param sessionId - Session ID for context
   */
  async registerBuiltinTasks(sessionId: string): Promise<void> {
    // Try to import and register embedding task
    try {
      const { isUnifiedEmbedderAvailable, UnifiedVectorIndex } = await import(
        '../unified-vector-index.js'
      );
      const { getMemoryMdContent } = await import('../memory-consolidation-pipeline.js');

      if (isUnifiedEmbedderAvailable()) {
        this.registerEndTask({
          type: TASK_INCREMENTAL_EMBEDDING,
          priority: 100,
          async: true,
          description: 'Index new/updated content in vector store',
          handler: async () => {
            const vectorIndex = new UnifiedVectorIndex(this.projectPath);
            const memoryContent = getMemoryMdContent(this.projectPath);
            if (memoryContent) {
              await vectorIndex.indexContent(memoryContent, {
                source_id: 'MEMORY_MD',
                source_type: 'core_memory',
                category: 'core_memory'
              });
            }
          }
        });
      }
    } catch {
      // Embedding dependencies not available
      this.log('Embedding task not registered: dependencies not available');
    }

    // Try to import and register clustering task
    try {
      const { SessionClusteringService } = await import('../session-clustering-service.js');

      this.registerEndTask({
        type: TASK_INCREMENTAL_CLUSTERING,
        priority: 50,
        async: true,
        description: 'Cluster unclustered sessions',
        handler: async () => {
          const clusteringService = new SessionClusteringService(this.projectPath);
          await clusteringService.autocluster({ scope: 'unclustered' });
        }
      });
    } catch {
      this.log('Clustering task not registered: dependencies not available');
    }

    // Try to import and register heat score task
    try {
      const { getMemoryStore } = await import('../memory-store.js');

      this.registerEndTask({
        type: TASK_HEAT_SCORE_UPDATE,
        priority: 25,
        async: true,
        description: 'Update entity heat scores',
        handler: async () => {
          const memoryStore = getMemoryStore(this.projectPath);
          const hotEntities = memoryStore.getHotEntities(50);
          for (const entity of hotEntities) {
            if (entity.id != null) {
              memoryStore.calculateHeatScore(entity.id);
            }
          }
        }
      });
    } catch {
      this.log('Heat score task not registered: dependencies not available');
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Utility Methods
  // ---------------------------------------------------------------------------

  /**
   * Log a message if logging is enabled
   */
  private log(message: string): void {
    if (this.enableLogging) {
      console.log(`[SessionEndService] ${message}`);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a SessionEndService instance with built-in tasks
 *
 * @param projectPath - Project root path
 * @param sessionId - Session ID for context
 * @param enableLogging - Whether to enable logging
 * @returns SessionEndService instance with built-in tasks registered
 */
export async function createSessionEndService(
  projectPath: string,
  sessionId: string,
  enableLogging = false
): Promise<SessionEndService> {
  const service = new SessionEndService({ projectPath, enableLogging });
  await service.registerBuiltinTasks(sessionId);
  return service;
}
