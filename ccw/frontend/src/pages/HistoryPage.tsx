// ========================================
// HistoryPage Component
// ========================================
// CLI execution history page with filtering and bulk actions
// Includes tabs: Executions + Session Audit (Observability)

import * as React from 'react';
import { useIntl } from 'react-intl';
import {
  Terminal,
  SearchX,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Search,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useAppStore, selectIsImmersiveMode } from '@/stores/appStore';
import { cn } from '@/lib/utils';
import { useHistory } from '@/hooks/useHistory';
import { ConversationCard } from '@/components/shared/ConversationCard';
import { CliStreamPanel } from '@/components/shared/CliStreamPanel';
import { NativeSessionPanel } from '@/components/shared/NativeSessionPanel';
import { ObservabilityPanel } from '@/components/issue/hub/ObservabilityPanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/Dropdown';
import type { CliExecution } from '@/lib/api';

type HistoryTab = 'executions' | 'observability';

/**
 * HistoryPage component - Display CLI execution history
 */
export function HistoryPage() {
  const { formatMessage } = useIntl();
  const [currentTab, setCurrentTab] = React.useState<HistoryTab>('executions');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [toolFilter, setToolFilter] = React.useState<string | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteType, setDeleteType] = React.useState<'single' | 'tool' | 'all' | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = React.useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = React.useState(false);
  const [nativeExecutionId, setNativeExecutionId] = React.useState<string | null>(null);
  const [isNativePanelOpen, setIsNativePanelOpen] = React.useState(false);
  const isImmersiveMode = useAppStore(selectIsImmersiveMode);
  const toggleImmersiveMode = useAppStore((s) => s.toggleImmersiveMode);

  const {
    executions,
    isLoading,
    isFetching,
    error,
    refetch,
    deleteExecution,
    deleteByTool,
    deleteAll,
    isDeleting,
  } = useHistory({
    filter: { search: searchQuery || undefined, tool: toolFilter },
  });

  const tools = React.useMemo(() => {
    const toolSet = new Set(executions.map((e) => e.tool));
    return Array.from(toolSet).sort();
  }, [executions]);

  // Filter handlers
  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setToolFilter(undefined);
  };

  const hasActiveFilters = searchQuery.length > 0 || toolFilter !== undefined;

  // Card click handler - open execution details panel
  const handleCardClick = (execution: CliExecution) => {
    setSelectedExecution(execution.id);
    setIsPanelOpen(true);
  };

  // View native session handler
  const handleViewNative = (execution: CliExecution) => {
    setNativeExecutionId(execution.id);
    setIsNativePanelOpen(true);
  };

  // Delete handlers
  const handleDeleteClick = (id: string) => {
    setDeleteType('single');
    setDeleteTarget(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteByTool = (tool: string) => {
    setDeleteType('tool');
    setDeleteTarget(tool);
    setDeleteDialogOpen(true);
  };

  const handleDeleteAll = () => {
    setDeleteType('all');
    setDeleteTarget(null);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      if (deleteType === 'single' && deleteTarget) {
        await deleteExecution(deleteTarget);
      } else if (deleteType === 'tool' && deleteTarget) {
        await deleteByTool(deleteTarget);
      } else if (deleteType === 'all') {
        await deleteAll();
      }
      setDeleteDialogOpen(false);
      setDeleteType(null);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  return (
    <div className={cn("space-y-6", isImmersiveMode && "h-screen overflow-hidden")}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {formatMessage({ id: 'history.title' })}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'history.description' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleImmersiveMode}
            className={cn(
              'p-2 rounded-md transition-colors',
              isImmersiveMode
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            title={isImmersiveMode ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isImmersiveMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Tabs - matching IssueHubTabs style */}
      <div className="flex gap-2 border-b border-border">
        <Button
          variant="ghost"
          className={cn(
            "border-b-2 rounded-none h-11 px-4",
            currentTab === 'executions'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setCurrentTab('executions')}
        >
          {formatMessage({ id: 'history.tabs.executions' })}
        </Button>
        <Button
          variant="ghost"
          className={cn(
            "border-b-2 rounded-none h-11 px-4",
            currentTab === 'observability'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setCurrentTab('observability')}
        >
          {formatMessage({ id: 'history.tabs.observability' })}
        </Button>
      </div>

      {/* Tab Content */}
      {currentTab === 'executions' && (
        <div className="space-y-4">
          {/* Error alert */}
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
              <Terminal className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{formatMessage({ id: 'common.errors.loadFailed' })}</p>
                <p className="text-xs mt-0.5">{error.message}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                {formatMessage({ id: 'common.actions.retry' })}
              </Button>
            </div>
          )}

          {/* Filters and Actions on same row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Search input */}
            <div className="flex-1 max-w-sm relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={formatMessage({ id: 'history.searchPlaceholder' })}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Tool filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 min-w-[160px] justify-between">
                  {toolFilter || formatMessage({ id: 'history.filterAllTools' })}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => setToolFilter(undefined)}>
                  {formatMessage({ id: 'history.filterAllTools' })}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {tools.map((tool) => (
                  <DropdownMenuItem
                    key={tool}
                    onClick={() => setToolFilter(tool)}
                    className={toolFilter === tool ? 'bg-accent' : ''}
                  >
                    {tool}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                {formatMessage({ id: 'common.actions.clearFilters' })}
              </Button>
            )}

            {/* Actions */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
              {formatMessage({ id: 'common.actions.refresh' })}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {formatMessage({ id: 'history.deleteOptions' })}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{formatMessage({ id: 'history.deleteBy' })}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {tools.map((tool) => (
                  <DropdownMenuItem key={tool} onClick={() => handleDeleteByTool(tool)}>
                    {formatMessage({ id: 'history.deleteAllTool' }, { tool })}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDeleteAll}
                  className="text-destructive focus:text-destructive"
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  {formatMessage({ id: 'history.deleteAll' })}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Executions list */}
          {isLoading ? (
            <div className="grid gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : executions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {hasActiveFilters
                  ? formatMessage({ id: 'history.empty.filtered' })
                  : formatMessage({ id: 'history.empty.title' })}
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                {hasActiveFilters
                  ? formatMessage({ id: 'history.empty.filteredMessage' })
                  : formatMessage({ id: 'history.empty.message' })}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={handleClearFilters} className="mt-4">
                  {formatMessage({ id: 'common.actions.clearFilters' })}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {executions.map((execution) => (
                <ConversationCard
                  key={execution.id}
                  execution={execution}
                  onClick={handleCardClick}
                  onViewNative={handleViewNative}
                  onDelete={handleDeleteClick}
                  actionsDisabled={isDeleting}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {currentTab === 'observability' && (
        <div className="mt-4">
          <ObservabilityPanel />
        </div>
      )}

      {/* CLI Stream Panel */}
      <CliStreamPanel
        executionId={selectedExecution || ''}
        open={isPanelOpen}
        onOpenChange={setIsPanelOpen}
      />

      {/* Native Session Panel */}
      <NativeSessionPanel
        executionId={nativeExecutionId || ''}
        open={isNativePanelOpen}
        onOpenChange={setIsNativePanelOpen}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteType === 'all'
                ? formatMessage({ id: 'history.dialog.deleteAllTitle' })
                : formatMessage({ id: 'history.dialog.deleteTitle' })}
            </DialogTitle>
            <DialogDescription>
              {deleteType === 'all' && formatMessage({ id: 'history.dialog.deleteAllMessage' })}
              {deleteType === 'tool' &&
                formatMessage({ id: 'history.dialog.deleteToolMessage' }, { tool: deleteTarget })}
              {deleteType === 'single' &&
                formatMessage({ id: 'history.dialog.deleteMessage' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              {formatMessage({ id: 'common.actions.cancel' })}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting
                ? formatMessage({ id: 'common.status.deleting' })
                : formatMessage({ id: 'common.actions.delete' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default HistoryPage;
