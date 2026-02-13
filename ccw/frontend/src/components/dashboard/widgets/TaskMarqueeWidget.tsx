// ========================================
// TaskMarqueeWidget Component
// ========================================
// Widget showing scrolling task details in a marquee/ticker format

import { memo, useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TaskMarqueeWidgetProps {
  className?: string;
}

interface TaskItem {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  progress: number;
}

// Mock task data
const MOCK_TASKS: TaskItem[] = [
  { id: '1', name: 'Implement user authentication system', status: 'in_progress', priority: 'high', progress: 75 },
  { id: '2', name: 'Design database schema', status: 'completed', priority: 'high', progress: 100 },
  { id: '3', name: 'Setup CI/CD pipeline', status: 'in_progress', priority: 'critical', progress: 45 },
  { id: '4', name: 'Write API documentation', status: 'pending', priority: 'medium', progress: 0 },
  { id: '5', name: 'Performance optimization', status: 'completed', priority: 'medium', progress: 100 },
  { id: '6', name: 'Security audit and fixes', status: 'failed', priority: 'critical', progress: 30 },
  { id: '7', name: 'Integration testing', status: 'in_progress', priority: 'high', progress: 60 },
  { id: '8', name: 'Deploy to staging', status: 'pending', priority: 'medium', progress: 0 },
];

// Status color mapping
const statusColors: Record<string, string> = {
  pending: 'bg-muted',
  in_progress: 'bg-warning/20 text-warning',
  completed: 'bg-success/20 text-success',
  failed: 'bg-destructive/20 text-destructive',
};

const priorityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-info/20 text-info',
  high: 'bg-warning/20 text-warning',
  critical: 'bg-destructive/20 text-destructive',
};

// Map status values to i18n keys
const statusLabelKeys: Record<string, string> = {
  pending: 'common.status.pending',
  in_progress: 'common.status.inProgress',
  completed: 'common.status.completed',
  failed: 'common.status.failed',
};

function TaskMarqueeWidgetComponent({ className }: TaskMarqueeWidgetProps) {
  const { formatMessage } = useIntl();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-advance task display every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % MOCK_TASKS.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const currentTask = MOCK_TASKS[currentIndex];

  return (
    <Card className={cn('h-full p-4 flex flex-col', className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <ListChecks className="h-5 w-5" />
        {formatMessage({ id: 'home.sections.taskDetails' })}
      </h3>

      <div className="flex-1 flex flex-col justify-center gap-4">
        {/* Task name with marquee effect */}
        <div className="overflow-hidden">
          <div className="animate-marquee">
            <h4 className="text-base font-semibold text-foreground whitespace-nowrap">
              {currentTask.name}
            </h4>
          </div>
        </div>

        {/* Status and Priority badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn(statusColors[currentTask.status], 'capitalize')}>
            {formatMessage({ id: statusLabelKeys[currentTask.status] ?? 'sessions.status.inProgress' })}
          </Badge>
          <Badge className={cn(priorityColors[currentTask.priority], 'capitalize')}>
            {formatMessage({ id: `common.priority.${currentTask.priority}` })}
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{formatMessage({ id: 'common.labels.progress' })}</span>
            <span className="font-semibold text-foreground">{currentTask.progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${currentTask.progress}%` }}
            />
          </div>
        </div>

        {/* Task counter */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
          <span>
            {currentIndex + 1} / {MOCK_TASKS.length}
          </span>
          <div className="flex gap-1">
            {MOCK_TASKS.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-colors',
                  idx === currentIndex ? 'bg-primary' : 'bg-muted'
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export const TaskMarqueeWidget = memo(TaskMarqueeWidgetComponent);

export default TaskMarqueeWidget;
