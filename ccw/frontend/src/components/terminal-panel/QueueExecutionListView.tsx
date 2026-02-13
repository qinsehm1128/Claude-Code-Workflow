// ========================================
// QueueExecutionListView Component
// ========================================
// Compact execution list for TerminalPanel queue view.
// Subscribes to queueExecutionStore and renders execution entries
// with status badges, tool/mode labels, and relative timestamps.
// Click navigates to terminal view (session) or orchestrator page.

import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { useQueueExecutionStore } from '@/stores/queueExecutionStore';
import { useTerminalPanelStore } from '@/stores/terminalPanelStore';
import type { QueueExecution } from '@/stores/queueExecutionStore';
import { ROUTES } from '@/router';
import { statusIcon, statusBadgeVariant, formatRelativeTime } from '@/lib/execution-display-utils';

// ========== Execution Item ==========

function QueueExecutionItem({
  execution,
  onClick,
}: {
  execution: QueueExecution;
  onClick: () => void;
}) {
  const { formatMessage } = useIntl();

  const typeLabel = execution.type === 'session'
    ? formatMessage({ id: 'home.terminalPanel.queueView.session' })
    : formatMessage({ id: 'home.terminalPanel.queueView.orchestrator' });

  return (
    <button
      type="button"
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-md transition-colors',
        'hover:bg-muted/60 focus:outline-none focus:ring-1 focus:ring-primary/30'
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {statusIcon(execution.status)}
          <span className="text-sm font-medium font-mono text-foreground truncate">
            {execution.queueItemId}
          </span>
        </div>
        <Badge variant={statusBadgeVariant(execution.status)} className="shrink-0 text-[10px] px-1.5 py-0">
          {formatMessage({ id: `home.terminalPanel.status.${execution.status}` })}
        </Badge>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{execution.tool}</span>
        <span className="text-border">|</span>
        <span>{execution.mode}</span>
        <span className="text-border">|</span>
        <span>{typeLabel}</span>
        <span className="ml-auto shrink-0">{formatRelativeTime(execution.startedAt)}</span>
      </div>
    </button>
  );
}

// ========== Empty State ==========

function QueueEmptyState() {
  const { formatMessage } = useIntl();

  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <div className="text-center">
        <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm">{formatMessage({ id: 'home.terminalPanel.queueView.emptyTitle' })}</p>
        <p className="text-xs mt-1">{formatMessage({ id: 'home.terminalPanel.queueView.emptyDesc' })}</p>
      </div>
    </div>
  );
}

// ========== Main Component ==========

export function QueueExecutionListView() {
  const navigate = useNavigate();
  const executions = useQueueExecutionStore((s) => s.executions);
  const setPanelView = useTerminalPanelStore((s) => s.setPanelView);
  const openTerminal = useTerminalPanelStore((s) => s.openTerminal);

  // Sort: running first, then pending, then failed, then completed; within same status by startedAt desc
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

  const handleClick = (exec: QueueExecution) => {
    if (exec.type === 'session' && exec.sessionKey) {
      setPanelView('terminal');
      openTerminal(exec.sessionKey);
    } else {
      navigate(ROUTES.ORCHESTRATOR);
    }
  };

  if (sortedExecutions.length === 0) {
    return <QueueEmptyState />;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-2 space-y-0.5">
      {sortedExecutions.map((exec) => (
        <QueueExecutionItem
          key={exec.id}
          execution={exec}
          onClick={() => handleClick(exec)}
        />
      ))}
    </div>
  );
}
