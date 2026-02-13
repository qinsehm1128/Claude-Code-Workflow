// ========================================
// Issue Hub Page
// ========================================
// Unified page for issues, queue, and discovery with tab navigation

import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  Plus,
  RefreshCw,
  Github,
  Loader2,
} from 'lucide-react';
import { IssueHubHeader } from '@/components/issue/hub/IssueHubHeader';
import { IssueHubTabs, type IssueTab } from '@/components/issue/hub/IssueHubTabs';
import { IssuesPanel } from '@/components/issue/hub/IssuesPanel';
import { IssueBoardPanel } from '@/components/issue/hub/IssueBoardPanel';
import { QueuePanel } from '@/components/issue/hub/QueuePanel';
import { DiscoveryPanel } from '@/components/issue/hub/DiscoveryPanel';
import { ObservabilityPanel } from '@/components/issue/hub/ObservabilityPanel';
import { ExecutionPanel } from '@/components/issue/hub/ExecutionPanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import { useIssues, useIssueMutations, useIssueQueue } from '@/hooks';
import { pullIssuesFromGitHub } from '@/lib/api';
import type { Issue } from '@/lib/api';
import { cn } from '@/lib/utils';

function NewIssueDialog({ open, onOpenChange, onSubmit, isCreating }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; context?: string; priority?: Issue['priority'] }) => void;
  isCreating: boolean;
}) {
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

export function IssueHubPage() {
  const { formatMessage } = useIntl();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as IssueTab) || 'issues';
  const [isNewIssueOpen, setIsNewIssueOpen] = useState(false);
  const [isGithubSyncing, setIsGithubSyncing] = useState(false);

  // Issues data
  const { refetch: refetchIssues, isFetching: isFetchingIssues } = useIssues();
  // Queue data
  const { refetch: refetchQueue, isFetching: isFetchingQueue } = useIssueQueue();

  const { createIssue, isCreating } = useIssueMutations();

  const setCurrentTab = (tab: IssueTab) => {
    setSearchParams({ tab });
  };

  // Issues tab handlers
  const handleIssuesRefresh = useCallback(() => {
    refetchIssues();
  }, [refetchIssues]);

  const handleGithubSync = useCallback(async () => {
    setIsGithubSyncing(true);
    try {
      const result = await pullIssuesFromGitHub({ state: 'open', limit: 100 });
      console.log('GitHub sync result:', result);
      await refetchIssues();
    } catch (error) {
      console.error('GitHub sync failed:', error);
    } finally {
      setIsGithubSyncing(false);
    }
  }, [refetchIssues]);

  const handleCreateIssue = async (data: { title: string; context?: string; priority?: Issue['priority'] }) => {
    await createIssue(data);
    setIsNewIssueOpen(false);
  };

  // Queue tab handler
  const handleQueueRefresh = useCallback(() => {
    refetchQueue();
  }, [refetchQueue]);

  // Render action buttons based on current tab
  const renderActionButtons = () => {
    switch (currentTab) {
      case 'issues':
      case 'board':
        return (
          <>
            <Button variant="outline" onClick={handleIssuesRefresh} disabled={isFetchingIssues}>
              <RefreshCw className={cn('w-4 h-4 mr-2', isFetchingIssues && 'animate-spin')} />
              {formatMessage({ id: 'common.actions.refresh' })}
            </Button>
            <Button variant="outline" onClick={handleGithubSync} disabled={isGithubSyncing}>
              <Github className={cn('w-4 h-4 mr-2', isGithubSyncing && 'animate-spin')} />
              {formatMessage({ id: 'issues.actions.github' })}
            </Button>
            <Button onClick={() => setIsNewIssueOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {formatMessage({ id: 'issues.actions.create' })}
            </Button>
          </>
        );

      case 'queue':
        return (
          <>
            <Button variant="outline" onClick={handleQueueRefresh} disabled={isFetchingQueue}>
              <RefreshCw className={cn('w-4 h-4 mr-2', isFetchingQueue && 'animate-spin')} />
              {formatMessage({ id: 'common.actions.refresh' })}
            </Button>
          </>
        );

      case 'discovery':
        return null; // Discovery panel has its own controls

      case 'observability':
        return null; // Observability panel has its own controls

      case 'executions':
        return null; // Execution panel has its own controls

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and action buttons on same row */}
      <div className="flex items-center justify-between">
        <IssueHubHeader currentTab={currentTab} />

        {/* Action buttons - dynamic based on current tab */}
        {renderActionButtons() && (
          <div className="flex gap-2">
            {renderActionButtons()}
          </div>
        )}
      </div>

      <IssueHubTabs currentTab={currentTab} onTabChange={setCurrentTab} />
      {currentTab === 'issues' && <IssuesPanel onCreateIssue={() => setIsNewIssueOpen(true)} />}
      {currentTab === 'board' && <IssueBoardPanel />}
      {currentTab === 'queue' && <QueuePanel />}
      {currentTab === 'discovery' && <DiscoveryPanel />}
      {currentTab === 'observability' && <ObservabilityPanel />}
      {currentTab === 'executions' && <ExecutionPanel />}

      <NewIssueDialog open={isNewIssueOpen} onOpenChange={setIsNewIssueOpen} onSubmit={handleCreateIssue} isCreating={isCreating} />
    </div>
  );
}

export default IssueHubPage;
