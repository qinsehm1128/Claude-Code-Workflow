/**
 * SessionStateService - Unified session state management
 *
 * Provides centralized session state persistence across CLI hooks and API routes.
 * Supports both legacy global path (~/.claude/.ccw-sessions/) and session-scoped
 * paths (.workflow/sessions/{sessionId}/) for workflow integration.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

/**
 * Session state interface
 */
export interface SessionState {
  /** ISO timestamp of first session load */
  firstLoad: string;
  /** Number of times session has been loaded */
  loadCount: number;
  /** Last prompt text (optional) */
  lastPrompt?: string;
  /** Active mode for the session (optional) */
  activeMode?: 'analysis' | 'write' | 'review' | 'auto';
}

/**
 * Storage type for session state
 */
export type SessionStorageType = 'global' | 'session-scoped';

/**
 * Options for session state operations
 */
export interface SessionStateOptions {
  /** Storage type: 'global' uses ~/.claude/.ccw-sessions/, 'session-scoped' uses .workflow/sessions/{sessionId}/ */
  storageType?: SessionStorageType;
  /** Project root path (required for session-scoped storage) */
  projectPath?: string;
}

/**
 * Validates that a session ID is safe to use in file paths.
 * Session IDs should be alphanumeric with optional hyphens and underscores.
 * This prevents path traversal attacks (e.g., "../../../etc").
 *
 * @param sessionId - The session ID to validate
 * @returns true if the session ID is safe, false otherwise
 */
export function validateSessionId(sessionId: string): boolean {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }
  // Allow alphanumeric, hyphens, and underscores only
  // Must be 1-256 characters (reasonable length limit)
  // Must not start with a dot (hidden files) or hyphen
  const SAFE_SESSION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,255}$/;
  return SAFE_SESSION_ID_PATTERN.test(sessionId);
}

/**
 * Get the default global session state directory
 * Uses ~/.claude/.ccw-sessions/ for reliable persistence across sessions
 */
function getGlobalStateDir(): string {
  return join(homedir(), '.claude', '.ccw-sessions');
}

/**
 * Get session state file path
 *
 * Supports two storage modes:
 * - 'global': ~/.claude/.ccw-sessions/session-{sessionId}.json (default)
 * - 'session-scoped': {projectPath}/.workflow/sessions/{sessionId}/state.json
 *
 * @param sessionId - The session ID
 * @param options - Storage options
 * @returns Full path to the session state file
 */
export function getSessionStatePath(sessionId: string, options?: SessionStateOptions): string {
  if (!validateSessionId(sessionId)) {
    throw new Error(`Invalid session ID: ${sessionId}`);
  }

  const storageType = options?.storageType ?? 'global';

  if (storageType === 'session-scoped') {
    if (!options?.projectPath) {
      throw new Error('projectPath is required for session-scoped storage');
    }
    const stateDir = join(options.projectPath, '.workflow', 'sessions', sessionId);
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
    }
    return join(stateDir, 'state.json');
  }

  // Global storage (default)
  const stateDir = getGlobalStateDir();
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  return join(stateDir, `session-${sessionId}.json`);
}

/**
 * Load session state from file
 *
 * @param sessionId - The session ID
 * @param options - Storage options
 * @returns SessionState if exists and valid, null otherwise
 */
