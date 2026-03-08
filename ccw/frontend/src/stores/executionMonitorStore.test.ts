// ========================================
// Execution Monitor Store Tests
// ========================================

import { beforeEach, describe, expect, it } from 'vitest';
import {
  useExecutionMonitorStore,
  selectActiveExecutionCount,
  type ExecutionWSMessage,
} from './executionMonitorStore';

describe('executionMonitorStore', () => {
  beforeEach(() => {
    useExecutionMonitorStore.getState().resetState();
  });

  it('resetState clears workspace-scoped execution monitor state', () => {
    const store = useExecutionMonitorStore.getState();
    const startMessage: ExecutionWSMessage = {
      type: 'EXECUTION_STARTED',
      payload: {
        executionId: 'exec-running',
        flowId: 'flow-1',
        sessionKey: 'session-1',
        stepName: 'Workspace Flow',
        totalSteps: 3,
        timestamp: '2026-03-08T12:00:00.000Z',
      },
    };

    store.handleExecutionMessage(startMessage);

    const activeState = useExecutionMonitorStore.getState();
    expect(selectActiveExecutionCount(activeState as any)).toBe(1);
    expect(activeState.currentExecutionId).toBe('exec-running');
    expect(activeState.isPanelOpen).toBe(true);

    store.resetState();

    const nextState = useExecutionMonitorStore.getState();
    expect(selectActiveExecutionCount(nextState as any)).toBe(0);
    expect(nextState.activeExecutions).toEqual({});
    expect(nextState.currentExecutionId).toBeNull();
    expect(nextState.isPanelOpen).toBe(false);
  });
});
