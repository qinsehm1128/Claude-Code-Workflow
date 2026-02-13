// ========================================
// InsightsPanel Component
// ========================================
// AI insights panel for prompt history analysis

import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Wand2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { PromptInsight, Pattern, Suggestion } from '@/types/store';

export interface InsightsPanelProps {
  /** Available insights */
  insights?: PromptInsight[];
  /** Detected patterns */
  patterns?: Pattern[];
  /** AI suggestions */
  suggestions?: Suggestion[];
  /** Currently selected tool */
  selectedTool: 'gemini' | 'qwen' | 'codex';
  /** Called when tool selection changes */
  onToolChange: (tool: 'gemini' | 'qwen' | 'codex') => void;
  /** Called when analyze is triggered */
  onAnalyze: () => void;
  /** Loading state */
  isAnalyzing?: boolean;
  /** Optional className */
  className?: string;
}

const toolConfig = {
  gemini: {
    label: 'Gemini',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  qwen: {
    label: 'Qwen',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  codex: {
    label: 'Codex',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
};

/**
 * InsightCard component for displaying a single insight
 */
function InsightCard({ insight }: { insight: PromptInsight }) {
  const { formatMessage } = useIntl();

  const typeConfig = {
    suggestion: {
      icon: Lightbulb,
      variant: 'info' as const,
      color: 'text-blue-500',
    },
    optimization: {
      icon: Sparkles,
      variant: 'success' as const,
      color: 'text-green-500',
    },
    warning: {
      icon: AlertTriangle,
      variant: 'warning' as const,
      color: 'text-orange-500',
    },
  };

  const config = typeConfig[insight.type];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <div className={cn('flex-shrink-0', config.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">{insight.content}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">
            {Math.round(insight.confidence * 100)}% {formatMessage({ id: 'prompts.insights.confidence' })}
          </Badge>
        </div>
      </div>
    </div>
  );
}

/**
 * PatternCard component for displaying a detected pattern
 */
function PatternCard({ pattern }: { pattern: Pattern }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <div className="flex-shrink-0 text-purple-500">
        <Wand2 className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{pattern.name}</p>
        <p className="text-xs text-muted-foreground mt-1">{pattern.description}</p>
        {pattern.example && (
          <code className="block mt-2 text-xs bg-background rounded p-2 overflow-x-auto">
            {pattern.example}
          </code>
        )}
        {pattern.severity && (
          <Badge variant={pattern.severity === 'error' ? 'destructive' : pattern.severity === 'warning' ? 'warning' : 'secondary'} className="mt-2 text-xs">
            {pattern.severity}
          </Badge>
        )}
      </div>
    </div>
  );
}

/**
 * SuggestionCard component for displaying a suggestion
 */
function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const { formatMessage } = useIntl();

  const typeConfig = {
    refactor: { color: 'text-blue-500', label: formatMessage({ id: 'prompts.suggestions.types.refactor' }) },
    optimize: { color: 'text-green-500', label: formatMessage({ id: 'prompts.suggestions.types.optimize' }) },
    fix: { color: 'text-orange-500', label: formatMessage({ id: 'prompts.suggestions.types.fix' }) },
    document: { color: 'text-purple-500', label: formatMessage({ id: 'prompts.suggestions.types.document' }) },
  };

  const config = typeConfig[suggestion.type];

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <div className={cn('flex-shrink-0', config.color)}>
        <Lightbulb className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{suggestion.title}</p>
          <Badge variant="outline" className="text-xs">
            {config.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{suggestion.description}</p>
        {suggestion.code && (
          <code className="block mt-2 text-xs bg-background rounded p-2 overflow-x-auto">
            {suggestion.code}
          </code>
        )}
        {suggestion.effort && (
          <Badge variant="secondary" className="mt-2 text-xs">
            {formatMessage({ id: 'prompts.suggestions.effort' })}: {suggestion.effort}
          </Badge>
        )}
      </div>
    </div>
  );
}

/**
 * InsightsPanel component - AI analysis panel for prompt history
 */
export function InsightsPanel({
  insights = [],
  patterns = [],
  suggestions = [],
  selectedTool,
  onToolChange,
  onAnalyze,
  isAnalyzing = false,
  className,
}: InsightsPanelProps) {
  const { formatMessage } = useIntl();

  const hasContent = insights.length > 0 || patterns.length > 0 || suggestions.length > 0;

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {formatMessage({ id: 'prompts.insights.title' })}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAnalyze()}
            disabled={isAnalyzing}
            className="gap-2"
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {formatMessage({ id: 'prompts.insights.analyze' })}
          </Button>
        </div>

        {/* Tool selector */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-sm text-muted-foreground">
            {formatMessage({ id: 'prompts.insights.selectTool' })}:
          </span>
          <div className="flex gap-1">
            {(Object.keys(toolConfig) as Array<keyof typeof toolConfig>).map((tool) => (
              <button
                key={tool}
                onClick={() => onToolChange(tool)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  selectedTool === tool
                    ? cn(toolConfig[tool].bgColor, toolConfig[tool].color)
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {toolConfig[tool].label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto">
        {!hasContent && !isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-sm font-medium text-foreground mb-1">
              {formatMessage({ id: 'prompts.insights.empty.title' })}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              {formatMessage({ id: 'prompts.insights.empty.message' })}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Insights section */}
            {insights.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  {formatMessage({ id: 'prompts.insights.sections.insights' })}
                </h4>
                <div className="space-y-2">
                  {insights.map((insight) => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))}
                </div>
              </div>
            )}

            {/* Patterns section */}
            {patterns.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Wand2 className="h-4 w-4" />
                  {formatMessage({ id: 'prompts.insights.sections.patterns' })}
                </h4>
                <div className="space-y-2">
                  {patterns.map((pattern) => (
                    <PatternCard key={pattern.id} pattern={pattern} />
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions section */}
            {suggestions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  {formatMessage({ id: 'prompts.insights.sections.suggestions' })}
                </h4>
                <div className="space-y-2">
                  {suggestions.map((suggestion) => (
                    <SuggestionCard key={suggestion.id} suggestion={suggestion} />
                  ))}
                </div>
              </div>
            )}

            {isAnalyzing && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  {formatMessage({ id: 'prompts.insights.analyzing' })}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default InsightsPanel;
