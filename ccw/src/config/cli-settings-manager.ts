/**
 * CLI Settings File Manager
 * Manages Claude CLI settings files for endpoint configuration
 *
 * Storage: ~/.ccw/cli-settings/{endpoint-id}.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import * as os from 'os';
import { getCCWHome, ensureStorageDir } from './storage-paths.js';
import {
  CliSettings,
  CliProvider,
  EndpointSettings,
  SettingsListResponse,
  SettingsOperationResult,
  SaveEndpointRequest,
  ExportedSettings,
  ImportOptions,
  ImportResult,
  validateSettings,
  createDefaultSettings
} from '../types/cli-settings.js';
import {
  addCustomEndpoint,
  removeCustomEndpoint
} from '../tools/claude-cli-tools.js';

/**
 * Get CLI settings directory path
 */
export function getCliSettingsDir(): string {
  return join(getCCWHome(), 'cli-settings');
}

/**
 * Get settings file path for an endpoint
 */
export function getSettingsFilePath(endpointId: string): string {
  return join(getCliSettingsDir(), `${endpointId}.json`);
}

/**
 * Get index file path (stores endpoint metadata)
 */
function getIndexFilePath(): string {
  return join(getCliSettingsDir(), '_index.json');
}

/**
 * Ensure settings directory exists
 */
export function ensureSettingsDir(): void {
  ensureStorageDir(getCliSettingsDir());
}

/**
 * Load endpoint index (metadata only, not settings content)
 */
function loadIndex(): Map<string, Omit<EndpointSettings, 'settings'>> {
  const indexPath = getIndexFilePath();
  if (!existsSync(indexPath)) {
    return new Map();
  }

  try {
    const data = JSON.parse(readFileSync(indexPath, 'utf-8'));
    return new Map(Object.entries(data));
  } catch {
    return new Map();
  }
}

/**
 * Save endpoint index
 */
