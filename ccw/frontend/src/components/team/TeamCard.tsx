// ========================================
// TeamCard Component
// ========================================
// Team card with status badge and action menu

import * as React from 'react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/Dropdown';
import {
  Users,
  MessageSquare,
  MoreVertical,
  Eye,
  Archive,
  ArchiveRestore,
  Trash2,
  Clock,
  GitBranch,
} from 'lucide-react';
import type { TeamSummaryExtended, TeamStatus } from '@/types/team';

export interface TeamCardProps {
  team: TeamSummaryExtended;
  onClick?: (name: string) => void;
  onArchive?: (name: string) => void;
  onUnarchive?: (name: string) => void;
  onDelete?: (name: string) => void;
  showActions?: boolean;
  actionsDisabled?: boolean;
  className?: string;
}

const statusVariantConfig: Record<
  TeamStatus,
  { variant: 'default' | 'secondary' | 'success' | 'info' }
> = {
  active: { variant: 'info' },
  completed: { variant: 'success' },
  archived: { variant: 'secondary' },
};

const statusLabelKeys: Record<TeamStatus, string> = {
  active: 'team.status.active',
  completed: 'team.status.completed',
  archived: 'team.status.archived',
};

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export function TeamCard({
  team,
  onClick,
  onArchive,
  onUnarchive,
  onDelete,
  showActions = true,
  actionsDisabled = false,
  className,
}: TeamCardProps) {
  const { formatMessage } = useIntl();

  const { variant: statusVariant } = statusVariantConfig[team.status] || { variant: 'default' as const };
  const statusLabel = statusLabelKeys[team.status]
    ? formatMessage({ id: statusLabelKeys[team.status] })
    : team.status;

  const isArchived = team.status === 'archived';

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-radix-popper-content-wrapper]')) return;
    onClick?.(team.name);
  };

  const handleAction = (e: React.MouseEvent, action: 'view' | 'archive' | 'unarchive' | 'delete') => {
    e.stopPropagation();
    switch (action) {
      case 'view':
        onClick?.(team.name);
        break;
      case 'archive':
        onArchive?.(team.name);
        break;
      case 'unarchive':
        onUnarchive?.(team.name);
        break;
      case 'delete':
        onDelete?.(team.name);
        break;
    }
  };

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30',
        className
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-4">
        {/* Header: team name + status + actions */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-card-foreground text-sm tracking-wide truncate">
                {team.name}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={statusVariant}>{statusLabel}</Badge>
            {team.pipeline_mode && (
              <Badge variant="default" className="gap-1">
                <GitBranch className="h-3 w-3" />
                {team.pipeline_mode}
              </Badge>
            )}
            {showActions && (
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
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => handleAction(e, 'view')}>
                    <Eye className="mr-2 h-4 w-4" />
                    {formatMessage({ id: 'team.actions.viewDetails' })}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {isArchived ? (
                    <DropdownMenuItem onClick={(e) => handleAction(e, 'unarchive')}>
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      {formatMessage({ id: 'team.actions.unarchive' })}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={(e) => handleAction(e, 'archive')}>
                      <Archive className="mr-2 h-4 w-4" />
                      {formatMessage({ id: 'team.actions.archive' })}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => handleAction(e, 'delete')}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {formatMessage({ id: 'team.actions.delete' })}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Meta info row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {team.messageCount} {formatMessage({ id: 'team.card.messages' })}
          </span>
          {team.lastActivity && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDate(team.lastActivity)}
            </span>
          )}
        </div>

        {/* Members row */}
        {team.members && team.members.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {team.members.map((name) => (
              <Badge key={name} variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                {name}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton loader for TeamCard
 */
export function TeamCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('animate-pulse', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="h-5 w-32 rounded bg-muted" />
          </div>
          <div className="h-5 w-16 rounded-full bg-muted" />
        </div>
        <div className="mt-3 flex gap-4">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-4 w-20 rounded bg-muted" />
          <div className="h-4 w-20 rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
