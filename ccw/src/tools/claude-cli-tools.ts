/**
 * Claude CLI Tools Configuration Manager
 * Manages cli-tools.json (tools) and cli-settings.json (settings)
 *
 * Configuration Strategy (GLOBAL ONLY):
 * - READ: Global → Default (no project-level configs)
 * - CREATE/SAVE: Always in ~/.claude/ (global user-level config)
 *
 * Config location: ~/.claude/cli-tools.json
 * Settings location: ~/.claude/cli-settings.json
 *
 * Note: Project-level configs are NOT used - all config is user-level.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ========== Debug Logging ==========
// Only output logs when DEBUG is enabled (via --debug flag or DEBUG env var)
function isDebugEnabled(): boolean {
  return process.env.DEBUG === 'true' || process.env.DEBUG === '1' || process.env.CCW_DEBUG === 'true';
}

function debugLog(message: string): void {
  if (isDebugEnabled()) {
    console.log(message);
  }
}

// ========== Types ==========

export interface ClaudeCliTool {
  enabled: boolean;
  primaryModel?: string;
  secondaryModel?: string;
  /**
   * Available models for this tool (shown in UI dropdown)
   * If not provided, defaults will be used based on tool type
   */
  availableModels?: string[];
  tags: string[];
  /**
   * Tool type determines routing:
   * - 'builtin': Built-in CLI tools (gemini, qwen, codex, etc.)
   * - 'cli-wrapper': Routes to `claude --settings` (CLI Settings endpoints)
   * - 'api-endpoint': Routes to LiteLLM (LiteLLM endpoints)
   */
  type?: 'builtin' | 'cli-wrapper' | 'api-endpoint';
  /**
   * Endpoint ID for type: 'api-endpoint'
   * Used to lookup endpoint configuration in litellm-api-config.json
   */
  id?: string;
  /**
   * Path to .env file for loading environment variables before CLI execution
   * Supports both absolute paths and paths relative to home directory (e.g., ~/.my-env)
   */
  envFile?: string;
  /**
   * Path to Claude CLI settings.json file (builtin claude only)
   * Passed to Claude CLI via --settings parameter
   * Supports ~, absolute, relative, and Windows paths
   */
  settingsFile?: string;
  /**
   * Default effort level for Claude CLI (builtin claude only)
   * Passed to Claude CLI via --effort parameter
   * Valid values: 'low', 'medium', 'high'
   */
  effort?: string;
}

export type CliToolName = 'gemini' | 'qwen' | 'codex' | 'claude' | 'opencode' | string;

// @deprecated Use tools with type: 'api-endpoint' instead
export interface ClaudeApiEndpoint {
  id: string;
  name: string;
  enabled: boolean;
}

// @deprecated Use tools with type: 'cli-wrapper' or 'api-endpoint' instead
export interface ClaudeCustomEndpoint {
  id: string;
  name: string;
  enabled: boolean;
  tags: string[];
}

export interface ClaudeCacheSettings {
  injectionMode: 'auto' | 'manual' | 'disabled';
  defaultPrefix: string;
  defaultSuffix: string;
}

// New: Tools-only config (cli-tools.json)
export interface ClaudeCliToolsConfig {
  $schema?: string;
  version: string;
  tools: Record<string, ClaudeCliTool>;  // All tools: builtin, cli-wrapper, api-endpoint
  apiEndpoints?: ClaudeApiEndpoint[];  // @deprecated Use tools with type: 'api-endpoint' instead
  customEndpoints?: ClaudeCustomEndpoint[];  // @deprecated Use tools with type: 'cli-wrapper' or 'api-endpoint' instead
}

// New: Settings-only config (cli-settings.json)
export interface ClaudeCliSettingsConfig {
  $schema?: string;
  version: string;
  defaultTool: string;
  promptFormat: 'plain' | 'yaml' | 'json';
  smartContext: {
    enabled: boolean;
    maxFiles: number;
  };
  nativeResume: boolean;
  recursiveQuery: boolean;
  cache: ClaudeCacheSettings;
  codeIndexMcp: 'codexlens' | 'ace' | 'none';
}

// Legacy combined config (for backward compatibility)
export interface ClaudeCliCombinedConfig extends ClaudeCliToolsConfig {
  defaultTool?: string;
  settings?: {
    promptFormat?: 'plain' | 'yaml' | 'json';
    smartContext?: {
      enabled?: boolean;
      maxFiles?: number;
    };
    nativeResume?: boolean;
    recursiveQuery?: boolean;
    cache?: Partial<ClaudeCacheSettings>;
    codeIndexMcp?: 'codexlens' | 'ace' | 'none';
  };
}

// ========== Default Config ==========

// Default tools config - no model defaults, models come from user's cli-tools.json
const DEFAULT_TOOLS_CONFIG: ClaudeCliToolsConfig = {
  version: '3.4.0',
  tools: {
    gemini: {
      enabled: true,
      tags: [],
      type: 'builtin'
    },
    qwen: {
      enabled: true,
      tags: [],
      type: 'builtin'
    },
    codex: {
      enabled: true,
      tags: [],
      type: 'builtin'
    },
    claude: {
      enabled: true,
      tags: [],
      type: 'builtin'
    },
    opencode: {
      enabled: true,
      tags: [],
      type: 'builtin'
    }
  }
  // Note: api-endpoint type tools are added dynamically via addClaudeApiEndpoint
};

