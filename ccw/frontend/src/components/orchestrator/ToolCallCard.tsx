// ========================================
// Tool Call Card Component
// ========================================
// Expandable card displaying tool call details with status, output, and results

import { memo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Terminal,
  Wrench,
  FileEdit,
  FileText,
  Brain,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolCallExecution } from '@/types/toolCall';

// ========== Helper Functions ==========

/**
 * Get status icon for tool call
 */
function getToolCallStatusIcon(status: ToolCallExecution['status']) {
  const iconClassName = 'h-4 w-4';

  switch (status) {
    case 'pending':
      return <Clock className={cn(iconClassName, 'text-muted-foreground')} />;
    case 'executing':
      return <Loader2 className={cn(iconClassName, 'text-primary animate-spin')} />;
    case 'success':
      return <CheckCircle2 className={cn(iconClassName, 'text-green-500')} />;
    case 'error':
      return <AlertCircle className={cn(iconClassName, 'text-destructive')} />;
    case 'canceled':
      return <XCircle className={cn(iconClassName, 'text-muted-foreground')} />;
  }
}

/**
 * Get kind icon for tool call
 */
function getToolCallKindIcon(kind: ToolCallExecution['kind']) {
  const iconClassName = 'h-3.5 w-3.5';

  switch (kind) {
    case 'execute':
      return <Terminal className={iconClassName} />;
    case 'patch':
      return <FileEdit className={iconClassName} />;
    case 'thinking':
      return <Brain className={iconClassName} />;
    case 'web_search':
      return <Search className={iconClassName} />;
    case 'mcp_tool':
      return <Wrench className={iconClassName} />;
    case 'file_operation':
      return <FileText className={iconClassName} />;
  }
}

/**
 * Get kind label for tool call
 */
function getToolCallKindLabel(kind: ToolCallExecution['kind']): string {
  switch (kind) {
    case 'execute':
      return 'Execute';
    case 'patch':
      return 'Patch';
    case 'thinking':
      return 'Thinking';
    case 'web_search':
      return 'Web Search';
    case 'mcp_tool':
      return 'MCP Tool';
    case 'file_operation':
      return 'File Operation';
  }
}

/**
 * Get border color class for tool call status
 */
function getToolCallBorderClass(status: ToolCallExecution['status']): string {
  switch (status) {
    case 'pending':
      return 'border-l-2 border-l-yellow-500/50';
    case 'executing':
      return 'border-l-2 border-l-blue-500';
    case 'success':
      return 'border-l-2 border-l-green-500';
    case 'error':
      return 'border-l-2 border-l-destructive';
    case 'canceled':
      return 'border-l-2 border-l-muted-foreground/50';
  }
}

/**
 * Format duration in milliseconds to human readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Calculate duration from start and end time
 */
function calculateDuration(startTime: number, endTime?: number): string {
  const duration = (endTime || Date.now()) - startTime;
  return formatDuration(duration);
}

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

// ========== Component Interfaces ==========

export interface ToolCallCardProps {
  /** Tool call execution data */
  toolCall: ToolCallExecution;
  /** Whether the card is expanded */
  isExpanded?: boolean;
  /** Callback when toggle expand/collapse */
  onToggle: () => void;
  /** Optional CSS class name */
  className?: string;
}

// ========== Component ==========

export const ToolCallCard = memo(function ToolCallCard({
  toolCall,
  isExpanded = false,
  onToggle,
  className,
}: ToolCallCardProps) {
  const duration = calculateDuration(toolCall.startTime, toolCall.endTime);

  return (
    <div
      className={cn(
        'border border-border rounded-lg overflow-hidden transition-colors',
        getToolCallBorderClass(toolCall.status),
        toolCall.status === 'executing' && 'animate-pulse-subtle',
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-3 p-3 cursor-pointer transition-colors',
          'hover:bg-muted/30'
        )}
        onClick={onToggle}
      >
        {/* Expand/Collapse Icon */}
        <div className="shrink-0">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Status Icon */}
        <div className="shrink-0">{getToolCallStatusIcon(toolCall.status)}</div>

        {/* Kind Icon */}
        <div className="shrink-0 text-muted-foreground">
          {getToolCallKindIcon(toolCall.kind)}
        </div>

        {/* Description */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{toolCall.description}</p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {getToolCallKindLabel(toolCall.kind)}
            </p>
            {toolCall.subtype && (
              <>
                <span className="text-xs text-muted-foreground">·</span>
                <p className="text-xs text-muted-foreground">{toolCall.subtype}</p>
              </>
            )}
          </div>
        </div>

        {/* Duration */}
        <div className="text-xs text-muted-foreground font-mono shrink-0">
          {duration}
        </div>

        {/* Exit Code Badge (if completed) */}
        {toolCall.exitCode !== undefined && (
          <div
            className={cn(
              'text-xs font-mono px-2 py-0.5 rounded shrink-0',
              toolCall.exitCode === 0
                ? 'bg-green-500/10 text-green-500'
                : 'bg-destructive/10 text-destructive'
            )}
          >
            Exit: {toolCall.exitCode}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-3 bg-muted/20 space-y-3">
          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Started: {formatTimestamp(toolCall.startTime)}</span>
            {toolCall.endTime && (
              <span>Ended: {formatTimestamp(toolCall.endTime)}</span>
            )}
            <span>Duration: {duration}</span>
          </div>

          {/* stdout Output */}
          {toolCall.outputBuffer.stdout && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Terminal className="h-3 w-3" />
                Output (stdout):
              </div>
              <pre className="text-xs bg-background rounded border border-border p-2 overflow-x-auto max-h-48 overflow-y-auto">
                {toolCall.outputBuffer.stdout}
              </pre>
            </div>
          )}

          {/* stderr Output */}
          {toolCall.outputBuffer.stderr && (
            <div>
              <div className="text-xs font-medium text-destructive mb-1.5 flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" />
                Error Output (stderr):
              </div>
              <pre className="text-xs bg-destructive/10 text-destructive rounded border border-destructive/20 p-2 overflow-x-auto max-h-48 overflow-y-auto">
                {toolCall.outputBuffer.stderr}
              </pre>
            </div>
          )}

          {/* Error Message */}
          {toolCall.error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded p-2 border border-destructive/20">
              <span className="font-medium">Error: </span>
              {toolCall.error}
            </div>
          )}

          {/* Result Display (if available) */}
          {toolCall.result !== undefined && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">
                Result:
              </div>
              <pre className="text-xs bg-background rounded border border-border p-2 overflow-x-auto max-h-48 overflow-y-auto">
                {typeof toolCall.result === 'string'
                  ? toolCall.result
                  : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}

          {/* Output Lines Count */}
          {toolCall.outputLines.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {toolCall.outputLines.length} output line{toolCall.outputLines.length !== 1 ? 's' : ''} captured
            </div>
          )}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for performance optimization
  return (
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.className === nextProps.className &&
    prevProps.toolCall.callId === nextProps.toolCall.callId &&
    prevProps.toolCall.status === nextProps.toolCall.status &&
    prevProps.toolCall.description === nextProps.toolCall.description &&
    prevProps.toolCall.endTime === nextProps.toolCall.endTime &&
    prevProps.toolCall.exitCode === nextProps.toolCall.exitCode &&
    prevProps.toolCall.error === nextProps.toolCall.error &&
    prevProps.toolCall.outputBuffer.stdout === nextProps.toolCall.outputBuffer.stdout &&
    prevProps.toolCall.outputBuffer.stderr === nextProps.toolCall.outputBuffer.stderr
  );
});

export default ToolCallCard;
