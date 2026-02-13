// ========================================
// WorkflowStatusProgressWidget Component
// ========================================
// Widget showing workflow status distribution using progress bars

import { memo } from 'react';
import { useIntl } from 'react-intl';
import { Card } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { Badge } from '@/components/ui/Badge';
import { useWorkflowStatusCounts, generateMockWorkflowStatusCounts } from '@/hooks/useWorkflowStatusCounts';
import { cn } from '@/lib/utils';

export interface WorkflowStatusProgressWidgetProps {
  className?: string;
}

// Status color mapping
const statusColors: Record<string, { bg: string; text: string }> = {
  completed: { bg: 'bg-success', text: 'text-success' },
  in_progress: { bg: 'bg-warning', text: 'text-warning' },
  planning: { bg: 'bg-info', text: 'text-info' },
  paused: { bg: 'bg-muted', text: 'text-muted-foreground' },
  archived: { bg: 'bg-secondary', text: 'text-secondary-foreground' },
};

// Status label keys for i18n
const statusLabelKeys: Record<string, string> = {
  completed: 'sessions.status.completed',
  in_progress: 'sessions.status.inProgress',
  planning: 'sessions.status.planning',
  paused: 'sessions.status.paused',
  archived: 'sessions.status.archived',
};

function WorkflowStatusProgressWidgetComponent({ className }: WorkflowStatusProgressWidgetProps) {
  const { formatMessage } = useIntl();
  const { data, isLoading } = useWorkflowStatusCounts();

  // Use mock data if API call fails or returns no data
  const chartData = data || generateMockWorkflowStatusCounts();

  // Calculate total for percentage
  const total = chartData.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className={cn('h-full p-4 flex flex-col', className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4">
        {formatMessage({ id: 'home.widgets.workflowStatus' })}
      </h3>
      
      {isLoading ? (
        <div className="space-y-4 flex-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-2 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4 flex-1">
          {chartData.map((item) => {
            const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
            const colors = statusColors[item.status] || statusColors.completed;
            
            return (
              <div key={item.status} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {formatMessage({ id: statusLabelKeys[item.status] ?? 'sessions.status.inProgress' })}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {item.count}
                    </Badge>
                  </div>
                  <span className={cn('text-sm font-semibold', colors.text)}>
                    {percentage}%
                  </span>
                </div>
                <Progress 
                  value={percentage} 
                  className="h-2"
                  indicatorClassName={colors.bg}
                />
              </div>
            );
          })}
        </div>
      )}
      
      {!isLoading && total > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {formatMessage({ id: 'common.stats.total' })}
            </span>
            <span className="font-semibold text-foreground">{total}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

export const WorkflowStatusProgressWidget = memo(WorkflowStatusProgressWidgetComponent);

export default WorkflowStatusProgressWidget;