const DEFAULT_SETTINGS_CONFIG: ClaudeCliSettingsConfig = {
  version: '1.0.0',
  defaultTool: 'gemini',
  promptFormat: 'plain',
  smartContext: {
    enabled: false,
    maxFiles: 10
  },
  nativeResume: true,
  recursiveQuery: true,
  cache: {
    injectionMode: 'auto',
    defaultPrefix: '',
    defaultSuffix: ''
  },
  codeIndexMcp: 'ace'
};

// ========== Helper Functions ==========

function getProjectConfigPath(projectDir: string): string {
  return path.join(projectDir, '.claude', 'cli-tools.json');
}

function getProjectSettingsPath(projectDir: string): string {
  return path.join(projectDir, '.claude', 'cli-settings.json');
}

function getGlobalConfigPath(): string {
  // Support CCW_DATA_DIR for test isolation
  const claudeHome = process.env.CCW_DATA_DIR
    ? path.join(process.env.CCW_DATA_DIR, '.claude')
    : path.join(os.homedir(), '.claude');
  return path.join(claudeHome, 'cli-tools.json');
}

function getGlobalSettingsPath(): string {
  // Support CCW_DATA_DIR for test isolation
  const claudeHome = process.env.CCW_DATA_DIR
    ? path.join(process.env.CCW_DATA_DIR, '.claude')
    : path.join(os.homedir(), '.claude');
  return path.join(claudeHome, 'cli-settings.json');
}

/**
 * Resolve config path - GLOBAL ONLY
 * Config is user-level, stored only in ~/.claude/cli-tools.json
 * Returns { path, source } where source is 'global' | 'default'
 */
function resolveConfigPath(projectDir: string): { path: string; source: 'project' | 'global' | 'default' } {
  const globalPath = getGlobalConfigPath();
  debugLog(`[HYPOTHESIS-1] Checking for global config at: ${globalPath}`);
  if (fs.existsSync(globalPath)) {
    debugLog(`[HYPOTHESIS-1] Global config found. Using source: 'global'`);
    return { path: globalPath, source: 'global' };
  }

  debugLog(`[HYPOTHESIS-1] Global config NOT found. Using source: 'default'`);
  // Return global path for default (will be created there)
  return { path: globalPath, source: 'default' };
}

/**
 * Resolve settings path - GLOBAL ONLY
 * Settings are user-level, stored only in ~/.claude/cli-settings.json
 */
function resolveSettingsPath(projectDir: string): { path: string; source: 'project' | 'global' | 'default' } {
  const globalPath = getGlobalSettingsPath();
  if (fs.existsSync(globalPath)) {
    return { path: globalPath, source: 'global' };
  }

  // Return global path for default (will be created there)
  return { path: globalPath, source: 'default' };
}

// NOTE: ensureClaudeDir removed - config should only be in ~/.claude/, not project directory

// ========== Main Functions ==========

/**
 * Create a timestamped backup of the config file
 * @param filePath - Path to the config file to backup
 * @returns Path to the backup file
 */
function backupConfigFile(filePath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '-' +
                    new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].substring(0, 8);
  const backupPath = `${filePath}.${timestamp}.bak`;

  try {
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath);
      debugLog(`[claude-cli-tools] Created backup: ${backupPath}`);
    }
    return backupPath;
  } catch (err) {
    console.warn('[claude-cli-tools] Failed to create backup:', err);
    return '';
  }
}

/**
 * Ensure tool has required fields (for backward compatibility)
 * Preserves ALL fields from original tool object
 */
function ensureToolTags(tool: Partial<ClaudeCliTool>): ClaudeCliTool {
  return {
    ...tool,  // Preserve all original fields (including availableModels, type, id, etc.)
    enabled: tool.enabled ?? true,
    tags: tool.tags ?? []
  };
}

/**
 * Migrate config from older versions to v3.3.0
 * v3.2.0: All endpoints (cli-wrapper, api-endpoint) are in tools with type field
 * v3.3.0: Remove models field (moved to system reference)
 */
