// ========================================
// QueuePanel Component
// ========================================
// Queue list panel for the terminal dashboard with tab switching.
// Tab 1 (Queue): Issue queue items from queueSchedulerStore (with useIssueQueue() fallback).
// Tab 2 (Orchestrator): Active orchestration plans from orchestratorStore.
// Integrates with issueQueueIntegrationStore for association chain.
// Note: Scheduler controls are in the standalone SchedulerPanel.

import { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  ListChecks,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
  Ban,
  Terminal,
  Workflow,
  Circle,
  CheckCircle2,
  SkipForward,
  Pause,
  Play,
  Square,
  RotateCcw,
  AlertCircle,
  Timer,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useIssueQueue } from '@/hooks/useIssues';
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
} from '@/stores/queueSchedulerStore';
import {
  useOrchestratorStore,
  selectActivePlans,
  selectActivePlanCount,
  type OrchestrationRunState,
} from '@/stores/orchestratorStore';
import type { StepStatus, OrchestrationStatus } from '@/types/orchestrator';
import type { QueueItem as ApiQueueItem } from '@/lib/api';
import type { QueueItem as SchedulerQueueItem, QueueItemStatus as SchedulerQueueItemStatus } from '@/types/queue-frontend-types';

// ========== Tab Type ==========

type QueueTab = 'queue' | 'orchestrator';

// ========== Queue Tab: Unified Item Type ==========

/**
 * Unified queue item type that works with both the legacy API QueueItem
 * and the new scheduler QueueItem. The scheduler type is a superset.
 */
type UnifiedQueueItem = ApiQueueItem | SchedulerQueueItem;

/**
 * Combined status type covering both scheduler statuses and legacy API statuses.
 */
type CombinedQueueItemStatus = SchedulerQueueItemStatus | ApiQueueItem['status'];

// ========== Queue Tab: Status Config ==========

