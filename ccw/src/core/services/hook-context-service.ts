/**
 * HookContextService - Unified context generation for Claude Code hooks
 *
 * Provides centralized context generation for:
 *   - session-start: MEMORY.md summary + cluster overview + hot entities + patterns
 *   - per-prompt: vector search + intent matching
 *   - session-end: task generation for async background processing
 *
 * Character limits:
 *   - session-start: <= 1500 chars
 *   - per-prompt: <= 500 chars
 */

import type { SessionEndTask } from '../unified-context-builder.js';
import { SessionStateService, type SessionState } from './session-state-service.js';

// =============================================================================
// Constants
// =============================================================================

/** Maximum character count for session-start context */
const SESSION_START_LIMIT = 1500;

/** Maximum character count for per-prompt context */
const PER_PROMPT_LIMIT = 500;

// =============================================================================
// Types
// =============================================================================

/**
 * Options for building context
 */
export interface BuildContextOptions {
  /** Session ID for state tracking */
  sessionId: string;
  /** Project root path */
  projectId?: string;
  /** Whether this is the first prompt in the session */
  isFirstPrompt?: boolean;
  /** Character limit for the generated context */
  charLimit?: number;
  /** Current prompt text (for per-prompt context) */
  prompt?: string;
}

/**
 * Context generation result
 */
export interface ContextResult {
  /** Generated context content */
  content: string;
  /** Type of context generated */
  type: 'session-start' | 'context';
  /** Whether this was the first prompt */
  isFirstPrompt: boolean;
  /** Updated session state */
  state: SessionState;
  /** Character count of generated content */
  charCount: number;
}

/**
 * Options for HookContextService
 */
export interface HookContextServiceOptions {
  /** Project root path */
  projectPath: string;
  /** Storage type for session state */
  storageType?: 'global' | 'session-scoped';
}

// =============================================================================
// HookContextService
// =============================================================================

/**
 * Service for generating hook context
 *
 * This service wraps UnifiedContextBuilder and SessionStateService to provide
 * a unified interface for context generation across CLI hooks and API routes.
 */
export class HookContextService {
  private projectPath: string;
  private sessionStateService: SessionStateService;
  private unifiedContextBuilder: InstanceType<typeof import('../unified-context-builder.js').UnifiedContextBuilder> | null = null;
  private clusteringService: InstanceType<typeof import('../session-clustering-service.js').SessionClusteringService> | null = null;
  private initialized = false;

  constructor(options: HookContextServiceOptions) {
    this.projectPath = options.projectPath;
    this.sessionStateService = new SessionStateService({
      storageType: options.storageType,
      projectPath: options.projectPath
    });
  }

  /**
   * Initialize lazy-loaded services
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Try to load UnifiedContextBuilder (requires embedder)
      const { isUnifiedEmbedderAvailable } = await import('../unified-vector-index.js');
      if (isUnifiedEmbedderAvailable()) {
        const { UnifiedContextBuilder } = await import('../unified-context-builder.js');
        this.unifiedContextBuilder = new UnifiedContextBuilder(this.projectPath);
      }
    } catch {
      // UnifiedContextBuilder not available
    }

    try {
      // Always load SessionClusteringService as fallback
      const { SessionClusteringService } = await import('../session-clustering-service.js');
      this.clusteringService = new SessionClusteringService(this.projectPath);
    } catch {
      // SessionClusteringService not available
    }

    this.initialized = true;
  }

  // ---------------------------------------------------------------------------
  // Public: Context Generation
  // ---------------------------------------------------------------------------

  /**
   * Build context for session-start hook
   *
   * @param options - Build context options
   * @returns Context generation result
   */
  async buildSessionStartContext(options: BuildContextOptions): Promise<ContextResult> {
    await this.initialize();

    const charLimit = options.charLimit ?? SESSION_START_LIMIT;

    // Update session state
    const { isFirstPrompt, state } = this.sessionStateService.incrementLoad(
      options.sessionId,
      options.prompt
    );

    let content = '';

    // Try UnifiedContextBuilder first
    if (this.unifiedContextBuilder) {
      content = await this.unifiedContextBuilder.buildSessionStartContext();
    } else if (this.clusteringService) {
      // Fallback to SessionClusteringService
      content = await this.clusteringService.getProgressiveIndex({
        type: 'session-start',
        sessionId: options.sessionId
      });
    }

    // Truncate if needed
    if (content.length > charLimit) {
      content = content.substring(0, charLimit - 20) + '...';
    }

    return {
      content,
      type: 'session-start',
      isFirstPrompt,
      state,
      charCount: content.length
    };
  }

