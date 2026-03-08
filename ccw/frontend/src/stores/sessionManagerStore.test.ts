// ========================================
// Session Manager Store Tests
// ========================================

import { beforeEach, describe, expect, it } from 'vitest';
import { useSessionManagerStore } from './sessionManagerStore';

describe('sessionManagerStore', () => {
  beforeEach(() => {
    useSessionManagerStore.getState().resetState();
  });

  it('resetState clears workspace-scoped terminal metadata and selection', () => {
    const store = useSessionManagerStore.getState();

    store.createGroup('Workspace Group');
    store.setActiveTerminal('session-1');
    store.updateTerminalMeta('session-1', {
      title: 'Session 1',
      status: 'active',
      alertCount: 2,
      tag: 'workspace-a',
    });

    const activeState = useSessionManagerStore.getState();
    expect(activeState.groups).toHaveLength(1);
    expect(activeState.activeTerminalId).toBe('session-1');
    expect(activeState.terminalMetas['session-1']?.status).toBe('active');

    store.resetState();

    const nextState = useSessionManagerStore.getState();
    expect(nextState.groups).toEqual([]);
    expect(nextState.activeTerminalId).toBeNull();
    expect(nextState.terminalMetas).toEqual({});
  });
});
