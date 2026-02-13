// ========================================
// PromptHistoryPage Component
// ========================================
// Prompt history page with timeline, stats, and AI insights

import * as React from 'react';
import { useIntl } from 'react-intl';
import {
  RefreshCw,
  Search,
  Filter,
  AlertCircle,
  History,
  X,
  FolderOpen,
} from 'lucide-react';
import {
  usePromptHistory,
  usePromptInsights,
  useInsightsHistory,
  usePromptHistoryMutations,
  useDeleteInsight,
  extractUniqueProjects,
  type PromptHistoryFilter,
} from '@/hooks/usePromptHistory';
import { PromptStats, PromptStatsSkeleton } from '@/components/shared/PromptStats';
import { PromptCard } from '@/components/shared/PromptCard';
import { BatchOperationToolbar } from '@/components/shared/BatchOperationToolbar';
import { InsightsPanel } from '@/components/shared/InsightsPanel';
import { InsightsHistoryList } from '@/components/shared/InsightsHistoryList';
import { InsightDetailPanelOverlay } from '@/components/shared/InsightDetailPanel';
import { fetchInsightDetail } from '@/lib/api';
import type { InsightHistory } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
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
import { cn } from '@/lib/utils';

type IntentFilter = 'all' | string;

/**
 * PromptHistoryPage component - Main page for prompt history management
 */
