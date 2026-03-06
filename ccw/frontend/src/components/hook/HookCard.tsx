// ========================================
// Hook Card Component
// ========================================
// Individual hook display card with actions

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  GitFork,
  Power,
  PowerOff,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/AlertDialog';
import { cn } from '@/lib/utils';

// ========== Types ==========

export type HookTriggerType = 'SessionStart' | 'UserPromptSubmit' | 'PreToolUse' | 'PostToolUse' | 'Stop' | 'Notification' | 'SubagentStart' | 'SubagentStop' | 'PreCompact' | 'SessionEnd' | 'PostToolUseFailure' | 'PermissionRequest';

export interface HookCardData {
  name: string;
  description?: string;
  enabled: boolean;
  trigger: HookTriggerType;
  matcher?: string;
  command?: string;
  script?: string;
  scope?: 'global' | 'project';
  index?: number;
}

export interface HookCardProps {
  hook: HookCardData;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggle: (hookName: string, enabled: boolean) => void;
  onEdit: (hook: HookCardData) => void;
  onDelete: (hookName: string) => void;
}

// ========== Helper Functions ==========

function getTriggerIcon(trigger: HookTriggerType) {
  switch (trigger) {
    case 'SessionStart':
      return '🎬';
    case 'UserPromptSubmit':
      return '⚡';
    case 'PreToolUse':
      return '🔧';
    case 'PostToolUse':
      return '✅';
    case 'Stop':
      return '🛑';
    case 'Notification':
      return '🔔';
    case 'SubagentStart':
      return '🚀';
    case 'SubagentStop':
      return '🏁';
    case 'PreCompact':
      return '📦';
    case 'SessionEnd':
      return '👋';
    case 'PostToolUseFailure':
      return '❌';
    case 'PermissionRequest':
      return '🔐';
    default:
      return '📌';
  }
}

function getTriggerVariant(trigger: HookTriggerType): 'default' | 'secondary' | 'outline' {
  switch (trigger) {
    case 'SessionStart':
    case 'UserPromptSubmit':
    case 'SubagentStart':
      return 'default';
    case 'PreToolUse':
    case 'Stop':
    case 'PreCompact':
    case 'PermissionRequest':
      return 'secondary';
    case 'PostToolUse':
    case 'Notification':
    case 'SubagentStop':
    case 'SessionEnd':
    case 'PostToolUseFailure':
      return 'outline';
    default:
      return 'outline';
  }
}

// ========== Component ==========

// ========== Hook Name Translation ==========
// Mapping from display name to template ID for translation lookup
const DISPLAY_NAME_TO_TEMPLATE_ID: Record<string, string> = {
  // Notification hooks
  'Session Start Notify': 'session-start-notify',
  'Session State Watch': 'session-state-watch',
  'Stop Notify': 'stop-notify',
  // Automation hooks
  'Auto Format on Write': 'auto-format-on-write',
  'Auto Lint on Write': 'auto-lint-on-write',
  'Block Sensitive Files': 'block-sensitive-files',
  'Git Auto Stage': 'git-auto-stage',
  // Indexing hooks
  'Post Edit Index': 'post-edit-index',
  'Session End Summary': 'session-end-summary',
  'Project State Inject': 'project-state-inject',
  // Memory V2 hooks
  'Memory V2 Extract': 'memory-v2-extract',
  'Memory V2 Auto Consolidate': 'memory-v2-auto-consolidate',
  'Memory Sync Dashboard': 'memory-sync-dashboard',
};

/**
 * Get translated hook name if available
 * Falls back to original name if no translation exists
 */
function getHookDisplayName(name: string, formatMessage: (msg: { id: string }) => string): string {
  // First try direct translation with the name (for template IDs)
  const translationKey = `cliHooks.templates.templates.${name}.name`;
  try {
    const translated = formatMessage({ id: translationKey });
    if (translated && !translated.includes('cliHooks.templates.templates')) {
      return translated;
    }
  } catch {
    // Direct translation not found
  }

  // Try mapping display name to template ID
  const templateId = DISPLAY_NAME_TO_TEMPLATE_ID[name];
  if (templateId) {
    const mappedKey = `cliHooks.templates.templates.${templateId}.name`;
    try {
      const translated = formatMessage({ id: mappedKey });
      if (translated && !translated.includes('cliHooks.templates.templates')) {
        return translated;
      }
    } catch {
      // Mapping found but no translation
    }
  }

  return name;
}

// ========== Component ==========

export function HookCard({
  hook,
  isExpanded,
  onToggleExpand,
  onToggle,
  onEdit,
  onDelete,
}: HookCardProps) {
  const { formatMessage } = useIntl();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Get translated hook name
  const displayName = getHookDisplayName(hook.name, formatMessage);

  const handleToggle = () => {
    onToggle(hook.name, !hook.enabled);
  };

  const handleEdit = () => {
    onEdit(hook);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    onDelete(hook.name);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <>
    <Card className={cn('overflow-hidden', !hook.enabled && 'opacity-60')}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn(
              'p-2 rounded-lg flex-shrink-0',
              hook.enabled ? 'bg-primary/10' : 'bg-muted'
            )}>
              <GitFork className={cn(
                'w-4 h-4',
                hook.enabled ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground truncate">
                  {displayName}
                </span>
                <Badge
                  variant={getTriggerVariant(hook.trigger)}
                  className="text-xs flex-shrink-0"
                >
                  <span className="mr-1">{getTriggerIcon(hook.trigger)}</span>
                  {formatMessage({ id: `cliHooks.trigger.${hook.trigger}` })}
                </Badge>
                <Badge
                  variant={hook.enabled ? 'default' : 'secondary'}
                  className="text-xs flex-shrink-0"
                >
                  {hook.enabled
                    ? formatMessage({ id: 'common.status.enabled' })
                    : formatMessage({ id: 'common.status.disabled' })
                  }
                </Badge>
              </div>
              {hook.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {hook.description}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleToggle}
              title={hook.enabled
                ? formatMessage({ id: 'cliHooks.actions.disable' })
                : formatMessage({ id: 'cliHooks.actions.enable' })
              }
            >
              {hook.enabled ? (
                <Power className="w-4 h-4 text-success" />
              ) : (
                <PowerOff className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleEdit}
              title={formatMessage({ id: 'common.actions.edit' })}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
              title={formatMessage({ id: 'common.actions.delete' })}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onToggleExpand}
              title={isExpanded
                ? formatMessage({ id: 'cliHooks.actions.collapse' })
                : formatMessage({ id: 'cliHooks.actions.expand' })
              }
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border bg-muted/30 p-4 space-y-3">
          {hook.description && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {formatMessage({ id: 'cliHooks.form.description' })}
              </label>
              <p className="text-sm text-foreground mt-1">{hook.description}</p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {formatMessage({ id: 'cliHooks.form.matcher' })}
            </label>
            <p className="text-sm text-foreground mt-1 font-mono bg-muted px-2 py-1 rounded">
              {hook.matcher || formatMessage({ id: 'cliHooks.allTools' })}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {formatMessage({ id: 'cliHooks.form.command' })}
            </label>
            <p className="text-sm text-foreground mt-1 font-mono bg-muted px-2 py-1 rounded break-all max-h-32 overflow-y-auto">
              {hook.command || hook.script || 'N/A'}
            </p>
          </div>
        </div>
      )}
    </Card>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete CLI Hook?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The hook "{displayName}" will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}

export default HookCard;
