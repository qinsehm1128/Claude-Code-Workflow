// ========================================
// Tool Calls Timeline Component
// ========================================
// Vertical timeline displaying tool calls in chronological order

import { memo, useMemo, useCallback, useEffect, useRef } from 'react';
import { Wrench, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolCallCard } from './ToolCallCard';
import type { ToolCallExecution } from '@/types/toolCall';

// ========== Helper Functions ==========

/**
 * Format timestamp to locale time string
 */
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Get timeline dot color based on tool call status
 */
function getTimelineDotClass(status: ToolCallExecution['status']): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-500';
    case 'executing':
      return 'bg-blue-500 animate-ping';
    case 'success':
      return 'bg-green-500';
    case 'error':
      return 'bg-destructive';
    case 'canceled':
      return 'bg-muted-foreground';
  }
}

/**
 * Check if tool call is currently executing
 */
function isExecutingToolCall(toolCall: ToolCallExecution): boolean {
  return toolCall.status === 'executing' || toolCall.status === 'pending';
}

// ========== Component Interfaces ==========

export interface ToolCallsTimelineProps {
  /** Array of tool call executions to display */
  toolCalls: ToolCallExecution[];
  /** Callback when a tool call is toggled (expanded/collapsed) */
  onToggleExpand: (callId: string) => void;
  /** Optional CSS class name */
  className?: string;
}

// ========== Internal Components ==========

interface ToolCallTimelineItemProps {
  /** Tool call execution data */
  call: ToolCallExecution;
  /** Callback when toggle expand/collapse */
  onToggle: () => void;
  /** Whether this is the last item in timeline */
  isLast: boolean;
}

/**
 * Individual timeline item with timestamp and tool call card
 */
const ToolCallTimelineItem = memo(function ToolCallTimelineItem({
  call,
  onToggle,
  isLast,
}: ToolCallTimelineItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to this item if it's executing
  useEffect(() => {
    if (isExecutingToolCall(call) && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [call.status]);

  return (
    <div ref={itemRef} className="relative pl-6 pb-1">
      {/* Timeline vertical line */}
      <div
        className={cn(
          'absolute left-0 top-2 w-px bg-border',
          !isLast && 'bottom-0'
        )}
      />

      {/* Timeline dot */}
      <div
        className={cn(
          'absolute left-0 top-2.5 w-2 h-2 rounded-full',
          'border-2 border-background',
          getTimelineDotClass(call.status)
        )}
      />

      {/* Timestamp */}
      <div className="text-xs text-muted-foreground mb-1.5 font-mono">
        {formatTimestamp(call.startTime)}
      </div>

      {/* Tool Call Card */}
      <ToolCallCard
        toolCall={call}
        isExpanded={call.isExpanded}
        onToggle={onToggle}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for performance
  return (
    prevProps.isLast === nextProps.isLast &&
    prevProps.call.callId === nextProps.call.callId &&
    prevProps.call.status === nextProps.call.status &&
    prevProps.call.isExpanded === nextProps.call.isExpanded &&
    prevProps.call.endTime === nextProps.call.endTime
  );
});

// ========== Main Component ==========

export function ToolCallsTimeline({
  toolCalls,
  onToggleExpand,
  className,
}: ToolCallsTimelineProps) {
  // Auto-expand executing tool calls
  const adjustedToolCalls = useMemo(() => {
    return toolCalls.map((call) => {
      // Auto-expand if executing
      if (isExecutingToolCall(call) && !call.isExpanded) {
        return { ...call, isExpanded: true };
      }
      return call;
    });
  }, [toolCalls]);

  // Handle toggle expand
  const handleToggleExpand = useCallback(
    (callId: string) => {
      onToggleExpand(callId);
    },
    [onToggleExpand]
  );

  // Sort tool calls by start time (chronological order)
  const sortedToolCalls = useMemo(() => {
    return [...adjustedToolCalls].sort((a, b) => a.startTime - b.startTime);
  }, [adjustedToolCalls]);

  // Empty state
  if (sortedToolCalls.length === 0) {
    return (
      <div className={cn('p-8 text-center', className)}>
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Wrench className="h-12 w-12 opacity-50" />
          <p className="text-sm">暂无工具调用</p>
          <p className="text-xs">等待执行开始...</p>
        </div>
      </div>
    );
  }

  // Loading state (executing calls present)
  const hasExecutingCalls = sortedToolCalls.some((call) =>
    isExecutingToolCall(call)
  );

  return (
    <div className={cn('space-y-1', className)}>
      {/* Status indicator */}
      {hasExecutingCalls && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 text-xs text-primary bg-primary/5 rounded border border-primary/20">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>工具执行中...</span>
        </div>
      )}

      {/* Timeline items */}
      {sortedToolCalls.map((call, index) => (
        <ToolCallTimelineItem
          key={call.callId}
          call={call}
          onToggle={() => handleToggleExpand(call.callId)}
          isLast={index === sortedToolCalls.length - 1}
        />
      ))}

      {/* Summary stats */}
      {sortedToolCalls.length > 0 && (
        <div className="mt-4 px-3 py-2 text-xs text-muted-foreground bg-muted/30 rounded border border-border">
          <div className="flex items-center justify-between">
            <span>Total: {sortedToolCalls.length} tool call{sortedToolCalls.length !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Success: {sortedToolCalls.filter((c) => c.status === 'success').length}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                Error: {sortedToolCalls.filter((c) => c.status === 'error').length}
              </span>
              {hasExecutingCalls && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  Running: {sortedToolCalls.filter((c) => isExecutingToolCall(c)).length}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ToolCallsTimeline;

// Re-export ToolCallCard for direct usage
export { ToolCallCard } from './ToolCallCard';
