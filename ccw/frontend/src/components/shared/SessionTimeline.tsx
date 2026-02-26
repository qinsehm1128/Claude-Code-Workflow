// ========================================
// SessionTimeline Component
// ========================================
// Timeline visualization for native CLI session turns, tokens, and tool calls

import * as React from 'react';
import { useIntl } from 'react-intl';
import {
  User,
  Bot,
  Brain,
  Wrench,
  Coins,
  Clock,
  ChevronDown,
  ChevronRight,
  Archive,
  ArrowDownUp,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import type {
  NativeSession,
  NativeSessionTurn,
  NativeTokenInfo,
  NativeToolCall,
} from '@/lib/api';

// ========== Types ==========

export interface SessionTimelineProps {
  session: NativeSession;
  className?: string;
}

interface TurnNodeProps {
  turn: NativeSessionTurn;
  isLatest: boolean;
  isLast: boolean;
}

interface TokenBarProps {
  tokens: NativeTokenInfo;
  className?: string;
}

interface ToolCallPanelProps {
  toolCall: NativeToolCall;
  index: number;
}

// ========== Helpers ==========

/**
 * Format token number with compact notation
 */
function formatTokenCount(count: number | undefined): string {
  if (count == null || count === 0) return '0';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

/**
 * Get status icon for tool call
 */
function getToolStatusIcon(status?: string): React.ReactNode {
  switch (status) {
    case 'completed':
    case 'success':
      return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    case 'error':
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    case 'running':
    case 'pending':
      return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
    default:
      return <Wrench className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

/**
 * Get badge variant for tool call status
 */
function getStatusVariant(status?: string): 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'info' {
  switch (status) {
    case 'completed':
    case 'success':
      return 'success';
    case 'error':
    case 'failed':
      return 'warning';
    case 'running':
    case 'pending':
      return 'info';
    default:
      return 'secondary';
  }
}

// ========== Sub-Components ==========

/**
 * TokenBar - Horizontal stacked bar for token usage
 */
function TokenBar({ tokens, className }: TokenBarProps) {
  const { formatMessage } = useIntl();
  const total = tokens.total || 0;
  const input = tokens.input || 0;
  const output = tokens.output || 0;
  const cached = tokens.cached || 0;

  // Calculate percentages
  const inputPercent = total > 0 ? (input / total) * 100 : 0;
  const outputPercent = total > 0 ? (output / total) * 100 : 0;
  const cachedPercent = total > 0 ? (cached / total) * 100 : 0;

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Visual bar */}
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted">
        {input > 0 && (
          <div
            className="bg-blue-500/80"
            style={{ width: `${inputPercent}%` }}
            title={formatMessage({ id: 'nativeSession.timeline.tokens.input', defaultMessage: 'Input: {count}' }, { count: formatTokenCount(input) })}
          />
        )}
        {output > 0 && (
          <div
            className="bg-green-500/80"
            style={{ width: `${outputPercent}%` }}
            title={formatMessage({ id: 'nativeSession.timeline.tokens.output', defaultMessage: 'Output: {count}' }, { count: formatTokenCount(output) })}
          />
        )}
        {cached > 0 && (
          <div
            className="bg-amber-500/80"
            style={{ width: `${cachedPercent}%` }}
            title={formatMessage({ id: 'nativeSession.timeline.tokens.cached', defaultMessage: 'Cached: {count}' }, { count: formatTokenCount(cached) })}
          />
        )}
      </div>
      {/* Labels */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Coins className="h-3 w-3" />
          {formatTokenCount(total)}
        </span>
        {input > 0 && (
          <span className="flex items-center gap-1">
            <ArrowDownUp className="h-3 w-3 text-blue-500" />
            {formatTokenCount(input)}
          </span>
        )}
        {output > 0 && (
          <span className="text-green-600 dark:text-green-400">
            out: {formatTokenCount(output)}
          </span>
        )}
        {cached > 0 && (
          <span className="flex items-center gap-1">
            <Archive className="h-3 w-3 text-amber-500" />
            {formatTokenCount(cached)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * ToolCallPanel - Collapsible panel for tool call details
 */
function ToolCallPanel({ toolCall, index }: ToolCallPanelProps) {
  const { formatMessage } = useIntl();
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
        aria-expanded={isExpanded}
        aria-controls={`toolcall-panel-${toolCall.name}-${index}`}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span aria-label={toolCall.output ? 'Tool completed' : 'Tool status unknown'}>
            {getToolStatusIcon(toolCall.output ? 'completed' : undefined)}
          </span>
          <span className="font-mono font-medium">{toolCall.name}</span>
          <span className="text-muted-foreground text-xs">#{index + 1}</span>
        </div>
        <Badge variant={getStatusVariant(toolCall.output ? 'completed' : undefined)} className="text-xs">
          {formatMessage({ id: 'nativeSession.timeline.toolCall.completed', defaultMessage: 'completed' })}
        </Badge>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div
          id={`toolcall-panel-${toolCall.name}-${index}`}
          className="border-t border-border/50 divide-y divide-border/50"
        >
          {toolCall.arguments && (
            <div className="p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                {formatMessage({ id: 'nativeSession.toolCall.input', defaultMessage: 'Input' })}
              </p>
              <pre className="p-2.5 bg-muted/30 rounded-md text-xs whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed max-h-48 overflow-y-auto">
                {toolCall.arguments}
              </pre>
            </div>
          )}
          {toolCall.output && (
            <div className="p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                {formatMessage({ id: 'nativeSession.toolCall.output', defaultMessage: 'Output' })}
              </p>
              <pre className="p-2.5 bg-muted/30 rounded-md text-xs whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed max-h-48 overflow-y-auto">
                {toolCall.output}
              </pre>
            </div>
          )}
          {!toolCall.arguments && !toolCall.output && (
            <div className="p-3 text-xs text-muted-foreground italic">
              {formatMessage({ id: 'nativeSession.timeline.toolCall.noData', defaultMessage: 'No data available' })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * TurnNode - Single conversation turn on the timeline
 */
function TurnNode({ turn, isLatest, isLast }: TurnNodeProps) {
  const { formatMessage } = useIntl();
  const isUser = turn.role === 'user';
  const RoleIcon = isUser ? User : Bot;

  return (
    <div className="flex gap-4">
      {/* Timeline column */}
      <div className="flex flex-col items-center">
        {/* Node dot */}
        <div
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0',
            isUser
              ? 'bg-primary/10 border-primary text-primary'
              : 'bg-blue-500/10 border-blue-500 text-blue-500',
            isLatest && 'ring-2 ring-offset-2 ring-offset-background',
            isLatest && (isUser ? 'ring-primary/50' : 'ring-blue-500/50')
          )}
        >
          <RoleIcon className="h-4 w-4" />
        </div>
        {/* Vertical connector line */}
        {!isLast && (
          <div className="w-0.5 flex-1 bg-border min-h-4" aria-hidden="true" />
        )}
      </div>

      {/* Content column */}
      <div className="flex-1 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={cn(
              'font-semibold text-sm capitalize',
              isUser ? 'text-primary' : 'text-blue-500'
            )}>
              {turn.role}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatMessage(
                { id: 'nativeSession.timeline.turnNumber', defaultMessage: 'Turn #{number}' },
                { number: turn.turnNumber }
              )}
            </span>
            {isLatest && (
              <Badge variant="default" className="text-xs h-5 px-1.5">
                {formatMessage({ id: 'nativeSession.turn.latest', defaultMessage: 'Latest' })}
              </Badge>
            )}
          </div>
          {turn.timestamp && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(turn.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Content card */}
        <div
          className={cn(
            'rounded-lg border overflow-hidden',
            isUser
              ? 'bg-muted/30 border-border'
              : 'bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/20'
          )}
        >
          {/* Message content */}
          {turn.content && (
            <div className="p-4">
              <pre className="text-sm whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed max-h-64 overflow-y-auto">
                {turn.content}
              </pre>
            </div>
          )}

          {/* Thoughts section */}
          {turn.thoughts && turn.thoughts.length > 0 && (
            <details className="group/thoughts border-t border-border/50">
              <summary className="flex items-center gap-2 px-4 py-2.5 text-sm cursor-pointer hover:bg-muted/30 select-none">
                <Brain className="h-4 w-4 text-purple-500" />
                <span className="font-medium text-muted-foreground">
                  {formatMessage({ id: 'nativeSession.turn.thoughts', defaultMessage: 'Thoughts' })}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({turn.thoughts.length})
                </span>
              </summary>
              <ul className="px-4 pb-3 space-y-1 text-sm text-muted-foreground list-disc list-inside">
                {turn.thoughts.map((thought, i) => (
                  <li key={`thought-${turn.turnNumber}-${i}`} className="leading-relaxed pl-2">{thought}</li>
                ))}
              </ul>
            </details>
          )}

          {/* Tool calls section */}
          {turn.toolCalls && turn.toolCalls.length > 0 && (
            <div className="border-t border-border/50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Wrench className="h-4 w-4" />
                <span className="font-medium">
                  {formatMessage({ id: 'nativeSession.turn.toolCalls', defaultMessage: 'Tool Calls' })}
                </span>
                <span className="text-xs">({turn.toolCalls.length})</span>
              </div>
              {turn.toolCalls.map((tc, i) => (
                <ToolCallPanel key={`toolcall-${turn.turnNumber}-${tc.name}-${i}`} toolCall={tc} index={i} />
              ))}
            </div>
          )}

          {/* Token usage bar */}
          {turn.tokens && (
            <div className="border-t border-border/50 px-4 py-3">
              <TokenBar tokens={turn.tokens} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== Main Component ==========

/**
 * SessionTimeline - Timeline visualization for native CLI sessions
 *
 * Displays conversation turns in a vertical timeline layout with:
 * - Left side: Timeline nodes with role icons
 * - Right side: Content cards with messages, thoughts, and tool calls
 * - Token usage bars with stacked input/output/cached visualization
 * - Collapsible tool call panels
 */
export function SessionTimeline({ session, className }: SessionTimelineProps) {
  const { formatMessage } = useIntl();
  const turns = session.turns || [];

  return (
    <div className={cn('space-y-0', className)}>
      {/* Session token summary bar */}
      {session.totalTokens && (
        <div className="mb-6 p-4 rounded-lg bg-muted/30 border">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {formatMessage({ id: 'nativeSession.tokenSummary', defaultMessage: 'Total Tokens' })}
          </p>
          <TokenBar tokens={session.totalTokens} />
        </div>
      )}

      {/* Timeline turns */}
      {turns.length > 0 ? (
        <div className="relative">
          {turns.map((turn, idx) => (
            <TurnNode
              key={turn.turnNumber}
              turn={turn}
              isLatest={idx === turns.length - 1}
              isLast={idx === turns.length - 1}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          {formatMessage({ id: 'nativeSession.empty', defaultMessage: 'No session data available' })}
        </div>
      )}
    </div>
  );
}

export default SessionTimeline;
