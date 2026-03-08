// ========================================
// Terminal Panel Store Tests
// ========================================

import { beforeEach, describe, expect, it } from 'vitest';
import { useTerminalPanelStore, selectTerminalCount } from './terminalPanelStore';

describe('terminalPanelStore', () => {
  beforeEach(() => {
    useTerminalPanelStore.getState().resetState();
  });

  it('resetState clears workspace-scoped terminal tabs and selection', () => {
    const store = useTerminalPanelStore.getState();

    store.openTerminal('session-a');
    store.addTerminal('session-b');
    store.setPanelView('queue');

    const activeState = useTerminalPanelStore.getState();
    expect(selectTerminalCount(activeState as any)).toBe(2);
    expect(activeState.activeTerminalId).toBe('session-a');
    expect(activeState.panelView).toBe('queue');
    expect(activeState.isPanelOpen).toBe(true);

    store.resetState();

    const nextState = useTerminalPanelStore.getState();
    expect(selectTerminalCount(nextState as any)).toBe(0);
    expect(nextState.terminalOrder).toEqual([]);
    expect(nextState.activeTerminalId).toBeNull();
    expect(nextState.panelView).toBe('terminal');
    expect(nextState.isPanelOpen).toBe(false);
  });
});
