/**
 * Hooks Routes Module
 * Handles all hooks-related API endpoints
 *
 * ## API Endpoints
 *
 * ### Active Endpoints
 * - POST /api/hook - Main hook endpoint for Claude Code notifications
 *   - Handles: session-start, context, CLI events, A2UI surfaces
 * - POST /api/hook/ccw-exec - Execute CCW CLI commands and parse output
 * - GET /api/hooks - Get hooks configuration from global and project settings
 * - POST /api/hooks - Save a hook to settings
 * - DELETE /api/hooks - Delete a hook from settings
 *
 * ### Deprecated Endpoints (will be removed in v2.0.0)
 * - POST /api/hook/session-context - Use `ccw hook session-context --stdin` instead
 * - POST /api/hook/ccw-status - Use /api/hook/ccw-exec with command=parse-status
 *
 * ## Service Layer
 * All endpoints use unified services:
 * - HookContextService: Context generation for session-start and per-prompt hooks
 * - SessionStateService: Session state tracking and persistence
 * - SessionEndService: Background task management for session-end events
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';

import type { RouteContext } from './types.js';
import { a2uiWebSocketHandler } from '../a2ui/A2UIWebSocketHandler.js';

interface HooksRouteContext extends RouteContext {
  extractSessionIdFromPath: (filePath: string) => string | null;
}

// ========================================
// Helper Functions
// ========================================

const GLOBAL_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');

/**
 * Get project settings path
 * @param {string} projectPath
 * @returns {string}
 */
function getProjectSettingsPath(projectPath: string): string {
  // path.join automatically handles cross-platform path separators
  return join(projectPath, '.claude', 'settings.json');
}

/**
 * Read settings file safely
 * @param {string} filePath
 * @returns {Object}
 */
function readSettingsFile(filePath: string): Record<string, unknown> {
  try {
    if (!existsSync(filePath)) {
      return {};
    }
    const content = readFileSync(filePath, 'utf8');
    if (!content.trim()) {
      return {};
    }
    return JSON.parse(content);
  } catch (error: unknown) {
    console.error(`Error reading settings file ${filePath}:`, error);
    return {};
  }
}

/**
 * Get hooks configuration from global and project settings
 * @param {string} projectPath
 * @returns {Object}
 */
function getHooksConfig(projectPath: string): { global: { path: string; hooks: unknown }; project: { path: string | null; hooks: unknown } } {
  const globalSettings = readSettingsFile(GLOBAL_SETTINGS_PATH);
  const projectSettingsPath = projectPath ? getProjectSettingsPath(projectPath) : null;
  const projectSettings = projectSettingsPath ? readSettingsFile(projectSettingsPath) : {};

  return {
    global: {
      path: GLOBAL_SETTINGS_PATH,
      hooks: (globalSettings as { hooks?: unknown }).hooks || {}
    },
    project: {
      path: projectSettingsPath,
      hooks: (projectSettings as { hooks?: unknown }).hooks || {}
    }
  };
}

/**
 * Save a hook to settings file
 * @param {string} projectPath
 * @param {string} scope - 'global' or 'project'
 * @param {string} event - Hook event type
 * @param {Object} hookData - Hook configuration
 * @returns {Object}
 */
function saveHookToSettings(
  projectPath: string,
  scope: 'global' | 'project',
  event: string,
  hookData: Record<string, unknown> & { replaceIndex?: unknown }
): Record<string, unknown> {
  try {
    const filePath = scope === 'global' ? GLOBAL_SETTINGS_PATH : getProjectSettingsPath(projectPath);
    const settings = readSettingsFile(filePath) as Record<string, unknown> & { hooks?: Record<string, unknown> };

    // Ensure hooks object exists
    settings.hooks = settings.hooks || {};

    // Ensure the event array exists
    if (!settings.hooks[event]) {
      settings.hooks[event] = [];
    }

    // Ensure it's an array
    if (!Array.isArray(settings.hooks[event])) {
      settings.hooks[event] = [settings.hooks[event]];
    }

    // Check if we're replacing an existing hook
    if (typeof hookData.replaceIndex === 'number') {
      const index = hookData.replaceIndex;
      delete hookData.replaceIndex;
      const hooksForEvent = settings.hooks[event] as unknown[];
      if (index >= 0 && index < hooksForEvent.length) {
        hooksForEvent[index] = hookData;
      }
    } else {
      // Add new hook
      (settings.hooks[event] as unknown[]).push(hookData);
    }

    // Ensure directory exists and write file
    const dirPath = dirname(filePath);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');

    return {
      success: true,
      event,
      hookData
    };
  } catch (error: unknown) {
    console.error('Error saving hook:', error);
    return { error: (error as Error).message };
  }
}

