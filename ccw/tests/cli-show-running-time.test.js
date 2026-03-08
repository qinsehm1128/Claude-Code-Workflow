/**
 * ccw cli show - running execution time formatting tests
 */

import { after, afterEach, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-cli-show-time-home-'));
process.env.CCW_DATA_DIR = TEST_CCW_HOME;

const cliCommandPath = new URL('../dist/commands/cli.js', import.meta.url).href;
const historyStorePath = new URL('../dist/tools/cli-history-store.js', import.meta.url).href;

function createConversationRecord({ id, prompt, updatedAt, durationMs = 2000 }) {
  return {
    id,
    created_at: updatedAt,
    updated_at: updatedAt,
    tool: 'codex',
    model: 'default',
    mode: 'analysis',
    category: 'user',
    total_duration_ms: durationMs,
    turn_count: 1,
    latest_status: 'success',
    turns: [
      {
        turn: 1,
        timestamp: updatedAt,
        prompt,
        duration_ms: durationMs,
        status: 'success',
        exit_code: 0,
        output: {
          stdout: 'saved output',
          stderr: '',
          truncated: false,
          cached: false,
        },
      },
    ],
  };
}

function stubActiveExecutionsResponse(executions) {
  mock.method(http, 'request', (_options, callback) => {
    const payload = JSON.stringify({ executions });
    const res = {
      on(event, handler) {
        if (event === 'data') {
          handler(Buffer.from(payload, 'utf8'));
        }
        if (event === 'end') {
          handler();
        }
        return res;
      }
    };

    if (callback) {
      callback(res);
    }

    const req = {
      on() { return req; },
      write() {},
      end() {},
      destroy() {},
    };
    return req;
  });
}

describe('ccw cli show running time formatting', async () => {
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

  it('formats running time with the same humanized style as history rows', async () => {
    const now = 1_741_392_000_000;
    stubActiveExecutionsResponse([
      {
        id: 'EXEC-RUN-125S',
        tool: 'codex',
        mode: 'analysis',
        status: 'running',
        prompt: 'long task',
        startTime: now - 125_000,
        output: ''
      }
    ]);

    mock.method(Date, 'now', () => now);

    const logs = [];
    mock.method(console, 'log', (...args) => {
      logs.push(args.map(String).join(' '));
    });
    mock.method(console, 'error', () => {});

    await cliModule.cliCommand('show', [], {});

    const rendered = logs.join('\n');
    assert.match(rendered, /2m ago/);
    assert.match(rendered, /2m 5s\.\.\./);
    assert.doesNotMatch(rendered, /125s ago/);
  });

  it('normalizes second-based string timestamps for running executions', async () => {
    const now = 1_741_392_000_000;
    const startTimeSeconds = String(Math.floor((now - 3_600_000) / 1000));

    stubActiveExecutionsResponse([
      {
        id: 'EXEC-RUN-1H',
        tool: 'gemini',
        mode: 'write',
        status: 'running',
        prompt: 'hour task',
        startTime: startTimeSeconds,
        output: ''
      }
    ]);

    mock.method(Date, 'now', () => now);

    const logs = [];
    mock.method(console, 'log', (...args) => {
      logs.push(args.map(String).join(' '));
    });
    mock.method(console, 'error', () => {});

    await cliModule.cliCommand('show', [], {});

    const rendered = logs.join('\n');
    assert.match(rendered, /1h ago/);
    assert.match(rendered, /1h\.\.\./);
  });

  it('suppresses stale running rows when saved history is newer than the active start time', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-cli-show-stale-project-'));
    const previousCwd = process.cwd();
    const now = 1_741_392_000_000;
    const savedUpdatedAt = new Date(now - 5_000).toISOString();

    try {
      process.chdir(projectRoot);
      const store = new historyStoreModule.CliHistoryStore(projectRoot);
      store.saveConversation(createConversationRecord({
        id: 'EXEC-STALE-RUNNING',
        prompt: 'HISTORY PROMPT SHOULD WIN',
        updatedAt: savedUpdatedAt,
        durationMs: 2300,
      }));
      store.close();

      stubActiveExecutionsResponse([
        {
          id: 'EXEC-STALE-RUNNING',
          tool: 'codex',
          mode: 'analysis',
          status: 'running',
          prompt: 'ACTIVE PROMPT SHOULD BE HIDDEN',
          startTime: now - 60_000,
          output: ''
        }
      ]);

      mock.method(Date, 'now', () => now);

      const logs = [];
      mock.method(console, 'log', (...args) => {
        logs.push(args.map(String).join(' '));
      });
      mock.method(console, 'error', () => {});

      await cliModule.cliCommand('show', [], {});

      const rendered = logs.join('\n');
      assert.match(rendered, /HISTORY PROMPT SHOULD WIN/);
      assert.doesNotMatch(rendered, /ACTIVE PROMPT SHOULD BE HIDDEN/);
      assert.match(rendered, /2\.3s/);
    } finally {
      process.chdir(previousCwd);
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('keeps active running rows when saved history is older than the active start time \(resume-safe\)', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-cli-show-resume-project-'));
    const previousCwd = process.cwd();
    const now = 1_741_392_000_000;
    const savedUpdatedAt = new Date(now - 120_000).toISOString();

    try {
      process.chdir(projectRoot);
      const store = new historyStoreModule.CliHistoryStore(projectRoot);
      store.saveConversation(createConversationRecord({
        id: 'EXEC-RESUME-RUNNING',
        prompt: 'OLD HISTORY PROMPT',
        updatedAt: savedUpdatedAt,
        durationMs: 1800,
      }));
      store.close();

      stubActiveExecutionsResponse([
        {
          id: 'EXEC-RESUME-RUNNING',
          tool: 'codex',
          mode: 'analysis',
          status: 'running',
          prompt: 'ACTIVE RESUME PROMPT',
          startTime: now - 30_000,
          output: ''
        }
      ]);

      mock.method(Date, 'now', () => now);

      const logs = [];
      mock.method(console, 'log', (...args) => {
        logs.push(args.map(String).join(' '));
      });
      mock.method(console, 'error', () => {});

      await cliModule.cliCommand('show', [], {});

      const rendered = logs.join('\n');
      assert.match(rendered, /ACTIVE RESUME PROMPT/);
      assert.doesNotMatch(rendered, /OLD HISTORY PROMPT/);
      assert.match(rendered, /just now/);
    } finally {
      process.chdir(previousCwd);
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
