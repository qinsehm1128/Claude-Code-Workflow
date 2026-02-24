// ========================================
// CLI Launch Registry
// ========================================
// Defines interactive-mode launch parameters for each CLI tool.
// Supports 'default' and 'yolo' launch modes.

export type CliTool = 'claude' | 'gemini' | 'qwen' | 'codex' | 'opencode';

export type LaunchMode = 'default' | 'yolo';

export interface CliLaunchConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

function parseCommand(raw: string): CliLaunchConfig {
  const parts = raw.split(/\s+/);
  return { command: parts[0], args: parts.slice(1) };
}

const LAUNCH_CONFIGS: Record<CliTool, Record<LaunchMode, CliLaunchConfig>> = {
  claude: {
    default: parseCommand('claude'),
    yolo:    parseCommand('claude --permission-mode bypassPermissions'),
  },
  gemini: {
    default: parseCommand('gemini'),
    yolo:    parseCommand('gemini --approval-mode yolo'),
  },
  qwen: {
    default: parseCommand('qwen'),
    yolo:    parseCommand('qwen --approval-mode yolo'),
  },
  codex: {
    default: parseCommand('codex'),
    yolo:    parseCommand('codex --full-auto'),
  },
  opencode: {
    default: parseCommand('opencode'),
    yolo:    parseCommand('opencode'),
  },
};

const KNOWN_TOOLS = new Set<string>(Object.keys(LAUNCH_CONFIGS));

export function getLaunchConfig(tool: string, launchMode: LaunchMode): CliLaunchConfig {
  if (KNOWN_TOOLS.has(tool)) {
    return LAUNCH_CONFIGS[tool as CliTool][launchMode];
  }
  // Unknown tool: treat the tool name itself as the command
  return { command: tool, args: [] };
}
