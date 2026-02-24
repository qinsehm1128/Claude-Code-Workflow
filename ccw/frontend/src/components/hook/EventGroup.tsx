// ========================================
// Event Group Component
// ========================================
// Groups hooks by trigger event type

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  ChevronDown,
  ChevronUp,
  Zap,
  Wrench,
  CheckCircle,
  StopCircle,
  Play,
  Bell,
  Rocket,
  Flag,
  Package,
  LogOut,
  XCircle,
  Lock,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { HookCard, type HookCardData, type HookTriggerType } from './HookCard';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface EventGroupProps {
  eventType: HookTriggerType;
  hooks: HookCardData[];
  onHookToggle: (hookName: string, enabled: boolean) => void;
  onHookEdit: (hook: HookCardData) => void;
  onHookDelete: (hookName: string) => void;
}

// ========== Helper Functions ==========

function getEventIcon(eventType: HookTriggerType) {
  switch (eventType) {
    case 'SessionStart':
      return Play;
    case 'UserPromptSubmit':
      return Zap;
    case 'PreToolUse':
      return Wrench;
    case 'PostToolUse':
      return CheckCircle;
    case 'Stop':
      return StopCircle;
    case 'Notification':
      return Bell;
    case 'SubagentStart':
      return Rocket;
    case 'SubagentStop':
      return Flag;
    case 'PreCompact':
      return Package;
    case 'SessionEnd':
      return LogOut;
    case 'PostToolUseFailure':
      return XCircle;
    case 'PermissionRequest':
      return Lock;
    default:
      return Play;
  }
}

function getEventColor(eventType: HookTriggerType): string {
  switch (eventType) {
    case 'SessionStart':
      return 'text-purple-500 bg-purple-500/10';
    case 'UserPromptSubmit':
      return 'text-amber-500 bg-amber-500/10';
    case 'PreToolUse':
      return 'text-blue-500 bg-blue-500/10';
    case 'PostToolUse':
      return 'text-green-500 bg-green-500/10';
    case 'Stop':
      return 'text-red-500 bg-red-500/10';
    case 'Notification':
      return 'text-sky-500 bg-sky-500/10';
    case 'SubagentStart':
      return 'text-indigo-500 bg-indigo-500/10';
    case 'SubagentStop':
      return 'text-teal-500 bg-teal-500/10';
    case 'PreCompact':
      return 'text-orange-500 bg-orange-500/10';
    case 'SessionEnd':
      return 'text-pink-500 bg-pink-500/10';
    case 'PostToolUseFailure':
      return 'text-rose-500 bg-rose-500/10';
    case 'PermissionRequest':
      return 'text-yellow-500 bg-yellow-500/10';
    default:
      return 'text-gray-500 bg-gray-500/10';
  }
}

// ========== Component ==========

export function EventGroup({
  eventType,
  hooks,
  onHookToggle,
  onHookEdit,
  onHookDelete,
}: EventGroupProps) {
  const { formatMessage } = useIntl();
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedHooks, setExpandedHooks] = useState<Set<string>>(new Set());

  const Icon = getEventIcon(eventType);
  const iconColorClass = getEventColor(eventType);

  const enabledCount = hooks.filter((h) => h.enabled).length;
  const totalCount = hooks.length;

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleToggleHookExpand = (hookName: string) => {
    setExpandedHooks((prev) => {
      const next = new Set(prev);
      if (next.has(hookName)) {
        next.delete(hookName);
      } else {
        next.add(hookName);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedHooks(new Set(hooks.map((h) => h.name)));
  };

  const handleCollapseAll = () => {
    setExpandedHooks(new Set());
  };

  return (
    <Card className="overflow-hidden">
      {/* Event Header */}
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border"
        onClick={handleToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', iconColorClass)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {formatMessage({ id: `cliHooks.trigger.${eventType}` })}
              </h3>
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'cliHooks.stats.count' }, {
                  enabled: enabledCount,
                  total: totalCount
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {totalCount}
            </Badge>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Hooks List */}
      {isExpanded && (
        <div className="p-4 space-y-3 bg-muted/10">
          {totalCount === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">{formatMessage({ id: 'cliHooks.empty.noHooksInEvent' })}</p>
            </div>
          ) : (
            <>
              {/* Expand/Collapse All */}
              {totalCount > 1 && (
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleExpandAll}
                  >
                    {formatMessage({ id: 'cliHooks.actions.expandAll' })}
                  </Button>
                  <span className="text-muted-foreground text-xs">/</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleCollapseAll}
                  >
                    {formatMessage({ id: 'cliHooks.actions.collapseAll' })}
                  </Button>
                </div>
              )}

              {/* Hook Cards */}
              <div className="space-y-2">
                {hooks.map((hook) => (
                  <HookCard
                    key={hook.name}
                    hook={hook}
                    isExpanded={expandedHooks.has(hook.name)}
                    onToggleExpand={() => handleToggleHookExpand(hook.name)}
                    onToggle={onHookToggle}
                    onEdit={onHookEdit}
                    onDelete={onHookDelete}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

export default EventGroup;