function saveIndex(index: Map<string, Omit<EndpointSettings, 'settings'>>): void {
  ensureSettingsDir();
  const indexPath = getIndexFilePath();
  const data = Object.fromEntries(index);
  writeFileSync(indexPath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Generate unique endpoint ID
 */
function generateEndpointId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ep-${timestamp}-${random}`;
}

/**
 * Save endpoint settings to file
 */
export function saveEndpointSettings(request: SaveEndpointRequest): SettingsOperationResult {
  try {
    ensureSettingsDir();

    const now = new Date().toISOString();
    const index = loadIndex();

    // Determine endpoint ID
    const endpointId = request.id || generateEndpointId();

    // Check if updating existing or creating new
    const existing = index.get(endpointId);

    // Create endpoint metadata
    const metadata: Omit<EndpointSettings, 'settings'> = {
      id: endpointId,
      name: request.name,
      description: request.description,
      provider: request.provider || 'claude',
      enabled: request.enabled ?? true,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    // Save settings file
    const settingsPath = getSettingsFilePath(endpointId);
    writeFileSync(settingsPath, JSON.stringify(request.settings, null, 2), 'utf-8');

    // Update index
    index.set(endpointId, metadata);
    saveIndex(index);

    // Sync with cli-tools.json for ccw cli --tool integration
    // CLI Settings endpoints are added as tools with type: 'cli-wrapper'
    // Usage: ccw cli -p "..." --tool <name> --mode analysis
    try {
      const projectDir = os.homedir(); // Use home dir as base for global config
      // Merge user-provided tags with cli-wrapper tag for proper type registration
      const userTags = request.settings.tags || [];
      const tags = [...new Set([...userTags, 'cli-wrapper'])]; // Dedupe and ensure cli-wrapper tag
      addCustomEndpoint(projectDir, {
        id: endpointId,
        name: request.name,
        enabled: request.enabled ?? true,
        tags,
        availableModels: request.settings.availableModels,
        settingsFile: 'settingsFile' in request.settings ? (request.settings as any).settingsFile : undefined
      });
      console.log(`[CliSettings] Synced endpoint ${endpointId} to cli-tools.json tools (cli-wrapper)`);
    } catch (syncError) {
      console.warn(`[CliSettings] Failed to sync with cli-tools.json: ${syncError}`);
      // Non-fatal: continue even if sync fails
    }

    // Return full endpoint settings
    const endpoint: EndpointSettings = {
      ...metadata,
      settings: request.settings
    };

    return {
      success: true,
      message: existing ? 'Endpoint updated' : 'Endpoint created',
      endpoint,
      filePath: settingsPath
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to save endpoint settings: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Load endpoint settings from file
 */
export function loadEndpointSettings(endpointId: string): EndpointSettings | null {
  try {
    const index = loadIndex();
    const metadata = index.get(endpointId);

    if (!metadata) {
      return null;
    }

    const settingsPath = getSettingsFilePath(endpointId);
    if (!existsSync(settingsPath)) {
      return null;
    }

    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));

    const provider = (metadata as any).provider || 'claude';
    if (!validateSettings(settings, provider)) {
      console.error(`[CliSettings] Invalid settings format for ${endpointId}`);
      return null;
    }

    return {
      ...metadata,
      provider,
      settings
    };
  } catch (e) {
    console.error(`[CliSettings] Failed to load settings for ${endpointId}:`, e);
    return null;
  }
}

/**
 * Delete endpoint settings
 */
export function deleteEndpointSettings(endpointId: string): SettingsOperationResult {
  const index = loadIndex();

  if (!index.has(endpointId)) {
    return {
      success: false,
      message: 'Endpoint not found'
    };
  }

  const settingsPath = getSettingsFilePath(endpointId);

  try {
    // Step 1: Delete file first
    if (existsSync(settingsPath)) {
      unlinkSync(settingsPath);
    }

    // Step 2: Only update index after successful file deletion
    index.delete(endpointId);
    saveIndex(index);

    // Step 3: Remove from cli-tools.json tools (api-endpoint type)
    try {
      const projectDir = os.homedir();
      removeCustomEndpoint(projectDir, endpointId);
      console.log(`[CliSettings] Removed endpoint ${endpointId} from cli-tools.json tools`);
    } catch (syncError) {
      console.warn(`[CliSettings] Failed to remove from cli-tools.json: ${syncError}`);
      // Non-fatal: continue even if sync fails
    }

    return {
      success: true,
      message: 'Endpoint deleted'
    };
  } catch (error) {
    // If deletion fails, index remains unchanged for consistency
    return {
      success: false,
      message: `Failed to delete endpoint file: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * List all endpoint settings
 */
export function listAllSettings(): SettingsListResponse {
  try {
    const index = loadIndex();
    const endpoints: EndpointSettings[] = [];

    for (const [endpointId, metadata] of index) {
      const settingsPath = getSettingsFilePath(endpointId);

      if (!existsSync(settingsPath)) {
        continue;
      }

      try {
        const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
        const provider: CliProvider = (metadata as any).provider || 'claude';

        if (validateSettings(settings, provider)) {
          endpoints.push({
            ...metadata,
            provider,
            settings
          });
        }
      } catch (e) {
        // Skip invalid settings files, but log the error for debugging
        console.error(`[CliSettings] Failed to load or parse settings for ${endpointId}:`, e);
      }
    }

    return {
      endpoints,
      total: endpoints.length
    };
  } catch (e) {
    console.error('[CliSettings] Failed to list settings:', e);
    return {
      endpoints: [],
      total: 0
    };
  }
}

/**
 * Toggle endpoint enabled status
 */
export function toggleEndpointEnabled(endpointId: string, enabled: boolean): SettingsOperationResult {
  try {
    const index = loadIndex();
    const metadata = index.get(endpointId);

    if (!metadata) {
      return {
        success: false,
        message: 'Endpoint not found'
      };
    }

    metadata.enabled = enabled;
    metadata.updatedAt = new Date().toISOString();
    index.set(endpointId, metadata);
    saveIndex(index);

    // Sync enabled status with cli-tools.json tools (cli-wrapper type)
    try {
      const projectDir = os.homedir();
      // Load full settings to get tags
      const endpoint = loadEndpointSettings(endpointId);
      const userTags = endpoint?.settings.tags || [];
      const tags = [...new Set([...userTags, 'cli-wrapper'])]; // Dedupe and ensure cli-wrapper tag
      addCustomEndpoint(projectDir, {
        id: endpointId,
        name: metadata.name,
        enabled: enabled,
        tags,
        availableModels: endpoint?.settings.availableModels,
        settingsFile: endpoint?.settings && 'settingsFile' in endpoint.settings ? (endpoint.settings as any).settingsFile : undefined
      });
      console.log(`[CliSettings] Synced endpoint ${endpointId} enabled=${enabled} to cli-tools.json tools`);
    } catch (syncError) {
      console.warn(`[CliSettings] Failed to sync enabled status to cli-tools.json: ${syncError}`);
    }

    // Load full settings for response
    const endpoint = loadEndpointSettings(endpointId);

    return {
      success: true,
      message: enabled ? 'Endpoint enabled' : 'Endpoint disabled',
      endpoint: endpoint || undefined
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to toggle endpoint: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Get settings file path for CLI execution
 * Returns null if endpoint not found or disabled
 */
export function getExecutableSettingsPath(endpointId: string): string | null {
  const endpoint = loadEndpointSettings(endpointId);

  if (!endpoint || !endpoint.enabled) {
    return null;
  }

  const settingsPath = getSettingsFilePath(endpointId);
  return existsSync(settingsPath) ? settingsPath : null;
}

/**
 * Create settings from LiteLLM provider configuration
 */
export function createSettingsFromProvider(provider: {
  apiKey?: string;
  apiBase?: string;
  name?: string;
}, options?: {
  model?: string;
}): CliSettings {
  const settings = createDefaultSettings('claude');

  // Map provider credentials to env
  if (provider.apiKey) {
    settings.env.ANTHROPIC_AUTH_TOKEN = provider.apiKey;
  }
  if (provider.apiBase) {
    settings.env.ANTHROPIC_BASE_URL = provider.apiBase;
  }

  // Apply options
  if (options?.model) {
    settings.model = options.model;
  }

  return settings;
}

/**
 * Validate and sanitize endpoint ID
 */
export function sanitizeEndpointId(id: string): string {
  // Remove special characters, keep alphanumeric and hyphens
  return id.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Check if endpoint ID exists
 */
export function endpointExists(endpointId: string): boolean {
  const index = loadIndex();
  return index.has(endpointId);
}

/**
 * Get enabled endpoints only
 */
export function getEnabledEndpoints(): EndpointSettings[] {
  const { endpoints } = listAllSettings();
  return endpoints.filter(ep => ep.enabled);
}

/**
 * Find endpoint by name (case-insensitive)
 * Useful for CLI where user types --tool doubao instead of --tool ep-xxx
 */
export function findEndpointByName(name: string): EndpointSettings | null {
  const { endpoints } = listAllSettings();
  const lowerName = name.toLowerCase();
  return endpoints.find(ep => ep.name.toLowerCase() === lowerName) || null;
}

/**
 * Find endpoint by ID or name
 * First tries exact ID match, then falls back to name match
 */
export function findEndpoint(idOrName: string): EndpointSettings | null {
  // Try by ID first
  const byId = loadEndpointSettings(idOrName);
  if (byId) return byId;

  // Try by name
  return findEndpointByName(idOrName);
}

/**
 * Validate endpoint name for CLI compatibility
 * Name must be: lowercase, alphanumeric, hyphens allowed, no spaces or special chars
 */
export function validateEndpointName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Name is required' };
  }

  // Check for valid characters: a-z, 0-9, hyphen, underscore
  const validPattern = /^[a-z][a-z0-9_-]*$/;
  if (!validPattern.test(name.toLowerCase())) {
    return {
      valid: false,
      error: 'Name must start with a letter and contain only letters, numbers, hyphens, and underscores'
    };
  }

  // Check length
  if (name.length > 32) {
    return { valid: false, error: 'Name must be 32 characters or less' };
  }

  // Check if name conflicts with built-in tools
  const builtinTools = ['gemini', 'qwen', 'codex', 'claude', 'opencode', 'litellm'];
  if (builtinTools.includes(name.toLowerCase())) {
    return { valid: false, error: `Name "${name}" conflicts with a built-in tool` };
  }

  return { valid: true };
}

/**
 * Export all CLI endpoint settings
 * Returns an ExportedSettings object with version, timestamp, and all endpoints
 */
export function exportAllSettings(): ExportedSettings {
  const { endpoints } = listAllSettings();

  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints
  };
}

/**
 * Import settings from an ExportedSettings object
 * Validates and applies imported settings with configurable conflict resolution
 */
export function importSettings(
  exportedData: unknown,
  options: ImportOptions = {}
): ImportResult {
  const {
    conflictStrategy = 'skip',
    skipInvalid = true,
    disableImported = false
  } = options;

  const result: ImportResult = {
    success: false,
    imported: 0,
    skipped: 0,
    errors: [],
    importedIds: []
  };

  // Validate exported data structure
  if (!exportedData || typeof exportedData !== 'object') {
    result.errors.push('Invalid export data: must be an object');
    return result;
  }

  const data = exportedData as Record<string, unknown>;

  // Check for required fields
  if (!('endpoints' in data) || !Array.isArray(data.endpoints)) {
    result.errors.push('Invalid export data: missing or invalid endpoints array');
    return result;
  }

  // Validate version (for future migration support)
  if ('version' in data && typeof data.version !== 'string') {
    result.errors.push('Invalid export data: version must be a string');
    return result;
  }

  const endpoints = data.endpoints as unknown[];
  const existingIndex = loadIndex();

  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];

    // Validate endpoint structure
    if (!ep || typeof ep !== 'object') {
      if (!skipInvalid) {
        result.errors.push(`Endpoint at index ${i}: invalid structure`);
      }
      result.skipped++;
      continue;
    }

    const endpoint = ep as Record<string, unknown>;

    // Check required fields
    if (!endpoint.name || typeof endpoint.name !== 'string') {
      if (!skipInvalid) {
        result.errors.push(`Endpoint at index ${i}: missing or invalid name`);
      }
      result.skipped++;
      continue;
    }

    if (!endpoint.settings || typeof endpoint.settings !== 'object') {
      if (!skipInvalid) {
        result.errors.push(`Endpoint at index ${i}: missing or invalid settings`);
      }
      result.skipped++;
      continue;
    }

    // Validate settings using provider-aware validation
    const provider: CliProvider = (endpoint.provider as CliProvider) || 'claude';
    if (!validateSettings(endpoint.settings, provider)) {
      if (!skipInvalid) {
        result.errors.push(`Endpoint "${endpoint.name}": invalid settings format`);
      }
      result.skipped++;
      continue;
    }

    // Determine endpoint ID
    const endpointId = (endpoint.id as string) || generateEndpointId();
    const exists = existingIndex.has(endpointId);

    // Handle conflicts
    if (exists && conflictStrategy === 'skip') {
      result.skipped++;
      continue;
    }

    // Prepare import request
    const importRequest: SaveEndpointRequest = {
      id: endpointId,
      name: endpoint.name as string,
      description: endpoint.description as string | undefined,
      provider,
      settings: endpoint.settings as CliSettings,
      enabled: disableImported ? false : (endpoint.enabled as boolean) ?? true
    };

    // For merge strategy, combine with existing if applicable
    if (exists && conflictStrategy === 'merge') {
      const existing = loadEndpointSettings(endpointId);
      if (existing) {
        importRequest.settings = {
          ...existing.settings,
          ...(endpoint.settings as CliSettings)
        } as CliSettings;
        importRequest.name = (endpoint.name as string) || existing.name;
        importRequest.description = (endpoint.description as string) ?? existing.description;
      }
    }

    // Save the endpoint
    const saveResult = saveEndpointSettings(importRequest);

    if (saveResult.success) {
      result.imported++;
      result.importedIds!.push(endpointId);
    } else {
      result.errors.push(`Endpoint "${endpoint.name}": ${saveResult.message || 'Failed to save'}`);
      result.skipped++;
    }
  }

  result.success = result.imported > 0;
  return result;
}
