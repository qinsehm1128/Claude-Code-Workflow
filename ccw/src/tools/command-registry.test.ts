/**
 * CommandRegistry Tests
 * 
 * Test coverage:
 * - YAML header parsing
 * - Command metadata extraction
 * - Directory detection (relative and home)
 * - Caching mechanism
 * - Batch operations
 * - Categorization
 * - Error handling
 */

import { CommandRegistry, createCommandRegistry, getAllCommandsSync, getCommandSync } from './command-registry';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock fs module
jest.mock('fs');
jest.mock('os');

describe('CommandRegistry', () => {
  const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
  const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
  const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;
  const mockStatSync = fs.statSync as jest.MockedFunction<typeof fs.statSync>;
  const mockHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>;

  // Sample YAML headers
  const sampleLitePlanYaml = `---
name: lite-plan
description: Quick planning for simple features
argument-hint: "\"feature description\""
allowed-tools: Task(*), Read(*), Write(*), Bash(*)
---

# Content here`;

  const sampleExecuteYaml = `---
name: execute
description: Execute implementation from plan
argument-hint: "--resume-session=\"WFS-xxx\""
allowed-tools: Task(*), Bash(*)
---

# Content here`;

  const sampleTestYaml = `---
name: test-cycle-execute
description: Run tests and fix failures
argument-hint: "--session=\"WFS-xxx\""
allowed-tools: Task(*), Bash(*)
---

# Content here`;

  const sampleReviewYaml = `---
name: review
description: Code review workflow
argument-hint: "--session=\"WFS-xxx\""
allowed-tools: Task(*), Read(*)
---

# Content here`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor & directory detection', () => {
    it('should use provided command directory', () => {
      const customDir = '/custom/path';
      const registry = new CommandRegistry(customDir);
      
      expect((registry as any).commandDir).toBe(customDir);
    });

    it('should auto-detect relative .claude/commands/workflow directory', () => {
      mockExistsSync.mockImplementation((path: string) => {
        return path === '.claude/commands/workflow';
      });

      const registry = new CommandRegistry();
      
      expect((registry as any).commandDir).toBe('.claude/commands/workflow');
      expect(mockExistsSync).toHaveBeenCalledWith('.claude/commands/workflow');
    });

    it('should auto-detect home directory ~/.claude/commands/workflow', () => {
      mockExistsSync.mockImplementation((checkPath: string) => {
        return checkPath === path.join('/home/user', '.claude', 'commands', 'workflow');
      });
      mockHomedir.mockReturnValue('/home/user');

      const registry = new CommandRegistry();
      
      expect((registry as any).commandDir).toBe(
        path.join('/home/user', '.claude', 'commands', 'workflow')
      );
    });

    it('should return null if no command directory found', () => {
      mockExistsSync.mockReturnValue(false);
      mockHomedir.mockReturnValue('/home/user');

      const registry = new CommandRegistry();
      
      expect((registry as any).commandDir).toBeNull();
    });
  });

  describe('parseYamlHeader', () => {
    it('should parse simple YAML header with Unix line endings', () => {
      const yaml = `---
name: test-command
description: Test description
argument-hint: "\"test\""
allowed-tools: Task(*), Read(*)
---

Content here`;

      const registry = new CommandRegistry('/fake/path');
      const result = (registry as any).parseYamlHeader(yaml);

      expect(result).toEqual({
        name: 'test-command',
        description: 'Test description',
        'argument-hint': '"test"',
        'allowed-tools': 'Task(*), Read(*)'
      });
    });

    it('should parse YAML header with Windows line endings (\\r\\n)', () => {
      const yaml = `---\r\nname: test-command\r\ndescription: Test\r\n---`;

      const registry = new CommandRegistry('/fake/path');
      const result = (registry as any).parseYamlHeader(yaml);

      expect(result).toEqual({
        name: 'test-command',
        description: 'Test'
      });
    });

    it('should handle quoted values', () => {
      const yaml = `---
name: "cmd"
description: 'double quoted'
---`;

      const registry = new CommandRegistry('/fake/path');
      const result = (registry as any).parseYamlHeader(yaml);

      expect(result).toEqual({
        name: 'cmd',
        description: 'double quoted'
      });
    });

    it('should parse allowed-tools and trim spaces', () => {
      const yaml = `---
name: test
allowed-tools: Task(*), Read(*) , Write(*), Bash(*)
---`;

      const registry = new CommandRegistry('/fake/path');
      const result = (registry as any).parseYamlHeader(yaml);

      expect(result['allowed-tools']).toBe('Task(*), Read(*), Write(*), Bash(*)');
    });

    it('should skip comments and empty lines', () => {
      const yaml = `---
# This is a comment
name: test-command

# Another comment
description: Test

---`;

      const registry = new CommandRegistry('/fake/path');
      const result = (registry as any).parseYamlHeader(yaml);

      expect(result).toEqual({
        name: 'test-command',
        description: 'Test'
      });
    });

    it('should return null for missing YAML markers', () => {
      const yaml = `name: test-command
description: Test`;

      const registry = new CommandRegistry('/fake/path');
      const result = (registry as any).parseYamlHeader(yaml);

      expect(result).toBeNull();
    });

    it('should return null for malformed YAML', () => {
      const yaml = `---
invalid yaml content without colons
---`;

      const registry = new CommandRegistry('/fake/path');
      const result = (registry as any).parseYamlHeader(yaml);

      expect(result).toEqual({});
    });
  });

  describe('getCommand', () => {
    it('should get command metadata by name', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockImplementation((checkPath: string) => {
        return checkPath === path.join(cmdDir, 'lite-plan.md');
      });
      mockReadFileSync.mockReturnValue(sampleLitePlanYaml);

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getCommand('lite-plan');

      expect(result).toEqual({
        name: 'lite-plan',
        command: '/workflow-lite-plan',
        description: 'Quick planning for simple features',
        argumentHint: '"feature description"',
        allowedTools: ['Task(*)', 'Read(*)', 'Write(*)', 'Bash(*)'],
        filePath: path.join(cmdDir, 'lite-plan.md')
      });
    });

    it('should normalize /workflow: prefix', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleLitePlanYaml);

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getCommand('/workflow-lite-plan');

      expect(result?.name).toBe('lite-plan');
    });

    it('should use cache for repeated requests', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleLitePlanYaml);

      const registry = new CommandRegistry(cmdDir);
      
      registry.getCommand('lite-plan');
      registry.getCommand('lite-plan');

      // readFileSync should only be called once due to cache
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('should return null if command file not found', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(false);

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getCommand('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null if no command directory', () => {
      mockExistsSync.mockReturnValue(false);
      mockHomedir.mockReturnValue('/home/user');

      const registry = new CommandRegistry();
      const result = registry.getCommand('lite-plan');

      expect(result).toBeNull();
    });

    it('should return null if YAML header is invalid', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('No YAML header here');

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getCommand('lite-plan');

      expect(result).toBeNull();
    });

    it('should parse allowedTools correctly', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleExecuteYaml);

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getCommand('execute');

      expect(result?.allowedTools).toEqual(['Task(*)', 'Bash(*)']);
    });

    it('should handle empty allowedTools', () => {
      const yaml = `---
name: minimal-cmd
description: Minimal command
---`;
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(yaml);

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getCommand('minimal-cmd');

      expect(result?.allowedTools).toEqual([]);
    });
  });

  describe('getCommands', () => {
    it('should get multiple commands', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('lite-plan')) return sampleLitePlanYaml;
        if (filePath.includes('execute')) return sampleExecuteYaml;
        return '';
      });

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getCommands(['lite-plan', 'execute', 'nonexistent']);

      expect(result.size).toBe(2);
      expect(result.has('/workflow-lite-plan')).toBe(true);
      expect(result.has('/workflow-execute')).toBe(true);
    });

    it('should skip nonexistent commands', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(false);

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getCommands(['nonexistent1', 'nonexistent2']);

      expect(result.size).toBe(0);
    });
  });

  describe('getAllCommandsSummary', () => {
    it('should get all commands summary', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['lite-plan.md', 'execute.md', 'test.md'] as any);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
      mockReadFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('lite-plan')) return sampleLitePlanYaml;
        if (filePath.includes('execute')) return sampleExecuteYaml;
        if (filePath.includes('test')) return sampleTestYaml;
        return '';
      });

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getAllCommandsSummary();

      expect(result.size).toBe(3);
      expect(result.get('/workflow-lite-plan')).toEqual({
        name: 'lite-plan',
        description: 'Quick planning for simple features'
      });
    });

    it('should skip directories', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['file.md', 'directory'] as any);
      mockStatSync.mockImplementation((filePath: string) => ({
        isDirectory: () => filePath.includes('directory')
      } as any));
      mockReadFileSync.mockReturnValue(sampleLitePlanYaml);

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getAllCommandsSummary();

      // Only file.md should be processed
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('should skip files with invalid YAML headers', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['valid.md', 'invalid.md'] as any);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
      mockReadFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('valid')) return sampleLitePlanYaml;
        return 'No YAML header';
      });

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getAllCommandsSummary();

      expect(result.size).toBe(1);
    });

    it('should return empty map if no command directory', () => {
      mockExistsSync.mockReturnValue(false);
      mockHomedir.mockReturnValue('/home/user');

      const registry = new CommandRegistry();
      const result = registry.getAllCommandsSummary();

      expect(result.size).toBe(0);
    });

    it('should handle directory read errors gracefully', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getAllCommandsSummary();

      expect(result.size).toBe(0);
    });
  });

  describe('getAllCommandsByCategory', () => {
    it('should categorize commands by name patterns', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['lite-plan.md', 'execute.md', 'test-cycle-execute.md', 'review.md'] as any);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
      mockReadFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('lite-plan')) return sampleLitePlanYaml;
        if (filePath.includes('execute')) return sampleExecuteYaml;
        if (filePath.includes('test')) return sampleTestYaml;
        if (filePath.includes('review')) return sampleReviewYaml;
        return '';
      });

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getAllCommandsByCategory();

      expect(result.planning.length).toBe(1);
      expect(result.execution.length).toBe(1);
      expect(result.testing.length).toBe(1);
      expect(result.review.length).toBe(1);
      expect(result.other.length).toBe(0);

      expect(result.planning[0].name).toBe('lite-plan');
      expect(result.execution[0].name).toBe('execute');
    });

    it('should handle commands matching multiple patterns', () => {
      const yamlMultiMatch = `---
name: test-plan
description: TDD planning
allowed-tools: Task(*)
---`;

      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['test-plan.md'] as any);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
      mockReadFileSync.mockReturnValue(yamlMultiMatch);

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getAllCommandsByCategory();

      // Should match 'plan' pattern (planning)
      expect(result.planning.length).toBe(1);
    });
  });

  describe('toJSON', () => {
    it('should serialize cached commands to JSON', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleLitePlanYaml);

      const registry = new CommandRegistry(cmdDir);
      registry.getCommand('lite-plan');
      
      const json = registry.toJSON();

      expect(json['/workflow-lite-plan']).toEqual({
        name: 'lite-plan',
        command: '/workflow-lite-plan',
        description: 'Quick planning for simple features',
        argumentHint: '"feature description"',
        allowedTools: ['Task(*)', 'Read(*)', 'Write(*)', 'Bash(*)'],
        filePath: path.join(cmdDir, 'lite-plan.md')
      });
    });

    it('should only include cached commands', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('lite-plan')) return sampleLitePlanYaml;
        return sampleExecuteYaml;
      });

      const registry = new CommandRegistry(cmdDir);
      registry.getCommand('lite-plan');
      // Don't call getCommand for 'execute'
      
      const json = registry.toJSON();

      expect(Object.keys(json).length).toBe(1);
      expect(json['/workflow-lite-plan']).toBeDefined();
      expect(json['/workflow-execute']).toBeUndefined();
    });
  });

  describe('exported functions', () => {
    it('createCommandRegistry should create new instance', () => {
      mockExistsSync.mockReturnValue(true);

      const registry = createCommandRegistry('/custom/path');
      
      expect((registry as any).commandDir).toBe('/custom/path');
    });

    it('getAllCommandsSync should return all commands', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['lite-plan.md'] as any);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
      mockReadFileSync.mockReturnValue(sampleLitePlanYaml);
      mockHomedir.mockReturnValue('/home/user');

      const result = getAllCommandsSync();

      expect(result.size).toBeGreaterThanOrEqual(1);
    });

    it('getCommandSync should return specific command', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleLitePlanYaml);
      mockHomedir.mockReturnValue('/home/user');

      const result = getCommandSync('lite-plan');

      expect(result?.name).toBe('lite-plan');
    });
  });

  describe('edge cases', () => {
    it('should handle file read errors', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getCommand('lite-plan');

      expect(result).toBeNull();
    });

    it('should handle YAML parsing errors', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      // Return something that will cause parsing to fail
      mockReadFileSync.mockReturnValue('---\ninvalid: : : yaml\n---');

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getCommand('lite-plan');

      // Should return null since name is not in result
      expect(result).toBeNull();
    });

    it('should handle empty command directory', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([] as any);

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getAllCommandsSummary();

      expect(result.size).toBe(0);
    });

    it('should handle non-md files in command directory', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['lite-plan.md', 'readme.txt', '.gitignore'] as any);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
      mockReadFileSync.mockReturnValue(sampleLitePlanYaml);

      const registry = new CommandRegistry(cmdDir);
      const result = registry.getAllCommandsSummary();

      expect(result.size).toBe(1);
    });
  });

  describe('integration tests', () => {
    it('should work with full workflow', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['lite-plan.md', 'execute.md', 'test-cycle-execute.md'] as any);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
      mockReadFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('lite-plan')) return sampleLitePlanYaml;
        if (filePath.includes('execute')) return sampleExecuteYaml;
        if (filePath.includes('test')) return sampleTestYaml;
        return '';
      });

      const registry = new CommandRegistry(cmdDir);

      // Get all summary
      const summary = registry.getAllCommandsSummary();
      expect(summary.size).toBe(3);

      // Get by category
      const byCategory = registry.getAllCommandsByCategory();
      expect(byCategory.planning.length).toBe(1);
      expect(byCategory.execution.length).toBe(1);
      expect(byCategory.testing.length).toBe(1);

      // Get specific command
      const cmd = registry.getCommand('lite-plan');
      expect(cmd?.name).toBe('lite-plan');

      // Get multiple commands
      const multiple = registry.getCommands(['lite-plan', 'execute']);
      expect(multiple.size).toBe(2);

      // Convert to JSON
      const json = registry.toJSON();
      expect(Object.keys(json).length).toBeGreaterThan(0);
    });

    it('should maintain cache across operations', () => {
      const cmdDir = '/workflows';
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['lite-plan.md', 'execute.md'] as any);
      mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
      mockReadFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('lite-plan')) return sampleLitePlanYaml;
        return sampleExecuteYaml;
      });

      const registry = new CommandRegistry(cmdDir);

      // First call
      registry.getCommand('lite-plan');
      const initialCallCount = mockReadFileSync.mock.calls.length;

      // getAllCommandsSummary will read all files
      registry.getAllCommandsSummary();
      const afterSummaryCallCount = mockReadFileSync.mock.calls.length;

      // Second getCommand should use cache
      registry.getCommand('lite-plan');
      const finalCallCount = mockReadFileSync.mock.calls.length;

      // lite-plan.md should only be read twice:
      // 1. Initial getCommand
      // 2. getAllCommandsSummary (must read all files)
      // Not again in second getCommand due to cache
      expect(finalCallCount).toBe(afterSummaryCallCount);
    });
  });
});
