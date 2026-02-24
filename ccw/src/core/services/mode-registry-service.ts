/**
 * ModeRegistryService - Centralized Mode State Management
 *
 * Provides unified mode state detection and management for CCW.
 * All modes store state in `.workflow/modes/` directory for consistency.
 *
 * Features:
 *   - Mode activation/deactivation tracking
 *   - Exclusive mode conflict detection
 *   - Stale marker cleanup (1 hour threshold)
 *   - File-based state persistence
 *
 * Based on oh-my-claudecode mode-registry pattern.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, readdirSync, statSync, rmSync } from 'fs';
import { join, dirname } from 'path';

// =============================================================================
// Types
// =============================================================================

/**
 * Supported execution modes
 */
export type ExecutionMode =
  | 'autopilot'
  | 'ralph'
  | 'ultrawork'
  | 'swarm'
  | 'pipeline'
  | 'team'
  | 'ultraqa';

/**
 * Mode configuration
 */
export interface ModeConfig {
  /** Display name for the mode */
  name: string;
  /** Primary state file path (relative to .workflow/modes/) */
  stateFile: string;
  /** Property to check in JSON state for active status */
  activeProperty: string;
  /** Whether this mode is mutually exclusive with other exclusive modes */
  exclusive?: boolean;
  /** Description of the mode */
  description?: string;
}

/**
 * Status of a mode
 */
export interface ModeStatus {
  /** The mode identifier */
  mode: ExecutionMode;
  /** Whether the mode is currently active */
  active: boolean;
  /** Path to the state file */
  stateFilePath: string;
  /** Session ID if session-scoped */
  sessionId?: string;
}

/**
 * Result of checking if a mode can be started
 */
export interface CanStartResult {
  /** Whether the mode can be started */
  allowed: boolean;
  /** The mode that is blocking (if not allowed) */
  blockedBy?: ExecutionMode;
  /** Human-readable message */
  message?: string;
}

/**
 * Options for mode registry operations
 */
export interface ModeRegistryOptions {
  /** Project root path */
  projectPath: string;
  /** Enable logging */
  enableLogging?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Stale marker threshold (1 hour)
 * Markers older than this are auto-removed to prevent crashed sessions
 * from blocking indefinitely.
 */
const STALE_MARKER_THRESHOLD = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Mode configuration registry
 *
 * Maps each mode to its state file location and detection method.
 * All paths are relative to .workflow/modes/ directory.
 */
const MODE_CONFIGS: Record<ExecutionMode, ModeConfig> = {
  autopilot: {
    name: 'Autopilot',
    stateFile: 'autopilot-state.json',
    activeProperty: 'active',
    exclusive: true,
    description: 'Autonomous execution mode for multi-step tasks'
  },
  ralph: {
    name: 'Ralph',
    stateFile: 'ralph-state.json',
    activeProperty: 'active',
    exclusive: false,
    description: 'Research and Analysis Learning Pattern Handler'
  },
  ultrawork: {
    name: 'Ultrawork',
    stateFile: 'ultrawork-state.json',
    activeProperty: 'active',
    exclusive: false,
    description: 'Ultra-focused work mode for deep tasks'
  },
  swarm: {
    name: 'Swarm',
    stateFile: 'swarm-state.json',
    activeProperty: 'active',
    exclusive: true,
    description: 'Multi-agent swarm execution mode'
  },
  pipeline: {
    name: 'Pipeline',
    stateFile: 'pipeline-state.json',
    activeProperty: 'active',
    exclusive: true,
    description: 'Pipeline execution mode for sequential tasks'
  },
  team: {
    name: 'Team',
    stateFile: 'team-state.json',
    activeProperty: 'active',
    exclusive: false,
    description: 'Team collaboration mode'
  },
  ultraqa: {
    name: 'UltraQA',
    stateFile: 'ultraqa-state.json',
    activeProperty: 'active',
    exclusive: false,
    description: 'Ultra-focused QA mode'
  }
};

/**
 * Modes that are mutually exclusive (cannot run concurrently)
 */
const EXCLUSIVE_MODES: ExecutionMode[] = ['autopilot', 'swarm', 'pipeline'];

// Export for external use
export { MODE_CONFIGS, EXCLUSIVE_MODES, STALE_MARKER_THRESHOLD };

// =============================================================================
// ModeRegistryService
// =============================================================================

/**
 * Service for managing mode state
 *
 * This service provides centralized mode state management using file-based
 * persistence. It supports exclusive mode detection and stale marker cleanup.
 */
export class ModeRegistryService {
  private projectPath: string;
  private enableLogging: boolean;
  private modesDir: string;