function migrateConfig(config: any, projectDir: string, configPath?: string): ClaudeCliToolsConfig {
  const version = parseFloat(config.version || '1.0');
  let needsMigration = false;

  // Check if models field exists (v3.3.0 migration)
  if (config.models) {
    needsMigration = true;
    debugLog('[claude-cli-tools] Detected models field, will remove (moved to system reference)');
  }

  // Already v3.3+, no migration needed
  if (version >= 3.3 && !needsMigration) {
    return config as ClaudeCliToolsConfig;
  }

  // Create backup before migration if config path is provided
  if (configPath && (version < 3.3 || needsMigration)) {
    backupConfigFile(configPath);
  }

  debugLog(`[claude-cli-tools] Migrating config from v${config.version || '1.0'} to v3.3.0`);

  // Try to load legacy cli-config.json for model data
  let legacyCliConfig: any = null;
  try {
    const { StoragePaths } = require('../config/storage-paths.js');
    const legacyPath = StoragePaths.project(projectDir).cliConfig;
    const fs = require('fs');
    if (fs.existsSync(legacyPath)) {
      legacyCliConfig = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
      debugLog(`[claude-cli-tools] Found legacy cli-config.json, merging model data`);
    }
  } catch {
    // Ignore errors loading legacy config
  }

  const migratedTools: Record<string, ClaudeCliTool> = {};

  for (const [key, tool] of Object.entries(config.tools || {})) {
    const t = tool as any;
    const legacyTool = legacyCliConfig?.tools?.[key];

    migratedTools[key] = {
      enabled: t.enabled ?? legacyTool?.enabled ?? true,
      primaryModel: t.primaryModel ?? legacyTool?.primaryModel ?? DEFAULT_TOOLS_CONFIG.tools[key]?.primaryModel,
      secondaryModel: t.secondaryModel ?? legacyTool?.secondaryModel ?? DEFAULT_TOOLS_CONFIG.tools[key]?.secondaryModel,
      tags: t.tags ?? legacyTool?.tags ?? [],
      type: t.type ?? DEFAULT_TOOLS_CONFIG.tools[key]?.type ?? 'builtin',
      id: t.id  // Preserve id for api-endpoint type
    };
  }

  // Add any missing default tools
  for (const [key, defaultTool] of Object.entries(DEFAULT_TOOLS_CONFIG.tools)) {
    if (!migratedTools[key]) {
      const legacyTool = legacyCliConfig?.tools?.[key];
      migratedTools[key] = {
        enabled: legacyTool?.enabled ?? defaultTool.enabled,
        primaryModel: legacyTool?.primaryModel ?? defaultTool.primaryModel,
        secondaryModel: legacyTool?.secondaryModel ?? defaultTool.secondaryModel,
        tags: legacyTool?.tags ?? defaultTool.tags,
        type: defaultTool.type ?? 'builtin'
      };
    }
  }

  // Migrate customEndpoints (v3.0 and below): cli-wrapper -> tools, others -> api-endpoint tools
  const customEndpoints = config.customEndpoints || [];
  for (const ep of customEndpoints) {
    if (ep.tags?.includes('cli-wrapper')) {
      // CLI wrapper becomes a tool with type: 'cli-wrapper'
      if (!migratedTools[ep.name]) {
        migratedTools[ep.name] = {
          enabled: ep.enabled ?? true,
          tags: ep.tags.filter((t: string) => t !== 'cli-wrapper'),
          type: 'cli-wrapper'
        };
        debugLog(`[claude-cli-tools] Migrated cli-wrapper "${ep.name}" to tools`);
      }
    } else {
      // Pure API endpoint becomes a tool with type: 'api-endpoint'
      if (!migratedTools[ep.name]) {
        migratedTools[ep.name] = {
          enabled: ep.enabled ?? true,
          tags: [],
          type: 'api-endpoint',
          id: ep.id  // Store endpoint ID for settings lookup
        };
        debugLog(`[claude-cli-tools] Migrated API endpoint "${ep.name}" to tools`);
      }
    }
  }

  // Migrate apiEndpoints (v3.1): convert to tools with type: 'api-endpoint'
  const apiEndpoints = config.apiEndpoints || [];
  for (const ep of apiEndpoints) {
    if (!migratedTools[ep.name]) {
      migratedTools[ep.name] = {
        enabled: ep.enabled ?? true,
        tags: [],
        type: 'api-endpoint',
        id: ep.id  // Store endpoint ID for settings lookup
      };
      debugLog(`[claude-cli-tools] Migrated API endpoint "${ep.name}" to tools`);
    }
  }

  // Remove models field if it exists (v3.3.0 migration)
  if (config.models) {
    debugLog('[claude-cli-tools] Removed models field (moved to system reference)');
  }

  return {
    version: '3.3.0',
    tools: migratedTools,
    $schema: config.$schema
  };
}

/**
 * Ensure CLI tools configuration file exists
 * Creates default config in global ~/.claude directory (user-level config)
 * @param projectDir - Project directory path (used for reading existing project config)
 * @param createInProject - DEPRECATED: Always creates in global dir. Kept for backward compatibility.
 * @returns The config that was created/exists
 */
