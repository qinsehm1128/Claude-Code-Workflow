// ========================================
// Queue Panel
// ========================================
// Content panel for Queue tab in IssueHub

import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  ListTodo,
  GitMerge,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { QueueCard } from '@/components/issue/queue/QueueCard';
import { QueueBoard } from '@/components/issue/queue/QueueBoard';
import { SolutionDrawer } from '@/components/issue/queue/SolutionDrawer';
import { useIssueQueue, useIssueQueueById, useQueueHistory, useQueueMutations } from '@/hooks';
import type { QueueItem } from '@/lib/api';

// ========== Loading Skeleton ==========

function QueuePanelSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <div className="h-6 bg-muted animate-pulse rounded w-16 mb-2" />
            <div className="h-4 bg-muted animate-pulse rounded w-24" />
          </Card>
        ))}
      </div>

      {/* Queue Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i} className="p-4">
            <div className="h-6 bg-muted animate-pulse rounded w-32 mb-4" />
            <div className="h-4 bg-muted animate-pulse rounded w-full mb-2" />
            <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
          </Card>
        ))}
      </div>
    </div>
  );
}

// ========== Empty State ==========

function QueueEmptyState() {
  const { formatMessage } = useIntl();

  return (
    <Card className="p-12 text-center">
      <AlertCircle className="w-16 h-16 mx-auto text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-medium text-foreground">
        {formatMessage({ id: 'issues.queue.emptyState.title' })}
      </h3>
      <p className="mt-2 text-muted-foreground">
        {formatMessage({ id: 'issues.queue.emptyState.description' })}
      </p>
    </Card>
  );
}

// ========== Main Panel Component ==========

export function QueuePanel() {
  const { formatMessage } = useIntl();
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [selectedQueueId, setSelectedQueueId] = useState<string>('');

  const activeQueueQuery = useIssueQueue();
  const { data: historyIndex } = useQueueHistory();
  const selectedQueueQuery = useIssueQueueById(selectedQueueId);
  const {
    activateQueue,
    deactivateQueue,
    deleteQueue,
    mergeQueues,
    splitQueue,
    isActivating,
    isDeactivating,
    isDeleting,
    isMerging,
    isSplitting,
  } = useQueueMutations();

  const queue = selectedQueueId && selectedQueueQuery.data ? selectedQueueQuery.data : activeQueueQuery.data;
  const isLoading =
    activeQueueQuery.isLoading ||
    (selectedQueueId ? selectedQueueQuery.isLoading && !selectedQueueQuery.data : false);
  const error = activeQueueQuery.error || selectedQueueQuery.error;

  const taskCount = queue?.tasks?.length || 0;
  const solutionCount = queue?.solutions?.length || 0;
  const conflictCount = queue?.conflicts?.length || 0;
  const groupCount = Object.keys(queue?.grouped_items || {}).length;
  const totalItems = taskCount + solutionCount;
  const activeQueueId = historyIndex?.active_queue_id || null;
  const activeQueueIds = historyIndex?.active_queue_ids || [];
  const queueId = queue?.id;

  // Keep selector in sync with active queue id
  useEffect(() => {
    if (selectedQueueId) return;
    if (activeQueueId) setSelectedQueueId(activeQueueId);
    else if (queueId) setSelectedQueueId(queueId);
  }, [activeQueueId, queueId, selectedQueueId]);

  const handleActivate = async (queueId: string) => {
    try {
      await activateQueue(queueId);
    } catch (err) {
      console.error('Failed to activate queue:', err);
    }
  };

  const handleDeactivate = async () => {
    try {
      await deactivateQueue();
    } catch (err) {
      console.error('Failed to deactivate queue:', err);
    }
  };

  const handleDelete = async (queueId: string) => {
    try {
      await deleteQueue(queueId);
    } catch (err) {
      console.error('Failed to delete queue:', err);
    }
  };

  const handleMerge = async (sourceId: string, targetId: string) => {
    try {
      await mergeQueues(sourceId, targetId);
    } catch (err) {
      console.error('Failed to merge queues:', err);
    }
  };

  const handleSplit = async (sourceQueueId: string, itemIds: string[]) => {
    try {
      await splitQueue(sourceQueueId, itemIds);
    } catch (err) {
      console.error('Failed to split queue:', err);
    }
  };

  const handleItemClick = (item: QueueItem) => {
    setSelectedItem(item);
  };

  const handleCloseDrawer = () => {
    setSelectedItem(null);
  };

  if (isLoading) {
    return <QueuePanelSkeleton />;
  }

  if (error) {
    return (
      <Card className="p-12 text-center">
        <AlertCircle className="w-16 h-16 mx-auto text-destructive/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">
          {formatMessage({ id: 'issues.queue.error.title' })}
        </h3>
        <p className="mt-2 text-muted-foreground">
          {(error as Error).message || formatMessage({ id: 'issues.queue.error.message' })}
        </p>
      </Card>
    );
  }

  if (!queue || totalItems === 0) {
    return <QueueEmptyState />;
  }

  // Check if queue is active (multi-queue index preferred)
  const isActive = queueId ? activeQueueIds.includes(queueId) : totalItems > 0 && conflictCount === 0;

  return (
    <div className="space-y-6">
      {/* Queue History / Active Queue Selector */}
      {historyIndex && (
        <Card className="p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">
                {formatMessage({ id: 'issues.queue.history.title' })}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                {formatMessage({ id: 'issues.queue.history.active' })}:{' '}
                {activeQueueId || '—'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedQueueId} onValueChange={(v) => setSelectedQueueId(v)}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder={formatMessage({ id: 'issues.queue.history.select' })} />
                </SelectTrigger>
                <SelectContent>
                  {(historyIndex.queues || []).length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      {formatMessage({ id: 'issues.queue.history.empty' })}
                    </SelectItem>
                  ) : (
                    historyIndex.queues.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={!selectedQueueId || isActivating}
                onClick={() => activateQueue(selectedQueueId)}
              >
                {formatMessage({ id: 'issues.queue.history.activate' })}
              </Button>
              <Button
                variant="outline"
                disabled={isDeactivating}
                onClick={() => deactivateQueue()}
              >
                {formatMessage({ id: 'issues.queue.actions.deactivate' })}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-info" />
            <span className="text-2xl font-bold">{totalItems}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'issues.queue.stats.totalItems' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-warning" />
            <span className="text-2xl font-bold">{groupCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'issues.queue.stats.groups' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning" />
            <span className="text-2xl font-bold">{taskCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'issues.queue.stats.tasks' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            <span className="text-2xl font-bold">{solutionCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'issues.queue.stats.solutions' })}
          </p>
        </Card>
      </div>

      {/* Conflicts Warning */}
      {conflictCount > 0 && (
        <Card className="p-4 border-destructive/50 bg-destructive/5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-destructive">
                {formatMessage({ id: 'issues.queue.conflicts.title' })}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {conflictCount} {formatMessage({ id: 'issues.queue.conflicts.description' })}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Queue Card (actions + summary) */}
      <QueueCard
        key={queue.id || 'legacy'}
        queue={queue}
        isActive={isActive}
        onActivate={handleActivate}
        onDeactivate={handleDeactivate}
        onDelete={handleDelete}
        onMerge={handleMerge}
        onSplit={handleSplit}
        onItemClick={handleItemClick}
        isActivating={isActivating}
        isDeactivating={isDeactivating}
        isDeleting={isDeleting}
        isMerging={isMerging}
        isSplitting={isSplitting}
      />

      {/* Queue Board (DnD reorder/move) */}
      <QueueBoard queue={queue} onItemClick={handleItemClick} />

      {/* Solution Detail Drawer */}
      <SolutionDrawer
        item={selectedItem}
        isOpen={selectedItem !== null}
        onClose={handleCloseDrawer}
      />

      {/* Status Footer */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isActive ? (
            <>
              <CheckCircle className="w-4 h-4 text-success" />
              {formatMessage({ id: 'issues.queue.status.ready' })}
            </>
          ) : (
            <>
              <Clock className="w-4 h-4 text-warning" />
              {formatMessage({ id: 'issues.queue.status.pending' })}
            </>
          )}
        </div>
        <Badge variant={isActive ? 'success' : 'secondary'} className="gap-1">
          {isActive ? (
            <CheckCircle className="w-3 h-3" />
          ) : (
            <Clock className="w-3 h-3" />
          )}
          {isActive
            ? formatMessage({ id: 'issues.queue.status.active' })
            : formatMessage({ id: 'issues.queue.status.inactive' })
          }
        </Badge>
      </div>
    </div>
  );
}