  constructor(options: ModeRegistryOptions) {
    this.projectPath = options.projectPath;
    this.enableLogging = options.enableLogging ?? false;
    this.modesDir = join(this.projectPath, '.workflow', 'modes');
  }

  // ---------------------------------------------------------------------------
  // Public: Directory Management
  // ---------------------------------------------------------------------------

  /**
   * Get the modes directory path
   */
  getModesDir(): string {
    return this.modesDir;
  }

  /**
   * Ensure the modes directory exists
   */
  ensureModesDir(): void {
    if (!existsSync(this.modesDir)) {
      mkdirSync(this.modesDir, { recursive: true });
    }
  }

  // ---------------------------------------------------------------------------
  // Public: Mode State Queries
  // ---------------------------------------------------------------------------

  /**
   * Check if a specific mode is currently active
   *
   * @param mode - The mode to check
   * @param sessionId - Optional session ID to check session-scoped state
   * @returns true if the mode is active
   */
  isModeActive(mode: ExecutionMode, sessionId?: string): boolean {
    const config = MODE_CONFIGS[mode];

    if (sessionId) {
      // Check session-scoped path
      const sessionStateFile = this.getSessionStatePath(mode, sessionId);
      return this.isJsonModeActive(sessionStateFile, config, sessionId);
    }

    // Check legacy shared path
    const stateFile = this.getStateFilePath(mode);
    return this.isJsonModeActive(stateFile, config);
  }

  /**
   * Check if a mode has state (file exists)
   *
   * @param mode - The mode to check
   * @param sessionId - Optional session ID
   * @returns true if state file exists
   */
  hasModeState(mode: ExecutionMode, sessionId?: string): boolean {
    const stateFile = sessionId
      ? this.getSessionStatePath(mode, sessionId)
      : this.getStateFilePath(mode);
    return existsSync(stateFile);
  }

  /**
   * Get all active modes
   *
   * @param sessionId - Optional session ID to check session-scoped state
   * @returns Array of active mode identifiers
   */
  getActiveModes(sessionId?: string): ExecutionMode[] {
    const modes: ExecutionMode[] = [];

    for (const mode of Object.keys(MODE_CONFIGS) as ExecutionMode[]) {
      if (this.isModeActive(mode, sessionId)) {
        modes.push(mode);
      }
    }

    return modes;
  }

  /**
   * Check if any mode is currently active
   *
   * @param sessionId - Optional session ID
   * @returns true if any mode is active
   */
  isAnyModeActive(sessionId?: string): boolean {
    return this.getActiveModes(sessionId).length > 0;
  }

  /**
   * Get the currently active exclusive mode (if any)
   *
   * @returns The active exclusive mode or null
   */
  getActiveExclusiveMode(): ExecutionMode | null {
    for (const mode of EXCLUSIVE_MODES) {
      if (this.isModeActiveInAnySession(mode)) {
        return mode;
      }
    }
    return null;
  }

  /**
   * Get status of all modes
   *
   * @param sessionId - Optional session ID
   * @returns Array of mode statuses
   */
  getAllModeStatuses(sessionId?: string): ModeStatus[] {
    return (Object.keys(MODE_CONFIGS) as ExecutionMode[]).map(mode => ({
      mode,
      active: this.isModeActive(mode, sessionId),
      stateFilePath: sessionId
        ? this.getSessionStatePath(mode, sessionId)
        : this.getStateFilePath(mode),
      sessionId
    }));
  }

  // ---------------------------------------------------------------------------
  // Public: Mode Control
  // ---------------------------------------------------------------------------

  /**
   * Check if a new mode can be started
   *
   * @param mode - The mode to start
   * @param sessionId - Optional session ID
   * @returns CanStartResult with allowed status and blocker info
   */
  canStartMode(mode: ExecutionMode, sessionId?: string): CanStartResult {
    const config = MODE_CONFIGS[mode];

    // Check for mutually exclusive modes
    if (EXCLUSIVE_MODES.includes(mode)) {
      for (const exclusiveMode of EXCLUSIVE_MODES) {
        if (exclusiveMode !== mode && this.isModeActiveInAnySession(exclusiveMode)) {
          const exclusiveConfig = MODE_CONFIGS[exclusiveMode];
          return {
            allowed: false,
            blockedBy: exclusiveMode,
            message: `Cannot start ${config.name} while ${exclusiveConfig.name} is active. Cancel ${exclusiveConfig.name} first.`
          };
        }
      }
    }

    // Check if already active in this session
    if (sessionId && this.isModeActive(mode, sessionId)) {
      return {
        allowed: false,
        blockedBy: mode,
        message: `${config.name} is already active in this session.`
      };
    }

    return { allowed: true };
  }