export function ensureClaudeCliTools(projectDir: string, createInProject: boolean = false): ClaudeCliToolsConfig & { _source?: string } {
  const resolved = resolveConfigPath(projectDir);

  if (resolved.source !== 'default') {
    // Config exists, load and return it
    return loadClaudeCliTools(projectDir);
  }

  // Config doesn't exist - create in global directory only
  debugLog('[claude-cli-tools] Config not found, creating default cli-tools.json in ~/.claude');

  const defaultConfig: ClaudeCliToolsConfig = { ...DEFAULT_TOOLS_CONFIG };

  // Always create in global directory (user-level config), respecting CCW_DATA_DIR
  const claudeHome = process.env.CCW_DATA_DIR
    ? path.join(process.env.CCW_DATA_DIR, '.claude')
    : path.join(os.homedir(), '.claude');
  if (!fs.existsSync(claudeHome)) {
    fs.mkdirSync(claudeHome, { recursive: true });
  }
  const globalPath = getGlobalConfigPath();
  try {
    fs.writeFileSync(globalPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    debugLog(`[claude-cli-tools] Created default config at: ${globalPath}`);
    return { ...defaultConfig, _source: 'global' };
  } catch (err) {
    console.error('[claude-cli-tools] Failed to create global config:', err);
    return { ...defaultConfig, _source: 'default' };
  }
}

/**
 * Async version of ensureClaudeCliTools with automatic availability sync
 * Creates default config in global ~/.claude directory and syncs with actual tool availability
 * @param projectDir - Project directory path (used for reading existing project config)
 * @param createInProject - DEPRECATED: Always creates in global dir. Kept for backward compatibility.
 * @returns The config that was created/exists
 */
export async function ensureClaudeCliToolsAsync(projectDir: string, createInProject: boolean = false): Promise<ClaudeCliToolsConfig & { _source?: string }> {
  const resolved = resolveConfigPath(projectDir);

  if (resolved.source !== 'default') {
    // Config exists, load and return it
    return loadClaudeCliTools(projectDir);
  }

  // Config doesn't exist - create in global directory only
  debugLog('[claude-cli-tools] Config not found, creating default cli-tools.json in ~/.claude');

  const defaultConfig: ClaudeCliToolsConfig = { ...DEFAULT_TOOLS_CONFIG };

  // Always create in global directory (user-level config), respecting CCW_DATA_DIR
  const claudeHome = process.env.CCW_DATA_DIR
    ? path.join(process.env.CCW_DATA_DIR, '.claude')
    : path.join(os.homedir(), '.claude');
  if (!fs.existsSync(claudeHome)) {
    fs.mkdirSync(claudeHome, { recursive: true });
  }
  const globalPath = getGlobalConfigPath();
  try {
    fs.writeFileSync(globalPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    debugLog(`[claude-cli-tools] Created default config at: ${globalPath}`);

    // Auto-sync with actual tool availability on first creation
    try {
      debugLog('[claude-cli-tools] Auto-syncing tool availability on first creation...');
      const syncResult = await syncBuiltinToolsAvailability(projectDir);
      debugLog(`[claude-cli-tools] Auto-sync completed: enabled=[${syncResult.changes.enabled.join(', ')}], disabled=[${syncResult.changes.disabled.join(', ')}]`);
      return { ...syncResult.config, _source: 'global' };
    } catch (syncErr) {
      console.warn('[claude-cli-tools] Failed to auto-sync availability:', syncErr);
      // Return default config if sync fails
      return { ...defaultConfig, _source: 'global' };
    }
  } catch (err) {
    console.error('[claude-cli-tools] Failed to create global config:', err);
    return { ...defaultConfig, _source: 'default' };
  }
}


/**
 * Load CLI tools configuration from global ~/.claude/cli-tools.json
 * Falls back to default config if not found.
 *
 * Automatically migrates older config versions to v3.2.0
 */
export function loadClaudeCliTools(projectDir: string): ClaudeCliToolsConfig & { _source?: string } {
  debugLog(`[DIAGNOSIS] Starting to load claude cli tools for projectDir: ${projectDir}`);
  const resolved = resolveConfigPath(projectDir);

  try {
    if (resolved.source === 'default') {
      debugLog('[DIAGNOSIS] Resolved source is "default", returning default config.');
      return { ...DEFAULT_TOOLS_CONFIG, _source: 'default' };
    }

    const content = fs.readFileSync(resolved.path, 'utf-8');
    const parsed = JSON.parse(content) as Partial<ClaudeCliCombinedConfig>;

    // Migrate older versions to v3.3.0 (pass config path for backup)
    const migrated = migrateConfig(parsed, projectDir, resolved.path);

    // Load user-configured tools only (defaults NOT merged)
    const mergedTools: Record<string, ClaudeCliTool> = {};
    for (const [key, tool] of Object.entries(migrated.tools || {})) {
      mergedTools[key] = {
        ...ensureToolTags(tool),  // Now preserves all fields including availableModels, type, id
        type: tool.type ?? 'builtin'  // Ensure type has default value
      };
    }

    const config: ClaudeCliToolsConfig & { _source?: string } = {
      version: migrated.version || DEFAULT_TOOLS_CONFIG.version,
      tools: mergedTools,
      $schema: migrated.$schema,
      _source: resolved.source
    };

    // Save migrated config if version changed or models field exists
    const needsVersionUpdate = migrated.version !== (parsed as any).version;
    const hasModelsField = (parsed as any).models !== undefined;
    if (needsVersionUpdate || hasModelsField) {
      try {
        saveClaudeCliTools(projectDir, config);
        debugLog(`[claude-cli-tools] Saved migrated config to: ${resolved.path}`);
      } catch (err) {
        console.warn('[claude-cli-tools] Failed to save migrated config:', err);
      }
    }

    debugLog(`[claude-cli-tools] Loaded tools config from ${resolved.source}: ${resolved.path}`);
    return config;
  } catch (err) {
    console.error('[HYPOTHESIS-2] Error loading or parsing tools config. Falling back to default. Error:', err);
    console.error('[claude-cli-tools] Error loading tools config:', err);
    return { ...DEFAULT_TOOLS_CONFIG, _source: 'default' };
  }
}

/**
 * Save CLI tools configuration to global ~/.claude/cli-tools.json
 * Always saves to global directory (user-level config)
 */
export function saveClaudeCliTools(projectDir: string, config: ClaudeCliToolsConfig & { _source?: string }): void {
  const { _source, ...configToSave } = config;

  // Always save to global directory, respecting CCW_DATA_DIR
  const claudeHome = process.env.CCW_DATA_DIR
    ? path.join(process.env.CCW_DATA_DIR, '.claude')
    : path.join(os.homedir(), '.claude');
  if (!fs.existsSync(claudeHome)) {
    fs.mkdirSync(claudeHome, { recursive: true });
  }
  const configPath = getGlobalConfigPath();

  try {
    fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2), 'utf-8');
    debugLog(`[claude-cli-tools] Saved tools config to: ${configPath}`);
  } catch (err) {
    console.error('[claude-cli-tools] Error saving tools config:', err);
    throw new Error(`Failed to save CLI tools config: ${err}`);
  }
}

/**
 * Load CLI settings configuration from global ~/.claude/cli-settings.json
 * Falls back to default settings if not found.
 */
