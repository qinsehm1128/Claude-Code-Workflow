// ========================================
// InsightDetailPanel Component
// ========================================
// Display detailed view of a single insight with patterns, suggestions, and metadata

import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import {
  X,
  Sparkles,
  Bot,
  Code2,
  Cpu,
  Trash2,
  AlertTriangle,
  Lightbulb,
  Clock,
  FileText,
} from 'lucide-react';
import type { InsightHistory, Pattern, Suggestion } from '@/lib/api';
import { Button } from '@/components/ui/Button';

export interface InsightDetailPanelProps {
  /** Insight to display (null = panel hidden) */
  insight: InsightHistory | null;
  /** Called when close button clicked */
  onClose: () => void;
  /** Called when delete button clicked */
  onDelete?: (insightId: string) => void;
  /** Is delete operation in progress */
  isDeleting?: boolean;
  /** Optional className */
  className?: string;
}

// Tool icon mapping
const toolConfig = {
  gemini: {
    icon: Sparkles,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    label: 'Gemini',
  },
  qwen: {
    icon: Bot,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    label: 'Qwen',
  },
  codex: {
    icon: Code2,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    label: 'Codex',
  },
  default: {
    icon: Cpu,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    label: 'CLI',
  },
};

// Severity configuration
const severityConfig = {
  error: {
    badge: 'bg-red-500/10 text-red-500 border-red-500/20',
    border: 'border-l-red-500',
    dot: 'bg-red-500',
  },
  warning: {
    badge: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    border: 'border-l-yellow-500',
    dot: 'bg-yellow-500',
  },
  info: {
    badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    border: 'border-l-blue-500',
    dot: 'bg-blue-500',
  },
  default: {
    badge: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    border: 'border-l-gray-500',
    dot: 'bg-gray-500',
  },
};

// Suggestion type configuration
const suggestionTypeConfig = {
  refactor: {
    badge: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    icon: 'refactor',
  },
  optimize: {
    badge: 'bg-green-500/10 text-green-500 border-green-500/20',
    icon: 'optimize',
  },
  fix: {
    badge: 'bg-red-500/10 text-red-500 border-red-500/20',
    icon: 'fix',
  },
  document: {
    badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    icon: 'document',
  },
};

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp: string, locale: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (locale === 'zh') {
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    return `${diffDays}天前`;
  }

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * PatternItem component for displaying a single pattern
 */
function PatternItem({ pattern }: { pattern: Pattern; locale: string }) {
  const severity = pattern.severity ?? 'info';
  const config = severityConfig[severity] ?? severityConfig.default;

  return (
    <div
      className={cn(
        'p-3 rounded-md border bg-card',
        'border-l-4',
        config.border
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            'px-2 py-0.5 text-xs font-medium rounded border',
            config.badge
          )}
        >
          {pattern.name?.split(' ')[0] || 'Pattern'}
        </span>
        <span
          className={cn(
            'px-2 py-0.5 text-xs font-medium rounded border uppercase',
            config.badge
          )}
        >
          {severity}
        </span>
      </div>
      <p className="text-sm text-foreground mb-2">{pattern.description}</p>
      {pattern.example && (
        <div className="mt-2 p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
          <code className="text-muted-foreground">{pattern.example}</code>
        </div>
      )}
    </div>
  );
}

/**
 * SuggestionItem component for displaying a single suggestion
 */
function SuggestionItem({ suggestion }: { suggestion: Suggestion; locale: string }) {
  const { formatMessage } = useIntl();
  const config = suggestionTypeConfig[suggestion.type] ?? suggestionTypeConfig.refactor;
  const typeLabel = formatMessage({ id: `prompts.suggestions.types.${suggestion.type}` });

  return (
    <div className="p-3 rounded-md border border-border bg-card">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            'px-2 py-0.5 text-xs font-medium rounded border',
            config.badge
          )}
        >
          {typeLabel}
        </span>
        {suggestion.effort && (
          <span className="text-xs text-muted-foreground">
            {formatMessage({ id: 'prompts.suggestions.effort' })}: {suggestion.effort}
          </span>
        )}
      </div>
      <h4 className="text-sm font-medium text-foreground mb-1">{suggestion.title}</h4>
      <p className="text-sm text-muted-foreground mb-2">{suggestion.description}</p>
      {suggestion.code && (
        <div className="mt-2 p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
          <code className="text-muted-foreground">{suggestion.code}</code>
        </div>
      )}
    </div>
  );
}

