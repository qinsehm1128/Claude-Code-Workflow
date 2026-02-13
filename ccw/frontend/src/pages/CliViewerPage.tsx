// ========================================
// CLI Viewer Page
// ========================================
// Multi-pane CLI output viewer with configurable layouts
// Integrates with viewerStore for state management
// Includes WebSocket integration and execution recovery

import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  Terminal,
  LayoutGrid,
  Columns,
  Rows,
  Square,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/Dropdown';
import { cn } from '@/lib/utils';
import { LayoutContainer } from '@/components/cli-viewer';
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

export type LayoutType = 'single' | 'split-h' | 'split-v' | 'grid-2x2';

interface LayoutOption {
  id: LayoutType;
  icon: React.ElementType;
  labelKey: string;
}

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

const LAYOUT_OPTIONS: LayoutOption[] = [
  { id: 'single', icon: Square, labelKey: 'cliViewer.layout.single' },
  { id: 'split-h', icon: Columns, labelKey: 'cliViewer.layout.splitH' },
  { id: 'split-v', icon: Rows, labelKey: 'cliViewer.layout.splitV' },
  { id: 'grid-2x2', icon: LayoutGrid, labelKey: 'cliViewer.layout.grid' },
];

const DEFAULT_LAYOUT: LayoutType = 'split-h';

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
 * Detect layout type from AllotmentLayout structure
 */
function detectLayoutType(layout: AllotmentLayout): LayoutType {
  const childCount = layout.children.length;

  // Empty or single pane
  if (childCount === 0 || childCount === 1) {
    return 'single';
  }

  // Two panes at root level
  if (childCount === 2) {
    const hasNestedGroups = layout.children.some(
      (child) => typeof child !== 'string'
    );

    // If no nested groups, it's a simple split
    if (!hasNestedGroups) {
      return layout.direction === 'horizontal' ? 'split-h' : 'split-v';
    }

    // Check for grid layout (2x2)
    const allNested = layout.children.every(
      (child) => typeof child !== 'string'
    );
    if (allNested) {
      return 'grid-2x2';
    }
  }

  // Default to current direction
  return layout.direction === 'horizontal' ? 'split-h' : 'split-v';
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
  const { formatMessage } = useIntl();
  const [searchParams, setSearchParams] = useSearchParams();

  // Store hooks
  const layout = useViewerLayout();
  const panes = useViewerPanes();
  const focusedPaneId = useFocusedPaneId();
  const { initializeDefaultLayout, addTab, reset } = useViewerStore();

  // CLI Stream Store hooks
  const executions = useCliStreamStore((state) => state.executions);

  // Track last processed WebSocket message to prevent duplicate processing
  const lastProcessedMsgRef = useRef<unknown>(null);

  // WebSocket last message from notification store
  const lastMessage = useNotificationStore(selectWsLastMessage);

  // Active execution sync from server
  const { isLoading: _isSyncing } = useActiveCliExecutions(true); // Always sync when page is open
  const invalidateActive = useInvalidateActiveCliExecutions();

  // Detect current layout type from store
  const currentLayoutType = useMemo(() => detectLayoutType(layout), [layout]);

  // Count active sessions (tabs across all panes)
  const activeSessionCount = useMemo(() => {
    return Object.values(panes).reduce((count, pane) => count + pane.tabs.length, 0);
  }, [panes]);

  // Get execution count for display
  const executionCount = useMemo(() => Object.keys(executions).length, [executions]);
  const runningCount = useMemo(
    () => Object.values(executions).filter(e => e.status === 'running').length,
    [executions]
  );

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
  // Uses round-robin distribution to spread executions across panes side-by-side
  const addedExecutionsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // Get all pane IDs from the current layout
    const paneIds = Object.keys(panes);
    if (paneIds.length === 0) return;

    // Get addTab from store directly to avoid dependency on reactive function
    // This prevents infinite loop when addTab updates store state
    const storeAddTab = useViewerStore.getState().addTab;

    // Get new executions that haven't been added yet
    const newExecutionIds = Object.keys(executions).filter(
      (id) => !addedExecutionsRef.current.has(id)
    );

    if (newExecutionIds.length === 0) return;

    // Distribute new executions across panes round-robin
    newExecutionIds.forEach((executionId, index) => {
      addedExecutionsRef.current.add(executionId);
      const exec = executions[executionId];
      const toolShort = exec.tool.split('-')[0];
      // Round-robin pane selection
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
      // Add tab to focused pane
      addTab(focusedPaneId, executionId, `Execution ${executionId.slice(0, 8)}`);

      // Clear the URL param after processing
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('executionId');
        return newParams;
      });
    }
  }, [searchParams, focusedPaneId, addTab, setSearchParams]);

  // Handle layout change
  const handleLayoutChange = useCallback(
    (layoutType: LayoutType) => {
      initializeDefaultLayout(layoutType);
    },
    [initializeDefaultLayout]
  );

  // Handle reset
  const handleReset = useCallback(() => {
    reset();
    initializeDefaultLayout(DEFAULT_LAYOUT);
  }, [reset, initializeDefaultLayout]);

  // Get current layout option for display
  const currentLayoutOption =
    LAYOUT_OPTIONS.find((l) => l.id === currentLayoutType) || LAYOUT_OPTIONS[1];
  const CurrentLayoutIcon = currentLayoutOption.icon;

  return (
    <div className="h-full flex flex-col -m-4 md:-m-6">
      {/* ======================================== */}
      {/* Toolbar */}
      {/* ======================================== */}
      <div className="flex items-center justify-between gap-3 p-3 bg-card border-b border-border">
        {/* Page Title */}
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {formatMessage({ id: 'cliViewer.page.title' })}
              </span>
              {runningCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  {runningCount} active
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {formatMessage(
                { id: 'cliViewer.page.subtitle' },
                { count: activeSessionCount }
              )}
              {executionCount > 0 && ` · ${executionCount} executions`}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Reset Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            title={formatMessage({ id: 'cliViewer.toolbar.clearAll' })}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          {/* Layout Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CurrentLayoutIcon className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {formatMessage({ id: currentLayoutOption.labelKey })}
                </span>
                <ChevronDown className="w-4 h-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {formatMessage({ id: 'cliViewer.layout.title' })}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {LAYOUT_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <DropdownMenuItem
                    key={option.id}
                    onClick={() => handleLayoutChange(option.id)}
                    className={cn(
                      'gap-2',
                      currentLayoutType === option.id && 'bg-accent'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {formatMessage({ id: option.labelKey })}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

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
