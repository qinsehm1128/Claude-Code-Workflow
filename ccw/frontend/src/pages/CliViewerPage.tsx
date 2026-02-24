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
import { useCliStreamStore, type CliOutputLine } from '@/stores/cliStreamStore';
import { useNotificationStore, selectWsLastMessage } from '@/stores';
import { useActiveCliExecutions, useInvalidateActiveCliExecutions } from '@/hooks/useActiveCliExecutions';

// ========================================
// Types
// ========================================

// CLI WebSocket message types (matching CliStreamMonitorLegacy)
interface CliStreamStartedPayload {
  executionId: string;
  tool: string;
  mode: string;
  timestamp: string;
}

interface CliStreamOutputPayload {
  executionId: string;
  chunkType: string;
  data: unknown;
  unit?: {
    content: unknown;
    type?: string;
  };
}

interface CliStreamCompletedPayload {
  executionId: string;
  success: boolean;
  duration?: number;
  timestamp: string;
}

interface CliStreamErrorPayload {
  executionId: string;
  error?: string;
  timestamp: string;
}

// ========================================
// Constants
// ========================================

const DEFAULT_LAYOUT = 'split-h' as const;

// ========================================
// Helper Functions
// ========================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

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

  // Track last processed WebSocket message to prevent duplicate processing
  const lastProcessedMsgRef = useRef<unknown>(null);

  // WebSocket last message from notification store
  const lastMessage = useNotificationStore(selectWsLastMessage);

  // Active execution sync from server
  useActiveCliExecutions(true);
  const invalidateActive = useInvalidateActiveCliExecutions();

  // Handle WebSocket messages for CLI stream (same logic as CliStreamMonitorLegacy)
  useEffect(() => {
    if (!lastMessage || lastMessage === lastProcessedMsgRef.current) return;
    lastProcessedMsgRef.current = lastMessage;

    const { type, payload } = lastMessage;

    if (type === 'CLI_STARTED') {
      const p = payload as CliStreamStartedPayload;
      const startTime = p.timestamp ? new Date(p.timestamp).getTime() : Date.now();
      useCliStreamStore.getState().upsertExecution(p.executionId, {
        tool: p.tool || 'cli',
        mode: p.mode || 'analysis',
        status: 'running',
        startTime,
        output: [
          {
            type: 'system',
            content: `[${new Date(startTime).toLocaleTimeString()}] CLI execution started: ${p.tool} (${p.mode} mode)`,
            timestamp: startTime
          }
        ]
      });
      invalidateActive();
    } else if (type === 'CLI_OUTPUT') {
      const p = payload as CliStreamOutputPayload;
      const unitContent = p.unit?.content ?? p.data;
      const unitType = p.unit?.type || p.chunkType;

      let content: string;
      if (unitType === 'tool_call' && typeof unitContent === 'object' && unitContent !== null) {
        const toolCall = unitContent as { action?: string; toolName?: string; parameters?: unknown; status?: string; output?: string };
        if (toolCall.action === 'invoke') {
          const params = toolCall.parameters ? JSON.stringify(toolCall.parameters) : '';
          content = `[Tool] ${toolCall.toolName}(${params})`;
        } else if (toolCall.action === 'result') {
          const status = toolCall.status || 'unknown';
          const output = toolCall.output ? `: ${toolCall.output.substring(0, 200)}${toolCall.output.length > 200 ? '...' : ''}` : '';
          content = `[Tool Result] ${status}${output}`;
        } else {
          content = JSON.stringify(unitContent);
        }
      } else {
        content = typeof unitContent === 'string' ? unitContent : JSON.stringify(unitContent);
      }

      const lines = content.split('\n');
      const addOutput = useCliStreamStore.getState().addOutput;
      lines.forEach(line => {
        if (line.trim() || lines.length === 1) {
          addOutput(p.executionId, {
            type: (unitType as CliOutputLine['type']) || 'stdout',
            content: line,
            timestamp: Date.now()
          });
        }
      });
    } else if (type === 'CLI_COMPLETED') {
      const p = payload as CliStreamCompletedPayload;
      const endTime = p.timestamp ? new Date(p.timestamp).getTime() : Date.now();
      useCliStreamStore.getState().upsertExecution(p.executionId, {
        status: p.success ? 'completed' : 'error',
        endTime,
        output: [
          {
            type: 'system',
            content: `[${new Date(endTime).toLocaleTimeString()}] CLI execution ${p.success ? 'completed successfully' : 'failed'}${p.duration ? ` (${formatDuration(p.duration)})` : ''}`,
            timestamp: endTime
          }
        ]
      });
      invalidateActive();
    } else if (type === 'CLI_ERROR') {
      const p = payload as CliStreamErrorPayload;
      const endTime = p.timestamp ? new Date(p.timestamp).getTime() : Date.now();
      useCliStreamStore.getState().upsertExecution(p.executionId, {
        status: 'error',
        endTime,
        output: [
          {
            type: 'stderr',
            content: `[ERROR] ${p.error || 'Unknown error occurred'}`,
            timestamp: endTime
          }
        ]
      });
      invalidateActive();
    }
  }, [lastMessage, invalidateActive]);

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
