// ========================================
// Issues Panel
// ========================================
// Unified issue list panel with list/board view toggle

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  LayoutGrid,
  List,
} from 'lucide-react';
import type { DropResult } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import { IssueCard } from '@/components/shared/IssueCard';
import { IssueDrawer } from '@/components/issue/hub/IssueDrawer';
import { KanbanBoard, type KanbanColumn, type KanbanItem } from '@/components/shared/KanbanBoard';
import { useIssues, useIssueMutations } from '@/hooks';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { cn } from '@/lib/utils';
import type { Issue } from '@/lib/api';

type StatusFilter = 'all' | Issue['status'];
type PriorityFilter = 'all' | Issue['priority'];
type ViewMode = 'list' | 'board';

// Board columns matching backend status with Chinese defaults
const BOARD_COLUMNS: Array<{ id: Issue['status']; titleKey: string; defaultLabel: string }> = [
  { id: 'registered', titleKey: 'issues.status.registered', defaultLabel: '新注册' },
  { id: 'planning', titleKey: 'issues.status.planning', defaultLabel: '规划中' },
  { id: 'planned', titleKey: 'issues.status.planned', defaultLabel: '已规划' },
  { id: 'executing', titleKey: 'issues.status.executing', defaultLabel: '执行中' },
  { id: 'completed', titleKey: 'issues.status.completed', defaultLabel: '已完成' },
];

interface IssuesPanelProps {
  onCreateIssue?: () => void;
}

interface IssueListProps {
  issues: Issue[];
  isLoading: boolean;
  onIssueClick: (issue: Issue) => void;
  onIssueEdit: (issue: Issue) => void;
  onIssueDelete: (issue: Issue) => void;
  onStatusChange: (issue: Issue, status: Issue['status']) => void;
}