export function loadClaudeCliSettings(projectDir: string): ClaudeCliSettingsConfig & { _source?: string } {
  const resolved = resolveSettingsPath(projectDir);

  try {
    if (resolved.source === 'default') {
      return { ...DEFAULT_SETTINGS_CONFIG, _source: 'default' };
    }

    const content = fs.readFileSync(resolved.path, 'utf-8');
    const parsed = JSON.parse(content) as Partial<ClaudeCliSettingsConfig>;

    const config: ClaudeCliSettingsConfig & { _source?: string } = {
      ...DEFAULT_SETTINGS_CONFIG,
      ...parsed,
      smartContext: {
        ...DEFAULT_SETTINGS_CONFIG.smartContext,
        ...(parsed.smartContext || {})
      },
      cache: {
        ...DEFAULT_SETTINGS_CONFIG.cache,
        ...(parsed.cache || {})
      },
      _source: resolved.source
    };

    debugLog(`[claude-cli-tools] Loaded settings from ${resolved.source}: ${resolved.path}`);
    return config;
  } catch (err) {
    console.error('[claude-cli-tools] Error loading settings:', err);
    return { ...DEFAULT_SETTINGS_CONFIG, _source: 'default' };
  }
}

/**
 * Save CLI settings configuration to global ~/.claude/cli-settings.json
 * Always saves to global directory (user-level config)
 */
export function saveClaudeCliSettings(projectDir: string, config: ClaudeCliSettingsConfig & { _source?: string }): void {
  const { _source, ...configToSave } = config;

  // Always save to global directory, respecting CCW_DATA_DIR
  const claudeHome = process.env.CCW_DATA_DIR
    ? path.join(process.env.CCW_DATA_DIR, '.claude')
    : path.join(os.homedir(), '.claude');
  if (!fs.existsSync(claudeHome)) {
    fs.mkdirSync(claudeHome, { recursive: true });
  }
  const settingsPath = getGlobalSettingsPath();

  try {
    fs.writeFileSync(settingsPath, JSON.stringify(configToSave, null, 2), 'utf-8');
    debugLog(`[claude-cli-tools] Saved settings to: ${settingsPath}`);
  } catch (err) {
    console.error('[claude-cli-tools] Error saving settings:', err);
    throw new Error(`Failed to save CLI settings: ${err}`);
  }
}

/**
 * Update enabled status for a specific tool
 */
export function updateClaudeToolEnabled(
  projectDir: string,
  toolName: string,
  enabled: boolean
): ClaudeCliToolsConfig {
  const config = loadClaudeCliTools(projectDir);

  if (config.tools[toolName]) {
    config.tools[toolName].enabled = enabled;
    saveClaudeCliTools(projectDir, config);
  }

  return config;
}

/**
 * Update cache settings
 */
export function updateClaudeCacheSettings(
  projectDir: string,
  cacheSettings: Partial<ClaudeCacheSettings>
): ClaudeCliSettingsConfig {
  const settings = loadClaudeCliSettings(projectDir);

  settings.cache = {
    ...settings.cache,
    ...cacheSettings
  };

  saveClaudeCliSettings(projectDir, settings);
  return settings;
}

/**
 * Update default tool
 */
export function updateClaudeDefaultTool(
  projectDir: string,
  defaultTool: string
): ClaudeCliSettingsConfig {
  const settings = loadClaudeCliSettings(projectDir);
  settings.defaultTool = defaultTool;
  saveClaudeCliSettings(projectDir, settings);
  return settings;
}

/**
 * Get the default tool from config
 * Returns the configured defaultTool or 'gemini' as fallback
 */
export function getDefaultTool(projectDir: string): string {
  try {
    const settings = loadClaudeCliSettings(projectDir);
    return settings.defaultTool || 'gemini';
  } catch {
    return 'gemini';
  }
}

// ========== Settings Persistence Functions ==========

/**
 * Update prompt format setting
 * @param projectDir - Project directory path
 * @param format - Prompt format: 'plain' | 'yaml' | 'json'
 * @returns Updated settings config
 */
export function setPromptFormat(
  projectDir: string,
  format: 'plain' | 'yaml' | 'json'
): ClaudeCliSettingsConfig {
  const settings = loadClaudeCliSettings(projectDir);
  settings.promptFormat = format;
  saveClaudeCliSettings(projectDir, settings);
  return settings;
}

/**
 * Get prompt format setting
 * @param projectDir - Project directory path
 * @returns Current prompt format or 'plain' as fallback
 */
export function getPromptFormat(projectDir: string): 'plain' | 'yaml' | 'json' {
  try {
    const settings = loadClaudeCliSettings(projectDir);
    return settings.promptFormat || 'plain';
  } catch {
    return 'plain';
  }
}

/**
 * Update smart context enabled setting
 * @param projectDir - Project directory path
 * @param enabled - Whether smart context is enabled
 * @returns Updated settings config
 */
export function setSmartContextEnabled(
  projectDir: string,
  enabled: boolean
): ClaudeCliSettingsConfig {
  const settings = loadClaudeCliSettings(projectDir);
  settings.smartContext = {
    ...settings.smartContext,
    enabled
  };
  saveClaudeCliSettings(projectDir, settings);
  return settings;
}

/**
 * Get smart context enabled setting
 * @param projectDir - Project directory path
 * @returns Current smart context status or false as fallback
 */
export function getSmartContextEnabled(projectDir: string): boolean {
  try {
    const settings = loadClaudeCliSettings(projectDir);
    return settings.smartContext?.enabled ?? false;
  } catch {
    return false;
  }
}

/**
 * Update native resume setting
 * @param projectDir - Project directory path
 * @param enabled - Whether native resume is enabled
 * @returns Updated settings config
 */
export function setNativeResume(
  projectDir: string,
  enabled: boolean
): ClaudeCliSettingsConfig {
  const settings = loadClaudeCliSettings(projectDir);
  settings.nativeResume = enabled;
  saveClaudeCliSettings(projectDir, settings);
  return settings;
}

