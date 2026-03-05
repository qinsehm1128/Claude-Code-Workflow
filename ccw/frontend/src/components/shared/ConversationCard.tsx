// ========================================
// ConversationCard Component
// ========================================
// Card component for displaying CLI execution history items

import * as React from 'react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  MoreVertical,
  Eye,
  Trash2,
  Copy,
  Clock,
  Timer,
  Hash,
  MessagesSquare,
  Folder,
  FileJson,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/Dropdown';
import type { CliExecution } from '@/lib/api';

export interface ConversationCardProps {
  /** Execution data */
  execution: CliExecution;
  /** Called when view action is triggered */
  onView?: (execution: CliExecution) => void;
  /** Called when view native session is triggered */
  onViewNative?: (execution: CliExecution) => void;
  /** Called when delete action is triggered */
  onDelete?: (id: string) => void;
  /** Called when card is clicked */
  onClick?: (execution: CliExecution) => void;
  /** Optional className */
  className?: string;
  /** Disabled state for actions */
  actionsDisabled?: boolean;
}

// Status configuration
const statusConfig = {
  success: {
    variant: 'success' as const,
    icon: 'check-circle',
  },
  error: {
    variant: 'destructive' as const,
    icon: 'x-circle',
  },
  timeout: {
    variant: 'warning' as const,
    icon: 'clock',
  },
};

/**
 * Format duration to human readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Hook to get localized time ago string
 */
function useTimeAgo() {
  const { formatMessage } = useIntl();

  return React.useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return formatMessage({ id: 'common.time.justNow' });
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return formatMessage({ id: 'common.time.minutesAgo' }, { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return formatMessage({ id: 'common.time.hoursAgo' }, { count: hours });
    const days = Math.floor(hours / 24);
    return formatMessage({ id: 'common.time.daysAgo' }, { count: days });
  }, [formatMessage]);
}

/**
 * ConversationCard component for displaying CLI execution history
 */
export function ConversationCard({
  execution,
  onView,
  onViewNative,
  onDelete,
  onClick,
  className,
  actionsDisabled = false,
}: ConversationCardProps) {
  const { formatMessage } = useIntl();
  const getTimeAgo = useTimeAgo();
  const [copied, setCopied] = React.useState(false);

  const status = statusConfig[execution.status] || statusConfig.error;

  const handleCopyId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(execution.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy ID');
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on dropdown
    if ((e.target as HTMLElement).closest('[data-radix-popper-content-wrapper]')) {
      return;
    }
    onClick?.(execution);
  };

  const handleAction = (
    e: React.MouseEvent,
    action: 'view' | 'delete' | 'copy'
  ) => {
    e.stopPropagation();
    switch (action) {
      case 'view':
        onView?.(execution);
        break;
      case 'delete':
        onDelete?.(execution.id);
        break;
      case 'copy':
        handleCopyId(e);
        break;
    }
  };

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all duration-200 hover:shadow-md',
        className
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs">
                {execution.tool}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {execution.mode || 'analysis'}
              </Badge>
              {execution.turn_count && execution.turn_count > 1 && (
                <Badge variant="info" className="gap-1 text-xs">
                  <MessagesSquare className="h-3 w-3" />
                  {execution.turn_count}
                </Badge>
              )}
              {execution.sourceDir && execution.sourceDir !== '.' && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Folder className="h-3 w-3" />
                  {execution.sourceDir}
                </Badge>
              )}
              {execution.hasNativeSession && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <FileJson className="h-3 w-3" />
                  {formatMessage({ id: 'history.badge.native' })}
                </Badge>
              )}
              <Badge variant={status.variant} className="gap-1 text-xs ml-auto">
                {status.icon === 'check-circle' && '✓'}
                {status.icon === 'x-circle' && '✗'}
                {status.icon === 'clock' && '⏱'}
                {execution.status}
              </Badge>
            </div>

            {/* Prompt preview */}
            <p className="text-sm text-foreground line-clamp-2 mb-2">
              {typeof execution.prompt_preview === 'string'
                ? execution.prompt_preview
                : JSON.stringify(execution.prompt_preview)}
            </p>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {getTimeAgo(execution.timestamp)}
              </span>
              <span className="flex items-center gap-1">
                <Timer className="h-3 w-3" />
                {formatDuration(execution.duration_ms)}
              </span>
              <span className="flex items-center gap-1 font-mono" title={execution.id}>
                <Hash className="h-3 w-3" />
                {execution.id.substring(0, 8)}...
              </span>
            </div>
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
                disabled={actionsDisabled}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">{formatMessage({ id: 'common.aria.actions' })}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => handleAction(e, 'copy')}>
                <Copy className="mr-2 h-4 w-4" />
                {copied
                  ? formatMessage({ id: 'history.actions.copied' })
                  : formatMessage({ id: 'history.actions.copyId' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => handleAction(e, 'view')}>
                <Eye className="mr-2 h-4 w-4" />
                {formatMessage({ id: 'history.actions.view' })}
              </DropdownMenuItem>
              {execution.hasNativeSession && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewNative?.(execution); }}>
                  <FileJson className="mr-2 h-4 w-4" />
                  {formatMessage({ id: 'history.actions.viewNative', defaultMessage: 'View Native Session' })}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => handleAction(e, 'delete')}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {formatMessage({ id: 'history.actions.delete' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
