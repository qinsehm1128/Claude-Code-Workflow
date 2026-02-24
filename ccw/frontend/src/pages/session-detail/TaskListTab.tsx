// ========================================
// TaskListTab Component
// ========================================
// Tasks tab for session detail page

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  ListChecks,
  GitBranch,
  Calendar,
  FileCode,
  Layers,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { TaskStatsBar, TaskStatusDropdown } from '@/components/session-detail/tasks';
import type { SessionMetadata, TaskData } from '@/types/store';
import type { TaskStatus, FlowControl } from '@/lib/api';
import { bulkUpdateTaskStatus, updateTaskStatus } from '@/lib/api';

// Extended task type with all possible fields from JSON
interface ExtendedTask extends TaskData {
  meta?: {
    type?: string;
    scope?: string;
  };
  context?: {
    focus_paths?: string[];
    acceptance?: string[];
    depends_on?: string[];
  };
  flow_control?: FlowControl;
}

export interface TaskListTabProps {
  session: SessionMetadata;
  onTaskClick?: (task: TaskData) => void;
}

/**
 * TaskListTab component - Display tasks in a list format
 */
export function TaskListTab({ session, onTaskClick }: TaskListTabProps) {
  const { formatMessage } = useIntl();

  const tasks = session.tasks || [];

  // Detect if session tasks support status tracking (new format has explicit status/status_history in raw data)
  const hasStatusTracking = tasks.some((t) => {
    const raw = (t as unknown as Record<string, unknown>)._raw as Record<string, unknown> | undefined;
    const source = (raw?._raw as Record<string, unknown>) || raw;
    return source ? (source.status !== undefined || source.status_history !== undefined) : false;
  });

  const completed = tasks.filter((t) => t.status === 'completed').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;

  // Loading states for bulk actions
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [isLoadingInProgress, setIsLoadingInProgress] = useState(false);
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false);

  // Local task state for optimistic updates
  const [localTasks, setLocalTasks] = useState<TaskData[]>(tasks);

  // Update local tasks when session tasks change
  if (tasks !== localTasks && !isLoadingPending && !isLoadingInProgress && !isLoadingCompleted) {
    setLocalTasks(tasks);
  }

  // Get session path for API calls
  const sessionPath = (session as any).path || session.session_id;

  // Bulk action handlers - mark ALL tasks (not just filtered ones) to the target status
  const handleMarkAllPending = async () => {
    // Mark all non-pending tasks as pending
    const targetTasks = localTasks.filter((t) => t.status !== 'pending');
    if (targetTasks.length === 0) return;

    setIsLoadingPending(true);
    // Optimistic update
    setLocalTasks((prev) => prev.map((t) => ({ ...t, status: 'pending' as const })));
    try {
      const taskIds = targetTasks.map((t) => t.task_id);
      const result = await bulkUpdateTaskStatus(sessionPath, taskIds, 'pending');
      if (!result.success) {
        console.error('[TaskListTab] Failed to mark all as pending:', result.error);
        // Rollback on error
        setLocalTasks(tasks);
      }
    } catch (error) {
      console.error('[TaskListTab] Failed to mark all as pending:', error);
      setLocalTasks(tasks);
    } finally {
      setIsLoadingPending(false);
    }
  };

  const handleMarkAllInProgress = async () => {
    // Mark all non-in_progress tasks as in_progress
    const targetTasks = localTasks.filter((t) => t.status !== 'in_progress');
    if (targetTasks.length === 0) return;

    setIsLoadingInProgress(true);
    // Optimistic update
    setLocalTasks((prev) => prev.map((t) => ({ ...t, status: 'in_progress' as const })));
    try {
      const taskIds = targetTasks.map((t) => t.task_id);
      const result = await bulkUpdateTaskStatus(sessionPath, taskIds, 'in_progress');
      if (!result.success) {
        console.error('[TaskListTab] Failed to mark all as in_progress:', result.error);
        setLocalTasks(tasks);
      }
    } catch (error) {
      console.error('[TaskListTab] Failed to mark all as in_progress:', error);
      setLocalTasks(tasks);
    } finally {
      setIsLoadingInProgress(false);
    }
  };

  const handleMarkAllCompleted = async () => {
    // Mark all non-completed tasks as completed
    const targetTasks = localTasks.filter((t) => t.status !== 'completed');
    if (targetTasks.length === 0) return;

    setIsLoadingCompleted(true);
    // Optimistic update
    setLocalTasks((prev) => prev.map((t) => ({ ...t, status: 'completed' as const })));
    try {
      const taskIds = targetTasks.map((t) => t.task_id);
      const result = await bulkUpdateTaskStatus(sessionPath, taskIds, 'completed');
      if (!result.success) {
        console.error('[TaskListTab] Failed to mark all as completed:', result.error);
        setLocalTasks(tasks);
      }
    } catch (error) {
      console.error('[TaskListTab] Failed to mark all as completed:', error);
      setLocalTasks(tasks);
    } finally {
      setIsLoadingCompleted(false);
    }
  };

  // Individual task status change handler
  const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const previousTasks = [...localTasks];
    const previousTask = previousTasks.find((t) => t.task_id === taskId);

    if (!previousTask) return;

    // Optimistic update
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.task_id === taskId ? { ...t, status: newStatus } : t
      )
    );

    try {
      const result = await updateTaskStatus(sessionPath, taskId, newStatus);
      if (!result.success) {
        // Rollback on error
        setLocalTasks(previousTasks);
        console.error('[TaskListTab] Failed to update task status:', result.error);
      }
    } catch (error) {
      // Rollback on error
      setLocalTasks(previousTasks);
      console.error('[TaskListTab] Failed to update task status:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats Bar with Bulk Actions (only for tasks with status tracking) */}
      {hasStatusTracking && (
        <TaskStatsBar
          completed={completed}
          inProgress={inProgress}
          pending={pending}
          onMarkAllPending={handleMarkAllPending}
          onMarkAllInProgress={handleMarkAllInProgress}
          onMarkAllCompleted={handleMarkAllCompleted}
          isLoadingPending={isLoadingPending}
          isLoadingInProgress={isLoadingInProgress}
          isLoadingCompleted={isLoadingCompleted}
        />
      )}

      {/* Tasks List */}
      {localTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ListChecks className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {formatMessage({ id: 'sessionDetail.tasks.empty.title' })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatMessage({ id: 'sessionDetail.tasks.empty.message' })}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {localTasks.map((task, index) => {
            // Cast to extended type to access all possible fields
            const extTask = task as unknown as ExtendedTask;

            // Get depends_on from either root level or context
            const dependsOn = extTask.depends_on || extTask.context?.depends_on || [];
            const dependsCount = dependsOn.length;

            // Get meta info
            const taskType = extTask.meta?.type;
            const taskScope = extTask.meta?.scope;

            // Get implementation steps count from flow_control
            const stepsCount = extTask.flow_control?.implementation_approach?.length || 0;

            // Get target files count
            const filesCount = extTask.flow_control?.target_files?.length || 0;

            return (
              <Card
                key={`${task.task_id}-${index}`}
                className={`hover:shadow-sm transition-shadow ${onTaskClick ? 'cursor-pointer hover:shadow-md' : ''}`}
                onClick={() => onTaskClick?.(task as TaskData)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Task ID, Title, Description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                          {task.task_id}
                        </span>
                      </div>
                      <h4 className="font-medium text-foreground text-sm">
                        {task.title || formatMessage({ id: 'sessionDetail.tasks.untitled' })}
                      </h4>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>

                    {/* Right: Status and Meta info */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {/* Row 1: Status dropdown (only for tasks with status tracking) */}
                      {hasStatusTracking && (
                        <TaskStatusDropdown
                          currentStatus={task.status as TaskStatus}
                          onStatusChange={(newStatus) => handleTaskStatusChange(task.task_id, newStatus)}
                          size="sm"
                        />
                      )}

                      {/* Row 2: Meta info */}
                      <div className="flex items-center gap-3 flex-wrap justify-end text-xs text-muted-foreground">
                        {taskType && (
                          <span className="bg-muted px-1.5 py-0.5 rounded">{taskType}</span>
                        )}
                        {stepsCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            {stepsCount} {formatMessage({ id: 'sessionDetail.tasks.steps' })}
                          </span>
                        )}
                        {filesCount > 0 && (
                          <span className="flex items-center gap-1">
                            <FileCode className="h-3 w-3" />
                            {filesCount} {formatMessage({ id: 'sessionDetail.tasks.files' })}
                          </span>
                        )}
                        {dependsCount > 0 && (
                          <span className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" />
                            {dependsCount} {formatMessage({ id: 'sessionDetail.tasks.deps' })}
                          </span>
                        )}
                      </div>

                      {/* Row 3: Scope or Date */}
                      {(taskScope || task.created_at) && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {taskScope && (
                            <span className="bg-muted px-1.5 py-0.5 rounded">{taskScope}</span>
                          )}
                          {task.created_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.created_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