/**
 * Get native resume setting
 * @param projectDir - Project directory path
 * @returns Current native resume status or true as fallback
 */
export function getNativeResume(projectDir: string): boolean {
  try {
    const settings = loadClaudeCliSettings(projectDir);
    return settings.nativeResume ?? true;
  } catch {
    return true;
  }
}

/**
 * Add API endpoint as a tool with type: 'api-endpoint'
 * Usage: --tool <name> or --tool custom --model <id>
 */
export function addClaudeApiEndpoint(
  projectDir: string,
  endpoint: { id: string; name: string; enabled: boolean; model?: string }
): ClaudeCliToolsConfig {
  const config = loadClaudeCliTools(projectDir);

  // Add as a tool with type: 'api-endpoint'
  config.tools[endpoint.name] = {
    enabled: endpoint.enabled,
    primaryModel: endpoint.model,  // Use endpoint.model as primaryModel (can be overridden via --model)
    secondaryModel: endpoint.model,  // Same as primary for fallback
    tags: [],
    type: 'api-endpoint',
    id: endpoint.id  // Store endpoint ID for settings lookup
  };

  saveClaudeCliTools(projectDir, config);
  return config;
}

/**
 * Remove API endpoint tool by id or name
 */
export function removeClaudeApiEndpoint(
  projectDir: string,
  endpointId: string
): ClaudeCliToolsConfig {
  const config = loadClaudeCliTools(projectDir);

  // Find the tool by id or name
  const toolToRemove = Object.entries(config.tools).find(
    ([name, t]) => t.type === 'api-endpoint' && (t.id === endpointId || name === endpointId || name.toLowerCase() === endpointId.toLowerCase())
  );

  if (toolToRemove) {
    delete config.tools[toolToRemove[0]];
  }

  saveClaudeCliTools(projectDir, config);
  return config;
}

/**
 * Add a custom CLI settings endpoint tool to cli-tools.json
 * Adds tool based on tags:
 * - cli-wrapper tag -> type: 'cli-wrapper'
 * - others -> type: 'api-endpoint'
 */
export function addCustomEndpoint(
  projectDir: string,
  endpoint: { id: string; name: string; enabled: boolean; tags?: string[]; availableModels?: string[]; settingsFile?: string }
): ClaudeCliToolsConfig {
  const config = loadClaudeCliTools(projectDir);

  if (endpoint.tags?.includes('cli-wrapper')) {
    // CLI wrapper tool
    config.tools[endpoint.name] = {
      enabled: endpoint.enabled,
      tags: endpoint.tags.filter(t => t !== 'cli-wrapper'),
      type: 'cli-wrapper',
      ...(endpoint.availableModels && { availableModels: endpoint.availableModels }),
      ...(endpoint.settingsFile && { settingsFile: endpoint.settingsFile })
    };
  } else {
    // API endpoint tool
    config.tools[endpoint.name] = {
      enabled: endpoint.enabled,
      tags: [],
      type: 'api-endpoint',
      id: endpoint.id,
      ...(endpoint.availableModels && { availableModels: endpoint.availableModels }),
      ...(endpoint.settingsFile && { settingsFile: endpoint.settingsFile })
    };
  }

  saveClaudeCliTools(projectDir, config);
  return config;
}

/** @deprecated Use addCustomEndpoint instead */
export const addClaudeCustomEndpoint = addCustomEndpoint;

/**
 * Remove endpoint tool (cli-wrapper or api-endpoint)
 */
export function removeCustomEndpoint(
  projectDir: string,
  endpointId: string
): ClaudeCliToolsConfig {
  const config = loadClaudeCliTools(projectDir);

  // Find the tool by id or name (cli-wrapper or api-endpoint type)
  const toolToRemove = Object.entries(config.tools).find(
    ([name, t]) => (t.type === 'cli-wrapper' || t.type === 'api-endpoint') &&
      (name === endpointId || name.toLowerCase() === endpointId.toLowerCase() || t.id === endpointId)
  );

  if (toolToRemove) {
    delete config.tools[toolToRemove[0]];
  }

  saveClaudeCliTools(projectDir, config);
  return config;
}

/** @deprecated Use removeCustomEndpoint instead */
export const removeClaudeCustomEndpoint = removeCustomEndpoint;

/**
 * Get config source info
 */
export function getClaudeCliToolsInfo(projectDir: string): {
  projectPath: string;
  globalPath: string;
  activePath: string;
  source: 'project' | 'global' | 'default';
} {
  const resolved = resolveConfigPath(projectDir);
  return {
    projectPath: getProjectConfigPath(projectDir),
    globalPath: getGlobalConfigPath(),
    activePath: resolved.path,
    source: resolved.source
  };
}

/**
 * Update Code Index MCP provider and switch CLAUDE.md reference
 * Strategy: Only modify global user-level CLAUDE.md (~/.claude/CLAUDE.md)
 * This is consistent with Chinese response and Windows platform settings
 */