const STATUS_CONFIG: Record<CombinedQueueItemStatus, {
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

// ========== Queue Tab: Content ==========

function QueueItemRow({
  item,
  isHighlighted,
  onSelect,
}: {
  item: UnifiedQueueItem;
  isHighlighted: boolean;
  onSelect: () => void;
}) {
  const { formatMessage } = useIntl();
  const statusKey = item.status as CombinedQueueItemStatus;
  const config = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  const executions = useQueueExecutionStore(selectByQueueItem(item.item_id));
  const activeExec = executions.find((e) => e.status === 'running') ?? executions[0];

  // Session key: prefer scheduler QueueItem.sessionKey, fallback to execution store
  const schedulerItem = item as SchedulerQueueItem;
  const sessionKey = schedulerItem.sessionKey ?? activeExec?.sessionKey;

  const isExecuting = item.status === 'executing';
  const isBlocked = item.status === 'blocked';

  return (
    <button
      type="button"
      className={cn(
        'w-full text-left px-3 py-2 rounded-md transition-colors',
        'hover:bg-muted/60 focus:outline-none focus:ring-1 focus:ring-primary/30',
        isHighlighted && 'bg-accent/50 ring-1 ring-accent/30',
        isExecuting && 'border-l-2 border-l-blue-500'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon
            className={cn(
              'w-3.5 h-3.5 shrink-0',
              isExecuting && 'animate-spin'
            )}
          />
          <span className="text-sm font-medium text-foreground truncate font-mono">
            {item.item_id}
          </span>
        </div>
        <Badge variant={config.variant} className="text-[10px] px-1.5 py-0 shrink-0">
          {formatMessage({ id: `terminalDashboard.queuePanel.status.${item.status}`, defaultMessage: config.label })}
        </Badge>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground pl-5">
        <span className="font-mono">{item.issue_id}</span>
        <span className="text-border">|</span>
        <span>
          {formatMessage(
            { id: 'terminalDashboard.queuePanel.order' },
            { order: item.execution_order }
          )}
        </span>
        <span className="text-border">|</span>
        <span>{item.execution_group}</span>
        {sessionKey && (
          <>
            <span className="text-border">|</span>
            <span className="flex items-center gap-0.5">
              <Terminal className="w-3 h-3" />
              {sessionKey}
            </span>
          </>
        )}
      </div>
      {isBlocked && item.depends_on.length > 0 && (
        <div className="mt-0.5 text-[10px] text-orange-500/80 pl-5 truncate">
          {formatMessage(
            { id: 'terminalDashboard.queuePanel.blockedBy', defaultMessage: 'Blocked by: {deps}' },
            { deps: item.depends_on.join(', ') }
          )}
        </div>
      )}
      {!isBlocked && item.depends_on.length > 0 && (
        <div className="mt-0.5 text-[10px] text-muted-foreground/70 pl-5 truncate">
          {formatMessage(
            { id: 'terminalDashboard.queuePanel.dependsOn' },
            { deps: item.depends_on.join(', ') }
          )}
        </div>
      )}
    </button>
  );
}

// ========== Queue Tab: Content ==========

function QueueTabContent(_props: { embedded?: boolean }) {
  const { formatMessage } = useIntl();

  // Scheduler store data
  const schedulerItems = useQueueSchedulerStore(selectQueueItems);
  const schedulerStatus = useQueueSchedulerStore(selectQueueSchedulerStatus);
  const loadInitialState = useQueueSchedulerStore((s) => s.loadInitialState);

  // Load scheduler state on mount
  useEffect(() => {
    loadInitialState();
  }, [loadInitialState]);

  // Legacy API data (fallback)
  const queueQuery = useIssueQueue();

  const associationChain = useIssueQueueIntegrationStore(selectAssociationChain);
  const buildAssociationChain = useIssueQueueIntegrationStore((s) => s.buildAssociationChain);

  // Use scheduler items when scheduler has data, otherwise fall back to legacy API
  const useSchedulerData = schedulerItems.length > 0 || schedulerStatus !== 'idle';

  const legacyItems = useMemo(() => {
    if (!queueQuery.data) return [];
    const grouped = queueQuery.data.grouped_items ?? {};
    const items: ApiQueueItem[] = [];
    for (const group of Object.values(grouped)) {
      items.push(...group);
    }
    items.sort((a, b) => a.execution_order - b.execution_order);
    return items;
  }, [queueQuery.data]);

  const allItems: UnifiedQueueItem[] = useMemo(() => {
    if (useSchedulerData) {
      return [...schedulerItems].sort((a, b) => a.execution_order - b.execution_order);
    }
    return legacyItems;
  }, [useSchedulerData, schedulerItems, legacyItems]);

  const handleSelect = useCallback(
    (queueItemId: string) => {
      buildAssociationChain(queueItemId, 'queue');
    },
    [buildAssociationChain]
  );

  // Show loading only for legacy mode
  if (!useSchedulerData && queueQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!useSchedulerData && queueQuery.error) {
    return (
      <div className="flex-1 flex items-center justify-center text-destructive p-4">
        <div className="text-center">
          <AlertTriangle className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
          <p className="text-sm">{formatMessage({ id: 'terminalDashboard.queuePanel.error' })}</p>
          <p className="text-xs mt-1 opacity-70">{queueQuery.error.message}</p>
        </div>
      </div>
    );
  }

  if (allItems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
        <div className="text-center">
          <ListChecks className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
          <p className="text-sm">{formatMessage({ id: 'terminalDashboard.queuePanel.noItems' })}</p>
          <p className="text-xs mt-1 opacity-70">
            {formatMessage({ id: 'terminalDashboard.queuePanel.noItemsDesc' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
      {allItems.map((item) => (
        <QueueItemRow
          key={item.item_id}
          item={item}
          isHighlighted={associationChain?.queueItemId === item.item_id}
          onSelect={() => handleSelect(item.item_id)}
        />
      ))}
    </div>
  );
}

// ========== Orchestrator Tab: Status Badge ==========

const orchestratorStatusClass: Record<OrchestrationStatus, string> = {
  pending: 'bg-muted text-muted-foreground border-border',
  running: 'bg-primary/10 text-primary border-primary/50',
  paused: 'bg-amber-500/10 text-amber-500 border-amber-500/50',
  completed: 'bg-green-500/10 text-green-500 border-green-500/50',
  failed: 'bg-destructive/10 text-destructive border-destructive/50',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

function OrchestratorStatusBadge({ status }: { status: OrchestrationStatus }) {
  const { formatMessage } = useIntl();
  return (
    <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium border', orchestratorStatusClass[status])}>
      {formatMessage({ id: `orchestrator.status.${status}` })}
    </span>
  );
}

// ========== Orchestrator Tab: Step Icon ==========

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    case 'skipped':
      return <SkipForward className="w-3.5 h-3.5 text-muted-foreground" />;
    case 'paused':
      return <Pause className="w-3.5 h-3.5 text-amber-500" />;
    case 'cancelled':
      return <Square className="w-3.5 h-3.5 text-muted-foreground" />;
    default:
      return <Circle className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

// ========== Orchestrator Tab: Plan Controls ==========

function PlanControls({ planId, status, failedStepId }: {
  planId: string;
  status: OrchestrationStatus;
  failedStepId: string | null;
}) {
  const pauseOrchestration = useOrchestratorStore((s) => s.pauseOrchestration);
  const resumeOrchestration = useOrchestratorStore((s) => s.resumeOrchestration);
  const stopOrchestration = useOrchestratorStore((s) => s.stopOrchestration);
  const retryStep = useOrchestratorStore((s) => s.retryStep);
  const skipStep = useOrchestratorStore((s) => s.skipStep);

  if (status === 'completed' || status === 'cancelled') return null;

  const isPausedOnError = status === 'paused' && failedStepId !== null;
  const isPausedByUser = status === 'paused' && failedStepId === null;

  return (
    <div className="flex items-center gap-1.5 mt-2">
      {status === 'running' && (
        <>
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1 px-2" onClick={() => pauseOrchestration(planId)}>
            <Pause className="w-3 h-3" />
          </Button>
          <Button variant="destructive" size="sm" className="h-6 text-xs gap-1 px-2" onClick={() => stopOrchestration(planId)}>
            <Square className="w-3 h-3" />
          </Button>
        </>
      )}
      {isPausedByUser && (
        <>
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1 px-2" onClick={() => resumeOrchestration(planId)}>
            <Play className="w-3 h-3" />
          </Button>
          <Button variant="destructive" size="sm" className="h-6 text-xs gap-1 px-2" onClick={() => stopOrchestration(planId)}>
            <Square className="w-3 h-3" />
          </Button>
        </>
      )}
      {isPausedOnError && failedStepId && (
        <>
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1 px-2" onClick={() => retryStep(planId, failedStepId)}>
            <RotateCcw className="w-3 h-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1 px-2" onClick={() => skipStep(planId, failedStepId)}>
            <SkipForward className="w-3 h-3" />
          </Button>
          <Button variant="destructive" size="sm" className="h-6 text-xs gap-1 px-2" onClick={() => stopOrchestration(planId)}>
            <Square className="w-3 h-3" />
          </Button>
        </>
      )}
    </div>
  );
}

// ========== Orchestrator Tab: Plan Card ==========

const PlanCard = memo(function PlanCard({ runState }: { runState: OrchestrationRunState }) {
  const { plan, status, stepStatuses, currentStepIndex } = runState;

  const { completedCount, totalCount, progress } = useMemo(() => {
    const statuses = Object.values(stepStatuses);
    const total = statuses.length;
    const completed = statuses.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
    return { completedCount: completed, totalCount: total, progress: total > 0 ? (completed / total) * 100 : 0 };
  }, [stepStatuses]);

  const failedStepId = useMemo(() => {
    for (const [stepId, stepState] of Object.entries(stepStatuses)) {
      if (stepState.status === 'failed') return stepId;
    }
    return null;
  }, [stepStatuses]);

  return (
    <div className="border rounded-md border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-xs font-semibold text-foreground truncate flex-1">{plan.name}</h4>
        <OrchestratorStatusBadge status={status} />
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {completedCount}/{totalCount}
        </span>
      </div>

      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
        <div
          className={cn(
            'h-full transition-all duration-300',
            status === 'failed' && 'bg-destructive',
            status === 'completed' && 'bg-green-500',
            status === 'cancelled' && 'bg-muted-foreground',
            (status === 'running' || status === 'pending') && 'bg-primary',
            status === 'paused' && 'bg-amber-500',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-0.5 max-h-48 overflow-y-auto">
        {plan.steps.map((step, index) => {
          const stepState = stepStatuses[step.id];
          if (!stepState) return null;
          const isCurrent = index === currentStepIndex && status === 'running';
          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1 rounded text-xs',
                isCurrent && 'bg-primary/5',
                stepState.status === 'failed' && 'bg-destructive/5',
              )}
            >
              <StepIcon status={stepState.status} />
              <span className={cn(
                'truncate flex-1',
                stepState.status === 'completed' && 'text-muted-foreground',
                stepState.status === 'skipped' && 'text-muted-foreground line-through',
                stepState.status === 'failed' && 'text-destructive',
              )}>
                {step.name}
              </span>
              {stepState.retryCount > 0 && (
                <span className="text-[10px] text-muted-foreground">×{stepState.retryCount}</span>
              )}
            </div>
          );
        })}
      </div>

      {failedStepId && stepStatuses[failedStepId]?.error && (
        <div className="flex items-start gap-1.5 mt-2 px-2">
          <AlertCircle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
          <span className="text-[10px] text-destructive/80 break-words">
            {stepStatuses[failedStepId].error}
          </span>
        </div>
      )}

      <PlanControls planId={plan.id} status={status} failedStepId={failedStepId} />
    </div>
  );
});

// ========== Orchestrator Tab: Content ==========

function OrchestratorTabContent() {
  const { formatMessage } = useIntl();
  const activePlans = useOrchestratorStore(selectActivePlans);
  const planEntries = useMemo(() => Object.entries(activePlans), [activePlans]);

  if (planEntries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
        <div className="text-center">
          <Workflow className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
          <p className="text-sm">
            {formatMessage({ id: 'terminalDashboard.orchestratorPanel.noPlans', defaultMessage: 'No active orchestrations' })}
          </p>
          <p className="text-xs mt-1 opacity-70">
            {formatMessage({ id: 'terminalDashboard.orchestratorPanel.noPlansHint', defaultMessage: 'Run a flow from the Orchestrator to see progress here' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
      {planEntries.map(([planId, runState]) => (
        <PlanCard key={planId} runState={runState} />
      ))}
    </div>
  );
}

// ========== Main Component ==========

export function QueuePanel({ embedded = false }: { embedded?: boolean }) {
  const { formatMessage } = useIntl();
  const [activeTab, setActiveTab] = useState<QueueTab>('queue');
  const orchestratorCount = useOrchestratorStore(selectActivePlanCount);

  // Scheduler store data for active count
  const schedulerItems = useQueueSchedulerStore(selectQueueItems);
  const schedulerStatus = useQueueSchedulerStore(selectQueueSchedulerStatus);
  const useSchedulerData = schedulerItems.length > 0 || schedulerStatus !== 'idle';

  // Legacy API data for active count fallback
  const queueQuery = useIssueQueue();

  const queueActiveCount = useMemo(() => {
    if (useSchedulerData) {
      return schedulerItems.filter(
        (item) =>
          item.status === 'pending' ||
          item.status === 'queued' ||
          item.status === 'executing'
      ).length;
    }
    if (!queueQuery.data) return 0;
    const grouped = queueQuery.data.grouped_items ?? {};
    let count = 0;
    for (const items of Object.values(grouped)) {
      count += items.filter(
        (item) => item.status === 'pending' || item.status === 'ready' || item.status === 'executing'
      ).length;
    }
    return count;
  }, [useSchedulerData, schedulerItems, queueQuery.data]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      {!embedded && (
        <div className="flex items-center border-b border-border shrink-0">
          <button
            type="button"
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
              activeTab === 'queue'
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setActiveTab('queue')}
          >
            <ListChecks className="w-3.5 h-3.5" />
            {formatMessage({ id: 'terminalDashboard.queuePanel.title' })}
            {queueActiveCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">
                {queueActiveCount}
              </Badge>
            )}
          </button>
          <button
            type="button"
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
              activeTab === 'orchestrator'
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setActiveTab('orchestrator')}
          >
            <Workflow className="w-3.5 h-3.5" />
            {formatMessage({ id: 'terminalDashboard.toolbar.orchestrator', defaultMessage: 'Orchestrator' })}
            {orchestratorCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">
                {orchestratorCount}
              </Badge>
            )}
          </button>
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'queue' ? (
        <QueueTabContent embedded={embedded} />
      ) : (
        <OrchestratorTabContent />
      )}
    </div>
  );
}
