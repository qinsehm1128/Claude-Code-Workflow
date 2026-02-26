/**
 * CLI Settings Routes Module
 * Handles Claude CLI settings file management API endpoints
 */

import { homedir } from 'os';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import type { RouteContext } from './types.js';
import {
  saveEndpointSettings,
  loadEndpointSettings,
  deleteEndpointSettings,
  listAllSettings,
  toggleEndpointEnabled,
  getSettingsFilePath,
  ensureSettingsDir,
  sanitizeEndpointId,
  exportAllSettings,
  importSettings
} from '../../config/cli-settings-manager.js';
import type { SaveEndpointRequest, ImportOptions } from '../../types/cli-settings.js';
import { validateSettings } from '../../types/cli-settings.js';
import { syncBuiltinToolsAvailability, getBuiltinToolsSyncReport } from '../../tools/claude-cli-tools.js';

/**
 * Mask sensitive values (API keys) for display
 * Shows first 8 characters, masks the rest with asterisks
 */
function maskSensitiveValue(value: string): string {
  if (!value || value.length <= 8) {
    return value;
  }
  return value.substring(0, 8) + '*'.repeat(value.length - 8);
}

/**
 * Mask API keys in JSON content
 */
function maskJsonApiKeys(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object') {
      // Mask common API key fields
      const sensitiveFields = ['api_key', 'apiKey', 'API_KEY', 'OPENAI_API_KEY', 'token', 'auth_token'];
      for (const field of sensitiveFields) {
        if (parsed[field] && typeof parsed[field] === 'string') {
          parsed[field] = maskSensitiveValue(parsed[field]);
        }
      }
      // Handle nested objects (e.g., api key in providers)
      if (parsed.providers && Array.isArray(parsed.providers)) {
        parsed.providers = parsed.providers.map((provider: any) => {
          if (provider.api_key) {
            return { ...provider, api_key: maskSensitiveValue(provider.api_key) };
          }
          return provider;
        });
      }
      return JSON.stringify(parsed, null, 2);
    }
  } catch {
    // If not valid JSON, return as-is
  }
  return content;
}

/**
 * Mask API keys in TOML content
 */
function maskTomlApiKeys(content: string): string {
  // Match patterns like api_key = "value" or apiKey = "value"
  return content.replace(
    /(api[_-]?key|apiKey|API_KEY|token|auth_token)\s*=\s*["']([^"']+)["']/gi,
    (match, key, value) => {
      return `${key} = "${maskSensitiveValue(value)}"`;
    }
  );
}

/**
 * Read and mask Codex config files for preview
 */
function readCodexConfigPreview(): { configToml: string | null; authJson: string | null; errors: string[] } {
  const home = homedir();
  const codexDir = join(home, '.codex');
  const result: { configToml: string | null; authJson: string | null; errors: string[] } = {
    configToml: null,
    authJson: null,
    errors: []
  };

  // Read config.toml
  const configTomlPath = join(codexDir, 'config.toml');
  if (existsSync(configTomlPath)) {
    try {
      const content = readFileSync(configTomlPath, 'utf-8');
      result.configToml = maskTomlApiKeys(content);
    } catch (err) {
      result.errors.push(`Failed to read config.toml: ${(err as Error).message}`);
    }
  } else {
    result.errors.push('config.toml not found');
  }

  // Read auth.json
  const authJsonPath = join(codexDir, 'auth.json');
  if (existsSync(authJsonPath)) {
    try {
      const content = readFileSync(authJsonPath, 'utf-8');
      result.authJson = maskJsonApiKeys(content);
    } catch (err) {
      result.errors.push(`Failed to read auth.json: ${(err as Error).message}`);
    }
  } else {
    result.errors.push('auth.json not found');
  }

  return result;
}

/**
 * Read and mask Gemini settings file for preview
 */
