// ========================================
// Orchestrator Control Panel Component
// ========================================
// Displays orchestration plan progress with step list, status badges,
// and conditional control buttons (pause/resume/retry/skip/stop).

import { memo, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
  SkipForward,
  Pause,
  Play,
  Square,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  useOrchestratorStore,
  selectPlan,
  type StepRunState,
} from '@/stores/orchestratorStore';
import type { StepStatus, OrchestrationStatus } from '@/types/orchestrator';

// ========== Props ==========

interface OrchestratorControlPanelProps {
  /** Identifies which orchestration plan to display/control */
  planId: string;
}

// ========== Status Badge ==========

const statusBadgeConfig: Record<
  OrchestrationStatus,
  { labelKey: string; className: string }
> = {
  pending: {
    labelKey: 'orchestrator.status.pending',
    className: 'bg-muted text-muted-foreground border-border',
  },
  running: {
    labelKey: 'orchestrator.status.running',
    className: 'bg-primary/10 text-primary border-primary/50',
  },
  paused: {
    labelKey: 'orchestrator.status.paused',
    className: 'bg-amber-500/10 text-amber-500 border-amber-500/50',
  },
  completed: {
    labelKey: 'orchestrator.status.completed',
    className: 'bg-green-500/10 text-green-500 border-green-500/50',
  },
  failed: {
    labelKey: 'orchestrator.status.failed',
    className: 'bg-destructive/10 text-destructive border-destructive/50',
  },
  cancelled: {
    labelKey: 'orchestrator.controlPanel.cancelled',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

function StatusBadge({ status }: { status: OrchestrationStatus }) {
  const { formatMessage } = useIntl();
  const config = statusBadgeConfig[status];

  return (
    <span
      className={cn(
        'px-2.5 py-1 rounded-md text-xs font-medium border',
        config.className
      )}
    >
      {formatMessage({ id: config.labelKey })}
    </span>
  );
}

// ========== Step Status Icon ==========

function StepStatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'pending':
      return <Circle className="w-4 h-4 text-muted-foreground" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-destructive" />;
    case 'skipped':
      return <SkipForward className="w-4 h-4 text-muted-foreground" />;
    case 'paused':
      return <Pause className="w-4 h-4 text-amber-500" />;
    case 'cancelled':
      return <Square className="w-4 h-4 text-muted-foreground" />;
    default:
      return <Circle className="w-4 h-4 text-muted-foreground opacity-50" />;
  }
}

// ========== Step List Item ==========

interface StepListItemProps {
  stepId: string;
  name: string;
  runState: StepRunState;
  isCurrent: boolean;
}

function StepListItem({ stepId: _stepId, name, runState, isCurrent }: StepListItemProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 px-3 py-2 rounded-md transition-colors',
        isCurrent && runState.status === 'running' && 'bg-primary/5 border border-primary/20',
        runState.status === 'failed' && 'bg-destructive/5',
        !isCurrent && runState.status !== 'failed' && 'hover:bg-muted/50'
      )}
    >
      {/* Status icon */}
      <div className="pt-0.5 shrink-0">
        <StepStatusIcon status={runState.status} />
      </div>

      {/* Step info */}
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            'text-sm font-medium truncate block',
            runState.status === 'completed' && 'text-muted-foreground',
            runState.status === 'skipped' && 'text-muted-foreground line-through',
            runState.status === 'running' && 'text-foreground',
            runState.status === 'failed' && 'text-destructive'
          )}
        >
          {name}
        </span>

        {/* Error message inline */}
        {runState.status === 'failed' && runState.error && (
          <div className="flex items-start gap-1.5 mt-1">
            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            <span className="text-xs text-destructive/80 break-words">
              {runState.error}
            </span>
          </div>
        )}

        {/* Retry count indicator */}
        {runState.retryCount > 0 && (
          <span className="text-xs text-muted-foreground mt-0.5 block">
            Retry #{runState.retryCount}
          </span>
        )}
      </div>
    </div>
  );
}

// ========== Control Buttons ==========

interface ControlBarProps {
  planId: string;
  status: OrchestrationStatus;
  failedStepId: string | null;
}

