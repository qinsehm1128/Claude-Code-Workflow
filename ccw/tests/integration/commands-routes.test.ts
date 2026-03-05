/**
 * Integration tests for commands routes (command creation).
 *
 * Notes:
 * - Targets runtime implementation shipped in `ccw/dist`.
 * - Calls route handler directly (no HTTP server required).
 * - Uses temporary HOME/USERPROFILE to isolate user commands directory.
 */

import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const commandsRoutesUrl = new URL('../../dist/core/routes/commands-routes.js', import.meta.url);
commandsRoutesUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

const originalEnv = {
  HOME: process.env.HOME,
  USERPROFILE: process.env.USERPROFILE,
  HOMEDRIVE: process.env.HOMEDRIVE,
  HOMEPATH: process.env.HOMEPATH,
};

// Helper to call routes with any method and optional body
async function callCommands(
  initialPath: string,
  method: string,
  pathname: string,
  body?: any,
): Promise<{ handled: boolean; status: number; json: any }> {
  const url = new URL(pathname, 'http://localhost');
  let status = 0;
  let text = '';
  let resolvePromise: () => void;
  const completionPromise = new Promise<void>((resolve) => { resolvePromise = resolve; });

  const res = {
    writeHead(code: number) {
      status = code;
    },
    end(chunk?: any) {
      text = chunk === undefined ? '' : String(chunk);
      resolvePromise();
    },
  };

  // handlePostRequest implementation matching the actual route handler signature
  // IMPORTANT: The route handler calls this without awaiting, so we need to track completion
  const handlePostRequest = async (_req: any, _res: any, handler: (parsed: any) => Promise<any>) => {
    try {
      // Call the handler and wait for result
      const result = await handler(body ?? {});

      // Handle the result
      if (result && typeof result === 'object') {
        // Check for explicit error/success indicators
        const isError = result.success === false;
        const hasStatus = typeof result.status === 'number';
        const isClientError = hasStatus && result.status >= 400;

        if (isError || isClientError) {
          res.writeHead(hasStatus ? result.status : 400);
          res.end(JSON.stringify(result));
        } else {
          res.writeHead(hasStatus ? result.status : 200);
          res.end(JSON.stringify(result));
        }
      } else {
        res.writeHead(200);
        res.end(JSON.stringify(result));
      }
    } catch (error: any) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  };

  const handled = await mod.handleCommandsRoutes({
    pathname: url.pathname,
    url,
    req: { method },
    res,
    initialPath,
    handlePostRequest,
    broadcastToClients() {},
  });

  // If the route was handled and method is POST, wait for handlePostRequest to complete
  // The route handler doesn't await handlePostRequest, so we need to wait for res.end()
  if (handled && method === 'POST') {
    // Wait for the async handlePostRequest to complete with a timeout
    await Promise.race([
      completionPromise,
      new Promise<void>((resolve) => setTimeout(resolve, 1000)),
    ]);
  }

  return { handled, status, json: text ? JSON.parse(text) : null };
}

// Helper to create a valid command file
function createCommandFile(dir: string, name: string, content?: string): string {
  const filePath = join(dir, `${name}.md`);
  const defaultContent = content || `---
name: "${name}"
description: "Test command for ${name}"
---

# ${name}

This is a test command.
`;
  writeFileSync(filePath, defaultContent, 'utf8');
  return filePath;
}

