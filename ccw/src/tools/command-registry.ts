/**
 * Command Registry Tool
 *
 * Features:
 * 1. Scan and parse YAML headers from command files
 * 2. Read from global ~/.claude/commands/workflow directory
 * 3. Support on-demand extraction (not full scan)
 * 4. Cache parsed metadata for performance
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface CommandMetadata {
  name: string;
  command: string;
  description: string;
  argumentHint: string;
  allowedTools: string[];
  filePath: string;
  group?: string;
}

export interface CommandSummary {
  name: string;
  description: string;
}

export class CommandRegistry {
  private commandDir: string | null;
  private cache: Map<string, CommandMetadata>;

  constructor(commandDir?: string) {
    this.cache = new Map();

    if (commandDir) {
      this.commandDir = commandDir;
    } else {
      this.commandDir = this.findCommandDir();
    }
  }

  /**
   * Auto-detect ~/.claude/commands/workflow directory
   */
  private findCommandDir(): string | null {
    // Try relative to current working directory
    const relativePath = join('.claude', 'commands', 'workflow');
    if (existsSync(relativePath)) {
      return relativePath;
    }

    // Try user home directory
    const homeDir = homedir();
    const homeCommandDir = join(homeDir, '.claude', 'commands', 'workflow');
    if (existsSync(homeCommandDir)) {
      return homeCommandDir;
    }

    return null;
  }

  /**
   * Parse YAML header (simplified version)
   *
   * Limitations:
   * - Only supports simple key: value pairs (single-line values)
   * - No support for multi-line values, nested objects, complex lists
   * - allowed-tools field converts comma-separated strings to arrays
   */
  private parseYamlHeader(content: string): Record<string, any> | null {
    // Handle Windows line endings (\r\n)
    const match = content.match(/^---[\r\n]+([\s\S]*?)[\r\n]+---/);
    if (!match) return null;

    const yamlContent = match[1];
    const result: Record<string, any> = {};

    try {
      const lines = yamlContent.split(/[\r\n]+/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue; // Skip empty lines and comments

        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) continue;

        const key = trimmed.substring(0, colonIndex).trim();
        let value = trimmed.substring(colonIndex + 1).trim();

        if (!key) continue; // Skip invalid lines

        // Remove quotes (single or double)
        let cleanValue = value.replace(/^["']|["']$/g, '');

        // Special handling for allowed-tools field: convert to array
        // Supports format: "Read, Write, Bash" or "Read,Write,Bash"
        if (key === 'allowed-tools') {
          cleanValue = cleanValue
            .split(',')
            .map(t => t.trim())
            .filter(t => t)
            .join(','); // Keep as comma-separated for now, will convert in getCommand
        }

        // Note: 'group' field is automatically extracted like other fields
        result[key] = cleanValue;
      }
    } catch (error) {
      const err = error as Error;
      console.error('YAML parsing error:', err.message);
      return null;
    }

    return result;
  }

  /**
   * Get single command metadata
   * @param commandName Command name (e.g., "lite-plan" or "/workflow-lite-plan")
   * @returns Command metadata or null
   */
  public getCommand(commandName: string): CommandMetadata | null {
    if (!this.commandDir) {
      console.error('ERROR: ~/.claude/commands/workflow directory not found');
      return null;
    }

    // Normalize command name
    const normalized = commandName.startsWith('/workflow:')
      ? commandName.substring('/workflow:'.length)
      : commandName;

    // Check cache
    const cached = this.cache.get(normalized);
    if (cached) {
      return cached;
    }

    // Read command file
    const filePath = join(this.commandDir, `${normalized}.md`);
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const header = this.parseYamlHeader(content);

      if (header && header.name) {
        const toolsStr = header['allowed-tools'] || '';
        const allowedTools = toolsStr
          .split(',')
          .map((t: string) => t.trim())
          .filter((t: string) => t);

        const result: CommandMetadata = {
          name: header.name,
          command: `/workflow:${header.name}`,
          description: header.description || '',
          argumentHint: header['argument-hint'] || '',
          allowedTools: allowedTools,
          filePath: filePath,
          group: header.group || undefined
        };

        // Cache result
        this.cache.set(normalized, result);
        return result;
      }
    } catch (error) {
      const err = error as Error;
      console.error(`Failed to read command ${filePath}:`, err.message);
    }

    return null;
  }

  /**
   * Get multiple commands metadata
   * @param commandNames Array of command names
   * @returns Map of command metadata
   */
  public getCommands(commandNames: string[]): Map<string, CommandMetadata> {
    const result = new Map<string, CommandMetadata>();

    for (const name of commandNames) {
      const cmd = this.getCommand(name);
      if (cmd) {
        result.set(cmd.command, cmd);
      }
    }

    return result;
  }

  /**
   * Get all commands' names and descriptions
   * @returns Map of command names to summaries
   */
  public getAllCommandsSummary(): Map<string, CommandSummary> {
    const result = new Map<string, CommandSummary>();

    if (!this.commandDir) {
      return result;
    }

    try {
      const files = readdirSync(this.commandDir);

      for (const file of files) {
        // Skip _disabled directory
        if (file === '_disabled') continue;

        if (!file.endsWith('.md')) continue;

        const filePath = join(this.commandDir, file);
        const stat = statSync(filePath);

        if (stat.isDirectory()) continue;

        try {
          const content = readFileSync(filePath, 'utf-8');
          const header = this.parseYamlHeader(content);

          if (header && header.name) {
            const commandName = `/workflow:${header.name}`;
            result.set(commandName, {
              name: header.name,
              description: header.description || ''
            });
          }
        } catch (error) {
          // Skip files that fail to read
          continue;
        }
      }
    } catch (error) {
      // Return empty map if directory read fails
      return result;
    }

    return result;
  }

  /**
   * Get all commands organized by category/tags
   */
  public getAllCommandsByCategory(): Record<string, CommandMetadata[]> {
    const summary = this.getAllCommandsSummary();
    const result: Record<string, CommandMetadata[]> = {
      planning: [],
      execution: [],
      testing: [],
      review: [],
      other: []
    };

    for (const [cmdName] of summary) {
      const cmd = this.getCommand(cmdName);
      if (cmd) {
        // Categorize based on command name patterns
        if (cmd.name.includes('plan')) {
          result.planning.push(cmd);
        } else if (cmd.name.includes('execute')) {
          result.execution.push(cmd);
        } else if (cmd.name.includes('test')) {
          result.testing.push(cmd);
        } else if (cmd.name.includes('review')) {
          result.review.push(cmd);
        } else {
          result.other.push(cmd);
        }
      }
    }

    return result;
  }

  /**
   * Convert to JSON for serialization
   */
  public toJSON(): Record<string, any> {
    const result: Record<string, CommandMetadata> = {};
    for (const [key, value] of this.cache) {
      result[`/workflow:${key}`] = value;
    }
    return result;
  }

  /**
   * Clear the command cache
   * Use this to invalidate cached commands after enable/disable operations
   * @returns void
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Export function for direct usage
 */
export function createCommandRegistry(commandDir?: string): CommandRegistry {
  return new CommandRegistry(commandDir);
}

/**
 * Export function to get all commands
 */
export function getAllCommandsSync(): Map<string, CommandSummary> {
  const registry = new CommandRegistry();
  return registry.getAllCommandsSummary();
}

/**
 * Export function to get specific command
 */
export function getCommandSync(name: string): CommandMetadata | null {
  const registry = new CommandRegistry();
  return registry.getCommand(name);
}
