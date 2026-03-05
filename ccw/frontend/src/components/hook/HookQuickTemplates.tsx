// ========================================
// Hook Quick Templates Component
// ========================================
// Frontend component for displaying and installing hook templates
// Templates are defined in backend: ccw/src/core/hooks/hook-templates.ts
// All templates use `ccw hook template exec <id> --stdin` to avoid Windows quote issues

import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Bell,
  Database,
  Wrench,
  Check,
  Zap,
  Download,
  Loader2,
  Shield,
  FileCode,
  FileSearch,
  GitBranch,
  Send,
  FileBarChart,
  Settings,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { HookTriggerType } from './HookCard';

// ========== Types ==========

/**
 * Template category type
 */
export type TemplateCategory = 'notification' | 'indexing' | 'automation' | 'utility' | 'protection';

/**
 * Hook template definition (frontend view of backend templates)
 */
export interface HookTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  trigger: HookTriggerType;
  matcher?: string;
}

/**
 * Component props
 */
export interface HookQuickTemplatesProps {
  /** Callback when install button is clicked */
  onInstallTemplate: (templateId: string) => Promise<void>;
  /** Array of installed template IDs */
  installedTemplates: string[];
  /** Optional loading state */
  isLoading?: boolean;
  /** ID of the template currently being installed */
  installingTemplateId?: string | null;
}

// ========== Hook Templates ==========
// NOTE: Templates are defined in backend (ccw/src/core/hooks/hook-templates.ts)
// This is a copy for frontend display purposes.
// All templates use `ccw hook template exec <id> --stdin` format.

/**
 * Predefined hook templates for quick installation
 * These mirror the backend templates in ccw/src/core/hooks/hook-templates.ts
 */