/**
 * InsightDetailPanel component - Display full insight details
 */
export function InsightDetailPanel({
  insight,
  onClose,
  onDelete,
  isDeleting = false,
  className,
}: InsightDetailPanelProps) {
  const { formatMessage } = useIntl();
  const locale = useIntl().locale;

  // Don't render if no insight
  if (!insight) {
    return null;
  }

  const config = toolConfig[insight.tool as keyof typeof toolConfig] ?? toolConfig.default;
  const ToolIcon = config.icon;
  const timeAgo = formatRelativeTime(insight.created_at, locale);
  const patternCount = insight.patterns?.length ?? 0;
  const suggestionCount = insight.suggestions?.length ?? 0;

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 w-full max-w-md bg-background border-l border-border shadow-lg',
        'flex flex-col',
        'animate-in slide-in-from-right',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ToolIcon className={cn('h-5 w-5', config.color)} />
          <h2 className="text-lg font-semibold text-card-foreground">
            {formatMessage({ id: 'prompts.insightDetail.title' })}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-accent transition-colors"
          aria-label={formatMessage({ id: 'common.actions.close' })}
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div className={cn('flex items-center gap-1.5', config.color)}>
            <ToolIcon className="h-3.5 w-3.5" />
            <span className="font-medium">{config.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>{timeAgo}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span>
              {insight.prompt_count} {formatMessage({ id: 'prompts.insightDetail.promptsAnalyzed' })}
            </span>
          </div>
        </div>

        {/* Patterns */}
        {insight.patterns && insight.patterns.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-card-foreground">
                {formatMessage({ id: 'prompts.insightDetail.patterns' })} ({patternCount})
              </h3>
            </div>
            <div className="space-y-2">
              {insight.patterns.map((pattern) => (
                <PatternItem key={pattern.id} pattern={pattern} locale={locale} />
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {insight.suggestions && insight.suggestions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-card-foreground">
                {formatMessage({ id: 'prompts.insightDetail.suggestions' })} ({suggestionCount})
              </h3>
            </div>
            <div className="space-y-2">
              {insight.suggestions.map((suggestion) => (
                <SuggestionItem key={suggestion.id} suggestion={suggestion} locale={locale} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {(!insight.patterns || insight.patterns.length === 0) &&
         (!insight.suggestions || insight.suggestions.length === 0) && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {formatMessage({ id: 'prompts.insightDetail.noContent' })}
          </div>
        )}
      </div>

      {/* Footer actions */}
      {onDelete && (
        <div className="p-4 border-t border-border">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(insight.id)}
            disabled={isDeleting}
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting
              ? formatMessage({ id: 'prompts.insightDetail.deleting' })
              : formatMessage({ id: 'common.actions.delete' })
            }
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * InsightDetailPanelOverlay - Full screen overlay with panel
 */
export interface InsightDetailPanelOverlayProps extends InsightDetailPanelProps {
  /** Show overlay backdrop */
  showOverlay?: boolean;
}

export function InsightDetailPanelOverlay({
  insight,
  onClose,
  onDelete,
  isDeleting = false,
  showOverlay = true,
  className,
}: InsightDetailPanelOverlayProps) {
  if (!insight) {
    return null;
  }

  return (
    <>
      {showOverlay && (
        <div
          className="fixed inset-0 bg-black/60 z-40 animate-in fade-in"
          onClick={onClose}
        />
      )}
      <InsightDetailPanel
        insight={insight}
        onClose={onClose}
        onDelete={onDelete}
        isDeleting={isDeleting}
        className={cn('z-50', className)}
      />
    </>
  );
}

export default InsightDetailPanel;
