// ========================================
// Terminal Grid Store Tests
// ========================================

import { beforeEach, describe, expect, it } from 'vitest';
import { useTerminalGridStore } from './terminalGridStore';

describe('terminalGridStore', () => {
  beforeEach(() => {
    useTerminalGridStore.getState().resetLayout('single');
  });

  it('resetWorkspaceState clears pane session bindings while preserving layout', () => {
    const store = useTerminalGridStore.getState();

    store.resetLayout('split-h');
    const configuredState = useTerminalGridStore.getState();
    const paneIds = Object.keys(configuredState.panes);
    const originalLayout = configuredState.layout;

    store.assignSession(paneIds[0], 'session-a', 'codex');
    store.showFileInPane(paneIds[1], 'D:/workspace-a/file.ts');
    store.setFocused(paneIds[1]);

    store.resetWorkspaceState();

    const nextState = useTerminalGridStore.getState();
    expect(nextState.layout).toEqual(originalLayout);
    expect(Object.keys(nextState.panes)).toEqual(paneIds);
    expect(nextState.focusedPaneId).toBe(paneIds[1]);
    for (const paneId of paneIds) {
      expect(nextState.panes[paneId]?.sessionId).toBeNull();
      expect(nextState.panes[paneId]?.cliTool).toBeNull();
      expect(nextState.panes[paneId]?.displayMode).toBe('terminal');
      expect(nextState.panes[paneId]?.filePath).toBeNull();
    }
  });
});
