// ========================================
// FileSidebarPanel Component
// ========================================
// Right sidebar file browser for Terminal Dashboard.
// Displays file tree and allows showing files in focused terminal pane.

import * as React from 'react';
import { useIntl } from 'react-intl';
import { FolderOpen, RefreshCw, Loader2, ChevronLeft, FileText, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { TreeView } from '@/components/shared/TreeView';
import { useFileExplorer } from '@/hooks/useFileExplorer';
import { useTerminalGridStore, selectTerminalGridFocusedPaneId } from '@/stores/terminalGridStore';
import type { FileSystemNode } from '@/types/file-explorer';

export interface FileSidebarPanelProps {
  /** Root path for file explorer */
  rootPath: string;
  /** Whether the panel is enabled (has project path) */
  enabled?: boolean;
  /** Optional class name */
  className?: string;
  /** Callback when panel collapse is requested */
  onCollapse?: () => void;
  /** Initial width of the panel */
  width?: number;
}

export function FileSidebarPanel({
  rootPath,
  enabled = true,
  className,
  onCollapse,
  width = 280,
}: FileSidebarPanelProps) {
  const { formatMessage } = useIntl();

  // Store
  const focusedPaneId = useTerminalGridStore(selectTerminalGridFocusedPaneId);
  const showFileInPane = useTerminalGridStore((s) => s.showFileInPane);

  // File explorer hook
  const {
    rootNodes,
    state,
    isLoading,
    isFetching,
    error,
    refetch,
    setSelectedFile,
    toggleExpanded,
    toggleShowHidden,
  } = useFileExplorer({
    rootPath,
    maxDepth: 6,
    enabled,
  });

  // Handle node click
  const handleNodeClick = React.useCallback(
    (node: FileSystemNode) => {
      // Only files can be shown in pane
      if (node.type === 'file') {
        setSelectedFile(node.path);
        // Show file in focused pane if one exists
        if (focusedPaneId) {
          showFileInPane(focusedPaneId, node.path);
        }
      }
    },
    [focusedPaneId, setSelectedFile, showFileInPane]
  );

  // Handle refresh
  const handleRefresh = React.useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle collapse
  const handleCollapse = React.useCallback(() => {
    onCollapse?.();
  }, [onCollapse]);

  // Disabled state (no project path)
  if (!enabled) {
    return (
      <div
        className={cn(
          'flex flex-col h-full border-l border-border bg-background',
          className
        )}
        style={{ width }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground">
            {formatMessage({ id: 'terminalDashboard.fileSidebar.title', defaultMessage: 'Files' })}
          </span>
          {onCollapse && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleCollapse}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center text-muted-foreground">
          <FolderOpen className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-xs">
            {formatMessage({ id: 'terminalDashboard.fileSidebar.noProject', defaultMessage: 'No project open' })}
          </p>
          <p className="text-[10px] mt-1 opacity-70">
            {formatMessage({ id: 'terminalDashboard.fileSidebar.openProjectHint', defaultMessage: 'Open a project to browse files' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full border-l border-border bg-background',
        className
      )}
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium truncate">
            {formatMessage({ id: 'terminalDashboard.fileSidebar.title', defaultMessage: 'Files' })}
          </span>
          {isFetching && !isLoading && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={toggleShowHidden}
            title={formatMessage({ id: 'terminalDashboard.fileBrowser.showHidden' })}
          >
            {state.showHiddenFiles ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleRefresh}
            disabled={isFetching}
            title={formatMessage({ id: 'terminalDashboard.fileSidebar.refresh', defaultMessage: 'Refresh' })}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          </Button>
          {onCollapse && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleCollapse}
              title={formatMessage({ id: 'terminalDashboard.fileSidebar.collapse', defaultMessage: 'Collapse' })}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Current path indicator */}
      <div className="px-3 py-1.5 border-b border-border/50 bg-muted/10 shrink-0">
        <div className="text-[10px] text-muted-foreground truncate font-mono" title={rootPath}>
          {rootPath}
        </div>
      </div>

      {/* Tree view */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="ml-2 text-xs">
              {formatMessage({ id: 'terminalDashboard.fileBrowser.loading', defaultMessage: 'Loading...' })}
            </span>
          </div>
        ) : error ? (
          <div className="p-3 text-xs text-destructive">
            {formatMessage({ id: 'terminalDashboard.fileBrowser.loadFailed', defaultMessage: 'Failed to load files' })}
          </div>
        ) : rootNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-xs">
              {formatMessage({ id: 'terminalDashboard.fileSidebar.empty', defaultMessage: 'No files found' })}
            </p>
          </div>
        ) : (
          <TreeView
            nodes={rootNodes}
            expandedPaths={state.expandedPaths}
            selectedPath={state.selectedFile}
            onNodeClick={handleNodeClick}
            onToggle={toggleExpanded}
            maxDepth={0}
            className="py-1"
          />
        )}
      </div>

      {/* Footer hint */}
      {!focusedPaneId && (
        <div className="px-3 py-2 border-t border-border bg-muted/10 shrink-0">
          <p className="text-[10px] text-muted-foreground text-center">
            {formatMessage({ id: 'terminalDashboard.fileSidebar.selectPaneHint', defaultMessage: 'Click a pane to show file preview' })}
          </p>
        </div>
      )}
    </div>
  );
}

export default FileSidebarPanel;