export function PromptHistoryPage() {
  const { formatMessage } = useIntl();

  // Filter state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [intentFilter, setIntentFilter] = React.useState<IntentFilter>('all');
  const [projectFilter, setProjectFilter] = React.useState<string>('all');
  const [selectedTool, setSelectedTool] = React.useState<'gemini' | 'qwen' | 'codex'>('gemini');

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [promptToDelete, setPromptToDelete] = React.useState<string | null>(null);

  // Insight detail state
  const [selectedInsight, setSelectedInsight] = React.useState<InsightHistory | null>(null);
  const [, setInsightDetailOpen] = React.useState(false);

  // Batch operations state
  const [selectedPromptIds, setSelectedPromptIds] = React.useState<Set<string>>(new Set());
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = React.useState(false);

  // Build filter object
  const filter: PromptHistoryFilter = React.useMemo(
    () => ({
      search: searchQuery,
      intent: intentFilter === 'all' ? undefined : intentFilter,
      project: projectFilter === 'all' ? undefined : projectFilter,
    }),
    [searchQuery, intentFilter, projectFilter]
  );

  // Fetch prompts and insights
  const {
    prompts,
    allPrompts,
    promptsBySession,
    stats,
    isLoading,
    isFetching,
    error,
    refetch,
  } = usePromptHistory({ filter });

  const { data: insightsData, isLoading: insightsLoading } = usePromptInsights();
  const { data: insightsHistoryData, isLoading: insightsHistoryLoading } = useInsightsHistory({ limit: 20 });

  const { analyzePrompts, deletePrompt, batchDeletePrompts, isAnalyzing, isBatchDeleting } = usePromptHistoryMutations();
  const { deleteInsight: deleteInsightMutation, isDeleting: isDeletingInsight } = useDeleteInsight();

  const isMutating = isAnalyzing || isBatchDeleting;

  // Extract unique projects from all prompts
  const uniqueProjects = React.useMemo(
    () => extractUniqueProjects(allPrompts),
    [allPrompts]
  );

  // Handlers
  const handleAnalyze = async () => {
    try {
      await analyzePrompts({ tool: selectedTool });
    } catch (err) {
      console.error('Failed to analyze prompts:', err);
    }
  };

  const handleDeleteClick = (promptId: string) => {
    setPromptToDelete(promptId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!promptToDelete) return;

    try {
      await deletePrompt(promptToDelete);
      setDeleteDialogOpen(false);
      setPromptToDelete(null);
    } catch (err) {
      console.error('Failed to delete prompt:', err);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleInsightSelect = async (insightId: string) => {
    try {
      const insight = await fetchInsightDetail(insightId);
      setSelectedInsight(insight);
      setInsightDetailOpen(true);
    } catch (err) {
      console.error('Failed to fetch insight detail:', err);
    }
  };

  const handleDeleteInsight = async (insightId: string) => {
    const locale = useIntl().locale;
    const confirmMessage = locale === 'zh'
      ? '确定要删除此分析吗？此操作无法撤销。'
      : 'Are you sure you want to delete this insight? This action cannot be undone.';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await deleteInsightMutation(insightId);
      setInsightDetailOpen(false);
      setSelectedInsight(null);
      // Show success toast
      const successMessage = locale === 'zh' ? '洞察已删除' : 'Insight deleted';
      if ((window as any).showToast) {
        (window as any).showToast(successMessage, 'success');
      }
    } catch (err) {
      console.error('Failed to delete insight:', err);
      // Show error toast
      const errorMessage = locale === 'zh' ? '删除洞察失败' : 'Failed to delete insight';
      if ((window as any).showToast) {
        (window as any).showToast(errorMessage, 'error');
      }
    }
  };

  const toggleIntentFilter = (intent: string) => {
    setIntentFilter((prev) => (prev === intent ? 'all' : intent));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setIntentFilter('all');
    setProjectFilter('all');
  };

  // Batch operations handlers
  const handleSelectPrompt = (promptId: string, selected: boolean) => {
    setSelectedPromptIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(promptId);
      } else {
        next.delete(promptId);
      }
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedPromptIds(new Set(prompts.map((p) => p.id)));
    } else {
      setSelectedPromptIds(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedPromptIds(new Set());
  };

  const handleBatchDeleteClick = () => {
    if (selectedPromptIds.size > 0) {
      setBatchDeleteDialogOpen(true);
    }
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedPromptIds.size === 0) return;

    try {
      await batchDeletePrompts(Array.from(selectedPromptIds));
      setBatchDeleteDialogOpen(false);
      setSelectedPromptIds(new Set());
    } catch (err) {
      console.error('Failed to batch delete prompts:', err);
    }
  };

  const hasActiveFilters = searchQuery.length > 0 || intentFilter !== 'all' || projectFilter !== 'all';

  // Group prompts for timeline view
  const timelineGroups = React.useMemo(() => {
    const groups: Array<{ key: string; label: string; prompts: typeof prompts }> = [];

    // Group by session if available, otherwise by date
    const sessionKeys = Object.keys(promptsBySession);
    if (sessionKeys.length > 0 && sessionKeys.some((k) => k !== 'ungrouped')) {
      // Session-based grouping
      for (const [sessionKey, sessionPrompts] of Object.entries(promptsBySession)) {
        const filtered = sessionPrompts.filter((p) =>
          prompts.some((fp) => fp.id === p.id)
        );
        if (filtered.length > 0) {
          groups.push({
            key: sessionKey,
            label: sessionKey === 'ungrouped'
              ? formatMessage({ id: 'prompts.timeline.ungrouped' })
              : formatMessage({ id: 'prompts.timeline.session' }, { session: sessionKey }),
            prompts: filtered,
          });
        }
      }
    } else {
      // Date-based grouping
      const dateGroups: Record<string, typeof prompts> = {};
      for (const prompt of prompts) {
        const date = new Date(prompt.createdAt).toLocaleDateString();
        if (!dateGroups[date]) {
          dateGroups[date] = [];
        }
        dateGroups[date].push(prompt);
      }
      for (const [date, datePrompts] of Object.entries(dateGroups)) {
        groups.push({ key: date, label: date, prompts: datePrompts });
      }
    }

    return groups.sort((a, b) => {
      const aDate = a.prompts[0]?.createdAt ? new Date(a.prompts[0].createdAt).getTime() : 0;
      const bDate = b.prompts[0]?.createdAt ? new Date(b.prompts[0].createdAt).getTime() : 0;
      return bDate - aDate;
    });
  }, [prompts, promptsBySession, formatMessage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <History className="h-6 w-6" />
            {formatMessage({ id: 'prompts.title' })}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'prompts.description' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">{formatMessage({ id: 'common.errors.loadFailed' })}</p>
            <p className="text-xs mt-0.5">{error.message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {formatMessage({ id: 'home.errors.retry' })}
          </Button>
        </div>
      )}

      {/* Stats */}
      {isLoading ? <PromptStatsSkeleton /> : <PromptStats {...stats} />}

      {/* Main content area with timeline and insights */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Timeline section */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Search input */}
            <div className="flex-1 max-w-sm relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={formatMessage({ id: 'prompts.searchPlaceholder' })}
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

            {/* Intent filter dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  {formatMessage({ id: 'common.actions.filter' })}
                  {(intentFilter !== 'all' || projectFilter !== 'all') && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
                      {(intentFilter !== 'all' ? 1 : 0) + (projectFilter !== 'all' ? 1 : 0)}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{formatMessage({ id: 'prompts.filterByIntent' })}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIntentFilter('all')}
                  className="justify-between"
                >
                  <span>{formatMessage({ id: 'prompts.intents.all' })}</span>
                  {intentFilter === 'all' && <span className="text-primary">&#10003;</span>}
                </DropdownMenuItem>
                {['bug-fix', 'feature', 'refactor', 'document', 'analyze'].map((intent) => (
                  <DropdownMenuItem
                    key={intent}
                    onClick={() => toggleIntentFilter(intent)}
                    className="justify-between"
                  >
                    <span>{formatMessage({ id: `prompts.intents.${intent}` })}</span>
                    {intentFilter === intent && <span className="text-primary">&#10003;</span>}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{formatMessage({ id: 'prompts.filterByProject' })}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setProjectFilter('all')}
                  className="justify-between"
                >
                  <span>{formatMessage({ id: 'prompts.projects.all' })}</span>
                  {projectFilter === 'all' && <span className="text-primary">&#10003;</span>}
                </DropdownMenuItem>
                {uniqueProjects.map((project) => (
                  <DropdownMenuItem
                    key={project}
                    onClick={() => setProjectFilter(project)}
                    className="justify-between"
                  >
                    <span className="truncate max-w-32" title={project}>{project}</span>
                    {projectFilter === project && <span className="text-primary">&#10003;</span>}
                  </DropdownMenuItem>
                ))}
                {hasActiveFilters && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={clearFilters} className="text-destructive">
                      {formatMessage({ id: 'common.actions.clearFilters' })}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Active filters display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">{formatMessage({ id: 'common.actions.filters' })}:</span>
              {intentFilter !== 'all' && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => setIntentFilter('all')}
                >
                  {formatMessage({ id: 'prompts.intents.intent' })}: {intentFilter}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              )}
              {projectFilter !== 'all' && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => setProjectFilter('all')}
                >
                  {formatMessage({ id: 'prompts.projects.project' })}: {projectFilter}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              )}
              {searchQuery && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={handleClearSearch}
                >
                  {formatMessage({ id: 'common.actions.search' })}: {searchQuery}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs">
                {formatMessage({ id: 'common.actions.clearAll' })}
              </Button>
            </div>
          )}

          {/* Batch operations toolbar */}
          <BatchOperationToolbar
            selectedCount={selectedPromptIds.size}
            allSelected={prompts.length > 0 && selectedPromptIds.size === prompts.length}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onDelete={handleBatchDeleteClick}
            isDeleting={isBatchDeleting}
          />

          {/* Timeline */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-lg border border-border animate-pulse">
                  <div className="h-4 w-32 bg-muted rounded mb-2" />
                  <div className="h-20 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : timelineGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-border rounded-lg">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                {hasActiveFilters
                  ? formatMessage({ id: 'prompts.emptyState.title' })
                  : formatMessage({ id: 'prompts.emptyState.noPrompts' })}
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                {hasActiveFilters
                  ? formatMessage({ id: 'prompts.emptyState.message' })
                  : formatMessage({ id: 'prompts.emptyState.createFirst' })}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  {formatMessage({ id: 'common.actions.clearFilters' })}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {timelineGroups.map((group) => (
                <div key={group.key} className="space-y-3">
                  {/* Group header */}
                  <div className="flex items-center gap-2">
                    <div className="h-px bg-border flex-1" />
                    <h3 className="text-sm font-medium text-muted-foreground px-2">
                      {group.label}
                    </h3>
                    <div className="h-px bg-border flex-1" />
                  </div>

                  {/* Prompt cards in group */}
                  <div className="space-y-2">
                    {group.prompts.map((prompt) => (
                      <PromptCard
                        key={prompt.id}
                        prompt={prompt}
                        onDelete={handleDeleteClick}
                        actionsDisabled={isMutating}
                        selected={selectedPromptIds.has(prompt.id)}
                        onSelectChange={handleSelectPrompt}
                        selectionMode={selectedPromptIds.size > 0 || prompts.some(p => selectedPromptIds.has(p.id))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Insights panel */}
        <div className="lg:col-span-1 space-y-4">
          <InsightsPanel
            insights={insightsData?.insights}
            patterns={insightsData?.patterns}
            suggestions={insightsData?.suggestions}
            selectedTool={selectedTool}
            onToolChange={setSelectedTool}
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing || insightsLoading}
            className="sticky top-4"
          />
          <InsightsHistoryList
            insights={insightsHistoryData?.insights}
            isLoading={insightsHistoryLoading}
            onInsightSelect={handleInsightSelect}
          />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formatMessage({ id: 'prompts.dialog.deleteTitle' })}</DialogTitle>
            <DialogDescription>
              {formatMessage({ id: 'prompts.dialog.deleteConfirm' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setPromptToDelete(null);
              }}
            >
              {formatMessage({ id: 'common.actions.cancel' })}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isAnalyzing}
            >
              {formatMessage({ id: 'common.actions.delete' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Delete Confirmation Dialog */}
      <Dialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formatMessage({ id: 'prompts.dialog.batchDeleteTitle' })}</DialogTitle>
            <DialogDescription>
              {formatMessage({ id: 'prompts.dialog.batchDeleteConfirm' }, { count: selectedPromptIds.size })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBatchDeleteDialogOpen(false);
              }}
              disabled={isBatchDeleting}
            >
              {formatMessage({ id: 'common.actions.cancel' })}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmBatchDelete}
              disabled={isBatchDeleting}
            >
              {isBatchDeleting ? formatMessage({ id: 'common.actions.deleting' }, { defaultValue: 'Deleting...' }) : formatMessage({ id: 'common.actions.delete' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insight Detail Panel Overlay */}
      <InsightDetailPanelOverlay
        insight={selectedInsight}
        onClose={() => {
          setInsightDetailOpen(false);
          setSelectedInsight(null);
        }}
        onDelete={handleDeleteInsight}
        isDeleting={isDeletingInsight}
        showOverlay={true}
      />
    </div>
  );
}

export default PromptHistoryPage;