/**
 * Delete a hook from settings file
 * @param {string} projectPath
 * @param {string} scope - 'global' or 'project'
 * @param {string} event - Hook event type
 * @param {number} hookIndex - Index of hook to delete
 * @returns {Object}
 */
function deleteHookFromSettings(
  projectPath: string,
  scope: 'global' | 'project',
  event: string,
  hookIndex: number
): Record<string, unknown> {
  try {
    const filePath = scope === 'global' ? GLOBAL_SETTINGS_PATH : getProjectSettingsPath(projectPath);
    const settings = readSettingsFile(filePath) as Record<string, unknown> & { hooks?: Record<string, unknown> };

    if (!settings.hooks || !settings.hooks[event]) {
      return { error: 'Hook not found' };
    }

    // Ensure it's an array
    if (!Array.isArray(settings.hooks[event])) {
      settings.hooks[event] = [settings.hooks[event]];
    }

    const hooksForEvent = settings.hooks[event] as unknown[];

    if (hookIndex < 0 || hookIndex >= hooksForEvent.length) {
      return { error: 'Invalid hook index' };
    }

    // Remove the hook
    hooksForEvent.splice(hookIndex, 1);

    // Remove empty event arrays
    if (hooksForEvent.length === 0) {
      delete settings.hooks[event];
    }

    writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');

    return {
      success: true,
      event,
      hookIndex
    };
  } catch (error: unknown) {
    console.error('Error deleting hook:', error);
    return { error: (error as Error).message };
  }
}

// ========================================
// Session State Tracking
// ========================================
// NOTE: Session state is managed by the CLI command (src/commands/hook.ts)
// using file-based persistence (~/.claude/.ccw-sessions/).
// This ensures consistent state tracking across all invocation methods.
// The /api/hook endpoint delegates to SessionClusteringService without
// managing its own state, as the authoritative state lives in the CLI layer.

// ========================================
// Route Handler
// ========================================

/**
 * Handle hooks routes
 * @returns true if route was handled, false otherwise
 */
