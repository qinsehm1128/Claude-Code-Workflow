// ========================================
// CliViewerPage Helper Tests
// ========================================

import { describe, it, expect } from 'vitest';
import { getStaleViewerTabs } from './cliViewerPage.utils';

describe('getStaleViewerTabs', () => {
  it('returns tabs whose execution ids are missing from the current execution map', () => {
    const panes = {
      'pane-1': {
        id: 'pane-1',
        activeTabId: 'tab-1',
        tabs: [
          { id: 'tab-1', executionId: 'exec-stale', title: 'stale', isPinned: false, order: 1 },
          { id: 'tab-2', executionId: 'exec-live', title: 'live', isPinned: false, order: 2 },
        ],
      },
      'pane-2': {
        id: 'pane-2',
        activeTabId: 'tab-3',
        tabs: [
          { id: 'tab-3', executionId: 'exec-missing', title: 'missing', isPinned: true, order: 1 },
        ],
      },
    };

    const executions = {
      'exec-live': { tool: 'codex', mode: 'analysis' },
    };

    expect(getStaleViewerTabs(panes as any, executions)).toEqual([
      { paneId: 'pane-1', tabId: 'tab-1', executionId: 'exec-stale' },
      { paneId: 'pane-2', tabId: 'tab-3', executionId: 'exec-missing' },
    ]);
  });

  it('returns an empty list when all tabs map to current executions', () => {
    const panes = {
      'pane-1': {
        id: 'pane-1',
        activeTabId: 'tab-1',
        tabs: [
          { id: 'tab-1', executionId: 'exec-live', title: 'live', isPinned: false, order: 1 },
        ],
      },
    };

    const executions = {
      'exec-live': { tool: 'codex', mode: 'analysis' },
    };

    expect(getStaleViewerTabs(panes as any, executions)).toEqual([]);
  });
});
