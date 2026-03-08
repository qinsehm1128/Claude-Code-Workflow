// ========================================
// CLI Stream Store Tests
// ========================================

import { describe, it, expect, beforeEach } from 'vitest';
import { useCliStreamStore, selectActiveExecutionCount } from './cliStreamStore';

describe('cliStreamStore', () => {
  beforeEach(() => {
    useCliStreamStore.getState().resetState();
  });

  it('removeExecution clears outputs and execution state together', () => {
    const store = useCliStreamStore.getState();

    store.upsertExecution('exec-1', {
      tool: 'codex',
      mode: 'analysis',
      status: 'running',
      output: [],
      startTime: 1_741_400_000_000,
    });
    store.addOutput('exec-1', {
      type: 'stdout',
      content: 'hello',
      timestamp: 1_741_400_000_100,
    });

    expect(useCliStreamStore.getState().outputs['exec-1']).toHaveLength(1);
    expect(useCliStreamStore.getState().executions['exec-1']).toBeDefined();

    store.removeExecution('exec-1');

    expect(useCliStreamStore.getState().outputs['exec-1']).toBeUndefined();
    expect(useCliStreamStore.getState().executions['exec-1']).toBeUndefined();
  });

  it('resetState clears execution badge state for workspace switches', () => {
    const store = useCliStreamStore.getState();

    store.upsertExecution('exec-running', {
      tool: 'codex',
      mode: 'analysis',
      status: 'running',
      output: [],
      startTime: 1_741_401_000_000,
    });
    store.setCurrentExecution('exec-running');
    store.markExecutionClosedByUser('exec-running');

    expect(selectActiveExecutionCount(useCliStreamStore.getState() as any)).toBe(1);
    expect(useCliStreamStore.getState().currentExecutionId).toBe('exec-running');

    store.resetState();

    const nextState = useCliStreamStore.getState();
    expect(selectActiveExecutionCount(nextState as any)).toBe(0);
    expect(nextState.currentExecutionId).toBeNull();
    expect(Object.keys(nextState.executions)).toEqual([]);
    expect(Object.keys(nextState.outputs)).toEqual([]);
    expect(nextState.userClosedExecutions.size).toBe(0);
  });
});