  /**
   * Build context for per-prompt hook
   *
   * @param options - Build context options
   * @returns Context generation result
   */
  async buildPromptContext(options: BuildContextOptions): Promise<ContextResult> {
    await this.initialize();

    const charLimit = options.charLimit ?? PER_PROMPT_LIMIT;

    // Update session state
    const { isFirstPrompt, state } = this.sessionStateService.incrementLoad(
      options.sessionId,
      options.prompt
    );

    let content = '';
    let contextType: 'session-start' | 'context' = 'context';

    // First prompt uses session-start context
    if (isFirstPrompt) {
      contextType = 'session-start';
      if (this.unifiedContextBuilder) {
        content = await this.unifiedContextBuilder.buildSessionStartContext();
      } else if (this.clusteringService) {
        content = await this.clusteringService.getProgressiveIndex({
          type: 'session-start',
          sessionId: options.sessionId
        });
      }
    } else if (options.prompt && options.prompt.trim().length > 0) {
      // Subsequent prompts use per-prompt context
      contextType = 'context';
      if (this.unifiedContextBuilder) {
        content = await this.unifiedContextBuilder.buildPromptContext(options.prompt);
      } else if (this.clusteringService) {
        content = await this.clusteringService.getProgressiveIndex({
          type: 'context',
          sessionId: options.sessionId,
          prompt: options.prompt
        });
      }
    }

    // Truncate if needed
    if (content.length > charLimit) {
      content = content.substring(0, charLimit - 20) + '...';
    }

    return {
      content,
      type: contextType,
      isFirstPrompt,
      state,
      charCount: content.length
    };
  }

  // ---------------------------------------------------------------------------
  // Public: Session End Tasks
  // ---------------------------------------------------------------------------

  /**
   * Build session end tasks for async background processing
   *
   * @param sessionId - Session ID for context
   * @returns Array of tasks to execute
   */
  async buildSessionEndTasks(sessionId: string): Promise<SessionEndTask[]> {
    await this.initialize();

    if (this.unifiedContextBuilder) {
      return this.unifiedContextBuilder.buildSessionEndTasks(sessionId);
    }

    // No tasks available without UnifiedContextBuilder
    return [];
  }

  // ---------------------------------------------------------------------------
  // Public: Session State Management
  // ---------------------------------------------------------------------------

  /**
   * Get session state
   *
   * @param sessionId - Session ID
   * @returns Session state or null if not found
   */
  getSessionState(sessionId: string): SessionState | null {
    return this.sessionStateService.load(sessionId);
  }

  /**
   * Check if this is the first prompt for a session
   *
   * @param sessionId - Session ID
   * @returns true if this is the first prompt
   */
  isFirstPrompt(sessionId: string): boolean {
    return this.sessionStateService.isFirstLoad(sessionId);
  }

  /**
   * Get load count for a session
   *
   * @param sessionId - Session ID
   * @returns Load count (0 if not found)
   */
  getLoadCount(sessionId: string): number {
    return this.sessionStateService.getLoadCount(sessionId);
  }

  /**
   * Clear session state
   *
   * @param sessionId - Session ID
   * @returns true if state was cleared
   */
  clearSessionState(sessionId: string): boolean {
    return this.sessionStateService.clear(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Public: Utility Methods
  // ---------------------------------------------------------------------------

  /**
   * Check if UnifiedContextBuilder is available
   *
   * @returns true if embedder is available
   */
  async isAdvancedContextAvailable(): Promise<boolean> {
    await this.initialize();
    return this.unifiedContextBuilder !== null;
  }

  /**
   * Get the project path
   */
  getProjectPath(): string {
    return this.projectPath;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a HookContextService instance
 *
 * @param projectPath - Project root path
 * @param storageType - Storage type for session state
 * @returns HookContextService instance
 */
export function createHookContextService(
  projectPath: string,
  storageType?: 'global' | 'session-scoped'
): HookContextService {
  return new HookContextService({ projectPath, storageType });
}