function ControlBar({ planId, status, failedStepId }: ControlBarProps) {
  const { formatMessage } = useIntl();
  const pauseOrchestration = useOrchestratorStore((s) => s.pauseOrchestration);
  const resumeOrchestration = useOrchestratorStore((s) => s.resumeOrchestration);
  const stopOrchestration = useOrchestratorStore((s) => s.stopOrchestration);
  const retryStep = useOrchestratorStore((s) => s.retryStep);
  const skipStep = useOrchestratorStore((s) => s.skipStep);

  if (status === 'completed') {
    return (
      <div className="px-4 py-3 border-t border-border">
        <p className="text-sm text-green-500 text-center">
          {formatMessage({ id: 'orchestrator.controlPanel.completedMessage' })}
        </p>
      </div>
    );
  }

  if (status === 'failed' || status === 'cancelled') {
    return (
      <div className="px-4 py-3 border-t border-border">
        <p className="text-sm text-destructive text-center">
          {formatMessage({ id: 'orchestrator.controlPanel.failedMessage' })}
        </p>
      </div>
    );
  }

  // Determine if paused due to error (has a failed step)
  const isPausedOnError = status === 'paused' && failedStepId !== null;
  const isPausedByUser = status === 'paused' && failedStepId === null;

  return (
    <div className="px-4 py-3 border-t border-border flex items-center gap-2">
      {/* Running state: Pause + Stop */}
      {status === 'running' && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => pauseOrchestration(planId)}
            className="gap-1.5"
          >
            <Pause className="w-3.5 h-3.5" />
            {formatMessage({ id: 'orchestrator.execution.pause' })}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => stopOrchestration(planId)}
            className="gap-1.5"
          >
            <Square className="w-3.5 h-3.5" />
            {formatMessage({ id: 'orchestrator.execution.stop' })}
          </Button>
        </>
      )}

      {/* User-paused state: Resume + Stop */}
      {isPausedByUser && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resumeOrchestration(planId)}
            className="gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            {formatMessage({ id: 'orchestrator.execution.resume' })}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => stopOrchestration(planId)}
            className="gap-1.5"
          >
            <Square className="w-3.5 h-3.5" />
            {formatMessage({ id: 'orchestrator.execution.stop' })}
          </Button>
        </>
      )}

      {/* Error-paused state: Retry + Skip + Stop */}
      {isPausedOnError && failedStepId && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => retryStep(planId, failedStepId)}
            className="gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {formatMessage({ id: 'orchestrator.controlPanel.retry' })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => skipStep(planId, failedStepId)}
            className="gap-1.5"
          >
            <SkipForward className="w-3.5 h-3.5" />
            {formatMessage({ id: 'orchestrator.controlPanel.skip' })}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => stopOrchestration(planId)}
            className="gap-1.5"
          >
            <Square className="w-3.5 h-3.5" />
            {formatMessage({ id: 'orchestrator.execution.stop' })}
          </Button>
        </>
      )}
    </div>
  );
}

// ========== Main Component ==========

/**
 * OrchestratorControlPanel displays plan progress and provides
 * pause/resume/retry/skip/stop controls for active orchestrations.
 *
 * Layout:
 * - Header: Plan name + status badge + progress count
 * - Progress bar: Completed/total ratio
 * - Step list: Scrollable with status icons and error messages
 * - Control bar: Conditional buttons based on orchestration status
 */
export const OrchestratorControlPanel = memo(function OrchestratorControlPanel({
  planId,
}: OrchestratorControlPanelProps) {
  const { formatMessage } = useIntl();
  const runState = useOrchestratorStore(selectPlan(planId));

  // Compute progress counts
  const { completedCount, totalCount, progress } = useMemo(() => {
    if (!runState) return { completedCount: 0, totalCount: 0, progress: 0 };

    const statuses = Object.values(runState.stepStatuses);
    const total = statuses.length;
    const completed = statuses.filter(
      (s) => s.status === 'completed' || s.status === 'skipped'
    ).length;

    return {
      completedCount: completed,
      totalCount: total,
      progress: total > 0 ? (completed / total) * 100 : 0,
    };
  }, [runState]);

  // Find the first failed step ID (for error-paused controls)
  const failedStepId = useMemo(() => {
    if (!runState) return null;
    for (const [stepId, stepState] of Object.entries(runState.stepStatuses)) {
      if (stepState.status === 'failed') return stepId;
    }
    return null;
  }, [runState]);

  // No plan found
  if (!runState) {
    return (
      <div className="p-4 border rounded-lg border-border">
        <p className="text-sm text-muted-foreground text-center">
          {formatMessage({ id: 'orchestrator.controlPanel.noPlan' })}
        </p>
      </div>
    );
  }

  const { plan, status, currentStepIndex } = runState;

  return (
    <div className="border rounded-lg border-border bg-card flex flex-col">
      {/* Header: Plan name + Status badge + Progress count */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground truncate flex-1">
            {plan.name}
          </h3>
          <StatusBadge status={status} />
          <span className="text-sm text-muted-foreground tabular-nums shrink-0">
            {formatMessage(
              { id: 'orchestrator.controlPanel.progress' },
              { completed: completedCount, total: totalCount }
            )}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-300 ease-out',
              status === 'failed' && 'bg-destructive',
              status === 'completed' && 'bg-green-500',
              status === 'cancelled' && 'bg-muted-foreground',
              (status === 'running' || status === 'pending') && 'bg-primary',
              status === 'paused' && 'bg-amber-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="flex-1 overflow-y-auto max-h-80 p-2 space-y-1">
        {plan.steps.map((step, index) => {
          const stepState = runState.stepStatuses[step.id];
          if (!stepState) return null;

          return (
            <StepListItem
              key={step.id}
              stepId={step.id}
              name={step.name}
              runState={stepState}
              isCurrent={index === currentStepIndex && status === 'running'}
            />
          );
        })}
      </div>

      {/* Control bar */}
      <ControlBar
        planId={planId}
        status={status}
        failedStepId={failedStepId}
      />
    </div>
  );
});

OrchestratorControlPanel.displayName = 'OrchestratorControlPanel';