export const HOOK_TEMPLATES: readonly HookTemplate[] = [
  // ============ Notification ============
  {
    id: 'session-start-notify',
    name: 'Session Start Notify',
    description: 'Notify dashboard when a new workflow session is created',
    category: 'notification',
    trigger: 'SessionStart',
  },
  {
    id: 'session-state-watch',
    name: 'Session State Watch',
    description: 'Watch for session metadata file changes (workflow-session.json)',
    category: 'notification',
    trigger: 'PostToolUse',
    matcher: 'Write|Edit',
  },
  {
    id: 'stop-notify',
    name: 'Stop Notify',
    description: 'Notify dashboard when Claude finishes responding',
    category: 'notification',
    trigger: 'Stop',
  },
  {
    id: 'memory-sync-dashboard',
    name: 'Memory Sync Dashboard',
    description: 'Sync memory V2 status to dashboard on changes',
    category: 'notification',
    trigger: 'PostToolUse',
    matcher: 'mcp__ccw-tools__core_memory',
  },

  // ============ Automation ============
  {
    id: 'auto-format-on-write',
    name: 'Auto Format on Write',
    description: 'Auto-format files after Claude writes or edits them',
    category: 'automation',
    trigger: 'PostToolUse',
    matcher: 'Write|Edit',
  },
  {
    id: 'auto-lint-on-write',
    name: 'Auto Lint on Write',
    description: 'Auto-lint files after Claude writes or edits them',
    category: 'automation',
    trigger: 'PostToolUse',
    matcher: 'Write|Edit',
  },
  {
    id: 'git-auto-stage',
    name: 'Git Auto Stage',
    description: 'Auto stage all modified files when Claude finishes responding',
    category: 'automation',
    trigger: 'Stop',
  },

  // ============ Protection ============
  {
    id: 'block-sensitive-files',
    name: 'Block Sensitive Files',
    description: 'Block modifications to sensitive files (.env, secrets, credentials)',
    category: 'protection',
    trigger: 'PreToolUse',
    matcher: 'Write|Edit',
  },
  {
    id: 'danger-bash-confirm',
    name: 'Danger Bash Confirm',
    description: 'Require confirmation for dangerous bash commands',
    category: 'protection',
    trigger: 'PreToolUse',
    matcher: 'Bash',
  },
  {
    id: 'danger-file-protection',
    name: 'Danger File Protection',
    description: 'Block modifications to protected files',
    category: 'protection',
    trigger: 'PreToolUse',
    matcher: 'Write|Edit',
  },
  {
    id: 'danger-git-destructive',
    name: 'Danger Git Destructive',
    description: 'Require confirmation for destructive git operations',
    category: 'protection',
    trigger: 'PreToolUse',
    matcher: 'Bash',
  },
  {
    id: 'danger-network-confirm',
    name: 'Danger Network Confirm',
    description: 'Require confirmation for network operations',
    category: 'protection',
    trigger: 'PreToolUse',
    matcher: 'Bash|WebFetch',
  },
  {
    id: 'danger-system-paths',
    name: 'Danger System Paths',
    description: 'Block modifications to system paths',
    category: 'protection',
    trigger: 'PreToolUse',
    matcher: 'Write|Edit|Bash',
  },
  {
    id: 'danger-permission-change',
    name: 'Danger Permission Change',
    description: 'Require confirmation for permission changes',
    category: 'protection',
    trigger: 'PreToolUse',
    matcher: 'Bash',
  },

  // ============ Indexing ============
  {
    id: 'post-edit-index',
    name: 'Post Edit Index',
    description: 'Notify indexing service when files are modified',
    category: 'indexing',
    trigger: 'PostToolUse',
    matcher: 'Write|Edit',
  },
  {
    id: 'session-end-summary',
    name: 'Session End Summary',
    description: 'Send session summary to dashboard on session end',
    category: 'indexing',
    trigger: 'Stop',
  },

  // ============ Utility ============
  {
    id: 'memory-auto-compress',
    name: 'Auto Memory Compress',
    description: 'Automatically compress memory when entries exceed threshold',
    category: 'utility',
    trigger: 'Stop',
  },
  {
    id: 'memory-preview-extract',
    name: 'Memory Preview & Extract',
    description: 'Preview extraction queue and extract eligible sessions',
    category: 'utility',
    trigger: 'SessionStart',
  },
  {
    id: 'memory-status-check',
    name: 'Memory Status Check',
    description: 'Check memory extraction and consolidation status',
    category: 'utility',
    trigger: 'SessionStart',
  },
  {
    id: 'memory-v2-extract',
    name: 'Memory V2 Extract',
    description: 'Trigger Phase 1 extraction when session ends',
    category: 'utility',
    trigger: 'Stop',
  },
  {
    id: 'memory-v2-auto-consolidate',
    name: 'Memory V2 Auto Consolidate',
    description: 'Trigger Phase 2 consolidation after extraction jobs complete',
    category: 'utility',
    trigger: 'Stop',
  },
] as const;

// ========== Category Icons ==========

