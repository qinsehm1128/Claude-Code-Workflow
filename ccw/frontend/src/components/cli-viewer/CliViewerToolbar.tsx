// ========================================
// CliViewerToolbar Component
// ========================================
// Compact icon-based toolbar for CLI Viewer page
// Follows DashboardToolbar design pattern

import { useCallback, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Square,
  Columns2,
  Rows2,
  LayoutGrid,
  Plus,
  ChevronDown,
  Maximize2,
  Minimize2,
  RotateCcw,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/Dropdown';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Search, Clock } from 'lucide-react';
import {
  useViewerStore,
  useViewerLayout,
  useFocusedPaneId,
  type AllotmentLayout,
} from '@/stores/viewerStore';
import { useCliStreamStore, type CliExecutionStatus } from '@/stores/cliStreamStore';

// ========== Types ==========

export interface CliViewerToolbarProps {
  /** Whether fullscreen mode is active */
  isFullscreen?: boolean;
  /** Callback to toggle fullscreen mode */
  onToggleFullscreen?: () => void;
}

export type LayoutType = 'single' | 'split-h' | 'split-v' | 'grid-2x2';

// ========== Constants ==========

const LAYOUT_PRESETS = [
  { id: 'single' as const, icon: Square, labelId: 'cliViewer.layout.single' },
  { id: 'split-h' as const, icon: Columns2, labelId: 'cliViewer.layout.splitH' },
  { id: 'split-v' as const, icon: Rows2, labelId: 'cliViewer.layout.splitV' },
  { id: 'grid-2x2' as const, icon: LayoutGrid, labelId: 'cliViewer.layout.grid' },
];

const DEFAULT_LAYOUT: LayoutType = 'split-h';

const STATUS_CONFIG: Record<CliExecutionStatus, { color: string }> = {
  running: { color: 'bg-blue-500 animate-pulse' },
  completed: { color: 'bg-green-500' },
  error: { color: 'bg-red-500' },
};

// ========== Helper Functions ==========

/**
 * Detect layout type from AllotmentLayout structure
 */
function detectLayoutType(layout: AllotmentLayout): LayoutType {
  const childCount = layout.children.length;

  if (childCount === 0 || childCount === 1) {
    return 'single';
  }

  if (childCount === 2) {
    const hasNestedGroups = layout.children.some(
      (child) => typeof child !== 'string'
    );

    if (!hasNestedGroups) {
      return layout.direction === 'horizontal' ? 'split-h' : 'split-v';
    }

    const allNested = layout.children.every(
      (child) => typeof child !== 'string'
    );
    if (allNested) {
      return 'grid-2x2';
    }
  }

  return layout.direction === 'horizontal' ? 'split-h' : 'split-v';
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ========== Component ==========

export function CliViewerToolbar({
  isFullscreen,
  onToggleFullscreen,
}: CliViewerToolbarProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();

  // Store hooks
  const layout = useViewerLayout();
  const focusedPaneId = useFocusedPaneId();
  const { initializeDefaultLayout, reset, addTab } = useViewerStore();

  // CLI Stream Store
  const executions = useCliStreamStore((state) => state.executions);

  // Detect current layout type
  const currentLayoutType = useMemo(() => detectLayoutType(layout), [layout]);

  // Get execution count for display
  const executionCount = useMemo(() => Object.keys(executions).length, [executions]);
  const runningCount = useMemo(
    () => Object.values(executions).filter((e) => e.status === 'running').length,
    [executions]
  );

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

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

  return (
    <div className="flex items-center gap-1 px-2 h-[40px] border-b border-border bg-muted/30 shrink-0">
      {/* Back button */}
      <button
        onClick={handleBack}
        className={cn(
          'p-1.5 rounded transition-colors',
          'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        title={formatMessage({ id: 'cliViewer.toolbar.back', defaultMessage: 'Back' })}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
      </button>

      {/* Separator */}
      <div className="w-px h-5 bg-border mx-1" />

      {/* Layout presets */}
      {LAYOUT_PRESETS.map((preset) => {
        const isActive = currentLayoutType === preset.id;
        return (
          <button
            key={preset.id}
            onClick={() => handleLayoutChange(preset.id)}
            className={cn(
              'p-1.5 rounded transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            title={formatMessage({ id: preset.labelId })}
          >
            <preset.icon className="w-3.5 h-3.5" />
          </button>
        );
      })}

      {/* Separator */}
      <div className="w-px h-5 bg-border mx-1" />

      {/* Add execution button - Inline Picker */}
      <AddExecutionButton focusedPaneId={focusedPaneId} />

      {/* Separator */}
      <div className="w-px h-5 bg-border mx-1" />

      {/* Reset button */}
      <button
        onClick={handleReset}
        className={cn(
          'p-1.5 rounded transition-colors',
          'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        title={formatMessage({ id: 'cliViewer.toolbar.clearAll' })}
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>

      {/* Right side - Execution selector & fullscreen */}
      <div className="flex items-center gap-1 ml-auto">
        {/* Execution dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>
                {runningCount > 0
                  ? `${runningCount} ${formatMessage({ id: 'cliViewer.toolbar.running', defaultMessage: 'running' })}`
                  : `${executionCount} ${formatMessage({ id: 'cliViewer.toolbar.executions', defaultMessage: 'executions' })}`}
              </span>
              {runningCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
              <ChevronDown className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuLabel>
              {formatMessage({ id: 'cliViewer.toolbar.executionsList', defaultMessage: 'Recent Executions' })}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.entries(executions).length === 0 ? (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                {formatMessage({ id: 'cliViewer.picker.noExecutions', defaultMessage: 'No executions available' })}
              </div>
            ) : (
              Object.entries(executions)
                .sort((a, b) => b[1].startTime - a[1].startTime)
                .slice(0, 10)
                .map(([id, exec]) => (
                  <DropdownMenuItem
                    key={id}
                    className="flex items-center gap-2 text-xs"
                    onClick={() => {
                      if (focusedPaneId) {
                        const title = `${exec.tool}-${exec.mode}`;
                        addTab(focusedPaneId, id, title);
                      }
                    }}
                  >
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        STATUS_CONFIG[exec.status].color
                      )}
                    />
                    <span className="truncate flex-1">{exec.tool}</span>
                    <span className="text-muted-foreground">{exec.mode}</span>
                  </DropdownMenuItem>
                ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Separator */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* Fullscreen toggle */}
        <button
          onClick={onToggleFullscreen}
          className={cn(
            'p-1.5 rounded transition-colors',
            isFullscreen
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          title={
            isFullscreen
              ? formatMessage({ id: 'cliViewer.toolbar.exitFullscreen', defaultMessage: 'Exit Fullscreen' })
              : formatMessage({ id: 'cliViewer.toolbar.fullscreen', defaultMessage: 'Fullscreen' })
          }
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Page title */}
        <span className="text-xs text-muted-foreground font-medium ml-2">
          {formatMessage({ id: 'cliViewer.page.title' })}
        </span>
      </div>
    </div>
  );
}

// ========== Add Execution Button Sub-Component ==========

function AddExecutionButton({ focusedPaneId }: { focusedPaneId: string | null }) {
  const { formatMessage } = useIntl();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const executions = useCliStreamStore((state) => state.executions);
  const panes = useViewerStore((state) => state.panes);
  const addTab = useViewerStore((state) => state.addTab);

  // Get existing execution IDs in current pane
  const existingExecutionIds = useMemo(() => {
    if (!focusedPaneId) return new Set<string>();
    const pane = panes[focusedPaneId];
    if (!pane) return new Set<string>();
    return new Set(pane.tabs.map((tab) => tab.executionId));
  }, [panes, focusedPaneId]);

  // Filter executions
  const filteredExecutions = useMemo(() => {
    const entries = Object.entries(executions);
    const filtered = entries.filter(([id, exec]) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        id.toLowerCase().includes(query) ||
        exec.tool.toLowerCase().includes(query) ||
        exec.mode.toLowerCase().includes(query)
      );
    });
    filtered.sort((a, b) => b[1].startTime - a[1].startTime);
    return filtered;
  }, [executions, searchQuery]);

  const handleSelect = useCallback((executionId: string, tool: string, mode: string) => {
    if (focusedPaneId) {
      addTab(focusedPaneId, executionId, `${tool}-${mode}`);
      setOpen(false);
      setSearchQuery('');
    }
  }, [focusedPaneId, addTab]);

  if (!focusedPaneId) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors',
            'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{formatMessage({ id: 'cliViewer.toolbar.addExecution', defaultMessage: 'Add' })}</span>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {formatMessage({ id: 'cliViewer.picker.selectExecution', defaultMessage: 'Select Execution' })}
          </DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({
              id: 'cliViewer.picker.searchExecutions',
              defaultMessage: 'Search executions...'
            })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Execution list */}
        <div className="max-h-[300px] overflow-y-auto space-y-2">
          {filteredExecutions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Terminal className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {Object.keys(executions).length === 0
                  ? formatMessage({ id: 'cliViewer.picker.noExecutions', defaultMessage: 'No executions available' })
                  : formatMessage({ id: 'cliViewer.picker.noMatchingExecutions', defaultMessage: 'No matching executions' })}
              </p>
            </div>
          ) : (
            filteredExecutions.map(([id, exec]) => {
              const isAlreadyOpen = existingExecutionIds.has(id);
              return (
                <div key={id} className="relative">
                  <button
                    onClick={() => handleSelect(id, exec.tool, exec.mode)}
                    disabled={isAlreadyOpen}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg',
                      'border border-border/50 bg-muted/30',
                      'hover:bg-muted/50 hover:border-border',
                      'transition-all duration-150',
                      'text-left',
                      isAlreadyOpen && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {/* Tool icon */}
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
                      <Terminal className="h-4 w-4 text-primary" />
                    </div>

                    {/* Execution info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground truncate">
                          {exec.tool}-{exec.mode}
                        </span>
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            STATUS_CONFIG[exec.status].color
                          )}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {id}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(exec.startTime)}</span>
                    </div>
                  </button>
                  {isAlreadyOpen && (
                    <div className="absolute inset-0 bg-background/60 rounded-lg flex items-center justify-center">
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        {formatMessage({ id: 'cliViewer.picker.alreadyOpen', defaultMessage: 'Already open' })}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CliViewerToolbar;
