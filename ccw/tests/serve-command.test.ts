/**
 * Unit tests for Serve command module (ccw serve)
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses Node's built-in test runner (node:test).
 * - Disables browser launch and captures SIGINT handler to shut down server cleanly.
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

const serveCommandPath = new URL('../dist/commands/serve.js', import.meta.url).href;

describe('serve command module', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let serveModule: any;

  before(async () => {
    serveModule = await import(serveCommandPath);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('starts server with browser disabled and shuts down via captured SIGINT handler', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'ccw-serve-workspace-'));

    try {
      let sigintHandler: (() => void) | null = null;

      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});

      const exitCodes: Array<number | undefined> = [];
      mock.method(process as any, 'exit', (code?: number) => {
        exitCodes.push(code);
      });

      const originalOn = process.on.bind(process);
      mock.method(process as any, 'on', (event: string, handler: any) => {
        if (event === 'SIGINT') {
          sigintHandler = handler;
          return process;
        }
        return originalOn(event, handler);
      });

      await serveModule.serveCommand({ port: 56790, browser: false, path: workspace });
      assert.ok(sigintHandler, 'Expected serveCommand to register SIGINT handler');

      sigintHandler?.();

      // Wait for async shutdown (stopReactFrontend can take up to ~6s)
      for (let i = 0; i < 40 && !exitCodes.includes(0); i++) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      assert.ok(exitCodes.includes(0));
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('fails fast on invalid path', async () => {
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    mock.method(process as any, 'exit', (code?: number) => {
      throw new ExitError(code);
    });

    await assert.rejects(
      serveModule.serveCommand({ port: 56791, browser: false, path: 'Z:\\this-path-should-not-exist' }),
      (err: any) => err instanceof ExitError && err.code === 1,
    );
  });
});

