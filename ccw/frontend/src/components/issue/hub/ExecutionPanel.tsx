// ========================================
// Execution Panel
// ========================================
// Content panel for Executions tab in IssueHub.
// Shows queue execution state from queueExecutionStore
// with split-view: execution list (left) + detail view (right).

import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Play,
  CheckCircle,
  XCircle,
  Terminal,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  useQueueExecutionStore,
  useTerminalPanelStore,
} from '@/stores';
import type { QueueExecution } from '@/stores/queueExecutionStore';
import { cn } from '@/lib/utils';
import { statusIcon, statusBadgeVariant, formatRelativeTime } from '@/lib/execution-display-utils';

// ========== Empty State ==========

function ExecutionEmptyState() {
  const { formatMessage } = useIntl();

  return (
    <Card className="p-12 text-center">
      <Terminal className="w-16 h-16 mx-auto text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-medium text-foreground">
        {formatMessage({ id: 'issues.executions.emptyState.title' })}
      </h3>
      <p className="mt-2 text-muted-foreground">
        {formatMessage({ id: 'issues.executions.emptyState.description' })}
      </p>
    </Card>
  );
}

// ========== Stats Cards ==========

function ExecutionStatsCards() {
  const { formatMessage } = useIntl();
  const executions = useQueueExecutionStore((s) => s.executions);
  const stats = useMemo(() => {
    const all = Object.values(executions);
    return {
      running: all.filter((e) => e.status === 'running').length,
      completed: all.filter((e) => e.status === 'completed').length,
      failed: all.filter((e) => e.status === 'failed').length,
      total: all.length,
    };
  }, [executions]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Play className="w-5 h-5 text-info" />
          <span className="text-2xl font-bold">{stats.running}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {formatMessage({ id: 'issues.executions.stats.running' })}
        </p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-success" />
          <span className="text-2xl font-bold">{stats.completed}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {formatMessage({ id: 'issues.executions.stats.completed' })}
        </p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-destructive" />
          <span className="text-2xl font-bold">{stats.failed}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {formatMessage({ id: 'issues.executions.stats.failed' })}
        </p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-muted-foreground" />
          <span className="text-2xl font-bold">{stats.total}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {formatMessage({ id: 'issues.executions.stats.total' })}
        </p>
      </Card>
    </div>
  );
}

// ========== Execution List Item ==========

function ExecutionListItem({
  execution,
  isSelected,
  onSelect,
}: {
  execution: QueueExecution;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'w-full text-left p-3 rounded-md transition-colors',
        'hover:bg-muted/60',
        isSelected && 'bg-muted ring-1 ring-primary/30'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {statusIcon(execution.status)}
          <span className="text-sm font-medium text-foreground truncate">
            {execution.id}
          </span>
        </div>
        <Badge variant={statusBadgeVariant(execution.status)} className="gap-1 shrink-0">
          {execution.status}
        </Badge>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="font-mono">{execution.tool}</span>
        <span>{execution.mode}</span>
        <span>{execution.type}</span>
        <span className="ml-auto">{formatRelativeTime(execution.startedAt)}</span>
      </div>
    </button>
  );
}

// ========== Execution Detail View ==========