export async function handleHooksRoutes(ctx: HooksRouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest, broadcastToClients, extractSessionIdFromPath } = ctx;

  // API: Hook endpoint for Claude Code notifications
  if (pathname === '/api/hook' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      if (typeof body !== 'object' || body === null) {
        return { error: 'Invalid request body', status: 400 };
      }

      const payload = body as Record<string, unknown>;
      const type = payload.type;
      const filePath = payload.filePath;
      const sessionId = payload.sessionId;
      const extraData: Record<string, unknown> = { ...payload };
      delete extraData.type;
      delete extraData.filePath;
      delete extraData.sessionId;

      // Determine session ID from file path if not provided
      let resolvedSessionId = typeof sessionId === 'string' ? sessionId : undefined;
      if (!resolvedSessionId && typeof filePath === 'string') {
        resolvedSessionId = extractSessionIdFromPath(filePath) ?? undefined;
      }

      // Handle context hooks (session-start, context)
      if (type === 'session-start' || type === 'context') {
        try {
          const projectPath = url.searchParams.get('path') || initialPath;

          // Use HookContextService for unified context generation
          const { HookContextService } = await import('../services/hook-context-service.js');
          const contextService = new HookContextService({ projectPath });

          const format = url.searchParams.get('format') || 'markdown';
          const prompt = typeof extraData.prompt === 'string' ? extraData.prompt : undefined;

          // Build context using the service
          const result = await contextService.buildPromptContext({
            sessionId: resolvedSessionId || '',
            prompt,
            projectId: projectPath
          });

          // Return context directly
          return {
            success: true,
            type: result.type,
            format,
            content: result.content,
            sessionId: resolvedSessionId
          };
        } catch (error) {
          console.error('[Hooks] Failed to generate context:', error);
          // Return empty content on failure (fail silently)
          return {
            success: true,
            type: 'context',
            format: 'markdown',
            content: '',
            sessionId: resolvedSessionId,
            error: (error as Error).message
          };
        }
      }

      // Update active executions state for CLI streaming events (terminal execution)
      if (type === 'CLI_EXECUTION_STARTED' || type === 'CLI_OUTPUT' || type === 'CLI_EXECUTION_COMPLETED') {
        console.log(`[Hooks] CLI event: ${type}, executionId: ${extraData.executionId}`);
        try {
          const { updateActiveExecution } = await import('./cli-routes.js');

          if (type === 'CLI_EXECUTION_STARTED') {
            updateActiveExecution({
              type: 'started',
              executionId: String(extraData.executionId || ''),
              tool: String(extraData.tool || 'unknown'),
              mode: String(extraData.mode || 'analysis'),
              prompt: String(extraData.prompt_preview || '')
            });
          } else if (type === 'CLI_OUTPUT') {
            updateActiveExecution({
              type: 'output',
              executionId: String(extraData.executionId || ''),
              output: String(extraData.data || '')
            });
          } else if (type === 'CLI_EXECUTION_COMPLETED') {
            updateActiveExecution({
              type: 'completed',
              executionId: String(extraData.executionId || ''),
              success: Boolean(extraData.success)
            });
          }
        } catch (err) {
          console.error('[Hooks] Failed to update active execution:', err);
        }
      }

      // Broadcast to all connected WebSocket clients
      const notification = {
        type: typeof type === 'string' && type.trim().length > 0 ? type : 'session_updated',
        payload: {
          sessionId: resolvedSessionId,
          filePath: typeof filePath === 'string' ? filePath : undefined,
          timestamp: new Date().toISOString(),
          ...extraData  // Pass through toolName, status, result, params, error, etc.
        }
      };

      // When an A2UI surface is forwarded from the MCP process, initialize
      // selection tracking on the Dashboard so that submit actions resolve
      // to the correct value type (single-select string vs multi-select array).
      if (type === 'a2ui-surface' && extraData?.initialState) {
        const initState = extraData.initialState as Record<string, unknown>;
        const questionId = initState.questionId as string | undefined;
        const questionType = initState.questionType as string | undefined;
        if (questionId && questionType === 'select') {
          a2uiWebSocketHandler.initSingleSelect(questionId);
        } else if (questionId && questionType === 'multi-select') {
          a2uiWebSocketHandler.initMultiSelect(questionId);
        }
      }

      broadcastToClients(notification);

      return { success: true, notification };
    });
    return true;
  }

  // API: Unified Session Context endpoint (Progressive Disclosure)
  // @DEPRECATED - This endpoint is deprecated and will be removed in a future version.
  // Migration: Use CLI command `ccw hook session-context --stdin` instead.
  // This endpoint now uses HookContextService for consistency with CLI.
  // - First prompt: returns cluster-based session overview
  // - Subsequent prompts: returns intent-matched sessions based on prompt
  if (pathname === '/api/hook/session-context' && req.method === 'POST') {
    // Add deprecation warning header
    res.setHeader('X-Deprecated', 'true');
    res.setHeader('X-Deprecation-Message', 'Use CLI command "ccw hook session-context --stdin" instead. This endpoint will be removed in v2.0.0');
    res.setHeader('X-Migration-Guide', 'https://github.com/ccw-project/ccw/blob/main/docs/migration-hooks.md#session-context');

    handlePostRequest(req, res, async (body) => {
      // Log deprecation warning
      console.warn('[DEPRECATED] /api/hook/session-context is deprecated. Use "ccw hook session-context --stdin" instead.');

      const { sessionId, prompt } = body as { sessionId?: string; prompt?: string };

      if (!sessionId) {
        return {
          success: true,
          content: '',
          error: 'sessionId is required',
          _deprecated: true,
          _migration: 'Use "ccw hook session-context --stdin"'
        };
      }

      try {
        const projectPath = url.searchParams.get('path') || initialPath;

        // Use HookContextService for unified context generation
        const { HookContextService } = await import('../services/hook-context-service.js');
        const contextService = new HookContextService({ projectPath });

        // Build context using the service
        const result = await contextService.buildPromptContext({
          sessionId,
          prompt,
          projectId: projectPath
        });

        return {
          success: true,
          type: result.type,
          isFirstPrompt: result.isFirstPrompt,
          loadCount: result.state.loadCount,
          content: result.content,
          sessionId,
          _deprecated: true,
          _migration: 'Use "ccw hook session-context --stdin"'
        };
      } catch (error) {
        console.error('[Hooks] Failed to generate session context:', error);
        return {
          success: true,
          content: '',
          sessionId,
          error: (error as Error).message,
          _deprecated: true,
          _migration: 'Use "ccw hook session-context --stdin"'
        };
      }
    });
    return true;
  }

  // API: Execute CCW CLI command and parse status
  if (pathname === '/api/hook/ccw-exec' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      if (typeof body !== 'object' || body === null) {
        return { error: 'Invalid request body', status: 400 };
      }

      const { filePath, command = 'parse-status' } = body as { filePath?: unknown; command?: unknown };

      if (typeof filePath !== 'string') {
        return { error: 'filePath is required', status: 400 };
      }

      // Check if this is a CCW status.json file
      if (!filePath.includes('status.json') ||
          !filePath.match(/\.(ccw|ccw-coordinator|ccw-debug)\//)) {
        return { success: false, message: 'Not a CCW status file' };
      }

      try {
        // Execute CCW CLI command to parse status
        const result = await executeCliCommand('ccw', ['hook', 'parse-status', filePath]);

        if (result.success) {
          const parsed = JSON.parse(result.output);
          return {
            success: true,
            ...parsed
          };
        } else {
          return {
            success: false,
            error: result.error
          };
        }
      } catch (error) {
        console.error('[Hooks] Failed to execute CCW command:', error);
        return {
          success: false,
          error: (error as Error).message
        };
      }
    });
    return true;
  }

  // API: Parse CCW status.json and return formatted status
  // @DEPRECATED - Use /api/hook/ccw-exec with command=parse-status instead.
  // This endpoint is kept for backward compatibility but will be removed.
  if (pathname === '/api/hook/ccw-status' && req.method === 'POST') {
    // Add deprecation warning header
    res.setHeader('X-Deprecated', 'true');
    res.setHeader('X-Deprecation-Message', 'Use /api/hook/ccw-exec with command=parse-status instead. This endpoint will be removed in v2.0.0');

    console.warn('[DEPRECATED] /api/hook/ccw-status is deprecated. Use /api/hook/ccw-exec instead.');

    handlePostRequest(req, res, async (body) => {
      if (typeof body !== 'object' || body === null) {
        return { error: 'Invalid request body', status: 400 };
      }

      const { filePath } = body as { filePath?: unknown };

      if (typeof filePath !== 'string') {
        return { error: 'filePath is required', status: 400 };
      }

      // Delegate to ccw-exec for unified handling
      try {
        const result = await executeCliCommand('ccw', ['hook', 'parse-status', filePath]);

        if (result.success) {
          return {
            success: true,
            message: result.output,
            _deprecated: true,
            _migration: 'Use /api/hook/ccw-exec with command=parse-status'
          };
        } else {
          return {
            success: false,
            error: result.error,
            _deprecated: true
          };
        }
      } catch (error) {
        console.error('[Hooks] Failed to parse CCW status:', error);
        return {
          success: false,
          error: (error as Error).message,
          _deprecated: true
        };
      }
    });
    return true;
  }

  // API: Get hooks configuration
  if (pathname === '/api/hooks' && req.method === 'GET') {
    const projectPathParam = url.searchParams.get('path');
    const hooksData = getHooksConfig(projectPathParam || initialPath);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(hooksData));
    return true;
  }

  // API: Save hook
  if (pathname === '/api/hooks' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      if (typeof body !== 'object' || body === null) {
        return { error: 'Invalid request body', status: 400 };
      }

      const { projectPath, scope, event, hookData } = body as {
        projectPath?: unknown;
        scope?: unknown;
        event?: unknown;
        hookData?: unknown;
      };

      if ((scope !== 'global' && scope !== 'project') || typeof event !== 'string' || typeof hookData !== 'object' || hookData === null) {
        return { error: 'scope, event, and hookData are required', status: 400 };
      }

      const resolvedProjectPath = typeof projectPath === 'string' && projectPath.trim().length > 0 ? projectPath : initialPath;
      return saveHookToSettings(resolvedProjectPath, scope, event, hookData as Record<string, unknown>);
    });
    return true;
  }

  // API: Delete hook
  if (pathname === '/api/hooks' && req.method === 'DELETE') {
    handlePostRequest(req, res, async (body) => {
      if (typeof body !== 'object' || body === null) {
        return { error: 'Invalid request body', status: 400 };
      }

      const { projectPath, scope, event, hookIndex } = body as {
        projectPath?: unknown;
        scope?: unknown;
        event?: unknown;
        hookIndex?: unknown;
      };

      if ((scope !== 'global' && scope !== 'project') || typeof event !== 'string' || typeof hookIndex !== 'number') {
        return { error: 'scope, event, and hookIndex are required', status: 400 };
      }

      const resolvedProjectPath = typeof projectPath === 'string' && projectPath.trim().length > 0 ? projectPath : initialPath;
      return deleteHookFromSettings(resolvedProjectPath, scope, event, hookIndex);
    });
    return true;
  }

  return false;
}

// ========================================
// Helper: Execute CLI Command
// ========================================

/**
 * Execute a CLI command and capture output
 * @param {string} command - Command name (e.g., 'ccw', 'npx')
 * @param {string[]} args - Command arguments
 * @returns {Promise<{success: boolean; output: string; error?: string}>}
 */
async function executeCliCommand(
  command: string,
  args: string[]
): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    let output = '';
    let errorOutput = '';

    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000  // 30 second timeout
    });

    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });
    }

    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({
          success: true,
          output: output.trim()
        });
      } else {
        resolve({
          success: false,
          output: output.trim(),
          error: errorOutput.trim() || `Command failed with exit code ${code}`
        });
      }
    });

    child.on('error', (err: Error) => {
      resolve({
        success: false,
        output: '',
        error: err.message
      });
    });
  });
}
