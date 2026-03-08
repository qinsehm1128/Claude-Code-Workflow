/**
 * ccw cli watch - stale running fallback tests
 */

import { after, afterEach, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-cli-watch-home-'));
process.env.CCW_DATA_DIR = TEST_CCW_HOME;

const cliCommandPath = new URL('../dist/commands/cli.js', import.meta.url).href;
const historyStorePath = new URL('../dist/tools/cli-history-store.js', import.meta.url).href;

describe('ccw cli watch stale running fallback', async () => {
  let cliModule;
  let historyStoreModule;

  before(async () => {
    cliModule = await import(cliCommandPath);
    historyStoreModule = await import(historyStorePath);
  });

  afterEach(() => {
    mock.restoreAll();
    try {
      historyStoreModule?.closeAllStores?.();
    } catch {
      // ignore
    }
  });

  after(() => {
    try {
      historyStoreModule?.closeAllStores?.();
    } catch {
      // ignore
    }
    rmSync(TEST_CCW_HOME, { recursive: true, force: true });
  });

  it('treats stale active running state as completed when saved conversation is newer', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-cli-watch-project-'));
    const previousCwd = process.cwd();
    const now = Date.now();
    const executionId = `EXEC-WATCH-STALE-${now}`;

    try {
      process.chdir(projectRoot);
      const store = new historyStoreModule.CliHistoryStore(projectRoot);
      store.saveConversation({
        id: executionId,
        created_at: new Date(now - 10_000).toISOString(),
        updated_at: new Date(now - 5_000).toISOString(),
        tool: 'codex',
        model: 'default',
        mode: 'analysis',
        category: 'user',
        total_duration_ms: 2100,
        turn_count: 1,
        latest_status: 'success',
        turns: [{
          turn: 1,
          timestamp: new Date(now - 5_000).toISOString(),
          prompt: 'saved prompt',
          duration_ms: 2100,
          status: 'success',
          exit_code: 0,
          output: {
            stdout: 'saved output',
            stderr: '',
            truncated: false,
            cached: false,
          }
        }]
      });
      store.close();

      mock.method(http, 'request', (_options, callback) => {
        const payload = JSON.stringify({
          executions: [{
            id: executionId,
            tool: 'codex',
            mode: 'analysis',
            status: 'running',
            prompt: 'stale active prompt',
            startTime: now - 60_000,
            output: ''
          }]
        });
        const res = {
          on(event, handler) {
            if (event === 'data') handler(Buffer.from(payload, 'utf8'));
            if (event === 'end') handler();
            return res;
          }
        };
        if (callback) callback(res);
        const req = {
          on() { return req; },
          end() {},
          destroy() {},
        };
        return req;
      });

      const stderrWrites = [];
      const exitCodes = [];
      mock.method(process.stderr, 'write', (chunk) => {
        stderrWrites.push(String(chunk));
        return true;
      });
      mock.method(process, 'exit', (code) => {
        exitCodes.push(code);
      });

      await cliModule.cliCommand('watch', [executionId], { timeout: '1' });

      const rendered = stderrWrites.join('');
      assert.match(rendered, /Execution already completed/);
      assert.match(rendered, new RegExp(`Use: ccw cli output ${executionId}`));
      assert.deepEqual(exitCodes, [0]);
    } finally {
      process.chdir(previousCwd);
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
