// ========================================
// CliViewerPage Utilities
// ========================================

import type { PaneId, PaneState, TabId } from '@/stores/viewerStore';

export function getStaleViewerTabs(
  panes: Record<PaneId, PaneState>,
  executions: Record<string, unknown>
): Array<{ paneId: PaneId; tabId: TabId; executionId: string }> {
  const executionIds = new Set(Object.keys(executions));

  return Object.entries(panes).flatMap(([paneId, pane]) => (
    pane.tabs
      .filter((tab) => !executionIds.has(tab.executionId))
      .map((tab) => ({
        paneId,
        tabId: tab.id,
        executionId: tab.executionId,
      }))
  ));
}
