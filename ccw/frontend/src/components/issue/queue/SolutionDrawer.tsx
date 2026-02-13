// ========================================
// SolutionDrawer Component
// ========================================
// Right-side solution detail drawer

import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { X, FileText, CheckCircle, Circle, Loader2, XCircle, Clock, AlertTriangle, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { QueueItemExecutor } from '@/components/issue/queue/QueueItemExecutor';
import { useOpenTerminalPanel } from '@/stores/terminalPanelStore';
import { useIssueQueue } from '@/hooks';
import { cn } from '@/lib/utils';
import type { QueueItem } from '@/lib/api';

// ========== Types ==========
export interface SolutionDrawerProps {
  item: QueueItem | null;
  isOpen: boolean;
  onClose: () => void;
}

type TabValue = 'overview' | 'tasks' | 'terminal' | 'json';

// ========== Status Configuration ==========
const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: 'issues.queue.status.pending', variant: 'secondary', icon: Circle },
  ready: { label: 'issues.queue.status.ready', variant: 'info', icon: Clock },
  executing: { label: 'issues.queue.status.executing', variant: 'warning', icon: Loader2 },
  completed: { label: 'issues.queue.status.completed', variant: 'success', icon: CheckCircle },
  failed: { label: 'issues.queue.status.failed', variant: 'destructive', icon: XCircle },
  blocked: { label: 'issues.queue.status.blocked', variant: 'destructive', icon: AlertTriangle },
};

// ========== Component ==========

export function SolutionDrawer({ item, isOpen, onClose }: SolutionDrawerProps) {
  const { formatMessage } = useIntl();
  const openTerminal = useOpenTerminalPanel();
  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const { data: queue } = useIssueQueue();
  const itemId = item?.item_id;
  const solutionId = item?.solution_id;

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Reset tab when switching items
  useEffect(() => {
    if (!isOpen || !itemId) return;
    setActiveTab('overview');
  }, [itemId, isOpen]);

  const tasksForSolution = useMemo(() => {
    if (!solutionId) return [];
    const allItems = Object.values(queue?.grouped_items || {}).flat();
    const isTaskItem = (qi: QueueItem) => Boolean(qi.task_id) || qi.item_id.startsWith('task-');
    return allItems
      .filter((qi) => qi.solution_id === solutionId && isTaskItem(qi))
      .sort((a, b) => a.execution_order - b.execution_order);
  }, [queue?.grouped_items, solutionId]);

  if (!item || !isOpen) {
    return null;
  }

  const status = statusConfig[item.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  // Get solution details (would need to fetch full solution data)
  const issueId = item.issue_id;

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 transition-opacity z-40',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-1/2 bg-background border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        style={{ minWidth: '400px', maxWidth: '800px' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border bg-card">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-muted-foreground">{item.item_id}</span>
              <Badge variant={status.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {formatMessage({ id: status.label })}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'issues.solution.issue' })}: <span className="font-mono">{issueId}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'issues.solution.solution' })}: <span className="font-mono">{solutionId}</span>
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0 hover:bg-secondary">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 bg-card">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">
                <FileText className="h-4 w-4 mr-2" />
                {formatMessage({ id: 'issues.solution.tabs.overview' })}
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />
                {formatMessage({ id: 'issues.solution.tabs.tasks' })}
              </TabsTrigger>
              <TabsTrigger value="terminal" className="flex-1">
                <Terminal className="h-4 w-4 mr-2" />
                {formatMessage({ id: 'issues.solution.tabs.terminal' })}
              </TabsTrigger>
              <TabsTrigger value="json" className="flex-1">
                <FileText className="h-4 w-4 mr-2" />
                {formatMessage({ id: 'issues.solution.tabs.json' })}
              </TabsTrigger>
            </TabsList>

            {/* Tab Content */}
            <div className="overflow-y-auto pr-2" style={{ height: 'calc(100vh - 200px)' }}>
              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-4 pb-6 focus-visible:outline-none">
                <div className="space-y-6">
                  {/* Execution Info */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                      {formatMessage({ id: 'issues.solution.overview.executionInfo' })}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-muted/50 rounded-md">
                        <p className="text-xs text-muted-foreground">{formatMessage({ id: 'issues.solution.overview.executionOrder' })}</p>
                        <p className="text-lg font-semibold">{item.execution_order}</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-md">
                        <p className="text-xs text-muted-foreground">{formatMessage({ id: 'issues.solution.overview.semanticPriority' })}</p>
                        <p className="text-lg font-semibold">{item.semantic_priority}</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-md">
                        <p className="text-xs text-muted-foreground">{formatMessage({ id: 'issues.solution.overview.group' })}</p>
                        <p className="text-sm font-mono truncate">{item.execution_group}</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-md">
                        <p className="text-xs text-muted-foreground">{formatMessage({ id: 'issues.solution.overview.taskCount' })}</p>
                        <p className="text-lg font-semibold">{item.task_count || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Unified Execution */}
                  <QueueItemExecutor item={item} />

                  {/* Dependencies */}
                  {item.depends_on && item.depends_on.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-2">
                        {formatMessage({ id: 'issues.solution.overview.dependencies' })}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {item.depends_on.map((dep, index) => (
                          <Badge key={index} variant="outline" className="font-mono text-xs">
                            {dep}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Files Touched */}
                  {item.files_touched && item.files_touched.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-2">
                        {formatMessage({ id: 'issues.solution.overview.filesTouched' })}
                      </h3>
                      <div className="space-y-1">
                        {item.files_touched.map((file, index) => (
                          <div key={index} className="p-2 bg-muted/50 rounded-md">
                            <span className="text-sm font-mono">{file}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Tasks Tab */}
              <TabsContent value="tasks" className="mt-4 pb-6 focus-visible:outline-none">
                {tasksForSolution.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">{formatMessage({ id: 'issues.solution.tasks.empty' })}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tasksForSolution.map((task) => {
                      const taskStatus = statusConfig[task.status] || statusConfig.pending;
                      const TaskStatusIcon = taskStatus.icon;
                      const taskId = task.task_id || task.item_id;

                      return (
                        <div
                          key={task.item_id}
                          className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-md"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-mono truncate">{taskId}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatMessage({ id: 'issues.solution.overview.executionOrder' })}: {task.execution_order}
                              {' · '}
                              {formatMessage({ id: 'issues.solution.overview.group' })}: {task.execution_group}
                            </p>
                          </div>
                          <Badge variant={taskStatus.variant} className="gap-1 shrink-0">
                            <TaskStatusIcon
                              className={cn('h-3 w-3', task.status === 'executing' && 'animate-spin')}
                            />
                            {formatMessage({ id: taskStatus.label })}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Terminal Tab - Link to Terminal Panel */}
              <TabsContent value="terminal" className="mt-4 pb-6 focus-visible:outline-none">
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Terminal className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm mb-4">{formatMessage({ id: 'home.terminalPanel.openInPanel' })}</p>
                  <Button
                    onClick={() => {
                      openTerminal(issueId);
                      onClose();
                    }}
                  >
                    <Terminal className="h-4 w-4 mr-2" />
                    {formatMessage({ id: 'home.terminalPanel.openInPanel' })}
                  </Button>
                </div>
              </TabsContent>

              {/* JSON Tab */}
              <TabsContent value="json" className="mt-4 pb-6 focus-visible:outline-none">
                <pre className="p-4 bg-muted rounded-md overflow-x-auto text-xs">
                  {JSON.stringify(item, null, 2)}
                </pre>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </>
  );
}

export default SolutionDrawer;
