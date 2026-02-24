// ========================================
// AgentList Component
// ========================================
// Compact list of active orchestration plans from orchestratorStore.
// Shows plan name, current step progress, and status badge.

import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrchestratorStore, selectActivePlans } from '@/stores';
import { Badge } from '@/components/ui/Badge';
import type { OrchestrationRunState } from '@/stores/orchestratorStore';
import type { OrchestrationStatus } from '@/types/orchestrator';

// ========== Status Badge Config ==========

const STATUS_CONFIG: Record<
  OrchestrationStatus,
  { variant: 'default' | 'info' | 'success' | 'destructive' | 'secondary' | 'warning'; messageId: string }
> = {
  running: { variant: 'info', messageId: 'terminalDashboard.agentList.statusRunning' },
  completed: { variant: 'success', messageId: 'terminalDashboard.agentList.statusCompleted' },
  failed: { variant: 'destructive', messageId: 'terminalDashboard.agentList.statusFailed' },
  paused: { variant: 'warning', messageId: 'terminalDashboard.agentList.statusPaused' },
  pending: { variant: 'secondary', messageId: 'terminalDashboard.agentList.statusPending' },
  cancelled: { variant: 'secondary', messageId: 'terminalDashboard.agentList.statusPending' },
};

// ========== AgentListItem ==========

function AgentListItem({
  runState,
}: {
  runState: OrchestrationRunState;
}) {
  const { formatMessage } = useIntl();
  const { plan, status, stepStatuses } = runState;

  const totalSteps = plan.steps.length;
  const completedSteps = useMemo(
    () =>
      Object.values(stepStatuses).filter(
        (s) => s.status === 'completed' || s.status === 'skipped'
      ).length,
    [stepStatuses]
  );

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const isRunning = status === 'running';

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2',
        'border-b border-border/30 last:border-b-0',
        'hover:bg-muted/30 transition-colors'
      )}
    >
      <div className="shrink-0">
        {isRunning ? (
          <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{plan.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {formatMessage(
            { id: 'terminalDashboard.agentList.stepLabel' },
            { current: completedSteps, total: totalSteps }
          )}
        </p>
      </div>

      <Badge variant={config.variant} className="text-[10px] px-1.5 py-0 shrink-0">
        {formatMessage({ id: config.messageId })}
      </Badge>
    </div>
  );
}

// ========== AgentList Component ==========

export function AgentList() {
  const { formatMessage } = useIntl();
  const activePlans = useOrchestratorStore(selectActivePlans);

  const planEntries = useMemo(
    () => Object.entries(activePlans),
    [activePlans]
  );

  return (
    <div className="flex flex-col">
      {/* Section header with visual separation */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-muted/20 shrink-0">
        <Bot className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {formatMessage({ id: 'terminalDashboard.agentList.title' })}
        </h3>
        {planEntries.length > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">
            {planEntries.length}
          </Badge>
        )}
      </div>

      {/* Plan list or empty state */}
      {planEntries.length === 0 ? (
        <div className="flex items-center justify-center py-3 px-3">
          <p className="text-[10px] text-muted-foreground">
            {formatMessage({ id: 'terminalDashboard.agentList.noAgents' })}
          </p>
        </div>
      ) : (
        <div className="overflow-y-auto max-h-[200px]">
          {planEntries.map(([planId, runState]) => (
            <AgentListItem key={planId} runState={runState} />
          ))}
        </div>
      )}
    </div>
  );
}

export default AgentList;