  /**
   * Activate a mode
   *
   * @param mode - The mode to activate
   * @param sessionId - Session ID
   * @param context - Optional context to store with state
   * @returns true if activation was successful
   */
  activateMode(mode: ExecutionMode, sessionId: string, context?: Record<string, unknown>): boolean {
    const config = MODE_CONFIGS[mode];

    // Check if can start
    const canStart = this.canStartMode(mode, sessionId);
    if (!canStart.allowed) {
      this.log(`Cannot activate ${config.name}: ${canStart.message}`);
      return false;
    }

    try {
      this.ensureModesDir();

      const stateFile = this.getSessionStatePath(mode, sessionId);
      const stateDir = dirname(stateFile);
      if (!existsSync(stateDir)) {
        mkdirSync(stateDir, { recursive: true });
      }

      const state = {
        [config.activeProperty]: true,
        session_id: sessionId,
        activatedAt: new Date().toISOString(),
        ...context
      };

      writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');
      this.log(`Activated ${config.name} for session ${sessionId}`);
      return true;
    } catch (error) {
      this.log(`Failed to activate ${config.name}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Deactivate a mode
   *
   * @param mode - The mode to deactivate
   * @param sessionId - Session ID
   * @returns true if deactivation was successful
   */
  deactivateMode(mode: ExecutionMode, sessionId: string): boolean {
    const config = MODE_CONFIGS[mode];

    try {
      const stateFile = this.getSessionStatePath(mode, sessionId);

      if (!existsSync(stateFile)) {
        return true; // Already inactive
      }

      unlinkSync(stateFile);
      this.log(`Deactivated ${config.name} for session ${sessionId}`);
      return true;
    } catch (error) {
      this.log(`Failed to deactivate ${config.name}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Clear all state for a mode
   *
   * @param mode - The mode to clear
   * @param sessionId - Optional session ID (if provided, only clears session state)
   * @returns true if successful
   */
  clearModeState(mode: ExecutionMode, sessionId?: string): boolean {
    let success = true;

    if (sessionId) {
      // Clear session-scoped state only
      const sessionStateFile = this.getSessionStatePath(mode, sessionId);
      if (existsSync(sessionStateFile)) {
        try {
          unlinkSync(sessionStateFile);
        } catch {
          success = false;
        }
      }
      return success;
    }

    // Clear all state for this mode
    const stateFile = this.getStateFilePath(mode);
    if (existsSync(stateFile)) {
      try {
        unlinkSync(stateFile);
      } catch {
        success = false;
      }
    }

    // Also clear session-scoped states
    try {
      const sessionIds = this.listSessionIds();
      for (const sid of sessionIds) {
        const sessionFile = this.getSessionStatePath(mode, sid);
        if (existsSync(sessionFile)) {
          try {
            unlinkSync(sessionFile);
          } catch {
            success = false;
          }
        }
      }
    } catch {
      // Ignore errors scanning sessions
    }

    return success;
  }

  /**
   * Clear all mode states (force clear)
   *
   * @returns true if all states were cleared
   */
  clearAllModeStates(): boolean {
    let success = true;

    for (const mode of Object.keys(MODE_CONFIGS) as ExecutionMode[]) {
      if (!this.clearModeState(mode)) {
        success = false;
      }
    }

    return success;
  }

  // ---------------------------------------------------------------------------
  // Public: Session Management
  // ---------------------------------------------------------------------------

  /**
   * Check if a mode is active in any session
   *
   * @param mode - The mode to check
   * @returns true if the mode is active in any session
   */
  isModeActiveInAnySession(mode: ExecutionMode): boolean {
    // Check legacy path first
    if (this.isModeActive(mode)) {
      return true;
    }

    // Scan all session dirs
    const sessionIds = this.listSessionIds();
    for (const sid of sessionIds) {
      if (this.isModeActive(mode, sid)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all session IDs that have a specific mode active
   *
   * @param mode - The mode to check
   * @returns Array of session IDs with this mode active
   */
  getActiveSessionsForMode(mode: ExecutionMode): string[] {
    const sessionIds = this.listSessionIds();
    return sessionIds.filter(sid => this.isModeActive(mode, sid));
  }

  /**
   * List all session IDs that have mode state files
   *
   * @returns Array of session IDs
   */
  listSessionIds(): string[] {
    const sessionsDir = join(this.modesDir, 'sessions');
    if (!existsSync(sessionsDir)) {
      return [];
    }

    try {
      return readdirSync(sessionsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => this.isValidSessionId(name));
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Public: Stale State Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Clear stale session directories
   *
   * Removes session directories that have no recent activity.
   *
   * @param maxAgeMs - Maximum age in milliseconds (default: 24 hours)
   * @returns Array of removed session IDs
   */
  clearStaleSessionDirs(maxAgeMs: number = 24 * 60 * 60 * 1000): string[] {
    const sessionsDir = join(this.modesDir, 'sessions');
    if (!existsSync(sessionsDir)) {
      return [];
    }

    const removed: string[] = [];
    const sessionIds = this.listSessionIds();

    for (const sid of sessionIds) {
      const sessionDir = this.getSessionDir(sid);
      try {
        const files = readdirSync(sessionDir);

        // Remove empty directories
        if (files.length === 0) {
          rmSync(sessionDir, { recursive: true, force: true });
          removed.push(sid);
          continue;
        }

        // Check modification time of any state file
        let newest = 0;
        for (const f of files) {
          const stat = statSync(join(sessionDir, f));
          if (stat.mtimeMs > newest) {
            newest = stat.mtimeMs;
          }
        }

        // Remove if stale
        if (Date.now() - newest > maxAgeMs) {
          rmSync(sessionDir, { recursive: true, force: true });
          removed.push(sid);
        }
      } catch {
        // Skip on error
      }
    }

    return removed;
  }

  /**
   * Clean up stale markers (older than threshold)
   *
   * @returns Array of cleaned up session IDs
   */
  cleanupStaleMarkers(): string[] {
    const cleaned: string[] = [];
    const sessionIds = this.listSessionIds();

    for (const sid of sessionIds) {
      for (const mode of Object.keys(MODE_CONFIGS) as ExecutionMode[]) {
        const stateFile = this.getSessionStatePath(mode, sid);
        if (existsSync(stateFile)) {
          try {
            const content = readFileSync(stateFile, 'utf-8');
            const state = JSON.parse(content);

            if (state.activatedAt) {
              const activatedAt = new Date(state.activatedAt).getTime();
              const age = Date.now() - activatedAt;

              if (age > STALE_MARKER_THRESHOLD) {
                this.log(`Cleaning up stale ${mode} marker for session ${sid} (${Math.round(age / 60000)} min old)`);
                unlinkSync(stateFile);
                cleaned.push(sid);
              }
            }
          } catch {
            // Skip invalid files
          }
        }
      }
    }

    return Array.from(new Set(cleaned)); // Remove duplicates
  }

  // ---------------------------------------------------------------------------
  // Private: Utility Methods
  // ---------------------------------------------------------------------------

  /**
   * Get the state file path for a mode (legacy shared path)
   */
  private getStateFilePath(mode: ExecutionMode): string {
    const config = MODE_CONFIGS[mode];
    return join(this.modesDir, config.stateFile);
  }

  /**
   * Get the session-scoped state file path
   */
  private getSessionStatePath(mode: ExecutionMode, sessionId: string): string {
    const config = MODE_CONFIGS[mode];
    return join(this.modesDir, 'sessions', sessionId, config.stateFile);
  }

  /**
   * Get the session directory path
   */
  private getSessionDir(sessionId: string): string {
    return join(this.modesDir, 'sessions', sessionId);
  }

  /**
   * Check if a JSON-based mode is active
   */
  private isJsonModeActive(
    stateFile: string,
    config: ModeConfig,
    sessionId?: string
  ): boolean {
    if (!existsSync(stateFile)) {
      return false;
    }

    try {
      const content = readFileSync(stateFile, 'utf-8');
      const state = JSON.parse(content);

      // Validate session identity if sessionId provided
      if (sessionId && state.session_id && state.session_id !== sessionId) {
        return false;
      }

      if (config.activeProperty) {
        return state[config.activeProperty] === true;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate session ID format
   */
  private isValidSessionId(sessionId: string): boolean {
    if (!sessionId || typeof sessionId !== 'string') {
      return false;
    }
    // Allow alphanumeric, hyphens, and underscores only
    const SAFE_SESSION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,255}$/;
    return SAFE_SESSION_ID_PATTERN.test(sessionId);
  }

  /**
   * Log a message if logging is enabled
   */
  private log(message: string): void {
    if (this.enableLogging) {
      const timestamp = new Date().toISOString();
      console.log(`[ModeRegistry ${timestamp}] ${message}`);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a ModeRegistryService instance
 *
 * @param projectPath - Project root path
 * @param enableLogging - Enable logging
 * @returns ModeRegistryService instance
 */
export function createModeRegistryService(
  projectPath: string,
  enableLogging?: boolean
): ModeRegistryService {
  return new ModeRegistryService({ projectPath, enableLogging });
}