function ExecutionDetailView({ execution }: { execution: QueueExecution | null }) {
  const { formatMessage } = useIntl();
  const openTerminal = useTerminalPanelStore((s) => s.openTerminal);

  if (!execution) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {formatMessage({ id: 'issues.executions.detail.selectExecution' })}
      </div>
    );
  }

  const detailRows: Array<{ label: string; value: string | undefined }> = [
    { label: formatMessage({ id: 'issues.executions.detail.id' }), value: execution.id },
    { label: formatMessage({ id: 'issues.executions.detail.queueItemId' }), value: execution.queueItemId },
    { label: formatMessage({ id: 'issues.executions.detail.issueId' }), value: execution.issueId },
    { label: formatMessage({ id: 'issues.executions.detail.solutionId' }), value: execution.solutionId },
    { label: formatMessage({ id: 'issues.executions.detail.type' }), value: execution.type },
    { label: formatMessage({ id: 'issues.executions.detail.tool' }), value: execution.tool },
    { label: formatMessage({ id: 'issues.executions.detail.mode' }), value: execution.mode },
    { label: formatMessage({ id: 'issues.executions.detail.status' }), value: execution.status },
    { label: formatMessage({ id: 'issues.executions.detail.startedAt' }), value: execution.startedAt },
    { label: formatMessage({ id: 'issues.executions.detail.completedAt' }), value: execution.completedAt || '-' },
  ];

  if (execution.sessionKey) {
    detailRows.push({
      label: formatMessage({ id: 'issues.executions.detail.sessionKey' }),
      value: execution.sessionKey,
    });
  }
  if (execution.flowId) {
    detailRows.push({
      label: formatMessage({ id: 'issues.executions.detail.flowId' }),
      value: execution.flowId,
    });
  }
  if (execution.execId) {
    detailRows.push({
      label: formatMessage({ id: 'issues.executions.detail.execId' }),
      value: execution.execId,
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusIcon(execution.status)}
          <span className="text-sm font-semibold text-foreground">{execution.id}</span>
          <Badge variant={statusBadgeVariant(execution.status)}>{execution.status}</Badge>
        </div>
        {execution.type === 'session' && execution.sessionKey && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => openTerminal(execution.sessionKey!)}
          >
            <Terminal className="w-3.5 h-3.5" />
            {formatMessage({ id: 'issues.executions.detail.openInTerminal' })}
          </Button>
        )}
      </div>

      {/* Error Banner */}
      {execution.error && (
        <Card className="p-3 border-destructive/50 bg-destructive/5">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive break-all">{execution.error}</p>
          </div>
        </Card>
      )}

      {/* Detail Table */}
      <Card className="p-0 overflow-hidden">
        <div className="divide-y divide-border">
          {detailRows.map((row) => (
            <div key={row.label} className="grid grid-cols-3 gap-2 px-4 py-2.5">
              <span className="text-xs font-medium text-muted-foreground">{row.label}</span>
              <span className="col-span-2 text-xs font-mono text-foreground break-all">
                {row.value || '-'}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ========== Main Panel Component ==========

export function ExecutionPanel() {
  const { formatMessage } = useIntl();
  const executions = useQueueExecutionStore((s) => s.executions);
  const clearCompleted = useQueueExecutionStore((s) => s.clearCompleted);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sort executions: running first, then pending, then by startedAt descending
  const sortedExecutions = useMemo(() => {
    const all = Object.values(executions);
    const statusOrder: Record<string, number> = {
      running: 0,
      pending: 1,
      failed: 2,
      completed: 3,
    };
    return all.sort((a, b) => {
      const sa = statusOrder[a.status] ?? 4;
      const sb = statusOrder[b.status] ?? 4;
      if (sa !== sb) return sa - sb;
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });
  }, [executions]);

  const selectedExecution = selectedId ? executions[selectedId] ?? null : null;
  const hasCompletedOrFailed = sortedExecutions.some(
    (e) => e.status === 'completed' || e.status === 'failed'
  );

  if (sortedExecutions.length === 0) {
    return (
      <div className="space-y-6">
        <ExecutionStatsCards />
        <ExecutionEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <ExecutionStatsCards />

      {/* Split View */}
      <div className="grid grid-cols-[3fr_2fr] gap-4 min-h-[400px]">
        {/* Left: Execution List */}
        <Card className="p-3 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">
              {formatMessage({ id: 'issues.executions.list.title' })}
            </h3>
            {hasCompletedOrFailed && (
              <Button variant="outline" size="sm" onClick={clearCompleted}>
                {formatMessage({ id: 'issues.executions.list.clearCompleted' })}
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {sortedExecutions.map((exec) => (
              <ExecutionListItem
                key={exec.id}
                execution={exec}
                isSelected={selectedId === exec.id}
                onSelect={() => setSelectedId(exec.id)}
              />
            ))}
          </div>
        </Card>

        {/* Right: Detail View */}
        <Card className="p-4 overflow-y-auto">
          <ExecutionDetailView execution={selectedExecution} />
        </Card>
      </div>
    </div>
  );
}

export default ExecutionPanel;