function readGeminiConfigPreview(): { settingsJson: string | null; errors: string[] } {
  const home = homedir();
  const geminiDir = join(home, '.gemini');
  const result: { settingsJson: string | null; errors: string[] } = {
    settingsJson: null,
    errors: []
  };

  // Read settings.json
  const settingsPath = join(geminiDir, 'settings.json');
  if (existsSync(settingsPath)) {
    try {
      const content = readFileSync(settingsPath, 'utf-8');
      result.settingsJson = maskJsonApiKeys(content);
    } catch (err) {
      result.errors.push(`Failed to read settings.json: ${(err as Error).message}`);
    }
  } else {
    result.errors.push('settings.json not found');
  }

  return result;
}

/**
 * Handle CLI Settings routes
 * @returns true if route was handled, false otherwise
 */
export async function handleCliSettingsRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, handlePostRequest, broadcastToClients } = ctx;

  // Ensure settings directory exists
  ensureSettingsDir();

  // ========== LIST ALL SETTINGS ==========
  // GET /api/cli/settings
  if (pathname === '/api/cli/settings' && req.method === 'GET') {
    try {
      const result = listAllSettings();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // ========== CREATE/UPDATE SETTINGS ==========
  // POST /api/cli/settings
  if (pathname === '/api/cli/settings' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: unknown) => {
      try {
        const request = body as SaveEndpointRequest;

        // Validate required fields
        if (!request.name) {
          return { error: 'name is required', status: 400 };
        }
        if (!request.settings || !request.settings.env) {
          return { error: 'settings.env is required', status: 400 };
        }
        // Deep validation of settings object (provider-aware)
        if (!validateSettings(request.settings, request.provider)) {
          return { error: 'Invalid settings object format', status: 400 };
        }

        const result = saveEndpointSettings(request);

        if (result.success) {
          // Broadcast settings created/updated event
          broadcastToClients({
            type: 'CLI_SETTINGS_UPDATED',
            payload: {
              endpoint: result.endpoint,
              filePath: result.filePath,
              timestamp: new Date().toISOString()
            }
          });
          return result;
        } else {
          return { error: result.message, status: 500 };
        }
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // ========== GET SINGLE SETTINGS ==========
  // GET /api/cli/settings/:id
  const getMatch = pathname.match(/^\/api\/cli\/settings\/([^/]+)$/);
  if (getMatch && req.method === 'GET') {
    const endpointId = sanitizeEndpointId(getMatch[1]);
    try {
      const endpoint = loadEndpointSettings(endpointId);

      if (!endpoint) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
        return true;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        endpoint,
        filePath: getSettingsFilePath(endpointId)
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // ========== UPDATE SETTINGS ==========
  // PUT /api/cli/settings/:id
  const putMatch = pathname.match(/^\/api\/cli\/settings\/([^/]+)$/);
  if (putMatch && req.method === 'PUT') {
    const endpointId = sanitizeEndpointId(putMatch[1]);
    handlePostRequest(req, res, async (body: unknown) => {
      try {
        const request = body as Partial<SaveEndpointRequest>;

        // Check if just toggling enabled status
        if (Object.keys(request).length === 1 && 'enabled' in request) {
          const result = toggleEndpointEnabled(endpointId, request.enabled as boolean);

          if (result.success) {
            broadcastToClients({
              type: 'CLI_SETTINGS_TOGGLED',
              payload: {
                endpointId,
                enabled: request.enabled,
                timestamp: new Date().toISOString()
              }
            });
          }
          return result;
        }

        // Full update
        const existing = loadEndpointSettings(endpointId);
        if (!existing) {
          return { error: 'Endpoint not found', status: 404 };
        }

        const updateRequest: SaveEndpointRequest = {
          id: endpointId,
          name: request.name || existing.name,
          description: request.description ?? existing.description,
          settings: request.settings || existing.settings,
          enabled: request.enabled ?? existing.enabled
        };

        const result = saveEndpointSettings(updateRequest);

        if (result.success) {
          broadcastToClients({
            type: 'CLI_SETTINGS_UPDATED',
            payload: {
              endpoint: result.endpoint,
              filePath: result.filePath,
              timestamp: new Date().toISOString()
            }
          });
        }

        return result;
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // ========== DELETE SETTINGS ==========
  // DELETE /api/cli/settings/:id
  const deleteMatch = pathname.match(/^\/api\/cli\/settings\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const endpointId = sanitizeEndpointId(deleteMatch[1]);
    try {
      const result = deleteEndpointSettings(endpointId);

      if (result.success) {
        broadcastToClients({
          type: 'CLI_SETTINGS_DELETED',
          payload: {
            endpointId,
            timestamp: new Date().toISOString()
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // ========== GET SETTINGS FILE PATH ==========
  // GET /api/cli/settings/:id/path
  const pathMatch = pathname.match(/^\/api\/cli\/settings\/([^/]+)\/path$/);
  if (pathMatch && req.method === 'GET') {
    const endpointId = sanitizeEndpointId(pathMatch[1]);
    try {
      const endpoint = loadEndpointSettings(endpointId);

      if (!endpoint) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
        return true;
      }

      const filePath = getSettingsFilePath(endpointId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        endpointId,
        filePath,
        enabled: endpoint.enabled
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // ========== SYNC BUILTIN TOOLS AVAILABILITY ==========
  // POST /api/cli/settings/sync-tools
  if (pathname === '/api/cli/settings/sync-tools' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      const { initialPath } = ctx;
      try {
        const result = await syncBuiltinToolsAvailability(initialPath);

        // Broadcast update event
        broadcastToClients({
          type: 'CLI_TOOLS_CONFIG_UPDATED',
          payload: {
            tools: result.config,
            timestamp: new Date().toISOString()
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          changes: result.changes,
          config: result.config
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    });
    return true;
  }

  // GET /api/cli/settings/sync-report
  if (pathname === '/api/cli/settings/sync-report' && req.method === 'GET') {
    try {
      const { initialPath } = ctx;
      const report = await getBuiltinToolsSyncReport(initialPath);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(report));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // ========== EXPORT SETTINGS ==========
  // GET /api/cli/settings/export
  if (pathname === '/api/cli/settings/export' && req.method === 'GET') {
    try {
      const exportData = exportAllSettings();
      const jsonContent = JSON.stringify(exportData, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `cli-settings-export-${timestamp}.json`;

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength(jsonContent, 'utf-8')
      });
      res.end(jsonContent);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // ========== IMPORT SETTINGS ==========
  // POST /api/cli/settings/import
  if (pathname === '/api/cli/settings/import' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: unknown) => {
      try {
        // Extract import options and data from request
        const request = body as { data?: unknown; options?: ImportOptions };

        if (!request.data) {
          return { error: 'Missing export data in request body', status: 400 };
        }

        const result = importSettings(request.data, request.options);

        if (result.success) {
          // Broadcast import event
          broadcastToClients({
            type: 'CLI_SETTINGS_IMPORTED',
            payload: {
              imported: result.imported,
              skipped: result.skipped,
              importedIds: result.importedIds,
              timestamp: new Date().toISOString()
            }
          });
        }

        return result;
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // ========== CODEX CONFIG PREVIEW ==========
  // GET /api/cli/settings/codex/preview
  if (pathname === '/api/cli/settings/codex/preview' && req.method === 'GET') {
    try {
      const preview = readCodexConfigPreview();
      const home = homedir();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        configPath: join(home, '.codex', 'config.toml'),
        authPath: join(home, '.codex', 'auth.json'),
        configToml: preview.configToml,
        authJson: preview.authJson,
        errors: preview.errors.length > 0 ? preview.errors : undefined
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // ========== GEMINI CONFIG PREVIEW ==========
  // GET /api/cli/settings/gemini/preview
  if (pathname === '/api/cli/settings/gemini/preview' && req.method === 'GET') {
    try {
      const preview = readGeminiConfigPreview();
      const home = homedir();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        settingsPath: join(home, '.gemini', 'settings.json'),
        settingsJson: preview.settingsJson,
        errors: preview.errors.length > 0 ? preview.errors : undefined
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  return false;
}
