/**
 * Integration test for FlowExecutor tmux-like routing to PTY sessions.
 *
 * Ensures that delivery=sendToSession:
 * - locates the target PTY session even if the executor workflowDir differs
 * - records a session_execute audit event for Observability panel
 */

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const flowExecutorUrl = new URL('../dist/core/services/flow-executor.js', import.meta.url);
flowExecutorUrl.searchParams.set('t', String(Date.now()));

const cliSessionMuxFileUrl = new URL('../dist/core/services/cli-session-mux.js', import.meta.url).href;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let FlowExecutorMod;

describe('flow-executor sendToSession routing', async () => {
  let workflowDir = '';
  let sessionRoot = '';
  let sessionKey = '';

  before(async () => {
    workflowDir = mkdtempSync(join(tmpdir(), 'ccw-flowexec-workflow-'));
    sessionRoot = mkdtempSync(join(tmpdir(), 'ccw-flowexec-sessionroot-'));

    sessionKey = 'cli-session-test-1';

    const fakeManager = {
      hasSession: (key) => key === sessionKey,
      getProjectRoot: () => sessionRoot,
      getSession: (key) => (key === sessionKey ? { sessionKey, workingDir: sessionRoot, tool: 'claude' } : null),
      execute: (key, options) => {
        if (key !== sessionKey) throw new Error('Session not found');
        return { executionId: 'exec-routed-1', command: `echo routed ${options?.tool || ''}` };
      },
    };

    const muxMod = await import(cliSessionMuxFileUrl);
    muxMod.cliSessionMux.findCliSessionManager = (key) => (key === sessionKey ? fakeManager : null);
    muxMod.cliSessionMux.getCliSessionManager = () => fakeManager;

    FlowExecutorMod = await import(flowExecutorUrl.href);
  });

  after(() => {
    if (workflowDir) rmSync(workflowDir, { recursive: true, force: true });
    if (sessionRoot) rmSync(sessionRoot, { recursive: true, force: true });
  });

  it('routes execution to the target session and appends audit event', async () => {
    const flowId = 'flow-test-send-to-session';
    const execId = `exec-${Date.now()}`;
    const now = new Date().toISOString();

    const flow = {
      id: flowId,
      name: 'SendToSession Flow',
      description: '',
      version: '1.0.0',
      created_at: now,
      updated_at: now,
      nodes: [
        {
          id: 'node-1',
          type: 'prompt-template',
          position: { x: 0, y: 0 },
          data: {
            label: 'SendToSession',
            instruction: 'echo hello',
            tool: 'claude',
            mode: 'analysis',
            delivery: 'sendToSession',
            targetSessionKey: sessionKey,
            resumeKey: 'ISSUE-TEST',
            resumeStrategy: 'nativeResume',
          },
        },
      ],
      edges: [],
      variables: {},
      metadata: { source: 'local' },
    };

    const executor = new FlowExecutorMod.FlowExecutor(flow, execId, workflowDir);
    const state = await executor.execute({});

    assert.equal(state.status, 'completed');

    const auditPath = join(sessionRoot, '.workflow', 'audit', 'cli-sessions.jsonl');
    const raw = readFileSync(auditPath, 'utf8');
    const events = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    const ev = events.find((e) => e.type === 'session_execute' && e.sessionKey === sessionKey);
    assert.ok(ev, 'expected session_execute audit event');
    assert.equal(ev.tool, 'claude');
    assert.equal(ev.resumeKey, 'ISSUE-TEST');
    assert.ok(ev.details);
    assert.equal(ev.details.delivery, 'sendToSession');
    assert.equal(ev.details.flowId, flowId);
    assert.equal(ev.details.nodeId, 'node-1');
  });
});
