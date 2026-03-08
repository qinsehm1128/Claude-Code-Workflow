// ========================================
// Queue Execution Store Tests
// ========================================

import { beforeEach, describe, expect, it } from 'vitest';
import { useQueueExecutionStore } from './queueExecutionStore';

describe('queueExecutionStore', () => {
  beforeEach(() => {
    useQueueExecutionStore.getState().resetState();
  });

  it('resetState clears workspace-scoped queue execution tracking', () => {
    const store = useQueueExecutionStore.getState();

    store.addExecution({
      id: 'queue-exec-1',
      queueItemId: 'Q-1',
      issueId: 'ISSUE-1',
      solutionId: 'SOL-1',
      type: 'session',
      sessionKey: 'session-1',
      tool: 'codex',
      mode: 'analysis',
      status: 'running',
      startedAt: '2026-03-08T12:00:00.000Z',
    });

    expect(useQueueExecutionStore.getState().executions['queue-exec-1']).toBeDefined();

    store.resetState();

    expect(useQueueExecutionStore.getState().executions).toEqual({});
  });
});
