// ========================================
// CLI Viewer Page
// ========================================
// Multi-pane CLI output viewer with configurable layouts
// Integrates with viewerStore for state management
// Includes WebSocket integration and execution recovery

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutContainer, CliViewerToolbar } from '@/components/cli-viewer';
import {
  useViewerStore,
  useViewerLayout,
  useViewerPanes,
  useFocusedPaneId,
  type AllotmentLayout,
} from '@/stores/viewerStore';
import { useCliStreamStore } from '@/stores/cliStreamStore';
import { useActiveCliExecutions } from '@/hooks/useActiveCliExecutions';
import { useCliStreamWebSocket } from '@/hooks/useCliStreamWebSocket';

// ========================================
// Constants
// ========================================

const DEFAULT_LAYOUT = 'split-h' as const;

// ========================================
// Helper Functions
// ========================================

/**
 * Count total panes in layout
 */
function countPanes(layout: AllotmentLayout): number {
  let count = 0;
  const traverse = (children: (string | AllotmentLayout)[]) => {
    for (const child of children) {
      if (typeof child === 'string') {
        count++;
      } else {
        traverse(child.children);
      }
    }
  };
  traverse(layout.children);
  return count;
}

// ========================================
// Main Component
// ========================================

export function CliViewerPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Store hooks
  const layout = useViewerLayout();
  const panes = useViewerPanes();
  const focusedPaneId = useFocusedPaneId();
  const { initializeDefaultLayout, addTab } = useViewerStore();

  // CLI Stream Store hooks
  const executions = useCliStreamStore((state) => state.executions);

  // Active execution sync from server
  useActiveCliExecutions(true);

  // CENTRALIZED WebSocket handler - processes each message only ONCE globally
  useCliStreamWebSocket();

  // Auto-add new executions as tabs, distributing across available panes
  const addedExecutionsRef = useRef<Set<string>>(new Set());

  // FIX-001: Initialize addedExecutionsRef with existing tab executionIds on mount
  // This prevents duplicate tabs from being added after page refresh
  useEffect(() => {
    // Extract executionIds from all existing tabs in all panes
    const existingExecutionIds = Object.values(panes).flatMap((pane) =>
      pane.tabs.map((tab) => tab.executionId)
    );
    existingExecutionIds.forEach((id) => addedExecutionsRef.current.add(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  useEffect(() => {
    const paneIds = Object.keys(panes);
    if (paneIds.length === 0) return;

    const storeAddTab = useViewerStore.getState().addTab;
    const newExecutionIds = Object.keys(executions).filter(
      (id) => !addedExecutionsRef.current.has(id)
    );

    if (newExecutionIds.length === 0) return;

    newExecutionIds.forEach((executionId, index) => {
      addedExecutionsRef.current.add(executionId);
      const exec = executions[executionId];
      const toolShort = exec.tool.split('-')[0];
      const targetPaneId = paneIds[index % paneIds.length];
      storeAddTab(targetPaneId, executionId, `${toolShort} (${exec.mode})`);
    });
  }, [executions, panes]);

  // Initialize layout if empty
  useEffect(() => {
    const paneCount = countPanes(layout);
    if (paneCount === 0) {
      initializeDefaultLayout(DEFAULT_LAYOUT);
    }
  }, [layout, initializeDefaultLayout]);

  // Handle executionId from URL params
  useEffect(() => {
    const executionId = searchParams.get('executionId');
    if (executionId && focusedPaneId) {
      addTab(focusedPaneId, executionId, `Execution ${executionId.slice(0, 8)}`);
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('executionId');
        return newParams;
      });
    }
  }, [searchParams, focusedPaneId, addTab, setSearchParams]);

  // Toggle fullscreen handler
  const handleToggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  return (
    <div className="h-full flex flex-col">
      {/* ======================================== */}
      {/* Toolbar */}
      {/* ======================================== */}
      <CliViewerToolbar
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* ======================================== */}
      {/* Layout Container */}
      {/* ======================================== */}
      <div className="flex-1 min-h-0 bg-background">
        <LayoutContainer />
      </div>
    </div>
  );
}

export default CliViewerPage;
