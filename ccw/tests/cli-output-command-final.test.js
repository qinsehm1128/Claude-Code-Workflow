/**
 * ccw cli output --final regression tests
 *
 * Verifies strict final-result behavior for cached executions.
 */

import { after, afterEach, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-cli-output-final-home-'));

const cliCommandPath = new URL('../dist/commands/cli.js', import.meta.url).href;
const historyStorePath = new URL('../dist/tools/cli-history-store.js', import.meta.url).href;

function createTestProjectRoot() {
  const dirPath = mkdtempSync(join(tmpdir(), 'ccw-cli-output-final-project-'));
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

function createConversation({ id, stdoutFull = '', parsedOutput, finalOutput }) {
  return {
    id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tool: 'codex',
    model: 'default',
    mode: 'analysis',
    category: 'user',
    total_duration_ms: 100,
    turn_count: 1,
    latest_status: 'success',
    turns: [
      {
        turn: 1,
        timestamp: new Date().toISOString(),
        prompt: 'test prompt',
        duration_ms: 100,
        status: 'success',
        exit_code: 0,
        output: {
          stdout: stdoutFull,
          stderr: '',
          truncated: false,
          cached: true,
          stdout_full: stdoutFull,
          stderr_full: '',
          parsed_output: parsedOutput,
          final_output: finalOutput,
        },
      },
    ],
  };
}

describe('ccw cli output --final', async () => {
  let cliModule;
  let historyStoreModule;

  before(async () => {
    process.env.CCW_DATA_DIR = TEST_CCW_HOME;
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

  it('reconstructs the final agent message from raw JSONL when final_output is missing', async () => {
    const projectRoot = createTestProjectRoot();
    const store = new historyStoreModule.CliHistoryStore(projectRoot);
    const stdoutFull = [
      JSON.stringify({ type: 'thread.started', thread_id: 'THREAD-1' }),
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({ type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text: 'Running `pwd` now.' } }),
      JSON.stringify({ type: 'item.completed', item: { id: 'item_1', type: 'command_execution', command: 'pwd', aggregated_output: 'D:\\Claude_dms3\\ccw', exit_code: 0, status: 'completed' } }),
      JSON.stringify({ type: 'item.completed', item: { id: 'item_2', type: 'agent_message', text: 'Waiting for the command output, then I’ll return it verbatim.' } }),
      JSON.stringify({ type: 'item.completed', item: { id: 'item_3', type: 'agent_message', text: 'D:\\Claude_dms3\\ccw' } }),
      JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } }),
      '',
    ].join('\n');

    try {
      store.saveConversation(createConversation({
        id: 'EXEC-RECONSTRUCT-FINAL',
        stdoutFull,
        parsedOutput: 'Running `pwd` now.\nWaiting for the command output, then I’ll return it verbatim.\nD:\\Claude_dms3\\ccw',
        finalOutput: undefined,
      }));

      const logs = [];
      mock.method(console, 'log', (...args) => {
        logs.push(args.map(String).join(' '));
      });
      mock.method(console, 'error', () => {});

      await cliModule.cliCommand('output', ['EXEC-RECONSTRUCT-FINAL'], { final: true, project: projectRoot });

      assert.deepEqual(logs, ['D:\\Claude_dms3\\ccw']);
    } finally {
      store.close();
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('fails fast for explicit --final when no final agent result can be recovered', async () => {
    const projectRoot = createTestProjectRoot();
    const store = new historyStoreModule.CliHistoryStore(projectRoot);

    try {
      store.saveConversation(createConversation({
        id: 'EXEC-NO-FINAL',
        stdoutFull: 'plain stdout without JSONL final message',
        parsedOutput: 'INTERMEDIATE_STATUS_LINE',
        finalOutput: undefined,
      }));

      const logs = [];
      const errors = [];
      const exitCodes = [];

      mock.method(console, 'log', (...args) => {
        logs.push(args.map(String).join(' '));
      });
      mock.method(console, 'error', (...args) => {
        errors.push(args.map(String).join(' '));
      });
      mock.method(process, 'exit', (code) => {
        exitCodes.push(code);
      });

      await cliModule.cliCommand('output', ['EXEC-NO-FINAL'], { final: true, project: projectRoot });

      assert.deepEqual(logs, []);
      assert.deepEqual(exitCodes, [1]);
      assert.ok(errors.some((line) => line.includes('No final agent result found in cached output.')));
    } finally {
      store.close();
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
