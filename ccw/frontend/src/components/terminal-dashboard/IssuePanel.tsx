// ========================================
// IssuePanel Component
// ========================================
// Issue list panel for the terminal dashboard middle column.
// Consumes existing useIssues() React Query hook for data fetching.
// Integrates with issueQueueIntegrationStore for selection state
// and association chain highlighting.

import { useMemo, useCallback } from 'react';
import { useIntl } from 'react-intl';
import {
  AlertCircle,
  ArrowRightToLine,
  Loader2,
  AlertTriangle,
  CircleDot,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { useIssues } from '@/hooks/useIssues';
import {
  useIssueQueueIntegrationStore,
  selectSelectedIssueId,
  selectAssociationChain,
} from '@/stores/issueQueueIntegrationStore';
import type { Issue } from '@/lib/api';

// ========== Priority Badge ==========

const PRIORITY_STYLES: Record<Issue['priority'], { variant: 'destructive' | 'warning' | 'info' | 'secondary'; label: string }> = {
  critical: { variant: 'destructive', label: 'Critical' },
  high: { variant: 'warning', label: 'High' },
  medium: { variant: 'info', label: 'Medium' },
  low: { variant: 'secondary', label: 'Low' },
};

function PriorityBadge({ priority }: { priority: Issue['priority'] }) {
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium;
  return (
    <Badge variant={style.variant} className="text-[10px] px-1.5 py-0 shrink-0">
      {style.label}
    </Badge>
  );
}

// ========== Status Indicator ==========

function StatusDot({ status }: { status: Issue['status'] }) {
  const colorMap: Record<Issue['status'], string> = {
    open: 'text-info',
    in_progress: 'text-warning',
    resolved: 'text-success',
    closed: 'text-muted-foreground',
    completed: 'text-success',
  };
  return <CircleDot className={cn('w-3 h-3 shrink-0', colorMap[status] ?? 'text-muted-foreground')} />;
}

// ========== Issue Item ==========

function IssueItem({
  issue,
  isSelected,
  isHighlighted,
  onSelect,
  onSendToQueue,
}: {
  issue: Issue;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: () => void;
  onSendToQueue: () => void;
}) {
  const { formatMessage } = useIntl();

  const handleSendToQueue = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSendToQueue();
    },
    [onSendToQueue]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'w-full text-left px-2.5 py-1.5 rounded-md transition-colors',
        'hover:bg-muted/60 focus:outline-none focus:ring-1 focus:ring-primary/30',
        isSelected && 'bg-primary/10 ring-1 ring-primary/30',
        isHighlighted && !isSelected && 'bg-accent/50'
      )}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={issue.status} />
          <span className="text-sm font-medium text-foreground truncate">
            {issue.title}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <PriorityBadge priority={issue.priority} />
          <button
            type="button"
            className={cn(
              'p-1 rounded hover:bg-primary/20 transition-colors',
              'text-muted-foreground hover:text-primary',
              'focus:outline-none focus:ring-1 focus:ring-primary/30'
            )}
            onClick={handleSendToQueue}
            title={formatMessage({ id: 'terminalDashboard.issuePanel.sendToQueue' })}
          >
            <ArrowRightToLine className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {issue.context && (
        <p className="mt-0.5 text-xs text-muted-foreground truncate pl-5">
          {issue.context}
        </p>
      )}
      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground pl-5">
        <span className="font-mono">{issue.id}</span>
        {issue.labels && issue.labels.length > 0 && (
          <>
            <span className="text-border">|</span>
            <span className="truncate">{issue.labels.slice(0, 2).join(', ')}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ========== Empty State ==========

function IssueEmptyState() {
  const { formatMessage } = useIntl();
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
      <div className="text-center">
        <AlertCircle className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
        <p className="text-sm">{formatMessage({ id: 'terminalDashboard.issuePanel.noIssues' })}</p>
        <p className="text-xs mt-1 opacity-70">
          {formatMessage({ id: 'terminalDashboard.issuePanel.noIssuesDesc' })}
        </p>
      </div>
    </div>
  );
}

// ========== Error State ==========

function IssueErrorState({ error }: { error: Error }) {
  const { formatMessage } = useIntl();
  return (
    <div className="flex-1 flex items-center justify-center text-destructive p-4">
      <div className="text-center">
        <AlertTriangle className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
        <p className="text-sm">{formatMessage({ id: 'terminalDashboard.issuePanel.error' })}</p>
        <p className="text-xs mt-1 opacity-70">{error.message}</p>
      </div>
    </div>
  );
}

// ========== Main Component ==========

export function IssuePanel() {
  const { formatMessage } = useIntl();
  const { issues, isLoading, error, openCount } = useIssues();

  const selectedIssueId = useIssueQueueIntegrationStore(selectSelectedIssueId);
  const associationChain = useIssueQueueIntegrationStore(selectAssociationChain);
  const setSelectedIssue = useIssueQueueIntegrationStore((s) => s.setSelectedIssue);
  const buildAssociationChain = useIssueQueueIntegrationStore((s) => s.buildAssociationChain);

  // Sort: open/in_progress first, then by priority (critical > high > medium > low)
  const sortedIssues = useMemo(() => {
    const priorityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    const statusOrder: Record<string, number> = {
      in_progress: 0,
      open: 1,
      resolved: 2,
      completed: 3,
      closed: 4,
    };
    return [...issues].sort((a, b) => {
      const sa = statusOrder[a.status] ?? 5;
      const sb = statusOrder[b.status] ?? 5;
      if (sa !== sb) return sa - sb;
      const pa = priorityOrder[a.priority] ?? 3;
      const pb = priorityOrder[b.priority] ?? 3;
      return pa - pb;
    });
  }, [issues]);

  const handleSelect = useCallback(
    (issueId: string) => {
      if (selectedIssueId === issueId) {
        setSelectedIssue(null);
      } else {
        buildAssociationChain(issueId, 'issue');
      }
    },
    [selectedIssueId, setSelectedIssue, buildAssociationChain]
  );

  const handleSendToQueue = useCallback(
    (issueId: string) => {
      // Select the issue and build chain - queue creation is handled elsewhere
      buildAssociationChain(issueId, 'issue');
    },
    [buildAssociationChain]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {formatMessage({ id: 'terminalDashboard.issuePanel.title' })}
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {formatMessage({ id: 'terminalDashboard.issuePanel.title' })}
          </h3>
        </div>
        <IssueErrorState error={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {formatMessage({ id: 'terminalDashboard.issuePanel.title' })}
        </h3>
        {openCount > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {openCount}
          </Badge>
        )}
      </div>

      {/* Issue List */}
      {sortedIssues.length === 0 ? (
        <IssueEmptyState />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
          {sortedIssues.map((issue) => (
            <IssueItem
              key={issue.id}
              issue={issue}
              isSelected={selectedIssueId === issue.id}
              isHighlighted={associationChain?.issueId === issue.id}
              onSelect={() => handleSelect(issue.id)}
              onSendToQueue={() => handleSendToQueue(issue.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
