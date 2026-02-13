/**
 * Unit tests for View command module (ccw view)
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses Node's built-in test runner (node:test).
 * - Mocks fetch + SIGINT handling to avoid opening browsers and leaving servers running.
 */

import { afterEach, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

class ExitError extends Error {
  code?: number;

  constructor(code?: number) {
    super(`process.exit(${code ?? 'undefined'})`);
    this.code = code;
  }
}

const viewCommandPath = new URL('../dist/commands/view.js', import.meta.url).href;

describe('view command module', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let viewModule: any;

  before(async () => {
    viewModule = await import(viewCommandPath);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('opens URL without launching browser when server is running', async () => {
    const logs: string[] = [];
    mock.method(console, 'log', (...args: any[]) => logs.push(args.map(String).join(' ')));
    mock.method(console, 'error', (...args: any[]) => logs.push(args.map(String).join(' ')));
    mock.method(process as any, 'exit', (code?: number) => {
      throw new ExitError(code);
    });

    mock.method(globalThis as any, 'fetch', async (url: string) => {
      if (url.includes('/api/health')) {
        return { ok: true, status: 200 };
      }
      if (url.includes('/api/auth/token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ token: 'test-token' }),
        };
      }
      if (url.includes('/api/switch-path')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, path: 'C:\\test-workspace' }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await viewModule.viewCommand({ port: 3456, browser: false });
    assert.ok(logs.some((l) => l.includes('Server already running')));
    assert.ok(logs.some((l) => l.includes('http://') && l.includes(':3456/')));
  });

  it('starts server when not running (browser disabled) and can be shut down via captured SIGINT handler', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'ccw-view-workspace-'));

    try {
      let sigintHandler: (() => void) | null = null;

      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});
      mock.method(process as any, 'exit', (_code?: number) => {});

      const originalOn = process.on.bind(process);
      mock.method(process as any, 'on', (event: string, handler: any) => {
        if (event === 'SIGINT') {
          sigintHandler = handler;
          return process;
        }
        return originalOn(event, handler);
      });

      mock.method(globalThis as any, 'fetch', async (_url: string) => {
        // Make health check fail so viewCommand triggers serveCommand
        throw new Error('Server not running');
      });

      await viewModule.viewCommand({ port: 56789, browser: false, path: workspace });
      assert.ok(sigintHandler, 'Expected serveCommand to register SIGINT handler');

      sigintHandler?.();
      await new Promise((resolve) => setTimeout(resolve, 200));
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