const CATEGORY_ICONS: Record<TemplateCategory, { icon: typeof Bell; color: string; bg: string }> = {
  notification: { icon: Bell, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  indexing: { icon: Database, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  automation: { icon: Wrench, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  utility: { icon: Settings, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  protection: { icon: Shield, color: 'text-red-500', bg: 'bg-red-500/10' },
};

// ========== Template Icons ==========

const TEMPLATE_ICONS: Record<string, typeof Bell> = {
  'session-start-notify': Send,
  'session-state-watch': FileBarChart,
  'stop-notify': Bell,
  'auto-format-on-write': FileCode,
  'auto-lint-on-write': FileSearch,
  'block-sensitive-files': Shield,
  'git-auto-stage': GitBranch,
  'post-edit-index': Database,
  'session-end-summary': FileBarChart,
  'project-state-inject': FileBarChart,
};

// ========== Category Names ==========

function getCategoryName(category: TemplateCategory, formatMessage: ReturnType<typeof useIntl>['formatMessage']): string {
  const names: Record<TemplateCategory, string> = {
    notification: formatMessage({ id: 'cliHooks.templates.categories.notification' }),
    indexing: formatMessage({ id: 'cliHooks.templates.categories.indexing' }),
    automation: formatMessage({ id: 'cliHooks.templates.categories.automation' }),
    utility: formatMessage({ id: 'cliHooks.templates.categories.utility' }),
    protection: formatMessage({ id: 'cliHooks.templates.categories.protection' }),
  };
  return names[category];
}

// ========== Main Component ==========

/**
 * HookQuickTemplates - Display predefined hook templates for quick installation
 */
export function HookQuickTemplates({
  onInstallTemplate,
  installedTemplates,
  isLoading: _isLoading = false,
  installingTemplateId = null
}: HookQuickTemplatesProps) {
  const { formatMessage } = useIntl();

  // Group templates by category
  const templatesByCategory = useMemo(() => {
    return HOOK_TEMPLATES.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    }, {} as Record<TemplateCategory, HookTemplate[]>);
  }, []);

  // Define category order
  const categoryOrder: TemplateCategory[] = ['notification', 'indexing', 'automation', 'protection', 'utility'];

  const handleInstall = async (templateId: string) => {
    await onInstallTemplate(templateId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Zap className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {formatMessage({ id: 'cliHooks.templates.title' })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatMessage({ id: 'cliHooks.templates.description' })}
          </p>
        </div>
      </div>

      {/* Categories */}
      {categoryOrder.map((category) => {
        const templates = templatesByCategory[category];
        if (!templates || templates.length === 0) return null;

        const { icon: CategoryIcon, color } = CATEGORY_ICONS[category];

        return (
          <div key={category} className="space-y-3">
            {/* Category Header */}
            <div className="flex items-center gap-2">
              <CategoryIcon className={cn('w-4 h-4', color)} />
              <h3 className="text-sm font-medium text-foreground">
                {getCategoryName(category, formatMessage)}
              </h3>
              <Badge variant="outline" className="text-xs">
                {templates.length}
              </Badge>
            </div>

            {/* Template Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((template) => {
                const isInstalled = installedTemplates.includes(template.id);
                const isInstalling = installingTemplateId === template.id;
                const TemplateIcon = TEMPLATE_ICONS[template.id] || Zap;
                const { color: catColor, bg: catBg } = CATEGORY_ICONS[template.category];

                return (
                  <Card
                    key={template.id}
                    className={cn(
                      'p-4 flex flex-col gap-2 transition-colors',
                      isInstalled && 'opacity-70'
                    )}
                  >
                    {/* Card Header: Icon + Name + Install */}
                    <div className="flex items-start gap-3">
                      <div className={cn('p-2 rounded-lg shrink-0', catBg)}>
                        <TemplateIcon className={cn('w-4 h-4', catColor)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-foreground leading-tight">
                          {formatMessage(
                            { id: `cliHooks.templates.templates.${template.id}.name`, defaultMessage: template.name }
                          )}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {formatMessage({ id: `cliHooks.trigger.${template.trigger}` })}
                          </Badge>
                          {template.matcher && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                              {template.matcher}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {/* Icon Install Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isInstalled || isInstalling}
                        onClick={() => handleInstall(template.id)}
                        className={cn(
                          'h-8 w-8 p-0 shrink-0 rounded-full',
                          isInstalled
                            ? 'text-green-500 hover:text-green-500'
                            : 'text-primary hover:bg-primary/10'
                        )}
                        title={isInstalled
                          ? formatMessage({ id: 'cliHooks.templates.actions.installed' })
                          : formatMessage({ id: 'cliHooks.templates.actions.install' })
                        }
                      >
                        {isInstalling ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isInstalled ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1 pl-11">
                      {formatMessage(
                        { id: `cliHooks.templates.templates.${template.id}.description`, defaultMessage: template.description }
                      )}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default HookQuickTemplates;
