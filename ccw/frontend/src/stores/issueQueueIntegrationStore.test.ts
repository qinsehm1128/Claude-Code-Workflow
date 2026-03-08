// ========================================
// Issue Queue Integration Store Tests
// ========================================

import { beforeEach, describe, expect, it } from 'vitest';
import { useIssueQueueIntegrationStore } from './issueQueueIntegrationStore';
import { useQueueExecutionStore } from './queueExecutionStore';

describe('issueQueueIntegrationStore', () => {
  beforeEach(() => {
    useIssueQueueIntegrationStore.getState().resetState();
    useQueueExecutionStore.getState().resetState();
  });

  it('resetState clears selected issue and association chain', () => {
    useQueueExecutionStore.getState().addExecution({
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

    const store = useIssueQueueIntegrationStore.getState();
    store.buildAssociationChain('ISSUE-1', 'issue');

    expect(useIssueQueueIntegrationStore.getState().selectedIssueId).toBe('ISSUE-1');
    expect(useIssueQueueIntegrationStore.getState().associationChain).toEqual({
      issueId: 'ISSUE-1',
      queueItemId: 'Q-1',
      sessionId: 'session-1',
    });

    store.resetState();

    const nextState = useIssueQueueIntegrationStore.getState();
    expect(nextState.selectedIssueId).toBeNull();
    expect(nextState.associationChain).toBeNull();
  });
});
