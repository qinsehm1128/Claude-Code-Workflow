// ========================================
// CLI Tool Theme Configuration
// ========================================
// Centralized theme configuration for CLI tools (gemini, codex, qwen, opencode)
// Used for Badge variants, icons, and color theming across components

import type { LucideIcon } from 'lucide-react';
import { Sparkles, Code, Brain, Terminal, Cpu } from 'lucide-react';

// ========== Types ==========

export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'info' | 'destructive';

export interface CliToolTheme {
  /** Badge variant for UI components */
  variant: BadgeVariant;
  /** Lucide icon name */
  icon: LucideIcon;
  /** Color theme (used for CSS classes) */
  color: 'blue' | 'green' | 'amber' | 'gray' | 'purple';
  /** Human-readable display name */
  displayName: string;
  /** Short label for compact display */
  shortLabel: string;
}

// ========== Tool Theme Configuration ==========

/**
 * Theme configuration for each supported CLI tool
 * Maps tool ID to visual theme properties
 */
export const CLI_TOOL_THEMES: Record<string, CliToolTheme> = {
  gemini: {
    variant: 'info',
    icon: Sparkles,
    color: 'blue',
    displayName: 'Gemini',
    shortLabel: 'GEM',
  },
  codex: {
    variant: 'success',
    icon: Code,
    color: 'green',
    displayName: 'Codex',
    shortLabel: 'CDX',
  },
  qwen: {
    variant: 'warning',
    icon: Brain,
    color: 'amber',
    displayName: 'Qwen',
    shortLabel: 'QWN',
  },
  opencode: {
    variant: 'secondary',
    icon: Terminal,
    color: 'gray',
    displayName: 'OpenCode',
    shortLabel: 'OPC',
  },
  claude: {
    variant: 'default',
    icon: Cpu,
    color: 'purple',
    displayName: 'Claude',
    shortLabel: 'CLD',
  },
};

/**
 * Default theme for unknown tools
 */
export const DEFAULT_TOOL_THEME: CliToolTheme = {
  variant: 'secondary',
  icon: Terminal,
  color: 'gray',
  displayName: 'CLI',
  shortLabel: 'CLI',
};

// ========== Helper Functions ==========

/**
 * Get theme configuration for a CLI tool
 * Falls back to default theme for unknown tools
 *
 * @param tool - Tool identifier (e.g., 'gemini', 'codex', 'qwen')
 * @returns Theme configuration for the tool
 */
export function getToolTheme(tool: string): CliToolTheme {
  const normalizedTool = tool.toLowerCase().trim();
  return CLI_TOOL_THEMES[normalizedTool] || DEFAULT_TOOL_THEME;
}

/**
 * Get Badge variant for a CLI tool
 * Used for tool badges in UI components
 *
 * @param tool - Tool identifier
 * @returns Badge variant
 */
export function getToolVariant(tool: string): BadgeVariant {
  return getToolTheme(tool).variant;
}

/**
 * Get icon component for a CLI tool
 *
 * @param tool - Tool identifier
 * @returns Lucide icon component
 */
export function getToolIcon(tool: string): LucideIcon {
  return getToolTheme(tool).icon;
}

/**
 * Get color class for a CLI tool
 * Returns a Tailwind CSS color class prefix
 *
 * @param tool - Tool identifier
 * @returns Color class prefix (e.g., 'text-blue-500')
 */
export function getToolColorClass(tool: string, shade: number = 500): string {
  const color = getToolTheme(tool).color;
  const colorMap: Record<string, string> = {
    blue: 'blue',
    green: 'green',
    amber: 'amber',
    gray: 'gray',
    purple: 'purple',
  };
  return `text-${colorMap[color] || 'gray'}-${shade}`;
}

/**
 * Get background color class for a CLI tool
 *
 * @param tool - Tool identifier
 * @returns Background color class (e.g., 'bg-blue-100')
 */
export function getToolBgClass(tool: string, shade: number = 100): string {
  const color = getToolTheme(tool).color;
  const colorMap: Record<string, string> = {
    blue: 'blue',
    green: 'green',
    amber: 'amber',
    gray: 'gray',
    purple: 'purple',
  };
  return `bg-${colorMap[color] || 'gray'}-${shade}`;
}

/**
 * Check if a tool is a known CLI tool
 *
 * @param tool - Tool identifier
 * @returns Whether the tool is known
 */
export function isKnownTool(tool: string): boolean {
  return tool.toLowerCase().trim() in CLI_TOOL_THEMES;
}

/**
 * Get all known tool identifiers
 *
 * @returns Array of known tool IDs
 */
export function getKnownTools(): string[] {
  return Object.keys(CLI_TOOL_THEMES);
}