function IssueList({ issues, isLoading, onIssueClick, onIssueEdit, onIssueDelete, onStatusChange }: IssueListProps) {
  const { formatMessage } = useIntl();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">{formatMessage({ id: 'issues.emptyState.title' })}</h3>
        <p className="mt-2 text-muted-foreground">{formatMessage({ id: 'issues.emptyState.message' })}</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {issues.map((issue) => (
        <IssueCard
          key={issue.id}
          issue={issue}
          onClick={onIssueClick}
          onEdit={onIssueEdit}
          onDelete={onIssueDelete}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  );
}

// Local storage key for board order
function storageKey(projectPath: string | null | undefined): string {
  const base = projectPath ? encodeURIComponent(projectPath) : 'global';
  return `ccw.issues.board.order:${base}`;
}

type BoardOrder = Partial<Record<Issue['status'], string[]>>;

function safeParseOrder(value: string | null): BoardOrder {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as BoardOrder;
  } catch {
    return {};
  }
}

function buildColumns(
  issues: Issue[],
  order: BoardOrder,
  formatTitle: (statusId: Issue['status']) => string
): KanbanColumn<Issue & KanbanItem>[] {
  const byId = new Map(issues.map((i) => [i.id, i]));
  const columns: KanbanColumn<Issue & KanbanItem>[] = [];

  for (const col of BOARD_COLUMNS) {
    const desired = (order[col.id] ?? []).map((id) => byId.get(id)).filter(Boolean) as Issue[];
    const desiredIds = new Set(desired.map((i) => i.id));

    const remaining = issues
      .filter((i) => i.status === col.id && !desiredIds.has(i.id))
      .sort((a, b) => {
        const at = a.updatedAt || a.createdAt || '';
        const bt = b.updatedAt || b.createdAt || '';
        return bt.localeCompare(at);
      });

    const items = [...desired, ...remaining].map((issue) => ({
      ...issue,
      id: issue.id,
      title: issue.title,
      status: issue.status,
    }));

    columns.push({
      id: col.id,
      title: formatTitle(col.id),
      items,
      icon: <LayoutGrid className="w-4 h-4" />,
    });
  }

  return columns;
}

function syncOrderWithIssues(prev: BoardOrder, issues: Issue[]): BoardOrder {
  const statusById = new Map(issues.map((i) => [i.id, i.status]));
  const next: BoardOrder = {};

  for (const { id: status } of BOARD_COLUMNS) {
    const existing = prev[status] ?? [];
    const filtered = existing.filter((id) => statusById.get(id) === status);
    const present = new Set(filtered);

    const missing = issues
      .filter((i) => i.status === status && !present.has(i.id))
      .map((i) => i.id);

    next[status] = [...filtered, ...missing];
  }

  return next;
}

function reorderIds(list: string[], from: number, to: number): string[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return list;
  next.splice(to, 0, moved);
  return next;
}

export function IssuesPanel({ onCreateIssue: _onCreateIssue }: IssuesPanelProps) {
  const { formatMessage } = useIntl();
  const projectPath = useWorkflowStore(selectProjectPath);

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // Board order state
  const [order, setOrder] = useState<BoardOrder>({});

  // Load board order when project changes
  useEffect(() => {
    const key = storageKey(projectPath);
    const loaded = safeParseOrder(localStorage.getItem(key));
    setOrder(loaded);
  }, [projectPath]);

  const { issues, criticalCount, isLoading } = useIssues({
    filter: {
      search: searchQuery || undefined,
      status: statusFilter !== 'all' ? [statusFilter] : undefined,
      priority: priorityFilter !== 'all' ? [priorityFilter] : undefined,
    },
  });

  const { updateIssue, deleteIssue } = useIssueMutations();

  // Keep order consistent with current issues
  useEffect(() => {
    setOrder((prev) => syncOrderWithIssues(prev, issues));
  }, [issues]);

  // Persist order
  useEffect(() => {
    const key = storageKey(projectPath);
    try {
      localStorage.setItem(key, JSON.stringify(order));
    } catch {
      // ignore quota errors
    }
  }, [order, projectPath]);

  // Status counts using backend statuses
  const statusCounts = useMemo(() => ({
    all: issues.length,
    registered: issues.filter(i => i.status === 'registered').length,
    planning: issues.filter(i => i.status === 'planning').length,
    planned: issues.filter(i => i.status === 'planned').length,
    executing: issues.filter(i => i.status === 'executing').length,
    completed: issues.filter(i => i.status === 'completed').length,
    failed: issues.filter(i => i.status === 'failed').length,
  }), [issues]);

  // Build kanban columns
  const columns = useMemo(
    () =>
      buildColumns(issues, order, (statusId) => {
        const col = BOARD_COLUMNS.find((c) => c.id === statusId);
        if (!col) return statusId;
        return formatMessage({ id: col.titleKey, defaultMessage: col.defaultLabel });
      }),
    [issues, order, formatMessage]
  );

  const idsByStatus = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of columns) {
      map[col.id] = col.items.map((i) => i.id);
    }
    return map;
  }, [columns]);

  const handleEditIssue = (_issue: Issue) => {};

  const handleDeleteIssue = async (issue: Issue) => {
    if (confirm(`Delete issue "${issue.title}"?`)) {
      await deleteIssue(issue.id);
    }
  };

  const handleStatusChange = async (issue: Issue, status: Issue['status']) => {
    await updateIssue(issue.id, { status });
  };

  const handleIssueClick = (issue: Issue) => {
    setSelectedIssue(issue);
  };

  const handleCloseDrawer = () => {
    setSelectedIssue(null);
  };

  // Board drag handler
  const handleDragEnd = useCallback(
    async (result: DropResult, sourceColumn: string, destColumn: string) => {
      const issueId = result.draggableId;
      const issue = issues.find((i) => i.id === issueId);
      if (!issue) return;

      const sourceStatus = sourceColumn as Issue['status'];
      const destStatus = destColumn as Issue['status'];
      const sourceIds = idsByStatus[sourceStatus] ?? [];
      const destIds = idsByStatus[destStatus] ?? [];

      // Update local order first (optimistic)
      setOrder((prev) => {
        const next = { ...prev };
        if (sourceStatus === destStatus) {
          next[sourceStatus] = reorderIds(sourceIds, result.source.index, result.destination!.index);
          return next;
        }

        const nextSource = [...sourceIds];
        nextSource.splice(result.source.index, 1);

        const nextDest = [...destIds];
        nextDest.splice(result.destination!.index, 0, issueId);

        next[sourceStatus] = nextSource;
        next[destStatus] = nextDest;
        return next;
      });

      // Status update
      if (sourceStatus !== destStatus) {
        try {
          await updateIssue(issueId, { status: destStatus });
        } catch (e) {
          console.error('Failed to update issue status:', e);
        }
      }
    },
    [issues, idsByStatus, updateIssue]
  );

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-info" />
            <span className="text-2xl font-bold">{statusCounts.registered}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'issues.status.registered', defaultMessage: '新注册' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning" />
            <span className="text-2xl font-bold">{statusCounts.executing}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'issues.status.executing', defaultMessage: '执行中' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <span className="text-2xl font-bold">{criticalCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'issues.priority.critical' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            <span className="text-2xl font-bold">{statusCounts.completed}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'issues.status.completed', defaultMessage: '已完成' })}</p>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'common.actions.searchIssues' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* View Mode Toggle */}
        <div className="flex border border-border rounded-md overflow-hidden">
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4 mr-1" />
            {formatMessage({ id: 'common.view.list', defaultMessage: '列表' })}
          </Button>
          <Button
            variant={viewMode === 'board' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none"
            onClick={() => setViewMode('board')}
          >
            <LayoutGrid className="w-4 h-4 mr-1" />
            {formatMessage({ id: 'common.view.board', defaultMessage: '看板' })}
          </Button>
        </div>

        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={formatMessage({ id: 'common.status.label' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{formatMessage({ id: 'issues.filters.all' })}</SelectItem>
              <SelectItem value="registered">{formatMessage({ id: 'issues.status.registered', defaultMessage: '新注册' })}</SelectItem>
              <SelectItem value="planning">{formatMessage({ id: 'issues.status.planning', defaultMessage: '规划中' })}</SelectItem>
              <SelectItem value="planned">{formatMessage({ id: 'issues.status.planned', defaultMessage: '已规划' })}</SelectItem>
              <SelectItem value="executing">{formatMessage({ id: 'issues.status.executing', defaultMessage: '执行中' })}</SelectItem>
              <SelectItem value="completed">{formatMessage({ id: 'issues.status.completed', defaultMessage: '已完成' })}</SelectItem>
              <SelectItem value="failed">{formatMessage({ id: 'issues.status.failed', defaultMessage: '失败' })}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={formatMessage({ id: 'issues.priority.label' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{formatMessage({ id: 'issues.filters.byPriority' })}</SelectItem>
              <SelectItem value="critical">{formatMessage({ id: 'issues.priority.critical' })}</SelectItem>
              <SelectItem value="high">{formatMessage({ id: 'issues.priority.high' })}</SelectItem>
              <SelectItem value="medium">{formatMessage({ id: 'issues.priority.medium' })}</SelectItem>
              <SelectItem value="low">{formatMessage({ id: 'issues.priority.low' })}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status Filter Pills - only in list mode */}
      {viewMode === 'list' && (
        <div className="flex flex-wrap gap-2">
          <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('all')}>
            {formatMessage({ id: 'issues.filters.all' })} ({statusCounts.all})
          </Button>
          <Button variant={statusFilter === 'registered' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('registered')}>
            <Badge variant="info" className="mr-2">{statusCounts.registered}</Badge>
            {formatMessage({ id: 'issues.status.registered', defaultMessage: '新注册' })}
          </Button>
          <Button variant={statusFilter === 'executing' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('executing')}>
            <Badge variant="warning" className="mr-2">{statusCounts.executing}</Badge>
            {formatMessage({ id: 'issues.status.executing', defaultMessage: '执行中' })}
          </Button>
          <Button variant={priorityFilter === 'critical' ? 'destructive' : 'outline'} size="sm" onClick={() => { setPriorityFilter(priorityFilter === 'critical' ? 'all' : 'critical'); setStatusFilter('all'); }}>
            <Badge variant="destructive" className="mr-2">{criticalCount}</Badge>
            {formatMessage({ id: 'issues.priority.critical' })}
          </Button>
        </div>
      )}

      {/* Content Area */}
      {viewMode === 'list' ? (
        <IssueList
          issues={issues}
          isLoading={isLoading}
          onIssueClick={handleIssueClick}
          onIssueEdit={handleEditIssue}
          onIssueDelete={handleDeleteIssue}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <KanbanBoard<Issue & KanbanItem>
          columns={columns}
          onDragEnd={handleDragEnd}
          onItemClick={(item) => handleIssueClick(item as unknown as Issue)}
          isLoading={isLoading}
          emptyColumnMessage={formatMessage({ id: 'issues.emptyState.message' })}
          className={cn('gap-4', 'grid')}
          renderItem={(item, provided) => (
            <IssueCard
              issue={item as unknown as Issue}
              compact
              showActions={false}
              onClick={(i) => handleIssueClick(i)}
              innerRef={provided.innerRef}
              draggableProps={provided.draggableProps}
              dragHandleProps={provided.dragHandleProps}
              className="w-full"
            />
          )}
        />
      )}

      {/* Issue Detail Drawer */}
      <IssueDrawer
        issue={selectedIssue}
        isOpen={selectedIssue !== null}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
