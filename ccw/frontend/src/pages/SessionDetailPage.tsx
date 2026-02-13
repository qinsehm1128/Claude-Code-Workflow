// ========================================
// SessionDetailPage Component
// ========================================
// Session detail page with tabs for tasks, context, summary, impl-plan, conflict, and review

import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  ArrowLeft,
  Calendar,
  ListChecks,
  Package,
  FileText,
  XCircle,
  Ruler,
  Scale,
  Search,
} from 'lucide-react';
import { useSessionDetail } from '@/hooks/useSessionDetail';
import { TaskListTab } from './session-detail/TaskListTab';
import { ContextTab } from './session-detail/ContextTab';
import { SummaryTab } from './session-detail/SummaryTab';
import ImplPlanTab from './session-detail/ImplPlanTab';
import { ConflictTab } from './session-detail/ConflictTab';
import { ReviewTab } from './session-detail/ReviewTab';
import { TaskDrawer } from '@/components/shared/TaskDrawer';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TabsNavigation, type TabItem } from '@/components/ui/TabsNavigation';
import type { TaskData, SessionMetadata } from '@/types/store';

type TabValue = 'tasks' | 'context' | 'summary' | 'impl-plan' | 'conflict' | 'review';

// Status label keys for i18n (maps snake_case status to camelCase translation keys)
const statusLabelKeys: Record<SessionMetadata['status'], string> = {
  planning: 'sessions.status.planning',
  in_progress: 'sessions.status.inProgress',
  completed: 'sessions.status.completed',
  archived: 'sessions.status.archived',
  paused: 'sessions.status.paused',
};

/**
 * SessionDetailPage component - Main session detail page with tabs
 */
export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { sessionDetail, isLoading, error, refetch } = useSessionDetail(sessionId!);
  const [activeTab, setActiveTab] = React.useState<TabValue>('tasks');
  const [selectedTask, setSelectedTask] = React.useState<TaskData | null>(null);

  const handleBack = () => {
    navigate('/sessions');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" disabled>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'common.actions.back' })}
          </Button>
          <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
        <XCircle className="h-5 w-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">{formatMessage({ id: 'common.errors.loadFailed' })}</p>
          <p className="text-xs mt-0.5">{error.message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {formatMessage({ id: 'common.actions.retry' })}
        </Button>
      </div>
    );
  }

  // Session not found
  if (!sessionDetail) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'sessionDetail.notFound.title' })}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {formatMessage({ id: 'sessionDetail.notFound.message' })}
        </p>
        <Button onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {formatMessage({ id: 'common.actions.back' })}
        </Button>
      </div>
    );
  }

  const { session, context, summary, summaries, implPlan, conflicts, review } = sessionDetail;
  const tasks = session.tasks || [];
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const hasReview = session.has_review || session.review;

  const tabs: TabItem[] = [
    {
      value: 'tasks',
      label: formatMessage({ id: 'sessionDetail.tabs.tasks' }),
      icon: <ListChecks className="h-4 w-4" />,
      badge: <Badge variant="secondary" className="ml-2">{tasks.length}</Badge>,
    },
    {
      value: 'context',
      label: formatMessage({ id: 'sessionDetail.tabs.context' }),
      icon: <Package className="h-4 w-4" />,
    },
    {
      value: 'summary',
      label: formatMessage({ id: 'sessionDetail.tabs.summary' }),
      icon: <FileText className="h-4 w-4" />,
    },
    {
      value: 'impl-plan',
      label: formatMessage({ id: 'sessionDetail.tabs.implPlan' }),
      icon: <Ruler className="h-4 w-4" />,
    },
    {
      value: 'conflict',
      label: formatMessage({ id: 'sessionDetail.tabs.conflict' }),
      icon: <Scale className="h-4 w-4" />,
    },
  ];

  if (hasReview) {
    tabs.push({
      value: 'review',
      label: formatMessage({ id: 'sessionDetail.tabs.review' }),
      icon: <Search className="h-4 w-4" />,
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'common.actions.back' })}
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {session.title || session.session_id}
            </h1>
            {session.title && session.title !== session.session_id && (
              <p className="text-sm text-muted-foreground mt-0.5">{session.session_id}</p>
            )}
          </div>
        </div>
        <Badge variant={session.status === 'completed' ? 'success' : 'secondary'}>
          {formatMessage({ id: statusLabelKeys[session.status] ?? 'sessions.status.inProgress' })}
        </Badge>
      </div>

      {/* Info Bar */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground p-4 bg-background rounded-lg border">
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          <span className="font-medium">{formatMessage({ id: 'sessionDetail.info.created' })}:</span>{' '}
          {new Date(session.created_at).toLocaleString()}
        </div>
        {session.updated_at && (
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">{formatMessage({ id: 'sessionDetail.info.updated' })}:</span>{' '}
            {new Date(session.updated_at).toLocaleString()}
          </div>
        )}
        <div className="flex items-center gap-1">
          <ListChecks className="h-4 w-4" />
          <span className="font-medium">{formatMessage({ id: 'sessionDetail.info.tasks' })}:</span>{' '}
          {completedTasks}/{tasks.length}
        </div>
      </div>

      {/* Tabs */}
      <TabsNavigation
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
        tabs={tabs}
      />

      {/* Tab Content */}
      {activeTab === 'tasks' && (
        <div className="mt-4">
          <TaskListTab session={session} onTaskClick={setSelectedTask} />
        </div>
      )}

      {activeTab === 'context' && (
        <div className="mt-4">
          <ContextTab context={context} />
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="mt-4">
          <SummaryTab summary={summary} summaries={summaries} />
        </div>
      )}

      {activeTab === 'impl-plan' && (
        <div className="mt-4">
          <ImplPlanTab implPlan={implPlan as string | undefined} />
        </div>
      )}

      {activeTab === 'conflict' && (
        <div className="mt-4">
          <ConflictTab conflicts={conflicts as any} />
        </div>
      )}

      {hasReview && activeTab === 'review' && (
        <div className="mt-4">
          <ReviewTab review={review as any} />
        </div>
      )}

      {/* Description (if exists) */}
      {session.description && (
        <div className="p-4 bg-background rounded-lg border">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            {formatMessage({ id: 'sessionDetail.info.description' })}
          </h3>
          <p className="text-sm text-muted-foreground">{session.description}</p>
        </div>
      )}

      {/* TaskDrawer */}
      <TaskDrawer
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}

export default SessionDetailPage;
