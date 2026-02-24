/**
 * CLI Configuration Manager (Deprecated - Redirects to claude-cli-tools.ts)
 *
 * This module is maintained for backward compatibility.
 * All configuration is now managed by claude-cli-tools.ts using cli-tools.json
 *
 * @deprecated Use claude-cli-tools.ts directly
 */
import {
  loadClaudeCliTools,
  saveClaudeCliTools,
  getToolConfig as getToolConfigFromClaude,
  updateToolConfig as updateToolConfigFromClaude,
  getPrimaryModel as getPrimaryModelFromClaude,
  getSecondaryModel as getSecondaryModelFromClaude,
  isToolEnabled as isToolEnabledFromClaude,
  getFullConfigResponse as getFullConfigResponseFromClaude,
  type ClaudeCliTool,
  type ClaudeCliToolsConfig,
  type CliToolName
} from './claude-cli-tools.js';

// ========== Re-exported Types ==========

export interface CliToolConfig {
  enabled: boolean;
  primaryModel: string;
  secondaryModel: string;
  tags?: string[];
  envFile?: string | null;
  type?: 'builtin' | 'cli-wrapper' | 'api-endpoint';  // Tool type for frontend routing
  settingsFile?: string | null;  // Claude CLI settings file path
  effort?: string | null;  // Effort level for Claude CLI (low, medium, high)
}

export interface CliConfig {
  version: number;
  tools: Record<string, CliToolConfig>;
}

export type { CliToolName };

// ========== Re-exported Functions ==========

/**
 * Load CLI configuration
 * @deprecated Use loadClaudeCliTools() instead
 */
export function loadCliConfig(baseDir: string): CliConfig {
  const config = loadClaudeCliTools(baseDir);

  // Convert to legacy format
  const tools: Record<string, CliToolConfig> = {};
  for (const [key, tool] of Object.entries(config.tools)) {
    tools[key] = {
      enabled: tool.enabled,
      primaryModel: tool.primaryModel ?? '',
      secondaryModel: tool.secondaryModel ?? '',
      tags: tool.tags
    };
  }

  return {
    version: parseFloat(config.version) || 1,
    tools
  };
}

/**
 * Save CLI configuration
 * @deprecated Use saveClaudeCliTools() instead
 */
export function saveCliConfig(baseDir: string, config: CliConfig): void {
  const currentConfig = loadClaudeCliTools(baseDir);

  // Update tools from legacy format
  for (const [key, tool] of Object.entries(config.tools)) {
    if (currentConfig.tools[key]) {
      currentConfig.tools[key].enabled = tool.enabled;
      currentConfig.tools[key].primaryModel = tool.primaryModel;
      currentConfig.tools[key].secondaryModel = tool.secondaryModel;
      if (tool.tags) {
        currentConfig.tools[key].tags = tool.tags;
      }
    }
  }

  saveClaudeCliTools(baseDir, currentConfig);
}

/**
 * Get configuration for a specific tool
 */
export function getToolConfig(baseDir: string, tool: string): CliToolConfig {
  return getToolConfigFromClaude(baseDir, tool);
}

/**
 * Update configuration for a specific tool
 */
export function updateToolConfig(
  baseDir: string,
  tool: string,
  updates: Partial<CliToolConfig>
): CliToolConfig {
  updateToolConfigFromClaude(baseDir, tool, updates);
  return getToolConfig(baseDir, tool);
}

/**
 * Enable a CLI tool
 */
export function enableTool(baseDir: string, tool: string): CliToolConfig {
  return updateToolConfig(baseDir, tool, { enabled: true });
}

/**
 * Disable a CLI tool
 */
export function disableTool(baseDir: string, tool: string): CliToolConfig {
  return updateToolConfig(baseDir, tool, { enabled: false });
}

/**
 * Check if a tool is enabled
 */
export function isToolEnabled(baseDir: string, tool: string): boolean {
  return isToolEnabledFromClaude(baseDir, tool);
}

/**
 * Get primary model for a tool
 */
export function getPrimaryModel(baseDir: string, tool: string): string {
  return getPrimaryModelFromClaude(baseDir, tool);
}

/**
 * Get secondary model for a tool
 */
export function getSecondaryModel(baseDir: string, tool: string): string {
  return getSecondaryModelFromClaude(baseDir, tool);
}

/**
 * Get full config response for API
 * Note: Provider model reference has been moved to system reference (see provider-routes.ts)
 */
export function getFullConfigResponse(baseDir: string): {
  config: CliConfig;
} {
  const response = getFullConfigResponseFromClaude(baseDir);

  // Convert to legacy format
  const tools: Record<string, CliToolConfig> = {};
  for (const [key, tool] of Object.entries(response.config.tools)) {
    tools[key] = {
      enabled: tool.enabled,
      primaryModel: tool.primaryModel ?? '',
      secondaryModel: tool.secondaryModel ?? '',
      tags: tool.tags,
      envFile: tool.envFile,
      type: tool.type,  // Preserve type field for frontend routing
      settingsFile: tool.settingsFile,  // Preserve settingsFile for Claude CLI
      effort: tool.effort  // Preserve effort level for Claude CLI
    };
  }

  return {
    config: {
      version: parseFloat(response.config.version) || 1,
      tools
    }
  };
}