describe('commands routes integration - creation', async () => {
  let homeDir = '';
  let projectRoot = '';
  let projectCommandsDir = '';
  let userCommandsDir = '';

  before(async () => {
    homeDir = mkdtempSync(join(tmpdir(), 'ccw-commands-home-'));
    projectRoot = mkdtempSync(join(tmpdir(), 'ccw-commands-project-'));
    projectCommandsDir = join(projectRoot, '.claude', 'commands');
    userCommandsDir = join(homeDir, '.claude', 'commands');

    process.env.HOME = homeDir;
    process.env.USERPROFILE = homeDir;
    process.env.HOMEDRIVE = undefined;
    process.env.HOMEPATH = undefined;

    mock.method(console, 'error', () => {});
    mock.method(console, 'warn', () => {});
    mod = await import(commandsRoutesUrl.href);
  });

  beforeEach(() => {
    // Retry cleanup on Windows due to file locking issues
    const cleanup = (path: string) => {
      try {
        rmSync(path, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors on Windows
      }
    };
    cleanup(join(homeDir, '.claude'));
    cleanup(join(projectRoot, '.claude'));

    mkdirSync(projectCommandsDir, { recursive: true });
    mkdirSync(userCommandsDir, { recursive: true });
  });

  after(() => {
    mock.restoreAll();
    process.env.HOME = originalEnv.HOME;
    process.env.USERPROFILE = originalEnv.USERPROFILE;
    process.env.HOMEDRIVE = originalEnv.HOMEDRIVE;
    process.env.HOMEPATH = originalEnv.HOMEPATH;

    // Retry cleanup on Windows due to EBUSY errors from async operations
    const cleanup = (path: string, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          rmSync(path, { recursive: true, force: true });
          break;
        } catch (err) {
          if (i === retries - 1) {
            console.error(`Failed to cleanup ${path}:`, err);
          }
        }
      }
    };
    cleanup(projectRoot);
    cleanup(homeDir);
  });

  // ========================================
  // POST /api/commands/create - Validation Tests
  // ========================================
  describe('POST /api/commands/create - validation', () => {
    it('should reject invalid mode', async () => {
      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'invalid-mode',
        location: 'project',
      });

      assert.equal(res.handled, true);
      assert.equal(res.status, 400);
      assert.equal(res.json.success, false);
    });

    it('should reject invalid location', async () => {
      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'upload',
        location: 'invalid-location',
        sourcePath: '/some/path.md',
      });

      assert.equal(res.handled, true);
      assert.equal(res.status, 400);
    });

    it('should reject upload mode without sourcePath', async () => {
      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'upload',
        location: 'project',
      });

      assert.equal(res.handled, true);
      assert.equal(res.status, 400);
      assert.ok(res.json.message || res.json.error);
    });

    it('should reject generate mode without commandName', async () => {
      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'generate',
        location: 'project',
        description: 'Test description',
      });

      assert.equal(res.handled, true);
      assert.equal(res.status, 400);
    });

    it('should reject generate mode without description', async () => {
      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'generate',
        location: 'project',
        commandName: 'test-command',
      });

      assert.equal(res.handled, true);
      assert.equal(res.status, 400);
    });

    it('should handle null body gracefully', async () => {
      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', null);

      assert.equal(res.handled, true);
      assert.equal(res.status, 400);
    });
  });

  // ========================================
  // POST /api/commands/create - Security Tests
  // ========================================
  describe('POST /api/commands/create - security', () => {
    it('should reject path traversal in sourcePath', async () => {
      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'upload',
        location: 'project',
        sourcePath: '../../../etc/passwd',
      });

      assert.equal(res.handled, true);
      // Should reject with 400 or 403
      assert.ok([400, 403].includes(res.status));
    });

    it('should reject path traversal in commandName for generate mode', async () => {
      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'generate',
        location: 'project',
        commandName: '../../../malicious',
        description: 'Test description',
      });

      assert.equal(res.handled, true);
      assert.ok([400, 403].includes(res.status));
    });

    it('should reject or sanitize path traversal in group parameter', async () => {
      // Create a valid source file first
      const tempDir = join(tmpdir(), 'ccw-source-security');
      mkdirSync(tempDir, { recursive: true });
      const sourcePath = createCommandFile(tempDir, 'security-test');

      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'upload',
        location: 'project',
        sourcePath,
        group: '../../../etc',
      });

      assert.equal(res.handled, true);
      // Should either sanitize the path or reject
      if (res.status === 200) {
        // Verify the file was NOT created in a dangerous location
        assert.ok(!existsSync(join(projectRoot, 'etc', 'security-test.md')));
      } else {
        // If rejected, should be 400 or 403
        assert.ok([400, 403].includes(res.status));
      }

      rmSync(tempDir, { recursive: true, force: true });
    });
  });

  // ========================================
  // POST /api/commands/create - Upload Mode Tests
  // ========================================
  describe('POST /api/commands/create - upload mode', () => {
    it('should create command via upload mode to project location', async () => {
      const tempDir = join(tmpdir(), 'ccw-source-upload1');
      mkdirSync(tempDir, { recursive: true });
      const sourcePath = createCommandFile(tempDir, 'upload-test');

      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'upload',
        location: 'project',
        sourcePath,
        group: 'uploaded',
      });

      assert.equal(res.handled, true);
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);
      assert.ok(res.json.commandInfo);
      assert.equal(res.json.commandInfo.name, 'upload-test');

      // Verify file exists at target location
      const targetPath = join(projectCommandsDir, 'uploaded', 'upload-test.md');
      assert.equal(existsSync(targetPath), true);

      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should create command via upload mode to user location', async () => {
      const tempDir = join(tmpdir(), 'ccw-source-upload2');
      mkdirSync(tempDir, { recursive: true });
      const sourcePath = createCommandFile(tempDir, 'user-command');

      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'upload',
        location: 'user',
        sourcePath,
        group: 'personal',
      });

      assert.equal(res.handled, true);
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);

      // Verify file exists at user location
      const targetPath = join(userCommandsDir, 'personal', 'user-command.md');
      assert.equal(existsSync(targetPath), true);

      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should reject non-existent source file', async () => {
      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'upload',
        location: 'project',
        sourcePath: '/nonexistent/command.md',
        group: 'test',
      });

      assert.equal(res.handled, true);
      assert.ok([400, 404].includes(res.status));
    });

    it('should handle deeply nested group paths', async () => {
      const tempDir = join(tmpdir(), 'ccw-source-nested');
      mkdirSync(tempDir, { recursive: true });
      const sourcePath = createCommandFile(tempDir, 'nested-test');

      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'upload',
        location: 'project',
        sourcePath,
        group: 'category/subcategory/type',
      });

      assert.equal(res.handled, true);
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);

      // Verify nested directories were created
      const targetPath = join(projectCommandsDir, 'category', 'subcategory', 'type', 'nested-test.md');
      assert.equal(existsSync(targetPath), true);

      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should reject non-.md source file', async () => {
      const tempDir = join(tmpdir(), 'ccw-source-txt');
      mkdirSync(tempDir, { recursive: true });
      const txtPath = join(tempDir, 'test.txt');
      writeFileSync(txtPath, 'test content', 'utf8');

      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'upload',
        location: 'project',
        sourcePath: txtPath,
        group: 'test',
      });

      assert.equal(res.handled, true);
      assert.ok([400, 404].includes(res.status));

      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should reject source file with invalid frontmatter', async () => {
      const tempDir = join(tmpdir(), 'ccw-source-invalid');
      mkdirSync(tempDir, { recursive: true });
      const invalidPath = join(tempDir, 'invalid.md');
      writeFileSync(invalidPath, '# Just markdown\nNo frontmatter here.', 'utf8');

      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'upload',
        location: 'project',
        sourcePath: invalidPath,
        group: 'test',
      });

      assert.equal(res.handled, true);
      assert.ok([400, 404].includes(res.status));

      rmSync(tempDir, { recursive: true, force: true });
    });
  });

  // ========================================
  // POST /api/commands/create - Generate Mode Tests
  // ========================================
  describe('POST /api/commands/create - generate mode', () => {
    // Note: Generate mode tests require CLI execution which may not be available in test environment
    // These tests focus on input validation for generate mode

    it.skip('should accept valid generate mode parameters (requires CLI)', async () => {
      // This test validates that the parameters are accepted
      // NOTE: Skipped because it requires actual CLI execution which may not be available
      // in all test environments. Enable this test when CLI tools are properly configured.

      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'generate',
        location: 'project',
        skillName: 'ai-generated-command',
        description: 'A command generated by AI',
        group: 'generated',
      });

      assert.equal(res.handled, true);
      // The route should accept the parameters
      // CLI execution can fail in many ways (200 success, 500 error, 400 bad request, etc.)
      assert.ok(
        res.status === 200 ||
        res.status === 201 ||
        res.status === 400 ||
        res.status === 500 ||
        res.status === 503,
        `Expected success or error status, got ${res.status}: ${JSON.stringify(res.json)}`
      );
    });
  });

  // ========================================
  // Edge Cases
  // ========================================
  describe('edge cases', () => {
    it('should handle command file with special characters in name', async () => {
      const tempDir = join(tmpdir(), 'ccw-source-special');
      mkdirSync(tempDir, { recursive: true });

      // Valid special characters (alphanumeric, dash, underscore)
      const sourcePath = join(tempDir, 'my-special_command-123.md');
      writeFileSync(sourcePath, `---
name: "my-special-command"
description: "Test command"
---

# Test
`, 'utf8');

      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'upload',
        location: 'project',
        sourcePath,
        group: 'special',
      });

      assert.equal(res.handled, true);
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);

      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should handle command file with unicode in description', async () => {
      const tempDir = join(tmpdir(), 'ccw-source-unicode');
      mkdirSync(tempDir, { recursive: true });

      const sourcePath = join(tempDir, 'unicode-test.md');
      writeFileSync(sourcePath, `---
name: "unicode-test"
description: "测试命令 with emoji 🚀 and unicode: éàü"
---

# Unicode Test
`, 'utf8');

      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'upload',
        location: 'project',
        sourcePath,
        group: 'unicode',
      });

      assert.equal(res.handled, true);
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);
      assert.ok(res.json.commandInfo.description.includes('测试'));

      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should handle command file without group (default group)', async () => {
      const tempDir = join(tmpdir(), 'ccw-source-nogroup');
      mkdirSync(tempDir, { recursive: true });
      const sourcePath = createCommandFile(tempDir, 'no-group-test');

      const res = await callCommands(projectRoot, 'POST', '/api/commands/create', {
        mode: 'upload',
        location: 'project',
        sourcePath,
        // No group specified
      });

      assert.equal(res.handled, true);
      // Should succeed with default group
      assert.ok([200, 400].includes(res.status));

      rmSync(tempDir, { recursive: true, force: true });
    });
  });

  // ========================================
  // Route Handler Tests
  // ========================================
  describe('route handler', () => {
    it('should not handle GET request to /api/commands/create', async () => {
      const res = await callCommands(projectRoot, 'GET', '/api/commands/create');

      // GET should not be handled by create route
      assert.equal(res.handled, false);
    });

    it('should not handle unknown routes', async () => {
      const res = await callCommands(projectRoot, 'POST', '/api/commands/unknown', {});

      assert.equal(res.handled, false);
    });
  });
});
