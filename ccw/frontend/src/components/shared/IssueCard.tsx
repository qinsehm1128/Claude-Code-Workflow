// ========================================
// IssueCard Component
// ========================================
// Card component for displaying issues with actions

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/Dropdown';
import type { DraggableProvidedDragHandleProps, DraggableProvidedDraggableProps } from '@hello-pangea/dnd';
import type { Issue } from '@/lib/api';

// ========== Types ==========

export interface IssueCardProps {
  issue: Issue;
  onEdit?: (issue: Issue) => void;
  onDelete?: (issue: Issue) => void;
  onClick?: (issue: Issue) => void;
  onStatusChange?: (issue: Issue, status: Issue['status']) => void;
  className?: string;
  compact?: boolean;
  showActions?: boolean;
  draggableProps?: DraggableProvidedDraggableProps;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  innerRef?: React.Ref<HTMLDivElement>;
}

// ========== Priority Helpers ==========

// Priority icon and color configuration (without labels for i18n)
const priorityVariantConfig: Record<Issue['priority'], { icon: React.ElementType; color: string }> = {
  critical: { icon: AlertCircle, color: 'destructive' },
  high: { icon: AlertTriangle, color: 'warning' },
  medium: { icon: Info, color: 'info' },
  low: { icon: Info, color: 'secondary' },
};

// Priority label keys for i18n
const priorityLabelKeys: Record<Issue['priority'], string> = {
  critical: 'issues.priority.critical',
  high: 'issues.priority.high',
  medium: 'issues.priority.medium',
  low: 'issues.priority.low',
};

// Status icon and color configuration (without labels for i18n)
const statusVariantConfig: Record<Issue['status'], { icon: React.ElementType; color: string }> = {
  registered: { icon: AlertCircle, color: 'info' },
  planning: { icon: Clock, color: 'warning' },
  planned: { icon: Clock, color: 'warning' },
  queued: { icon: Clock, color: 'warning' },
  executing: { icon: Loader2, color: 'warning' },
  completed: { icon: CheckCircle, color: 'success' },
  failed: { icon: XCircle, color: 'destructive' },
  paused: { icon: Clock, color: 'muted' },
};

// Status label keys for i18n
const statusLabelKeys: Record<Issue['status'], string> = {
  registered: 'issues.status.registered',
  planning: 'issues.status.planning',
  planned: 'issues.status.planned',
  queued: 'issues.status.queued',
  executing: 'issues.status.executing',
  completed: 'issues.status.completed',
  failed: 'issues.status.failed',
  paused: 'issues.status.paused',
};

// ========== Priority Badge ==========

export function PriorityBadge({ priority }: { priority: Issue['priority'] }) {
  const { formatMessage } = useIntl();
  const config = priorityVariantConfig[priority];

  // Defensive check: handle unknown priority values
  if (!config) {
    return (
      <Badge variant="secondary" className="gap-1">
        {priority}
      </Badge>
    );
  }

  const Icon = config.icon;
  const label = priorityLabelKeys[priority]
    ? formatMessage({ id: priorityLabelKeys[priority] })
    : priority;

  return (
    <Badge variant={config.color as 'default' | 'secondary' | 'destructive' | 'outline'} className="gap-1">
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

// ========== Status Badge ==========

export function StatusBadge({ status }: { status: Issue['status'] }) {
  const { formatMessage } = useIntl();
  const config = statusVariantConfig[status];

  // Defensive check: handle unknown status values
  if (!config) {
    return (
      <Badge variant="outline" className="gap-1">
        {status}
      </Badge>
    );
  }

  const Icon = config.icon;
  const label = statusLabelKeys[status]
    ? formatMessage({ id: statusLabelKeys[status] })
    : status;

  return (
    <Badge variant="outline" className="gap-1">
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

// ========== Main IssueCard Component ==========

export function IssueCard({
  issue,
  onEdit,
  onDelete,
  onClick,
  onStatusChange,
  className,
  compact = false,
  showActions = true,
  draggableProps,
  dragHandleProps,
  innerRef,
}: IssueCardProps) {
  const { formatMessage } = useIntl();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleClick = () => {
    if (!isMenuOpen) {
      onClick?.(issue);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    onEdit?.(issue);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    onDelete?.(issue);
  };

  if (compact) {
    return (
      <div
        ref={innerRef}
        {...draggableProps}
        {...dragHandleProps}
        onClick={handleClick}
        className={cn(
          'p-3 bg-card border border-border rounded-lg cursor-pointer',
          'hover:shadow-md hover:border-primary/50 transition-all hover-glow',
          className
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{issue.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">#{issue.id}</p>
          </div>
          <PriorityBadge priority={issue.priority} />
        </div>
      </div>
    );
  }

  return (
    <Card
      ref={innerRef}
      {...draggableProps}
      onClick={handleClick}
      className={cn(
        'p-4 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all hover-glow',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0" {...dragHandleProps}>
          <h3 className="text-sm font-medium text-foreground line-clamp-2">
            {issue.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">#{issue.id}</p>
        </div>
        {showActions && (
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEdit}>
                <Edit className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'issues.actions.edit' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(issue, 'executing')}>
                <Clock className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'issues.actions.startProgress' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(issue, 'completed')}>
                <CheckCircle className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'issues.actions.markResolved' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'issues.actions.delete' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Context Preview */}
      {issue.context && (
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
          {issue.context}
        </p>
      )}

      {/* Labels */}
      {issue.labels && issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {issue.labels.slice(0, 3).map((label) => (
            <Badge key={label} variant="outline" className="text-xs">
              {label}
            </Badge>
          ))}
          {issue.labels.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{issue.labels.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <PriorityBadge priority={issue.priority} />
        <StatusBadge status={issue.status} />
      </div>

      {/* Solutions Count */}
      {issue.solutions && issue.solutions.length > 0 && (
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
          <ExternalLink className="w-3 h-3" />
          {issue.solutions.length} {formatMessage(
            { id: 'issues.card.solutions' },
            { count: issue.solutions.length }
          )}
        </div>
      )}
    </Card>
  );
}

export default IssueCard;
