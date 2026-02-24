// ========================================
// FloatingFileBrowser Component
// ========================================
// Floating file browser panel for Terminal Dashboard.

import * as React from 'react';
import { useIntl } from 'react-intl';
import { Copy, ArrowRightToLine, Loader2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FloatingPanel } from './FloatingPanel';
import { Button } from '@/components/ui/Button';
import { TreeView } from '@/components/shared/TreeView';
import { FilePreview } from '@/components/shared/FilePreview';
import { useFileExplorer, useFileContent } from '@/hooks/useFileExplorer';
import type { FileSystemNode } from '@/types/file-explorer';

export interface FloatingFileBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  rootPath: string;
  onInsertPath?: (path: string) => void;
  initialSelectedPath?: string | null;
  width?: number | string;
}

export function FloatingFileBrowser({
  isOpen,
  onClose,
  rootPath,
  onInsertPath,
  initialSelectedPath = null,
  width = 400,
}: FloatingFileBrowserProps) {
  const { formatMessage } = useIntl();

  const {
    state,
    rootNodes,
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
    enabled: isOpen,
  });

  const selectedPath = state.selectedFile;
  const { content, isLoading: isContentLoading, error: contentError } = useFileContent(selectedPath, {
    enabled: isOpen && !!selectedPath,
  });

  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    if (initialSelectedPath) {
      setSelectedFile(initialSelectedPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialSelectedPath]);

  const handleNodeClick = (node: FileSystemNode) => {
    if (node.type === 'file') {
      setSelectedFile(node.path);
    }
  };

  const handleCopyPath = async () => {
    if (!selectedPath) return;
    try {
      await navigator.clipboard.writeText(selectedPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.error('[FloatingFileBrowser] copy path failed:', err);
    }
  };

  const handleInsert = () => {
    if (!selectedPath) return;
    onInsertPath?.(selectedPath);
  };

  return (
    <FloatingPanel
      isOpen={isOpen}
      onClose={onClose}
      title={formatMessage({ id: 'terminalDashboard.fileBrowser.title' })}
      side="right"
      width={width}
    >
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/20 shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground">
              {selectedPath
                ? formatMessage({ id: 'terminalDashboard.fileBrowser.selected' })
                : formatMessage({ id: 'terminalDashboard.fileBrowser.noSelection' })}
            </div>
            <div className="text-xs font-mono truncate" title={selectedPath ?? undefined}>
              {selectedPath ?? rootPath}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleShowHidden}
              title={formatMessage({ id: 'terminalDashboard.fileBrowser.showHidden' })}
            >
              {state.showHiddenFiles ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => void refetch()}
              disabled={!isOpen || isFetching}
              title={formatMessage({ id: 'common.actions.refresh' })}
            >
              <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCopyPath}
              disabled={!selectedPath}
              title={copied
                ? formatMessage({ id: 'terminalDashboard.fileBrowser.copied' })
                : formatMessage({ id: 'terminalDashboard.fileBrowser.copyPath' })}
            >
              <Copy className="w-4 h-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleInsert}
              disabled={!selectedPath || !onInsertPath}
              title={formatMessage({ id: 'terminalDashboard.fileBrowser.insertPath' })}
            >
              <ArrowRightToLine className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Tree */}
          <div className="w-[240px] shrink-0 border-r border-border overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="ml-2 text-xs">
                  {formatMessage({ id: 'terminalDashboard.fileBrowser.loading' })}
                </span>
              </div>
            ) : error ? (
              <div className="p-3 text-xs text-destructive">
                {formatMessage({ id: 'terminalDashboard.fileBrowser.loadFailed' })}
              </div>
            ) : (
              <TreeView
                nodes={rootNodes}
                expandedPaths={state.expandedPaths}
                selectedPath={state.selectedFile}
                onNodeClick={handleNodeClick}
                onToggle={toggleExpanded}
                maxDepth={0}
                className={cn('py-1')}
              />
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <FilePreview
              fileContent={content}
              isLoading={isContentLoading}
              error={contentError ? String((contentError as any).message ?? contentError) : null}
              className="h-full overflow-auto"
            />
          </div>
        </div>
      </div>
    </FloatingPanel>
  );
}

export default FloatingFileBrowser;
