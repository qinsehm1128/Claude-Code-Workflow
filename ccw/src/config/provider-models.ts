/**
 * CLI Tool Model Type Definitions
 *
 * Type definitions for CLI tool models.
 * Model lists are now read from user configuration (cli-tools.json).
 * Each tool can define availableModels in its configuration.
 */

export interface ProviderModelInfo {
  id: string;
  name: string;
  capabilities?: string[];
  contextWindow?: number;
  deprecated?: boolean;
}

export interface ProviderInfo {
  name: string;
  models: ProviderModelInfo[];
}

// Re-export from claude-cli-tools for convenience
export type { ClaudeCliTool, ClaudeCliToolsConfig, CliToolName } from '../tools/claude-cli-tools.js';
