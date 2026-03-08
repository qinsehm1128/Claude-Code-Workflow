// ========================================
// CLI Session Store Tests
// ========================================

import { beforeEach, describe, expect, it } from 'vitest';
import { useCliSessionStore } from './cliSessionStore';

describe('cliSessionStore', () => {
  beforeEach(() => {
    useCliSessionStore.getState().resetState();
  });

  it('resetState clears workspace-scoped sessions and output buffers', () => {
    const store = useCliSessionStore.getState();

    store.setSessions([
      {
        sessionKey: 'session-1',
        shellKind: 'bash',
        workingDir: 'D:/workspace-a',
        tool: 'codex',
        createdAt: '2026-03-08T12:00:00.000Z',
        updatedAt: '2026-03-08T12:00:00.000Z',
        isPaused: false,
      },
    ]);
    store.appendOutput('session-1', 'hello world', 1_741_430_000_000);

    expect(useCliSessionStore.getState().sessions['session-1']).toBeDefined();
    expect(useCliSessionStore.getState().outputChunks['session-1']).toHaveLength(1);

    store.resetState();

    const nextState = useCliSessionStore.getState();
    expect(nextState.sessions).toEqual({});
    expect(nextState.outputChunks).toEqual({});
    expect(nextState.outputBytes).toEqual({});
  });
});
