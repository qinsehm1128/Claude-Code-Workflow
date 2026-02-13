// ========================================
// Issue Manager Page
// ========================================
// Track and manage project issues with drag-drop queue

import { useState, useEffect, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import {
  AlertCircle,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  Github,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import { IssueCard } from '@/components/shared/IssueCard';
import { useIssues, useIssueMutations } from '@/hooks';
import { pullIssuesFromGitHub } from '@/lib/api';
import type { Issue } from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== Types ==========

type StatusFilter = 'all' | Issue['status'];
type PriorityFilter = 'all' | Issue['priority'];

// ========== New Issue Dialog ==========

interface NewIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; context?: string; priority?: Issue['priority'] }) => void;
  isCreating: boolean;
}

function NewIssueDialog({ open, onOpenChange, onSubmit, isCreating }: NewIssueDialogProps) {
  const { formatMessage } = useIntl();
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [priority, setPriority] = useState<Issue['priority']>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSubmit({ title: title.trim(), context: context.trim() || undefined, priority });
      setTitle('');
      setContext('');
      setPriority('medium');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{formatMessage({ id: 'issues.createDialog.title' })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-foreground">{formatMessage({ id: 'issues.createDialog.labels.title' })}</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={formatMessage({ id: 'issues.createDialog.placeholders.title' })}
              className="mt-1"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{formatMessage({ id: 'issues.createDialog.labels.context' })}</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={formatMessage({ id: 'issues.createDialog.placeholders.context' })}
              className="mt-1 w-full min-h-[100px] p-3 bg-background border border-input rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{formatMessage({ id: 'issues.createDialog.labels.priority' })}</label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Issue['priority'])}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{formatMessage({ id: 'issues.priority.low' })}</SelectItem>
                <SelectItem value="medium">{formatMessage({ id: 'issues.priority.medium' })}</SelectItem>
                <SelectItem value="high">{formatMessage({ id: 'issues.priority.high' })}</SelectItem>
                <SelectItem value="critical">{formatMessage({ id: 'issues.priority.critical' })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {formatMessage({ id: 'issues.createDialog.buttons.cancel' })}
            </Button>
            <Button type="submit" disabled={isCreating || !title.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {formatMessage({ id: 'issues.createDialog.buttons.creating' })}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {formatMessage({ id: 'issues.createDialog.buttons.create' })}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ========== Edit Issue Dialog ==========

interface EditIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: Issue | null;
  onSubmit: (issueId: string, data: { title: string; context?: string; priority: Issue['priority']; status: Issue['status'] }) => void;
  isUpdating: boolean;
}

function EditIssueDialog({ open, onOpenChange, issue, onSubmit, isUpdating }: EditIssueDialogProps) {
  const { formatMessage } = useIntl();
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [priority, setPriority] = useState<Issue['priority']>('medium');
  const [status, setStatus] = useState<Issue['status']>('open');

  // Reset form when dialog opens or issue changes
  useEffect(() => {
    if (open && issue) {
      setTitle(issue.title ?? '');
      setContext(issue.context ?? '');
      setPriority(issue.priority ?? 'medium');
      setStatus(issue.status ?? 'open');
    } else if (!open) {
      setTitle('');
      setContext('');
      setPriority('medium');
      setStatus('open');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, issue?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue) return;
    if (!title.trim()) return;

    onSubmit(issue.id, {
      title: title.trim(),
      context: context.trim() || undefined,
      priority,
      status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{formatMessage({ id: 'issues.editDialog.title' })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-foreground">{formatMessage({ id: 'issues.editDialog.labels.title' })}</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={formatMessage({ id: 'issues.editDialog.placeholders.title' })}
              className="mt-1"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{formatMessage({ id: 'issues.editDialog.labels.context' })}</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={formatMessage({ id: 'issues.editDialog.placeholders.context' })}
              className="mt-1 w-full min-h-[100px] p-3 bg-background border border-input rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">{formatMessage({ id: 'issues.editDialog.labels.priority' })}</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Issue['priority'])}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{formatMessage({ id: 'issues.priority.low' })}</SelectItem>
                  <SelectItem value="medium">{formatMessage({ id: 'issues.priority.medium' })}</SelectItem>
                  <SelectItem value="high">{formatMessage({ id: 'issues.priority.high' })}</SelectItem>
                  <SelectItem value="critical">{formatMessage({ id: 'issues.priority.critical' })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">{formatMessage({ id: 'issues.editDialog.labels.status' })}</label>
              <Select value={status} onValueChange={(v) => setStatus(v as Issue['status'])}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">{formatMessage({ id: 'issues.status.open' })}</SelectItem>
                  <SelectItem value="in_progress">{formatMessage({ id: 'issues.status.inProgress' })}</SelectItem>
                  <SelectItem value="resolved">{formatMessage({ id: 'issues.status.resolved' })}</SelectItem>
                  <SelectItem value="closed">{formatMessage({ id: 'issues.status.closed' })}</SelectItem>
                  <SelectItem value="completed">{formatMessage({ id: 'issues.status.completed' })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {formatMessage({ id: 'issues.editDialog.buttons.cancel' })}
            </Button>
            <Button type="submit" disabled={isUpdating || !issue || !title.trim()}>
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {formatMessage({ id: 'issues.editDialog.buttons.saving' })}
                </>
              ) : (
                <>
                  {formatMessage({ id: 'issues.editDialog.buttons.save' })}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ========== Issue List Component ==========

interface IssueListProps {
  issues: Issue[];
  isLoading: boolean;
  onIssueClick: (issue: Issue) => void;
  onIssueEdit: (issue: Issue) => void;
  onIssueDelete: (issue: Issue) => void;
  onStatusChange: (issue: Issue, status: Issue['status']) => void;
}

function IssueList({
  issues,
  isLoading,
  onIssueClick,
  onIssueEdit,
  onIssueDelete,
  onStatusChange,
}: IssueListProps) {
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
        <p className="mt-2 text-muted-foreground">
          {formatMessage({ id: 'issues.emptyState.message' })}
        </p>
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

// ========== Main Page Component ==========

export function IssueManagerPage() {
  const { formatMessage } = useIntl();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [isNewIssueOpen, setIsNewIssueOpen] = useState(false);
  const [isEditIssueOpen, setIsEditIssueOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [isGithubSyncing, setIsGithubSyncing] = useState(false);

  const {
    issues,
    issuesByStatus,
    openCount,
    criticalCount,
    isLoading,
    isFetching,
    refetch,
  } = useIssues({
    filter: {
      search: searchQuery || undefined,
      status: statusFilter !== 'all' ? [statusFilter] : undefined,
      priority: priorityFilter !== 'all' ? [priorityFilter] : undefined,
    },
  });

  const { createIssue, updateIssue, deleteIssue, isCreating, isUpdating } = useIssueMutations();

  // Filter counts
  const statusCounts = useMemo(() => ({
    all: issues.length,
    open: issuesByStatus.open?.length || 0,
    in_progress: issuesByStatus.in_progress?.length || 0,
    resolved: issuesByStatus.resolved?.length || 0,
    closed: issuesByStatus.closed?.length || 0,
    completed: issuesByStatus.completed?.length || 0,
  }), [issues, issuesByStatus]);

  const handleCreateIssue = async (data: { title: string; context?: string; priority?: Issue['priority'] }) => {
    await createIssue(data);
    setIsNewIssueOpen(false);
  };

  const handleEditIssue = (issue: Issue) => {
    setEditingIssue(issue);
    setIsEditIssueOpen(true);
  };

  const handleCloseEditDialog = (open: boolean) => {
    setIsEditIssueOpen(open);
    if (!open) {
      setEditingIssue(null);
    }
  };

  const handleUpdateIssue = async (issueId: string, data: { title: string; context?: string; priority: Issue['priority']; status: Issue['status'] }) => {
    await updateIssue(issueId, data);
    setIsEditIssueOpen(false);
    setEditingIssue(null);
  };

  const handleDeleteIssue = async (issue: Issue) => {
    if (confirm(`Delete issue "${issue.title}"?`)) {
      await deleteIssue(issue.id);
    }
  };

  const handleStatusChange = async (issue: Issue, status: Issue['status']) => {
    await updateIssue(issue.id, { status });
  };

  const handleGithubSync = async () => {
    setIsGithubSyncing(true);
    try {
      const result = await pullIssuesFromGitHub({ state: 'open', limit: 100 });
      await refetch();
      toast.success(formatMessage({ id: 'issues.messages.githubSyncSuccess' }, { ...result }));
    } catch (err) {
      console.error('GitHub sync failed:', err);
      toast.error(formatMessage({ id: 'issues.messages.githubSyncError' }));
    } finally {
      setIsGithubSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-primary" />
            {formatMessage({ id: 'issues.title' })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatMessage({ id: 'issues.description' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('w-4 h-4 mr-2', isFetching && 'animate-spin')} />
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
          <Button variant="outline" onClick={handleGithubSync} disabled={isGithubSyncing}>
            {isGithubSyncing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Github className="w-4 h-4 mr-2" />
            )}
            {formatMessage({ id: 'issues.actions.github' })}
          </Button>
          <Button onClick={() => setIsNewIssueOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'issues.actions.create' })}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-info" />
            <span className="text-2xl font-bold">{openCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'common.status.openIssues' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning" />
            <span className="text-2xl font-bold">{issuesByStatus.in_progress?.length || 0}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'issues.status.inProgress' })}</p>
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
            <span className="text-2xl font-bold">{issuesByStatus.resolved?.length || 0}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'issues.status.resolved' })}</p>
        </Card>
      </div>

      {/* Filters and Search */}
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
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={formatMessage({ id: 'common.status.label' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{formatMessage({ id: 'issues.filters.all' })}</SelectItem>
              <SelectItem value="open">{formatMessage({ id: 'issues.status.open' })}</SelectItem>
              <SelectItem value="in_progress">{formatMessage({ id: 'issues.status.inProgress' })}</SelectItem>
              <SelectItem value="resolved">{formatMessage({ id: 'issues.status.resolved' })}</SelectItem>
              <SelectItem value="closed">{formatMessage({ id: 'issues.status.closed' })}</SelectItem>
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

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
        >
          {formatMessage({ id: 'issues.filters.all' })} ({statusCounts.all})
        </Button>
        <Button
          variant={statusFilter === 'open' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('open')}
        >
          <Badge variant="info" className="mr-2">{statusCounts.open}</Badge>
          {formatMessage({ id: 'issues.status.open' })}
        </Button>
        <Button
          variant={statusFilter === 'in_progress' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('in_progress')}
        >
          <Badge variant="warning" className="mr-2">{statusCounts.in_progress}</Badge>
          {formatMessage({ id: 'issues.status.inProgress' })}
        </Button>
        <Button
          variant={priorityFilter === 'critical' ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => {
            setPriorityFilter(priorityFilter === 'critical' ? 'all' : 'critical');
            setStatusFilter('all');
          }}
        >
          <Badge variant="destructive" className="mr-2">{criticalCount}</Badge>
          {formatMessage({ id: 'issues.priority.critical' })}
        </Button>
      </div>

      {/* Issue List */}
      <IssueList
        issues={issues}
        isLoading={isLoading}
        onIssueClick={() => {}}
        onIssueEdit={handleEditIssue}
        onIssueDelete={handleDeleteIssue}
        onStatusChange={handleStatusChange}
      />

      {/* New Issue Dialog */}
      <NewIssueDialog
        open={isNewIssueOpen}
        onOpenChange={setIsNewIssueOpen}
        onSubmit={handleCreateIssue}
        isCreating={isCreating}
      />

      {/* Edit Issue Dialog */}
      <EditIssueDialog
        open={isEditIssueOpen}
        onOpenChange={handleCloseEditDialog}
        issue={editingIssue}
        onSubmit={handleUpdateIssue}
        isUpdating={isUpdating}
      />
    </div>
  );
}

export default IssueManagerPage;