export function updateCodeIndexMcp(
  projectDir: string,
  provider: 'codexlens' | 'ace' | 'none'
): { success: boolean; error?: string; settings?: ClaudeCliSettingsConfig } {
  try {
    // Update settings config
    const settings = loadClaudeCliSettings(projectDir);
    settings.codeIndexMcp = provider;
    saveClaudeCliSettings(projectDir, settings);

    // Only update global CLAUDE.md (consistent with Chinese response / Windows platform)
    const globalClaudeMdPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');

    // Define patterns for all formats (match both old .claude and new .ccw paths)
    const codexlensPattern = /@~\/\.(?:claude|ccw)\/workflows\/context-tools\.md/g;
    const acePattern = /@~\/\.(?:claude|ccw)\/workflows\/context-tools-ace\.md/g;
    const nonePattern = /@~\/\.(?:claude|ccw)\/workflows\/context-tools-none\.md/g;

    // Determine target file based on provider
    const targetFile = provider === 'ace'
      ? '@~/.ccw/workflows/context-tools-ace.md'
      : provider === 'none'
        ? '@~/.ccw/workflows/context-tools-none.md'
        : '@~/.ccw/workflows/context-tools.md';

    if (!fs.existsSync(globalClaudeMdPath)) {
      // If global CLAUDE.md doesn't exist, check project-level
      const projectClaudeMdPath = path.join(projectDir, '.claude', 'CLAUDE.md');
      if (fs.existsSync(projectClaudeMdPath)) {
        let content = fs.readFileSync(projectClaudeMdPath, 'utf-8');

        // Replace any existing pattern with the target
        content = content.replace(codexlensPattern, targetFile);
        content = content.replace(acePattern, targetFile);
        content = content.replace(nonePattern, targetFile);

        fs.writeFileSync(projectClaudeMdPath, content, 'utf-8');
        debugLog(`[claude-cli-tools] Updated project CLAUDE.md to use ${provider} (no global CLAUDE.md found)`);
      }
    } else {
      // Update global CLAUDE.md (primary target)
      let content = fs.readFileSync(globalClaudeMdPath, 'utf-8');

      // Replace any existing pattern with the target
      content = content.replace(codexlensPattern, targetFile);
      content = content.replace(acePattern, targetFile);
      content = content.replace(nonePattern, targetFile);

      fs.writeFileSync(globalClaudeMdPath, content, 'utf-8');
      debugLog(`[claude-cli-tools] Updated global CLAUDE.md to use ${provider}`);
    }

    return { success: true, settings };
  } catch (err) {
    console.error('[claude-cli-tools] Error updating Code Index MCP:', err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Get current Code Index MCP provider
 */
export function getCodeIndexMcp(projectDir: string): 'codexlens' | 'ace' | 'none' {
  const settings = loadClaudeCliSettings(projectDir);
  return settings.codeIndexMcp || 'ace';
}

/**
 * Get the context-tools file path based on provider
 */
export function getContextToolsPath(provider: 'codexlens' | 'ace' | 'none'): string {
  switch (provider) {
    case 'ace':
      return 'context-tools-ace.md';
    case 'none':
      return 'context-tools-none.md';
    default:
      return 'context-tools.md';
  }
}

// ========== Model Configuration Functions ==========
// NOTE: Model reference data has been moved to system reference (src/config/provider-models.ts)
// User configuration only manages primaryModel/secondaryModel per tool via tools.{tool}

/**
 * Get tool configuration (compatible with cli-config-manager interface)
 */
export function getToolConfig(projectDir: string, tool: string): {
  enabled: boolean;
  primaryModel: string;
  secondaryModel: string;
  tags?: string[];
  envFile?: string;
  settingsFile?: string;
  effort?: string;
} {
  const config = loadClaudeCliTools(projectDir);
  const toolConfig = config.tools[tool];

  if (!toolConfig) {
    const defaultTool = DEFAULT_TOOLS_CONFIG.tools[tool];
    return {
      enabled: defaultTool?.enabled ?? true,
      primaryModel: defaultTool?.primaryModel ?? '',
      secondaryModel: defaultTool?.secondaryModel ?? '',
      tags: defaultTool?.tags ?? []
    };
  }

  return {
    enabled: toolConfig.enabled,
    primaryModel: toolConfig.primaryModel ?? '',
    secondaryModel: toolConfig.secondaryModel ?? '',
    tags: toolConfig.tags,
    envFile: toolConfig.envFile,
    settingsFile: toolConfig.settingsFile,
    effort: toolConfig.effort
  };
}

/**
 * Update tool configuration
 */
export function updateToolConfig(
  projectDir: string,
  tool: string,
  updates: Partial<{
    enabled: boolean;
    primaryModel: string;
    secondaryModel: string;
    availableModels: string[];
    tags: string[];
    envFile: string | null;
    settingsFile: string | null;
    effort: string | null;
  }>
): ClaudeCliToolsConfig {
  const config = loadClaudeCliTools(projectDir);

  if (config.tools[tool]) {
    if (updates.enabled !== undefined) {
      config.tools[tool].enabled = updates.enabled;
    }
    if (updates.primaryModel !== undefined) {
      config.tools[tool].primaryModel = updates.primaryModel;
    }
    if (updates.secondaryModel !== undefined) {
      config.tools[tool].secondaryModel = updates.secondaryModel;
    }
    if (updates.availableModels !== undefined) {
      config.tools[tool].availableModels = updates.availableModels;
    }
    if (updates.tags !== undefined) {
      config.tools[tool].tags = updates.tags;
    }
    // Handle envFile: set to undefined if null/empty, otherwise set value
    if (updates.envFile !== undefined) {
      if (updates.envFile === null || updates.envFile === '') {
        delete config.tools[tool].envFile;
      } else {
        config.tools[tool].envFile = updates.envFile;
      }
    }
    // Handle settingsFile: set to undefined if null/empty, otherwise set value
    if (updates.settingsFile !== undefined) {
      if (updates.settingsFile === null || updates.settingsFile === '') {
        delete config.tools[tool].settingsFile;
      } else {
        config.tools[tool].settingsFile = updates.settingsFile;
      }
    }
    // Handle effort: set to undefined if null/empty, otherwise set value
    if (updates.effort !== undefined) {
      if (updates.effort === null || updates.effort === '') {
        delete config.tools[tool].effort;
      } else {
        config.tools[tool].effort = updates.effort;
      }
    }
    saveClaudeCliTools(projectDir, config);
  }

  return config;
}

/**
 * Get primary model for a tool
 */
export function getPrimaryModel(projectDir: string, tool: string): string {
  const toolConfig = getToolConfig(projectDir, tool);
  return toolConfig.primaryModel;
}

/**
 * Get secondary model for a tool
 */
export function getSecondaryModel(projectDir: string, tool: string): string {
  const toolConfig = getToolConfig(projectDir, tool);
  return toolConfig.secondaryModel;
}

/**
 * Check if a tool is enabled
 */
export function isToolEnabled(projectDir: string, tool: string): boolean {
  const toolConfig = getToolConfig(projectDir, tool);
  return toolConfig.enabled;
}

/**
 * Get full config response for API
 * Note: Provider model reference has been moved to system reference (see provider-routes.ts)
 */
export function getFullConfigResponse(projectDir: string): {
  config: ClaudeCliToolsConfig;
} {
  const config = loadClaudeCliTools(projectDir);
  return {
    config
  };
}

// ========== Tool Detection & Sync Functions ==========

/**
 * Sync builtin tools availability with cli-tools.json
 *
 * For builtin tools (gemini, qwen, codex, claude, opencode):
 * - Checks actual tool availability using system PATH
 * - Updates enabled status based on actual availability
 *
 * For non-builtin tools (cli-wrapper, api-endpoint):
 * - Leaves them unchanged as they have different availability mechanisms
 *
 * @returns Updated config and sync results
 */
export async function syncBuiltinToolsAvailability(projectDir: string): Promise<{
  config: ClaudeCliToolsConfig;
  changes: {
    enabled: string[];    // Tools that were enabled
    disabled: string[];   // Tools that were disabled
    unchanged: string[];  // Tools that stayed the same
  };
}> {
  // Import getCliToolsStatus dynamically to avoid circular dependency
  const { getCliToolsStatus } = await import('./cli-executor.js');

  // Get actual tool availability
  const actualStatus = await getCliToolsStatus();

  // Load current config
  const config = loadClaudeCliTools(projectDir);
  const changes = {
    enabled: [] as string[],
    disabled: [] as string[],
    unchanged: [] as string[]
  };

  // Builtin tools that need sync
  const builtinTools = ['gemini', 'qwen', 'codex', 'claude', 'opencode'];

  for (const toolName of builtinTools) {
    const isAvailable = actualStatus[toolName]?.available ?? false;
    const currentConfig = config.tools[toolName];
    const wasEnabled = currentConfig?.enabled ?? true;

    // Update based on actual availability
    if (isAvailable && !wasEnabled) {
      // Tool exists but was disabled - enable it
      if (!currentConfig) {
        config.tools[toolName] = {
          enabled: true,
          primaryModel: DEFAULT_TOOLS_CONFIG.tools[toolName]?.primaryModel || '',
          secondaryModel: DEFAULT_TOOLS_CONFIG.tools[toolName]?.secondaryModel || '',
          tags: [],
          type: 'builtin'
        };
      } else {
        currentConfig.enabled = true;
      }
      changes.enabled.push(toolName);
    } else if (!isAvailable && wasEnabled) {
      // Tool doesn't exist but was enabled - disable it
      if (currentConfig) {
        currentConfig.enabled = false;
      }
      changes.disabled.push(toolName);
    } else {
      // No change needed
      changes.unchanged.push(toolName);
    }
  }

  // Save updated config
  saveClaudeCliTools(projectDir, config);

  console.log('[claude-cli-tools] Synced builtin tools availability:', {
    enabled: changes.enabled,
    disabled: changes.disabled,
    unchanged: changes.unchanged
  });

  return { config, changes };
}

/**
 * Get sync status report without actually modifying config
 *
 * @returns Report showing what would change if sync were run
 */
export async function getBuiltinToolsSyncReport(projectDir: string): Promise<{
  current: Record<string, { available: boolean; enabled: boolean }>;
  recommended: Record<string, { shouldEnable: boolean; reason: string }>;
}> {
  // Import getCliToolsStatus dynamically to avoid circular dependency
  const { getCliToolsStatus } = await import('./cli-executor.js');

  // Get actual tool availability
  const actualStatus = await getCliToolsStatus();

  // Load current config
  const config = loadClaudeCliTools(projectDir);
  const builtinTools = ['gemini', 'qwen', 'codex', 'claude', 'opencode'];

  const current: Record<string, { available: boolean; enabled: boolean }> = {};
  const recommended: Record<string, { shouldEnable: boolean; reason: string }> = {};

  for (const toolName of builtinTools) {
    const isAvailable = actualStatus[toolName]?.available ?? false;
    const isEnabled = config.tools[toolName]?.enabled ?? true;

    current[toolName] = {
      available: isAvailable,
      enabled: isEnabled
    };

    if (isAvailable && !isEnabled) {
      recommended[toolName] = {
        shouldEnable: true,
        reason: 'Tool is installed but disabled in config'
      };
    } else if (!isAvailable && isEnabled) {
      recommended[toolName] = {
        shouldEnable: false,
        reason: 'Tool is not installed but enabled in config'
      };
    }
  }

  return { current, recommended };
}
