// ========================================
// HookCard Component
// ========================================
// Hook card with event badge, scope badge and action menu

import * as React from 'react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/Dropdown';
import {
  Zap,
  MoreVertical,
  Edit,
  Trash2,
  Globe,
  Folder,
  Play,
  Clock,
  Terminal,
} from 'lucide-react';

/**
 * Hook event types
 */
export type HookEvent = 'SessionStart' | 'UserPromptSubmit' | 'SessionEnd';

/**
 * Hook scope types
 */
export type HookScope = 'global' | 'project';

/**
 * Fail mode for hooks
 */
export type HookFailMode = 'continue' | 'block' | 'warn';

/**
 * Hook configuration interface
 */
export interface HookConfig {
  /** Unique hook identifier */
  id: string;
  /** Hook name */
  name: string;
  /** Trigger event */
  event: HookEvent;
  /** Command to execute */
  command: string;
  /** Description */
  description?: string;
  /** Scope (global or project) */
  scope: HookScope;
  /** Whether hook is enabled */
  enabled: boolean;
  /** Whether hook is installed */
  installed?: boolean;
  /** Whether this is a recommended hook */
  isRecommended?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Fail mode */
  failMode?: HookFailMode;
}

export interface HookCardProps {
  /** Hook data */
  hook: HookConfig;
  /** Called when edit action is triggered */
  onEdit?: (hook: HookConfig) => void;
  /** Called when uninstall action is triggered */
  onUninstall?: (hookId: string) => void;
  /** Called when toggle enabled is triggered */
  onToggle?: (hookId: string, enabled: boolean) => void;
  /** Optional className */
  className?: string;
  /** Show actions dropdown */
  showActions?: boolean;
  /** Disabled state for actions */
  actionsDisabled?: boolean;
  /** Whether this is a recommended hook card */
  isRecommendedCard?: boolean;
  /** Called when install action is triggered (recommended hooks only) */
  onInstall?: (hookId: string) => void;
}

// Event type configuration
const eventConfig: Record<
  HookEvent,
  { variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info'; icon: React.ReactNode }
> = {
  SessionStart: { variant: 'success' as const, icon: <Play className="h-3 w-3" /> },
  UserPromptSubmit: { variant: 'info' as const, icon: <Terminal className="h-3 w-3" /> },
  SessionEnd: { variant: 'secondary' as const, icon: <Clock className="h-3 w-3" /> },
};

// Event label keys for i18n
const eventLabelKeys: Record<HookEvent, string> = {
  SessionStart: 'specs.hook.event.SessionStart',
  UserPromptSubmit: 'specs.hook.event.UserPromptSubmit',
  SessionEnd: 'specs.hook.event.SessionEnd',
};

// Scope label keys for i18n
const scopeLabelKeys: Record<HookScope, string> = {
  global: 'specs.hook.scope.global',
  project: 'specs.hook.scope.project',
};

/**
 * HookCard component for displaying hook information
 */
export function HookCard({
  hook,
  onEdit,
  onUninstall,
  onToggle,
  className,
  showActions = true,
  actionsDisabled = false,
  isRecommendedCard = false,
  onInstall,
}: HookCardProps) {
  const { formatMessage } = useIntl();

  const { variant: eventVariant, icon: eventIcon } = eventConfig[hook.event] || {
    variant: 'default' as const,
    icon: <Zap className="h-3 w-3" />,
  };
  const eventLabel = formatMessage({ id: eventLabelKeys[hook.event] || 'specs.hook.event.SessionStart' });

  const scopeIcon = hook.scope === 'global' ? <Globe className="h-3 w-3" /> : <Folder className="h-3 w-3" />;
  const scopeLabel = formatMessage({ id: scopeLabelKeys[hook.scope] });

  const handleToggle = (enabled: boolean) => {
    onToggle?.(hook.id, enabled);
  };

  const handleAction = (e: React.MouseEvent, action: 'edit' | 'uninstall' | 'install') => {
    e.stopPropagation();
    switch (action) {
      case 'edit':
        onEdit?.(hook);
        break;
      case 'uninstall':
        onUninstall?.(hook.id);
        break;
      case 'install':
        onInstall?.(hook.id);
        break;
    }
  };

  // For recommended hooks that are not installed
  if (isRecommendedCard && !hook.installed) {
    return (
      <Card
        className={cn(
          'group transition-all duration-200 hover:shadow-md hover:border-primary/30 hover-glow',
          className
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-card-foreground truncate">
                  {hook.name}
                </h3>
                <Badge variant="outline" className="gap-1">
                  {scopeIcon}
                  {scopeLabel}
                </Badge>
              </div>
              {hook.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                  {hook.description}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => handleAction(e, 'install')}
              disabled={actionsDisabled}
              className="ml-4"
            >
              {formatMessage({ id: 'specs.hook.install' })}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'group transition-all duration-200 hover:shadow-md hover:border-primary/30 hover-glow',
        !hook.enabled && 'opacity-60',
        className
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-card-foreground truncate">
                {hook.name}
              </h3>
              <Badge variant="outline" className="gap-1" title={scopeLabel}>
                {scopeIcon}
              </Badge>
            </div>
            {hook.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                {hook.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={eventVariant} className="gap-1">
              {eventIcon}
              {eventLabel}
            </Badge>
            <Switch
              checked={hook.enabled}
              onCheckedChange={handleToggle}
              disabled={actionsDisabled}
              className="data-[state=checked]:bg-primary"
            />
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
                    <span className="sr-only">{formatMessage({ id: 'common.aria.actions' })}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => handleAction(e, 'edit')}>
                    <Edit className="mr-2 h-4 w-4" />
                    {formatMessage({ id: 'specs.hook.edit' })}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => handleAction(e, 'uninstall')}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {formatMessage({ id: 'specs.hook.uninstall' })}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Command info */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-mono">
            <Terminal className="h-3.5 w-3.5" />
            {hook.command}
          </span>
          {hook.timeout && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {hook.timeout}ms
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton loader for HookCard
 */
export function HookCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('animate-pulse', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="h-5 w-32 rounded bg-muted" />
            <div className="mt-1 h-3 w-48 rounded bg-muted" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-5 w-20 rounded bg-muted" />
            <div className="h-5 w-8 rounded-full bg-muted" />
            <div className="h-8 w-8 rounded bg-muted" />
          </div>
        </div>
        <div className="mt-3 flex gap-4">
          <div className="h-3 w-32 rounded bg-muted" />
          <div className="h-3 w-16 rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
