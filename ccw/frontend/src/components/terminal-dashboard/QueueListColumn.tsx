// ========================================
// QueueListColumn Component
// ========================================
// Queue items list for embedding in the Issues dual-column panel.
// Unified data source: queueSchedulerStore only.
// Includes inline scheduler controls at the bottom.

import { useMemo, useCallback, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  ListChecks,
  Loader2,
  CheckCircle,
  XCircle,
  Zap,
  Ban,
  Square,
  Terminal,
  Timer,
  Clock,
  Play,
  Pause,
  StopCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/AlertDialog';
import { cn } from '@/lib/utils';
import {
  useIssueQueueIntegrationStore,
  selectAssociationChain,
} from '@/stores/issueQueueIntegrationStore';
import {
  useQueueExecutionStore,
  selectByQueueItem,
} from '@/stores/queueExecutionStore';
import {
  useQueueSchedulerStore,
  selectQueueSchedulerStatus,
  selectQueueItems,
  selectSchedulerProgress,
  selectCurrentConcurrency,
  selectSchedulerConfig,
} from '@/stores/queueSchedulerStore';
import type { QueueItem, QueueItemStatus } from '@/types/queue-frontend-types';

// ========== Status Config ==========

const STATUS_CONFIG: Record<QueueItemStatus, {
  variant: 'info' | 'success' | 'destructive' | 'secondary' | 'warning' | 'outline';
  icon: typeof Clock;
  label: string;
}> = {
  pending: { variant: 'secondary', icon: Clock, label: 'Pending' },
  queued: { variant: 'info', icon: Timer, label: 'Queued' },
  ready: { variant: 'info', icon: Zap, label: 'Ready' },
  blocked: { variant: 'outline', icon: Ban, label: 'Blocked' },
  executing: { variant: 'warning', icon: Loader2, label: 'Executing' },
  completed: { variant: 'success', icon: CheckCircle, label: 'Completed' },
  failed: { variant: 'destructive', icon: XCircle, label: 'Failed' },
  cancelled: { variant: 'secondary', icon: Square, label: 'Cancelled' },
};

// ========== Scheduler Status Styles ==========

const SCHEDULER_STATUS_STYLE: Record<string, string> = {
  idle: 'bg-muted text-muted-foreground',
  running: 'bg-blue-500/15 text-blue-600',
  paused: 'bg-yellow-500/15 text-yellow-600',
  stopping: 'bg-orange-500/15 text-orange-600',
  completed: 'bg-green-500/15 text-green-600',
  failed: 'bg-red-500/15 text-red-600',
};

// ========== Item Row ==========

function QueueItemRow({
  item,
  isHighlighted,
  onSelect,
}: {
  item: QueueItem;
  isHighlighted: boolean;
  onSelect: () => void;
}) {
  const { formatMessage } = useIntl();
  const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  const executions = useQueueExecutionStore(selectByQueueItem(item.item_id));
  const activeExec = executions.find((e) => e.status === 'running') ?? executions[0];
  const sessionKey = item.sessionKey ?? activeExec?.sessionKey;

  const isExecuting = item.status === 'executing';
  const isBlocked = item.status === 'blocked';

  // Show issue_id if available (for items added from IssuePanel)
  const displayId = item.issue_id ? `${item.issue_id}` : item.item_id;

  return (
    <button
      type="button"
      className={cn(
        'w-full text-left px-2.5 py-1.5 rounded-md transition-colors',
        'hover:bg-muted/60 focus:outline-none focus:ring-1 focus:ring-primary/30',
        isHighlighted && 'bg-accent/50 ring-1 ring-accent/30',
        isExecuting && 'border-l-2 border-l-blue-500'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <StatusIcon
            className={cn(
              'w-3 h-3 shrink-0',
              isExecuting && 'animate-spin'
            )}
          />
          <span className="text-xs font-medium text-foreground truncate font-mono">
            {displayId}
          </span>
        </div>
        <Badge variant={config.variant} className="text-[10px] px-1 py-0 shrink-0">
          {formatMessage({ id: `terminalDashboard.queuePanel.status.${item.status}`, defaultMessage: config.label })}
        </Badge>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground pl-4">
        {item.execution_group && <span>{item.execution_group}</span>}
        {sessionKey && (
          <>
            <span className="text-border">|</span>
            <span className="flex items-center gap-0.5">
              <Terminal className="w-2.5 h-2.5" />
              {sessionKey}
            </span>
          </>
        )}
      </div>
      {isBlocked && item.depends_on.length > 0 && (
        <div className="mt-0.5 text-[10px] text-orange-500/80 pl-4 truncate">
          {formatMessage(
            { id: 'terminalDashboard.queuePanel.blockedBy', defaultMessage: 'Blocked by: {deps}' },
            { deps: item.depends_on.join(', ') }
          )}
        </div>
      )}
    </button>
  );
}

// ========== Inline Scheduler Controls ==========

function SchedulerBar() {
  const { formatMessage } = useIntl();
  const status = useQueueSchedulerStore(selectQueueSchedulerStatus);
  const progress = useQueueSchedulerStore(selectSchedulerProgress);
  const concurrency = useQueueSchedulerStore(selectCurrentConcurrency);
  const config = useQueueSchedulerStore(selectSchedulerConfig);
  const startQueue = useQueueSchedulerStore((s) => s.startQueue);
  const pauseQueue = useQueueSchedulerStore((s) => s.pauseQueue);
  const stopQueue = useQueueSchedulerStore((s) => s.stopQueue);
  const items = useQueueSchedulerStore(selectQueueItems);

  const canStart = status === 'idle' && items.length > 0;
  const canPause = status === 'running';
  const canResume = status === 'paused';
  const canStop = status === 'running' || status === 'paused';
  const isActive = status !== 'idle';

  const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false);

  const handleStart = useCallback(() => {
    if (canResume) {
      startQueue();
    } else if (canStart) {
      startQueue(items);
    }
  }, [canResume, canStart, startQueue, items]);

  return (
    <div className="border-t border-border px-2.5 py-1.5 shrink-0">
      <div className="flex items-center justify-between gap-2">
        {/* Status badge */}
        <Badge
          variant="outline"
          className={cn('text-[10px] px-1.5 py-0', SCHEDULER_STATUS_STYLE[status])}
        >
          {formatMessage({ id: `terminalDashboard.queuePanel.scheduler.status.${status}`, defaultMessage: status })}
        </Badge>

        {/* Progress + Concurrency */}
        {isActive && (
          <span className="text-[10px] text-muted-foreground">
            {progress}% | {concurrency}/{config?.maxConcurrentSessions ?? 2}
          </span>
        )}

        {/* Controls */}
        <div className="flex items-center gap-0.5">
          {(canStart || canResume) && (
            <button
              type="button"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={handleStart}
              title={formatMessage({ id: 'terminalDashboard.queuePanel.scheduler.start', defaultMessage: 'Start' })}
            >
              <Play className="w-3 h-3" />
            </button>
          )}
          {canPause && (
            <button
              type="button"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={pauseQueue}
              title={formatMessage({ id: 'terminalDashboard.queuePanel.scheduler.pause', defaultMessage: 'Pause' })}
            >
              <Pause className="w-3 h-3" />
            </button>
          )}
          {canStop && (
            <button
              type="button"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={() => setIsStopConfirmOpen(true)}
              title={formatMessage({ id: 'terminalDashboard.queuePanel.scheduler.stop', defaultMessage: 'Stop' })}
            >
              <StopCircle className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {isActive && (
        <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Stop confirmation dialog */}
      <AlertDialog open={isStopConfirmOpen} onOpenChange={setIsStopConfirmOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              {formatMessage({ id: 'terminalDashboard.queuePanel.scheduler.stopConfirmTitle', defaultMessage: 'Stop Queue?' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {formatMessage({ id: 'terminalDashboard.queuePanel.scheduler.stopConfirmMessage', defaultMessage: 'Executing tasks will finish, but no new tasks will be started.' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">
              {formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { stopQueue(); setIsStopConfirmOpen(false); }}
            >
              {formatMessage({ id: 'terminalDashboard.queuePanel.scheduler.stop', defaultMessage: 'Stop' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ========== Main Component ==========

export function QueueListColumn() {
  const { formatMessage } = useIntl();

  const items = useQueueSchedulerStore(selectQueueItems);
  const associationChain = useIssueQueueIntegrationStore(selectAssociationChain);
  const buildAssociationChain = useIssueQueueIntegrationStore((s) => s.buildAssociationChain);

  // NOTE: loadInitialState is called from a parent component or app initialization
  // to avoid infinite loop issues with Zustand selectors

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.execution_order - b.execution_order),
    [items]
  );

  const handleSelect = useCallback(
    (queueItemId: string) => {
      buildAssociationChain(queueItemId, 'queue');
    },
    [buildAssociationChain]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Item list */}
      {sortedItems.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground p-3">
          <div className="text-center">
            <ListChecks className="h-5 w-5 mx-auto mb-1 opacity-30" />
            <p className="text-xs">{formatMessage({ id: 'terminalDashboard.queuePanel.noItems' })}</p>
            <p className="text-[10px] mt-0.5 opacity-70">
              {formatMessage({ id: 'terminalDashboard.queuePanel.noItemsDesc', defaultMessage: 'Select issues and click Queue to add items' })}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-1 space-y-0.5">
          {sortedItems.map((item) => (
            <QueueItemRow
              key={item.item_id}
              item={item}
              isHighlighted={associationChain?.queueItemId === item.item_id}
              onSelect={() => handleSelect(item.item_id)}
            />
          ))}
        </div>
      )}

      {/* Inline scheduler controls */}
      <SchedulerBar />
    </div>
  );
}