export function loadSessionState(sessionId: string, options?: SessionStateOptions): SessionState | null {
  if (!validateSessionId(sessionId)) {
    return null;
  }

  try {
    const stateFile = getSessionStatePath(sessionId, options);
    if (!existsSync(stateFile)) {
      return null;
    }

    const content = readFileSync(stateFile, 'utf-8');
    const parsed = JSON.parse(content) as SessionState;

    // Validate required fields
    if (typeof parsed.firstLoad !== 'string' || typeof parsed.loadCount !== 'number') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save session state to file
 *
 * @param sessionId - The session ID
 * @param state - The session state to save
 * @param options - Storage options
 */
export function saveSessionState(sessionId: string, state: SessionState, options?: SessionStateOptions): void {
  if (!validateSessionId(sessionId)) {
    throw new Error(`Invalid session ID: ${sessionId}`);
  }

  const stateFile = getSessionStatePath(sessionId, options);

  // Ensure parent directory exists
  const stateDir = dirname(stateFile);
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }

  writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Clear session state (for session-end cleanup)
 *
 * @param sessionId - The session ID
 * @param options - Storage options
 * @returns true if state was cleared, false if it didn't exist
 */
export function clearSessionState(sessionId: string, options?: SessionStateOptions): boolean {
  if (!validateSessionId(sessionId)) {
    return false;
  }

  try {
    const stateFile = getSessionStatePath(sessionId, options);

    if (!existsSync(stateFile)) {
      return false;
    }

    unlinkSync(stateFile);

    // For session-scoped storage, also remove the session directory if empty
    if (options?.storageType === 'session-scoped' && options.projectPath) {
      const sessionDir = join(options.projectPath, '.workflow', 'sessions', sessionId);
      try {
        // Try to remove the directory (will fail if not empty)
        rmSync(sessionDir, { recursive: false, force: true });
      } catch {
        // Directory not empty or other error - ignore
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Update session state with new values
 *
 * This is a convenience function that loads existing state, merges with updates,
 * and saves the result.
 *
 * @param sessionId - The session ID
 * @param updates - Partial state to merge
 * @param options - Storage options
 * @returns The updated state
 */
export function updateSessionState(
  sessionId: string,
  updates: Partial<SessionState>,
  options?: SessionStateOptions
): SessionState {
  const existing = loadSessionState(sessionId, options);

  const newState: SessionState = existing
    ? { ...existing, ...updates }
    : {
        firstLoad: new Date().toISOString(),
        loadCount: 1,
        ...updates
      };

  saveSessionState(sessionId, newState, options);
  return newState;
}

/**
 * Increment the load count for a session
 *
 * This is a convenience function for the common pattern of tracking
 * how many times a session has been loaded.
 *
 * @param sessionId - The session ID
 * @param prompt - Optional prompt to record as lastPrompt
 * @param options - Storage options
 * @returns Object with isFirstPrompt flag and updated state
 */
export function incrementSessionLoad(
  sessionId: string,
  prompt?: string,
  options?: SessionStateOptions
): { isFirstPrompt: boolean; state: SessionState } {
  const existing = loadSessionState(sessionId, options);
  const isFirstPrompt = !existing;

  const state: SessionState = isFirstPrompt
    ? {
        firstLoad: new Date().toISOString(),
        loadCount: 1,
        lastPrompt: prompt
      }
    : {
        ...existing,
        loadCount: existing.loadCount + 1,
        ...(prompt !== undefined && { lastPrompt: prompt })
      };

  saveSessionState(sessionId, state, options);
  return { isFirstPrompt, state };
}

/**
 * SessionStateService class for object-oriented usage
 */
export class SessionStateService {
  private options?: SessionStateOptions;

  constructor(options?: SessionStateOptions) {
    this.options = options;
  }

  /**
   * Get session state file path
   */
  getStatePath(sessionId: string): string {
    return getSessionStatePath(sessionId, this.options);
  }

  /**
   * Load session state
   */
  load(sessionId: string): SessionState | null {
    return loadSessionState(sessionId, this.options);
  }

  /**
   * Save session state
   */
  save(sessionId: string, state: SessionState): void {
    saveSessionState(sessionId, state, this.options);
  }

  /**
   * Clear session state
   */
  clear(sessionId: string): boolean {
    return clearSessionState(sessionId, this.options);
  }

  /**
   * Update session state
   */
  update(sessionId: string, updates: Partial<SessionState>): SessionState {
    return updateSessionState(sessionId, updates, this.options);
  }

  /**
   * Increment load count
   */
  incrementLoad(sessionId: string, prompt?: string): { isFirstPrompt: boolean; state: SessionState } {
    return incrementSessionLoad(sessionId, prompt, this.options);
  }

  /**
   * Check if session is first load
   */
  isFirstLoad(sessionId: string): boolean {
    return this.load(sessionId) === null;
  }

  /**
   * Get load count for session
   */
  getLoadCount(sessionId: string): number {
    const state = this.load(sessionId);
    return state?.loadCount ?? 0;
  }
}
