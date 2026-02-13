// ========================================
// LogBlock Component
// ========================================

import { memo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  Brain,
  Settings,
  Info,
  MessageCircle,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { LogBlockProps, LogLine } from './types';
import { getOutputLineClass } from './utils';

// Local function for icon rendering (uses JSX, must stay in .tsx file)
function getOutputLineIcon(type: LogLine['type']) {
  switch (type) {
    case 'thought':
      return <Brain className="h-3 w-3" />;
    case 'system':
      return <Settings className="h-3 w-3" />;
    case 'stderr':
      return <AlertCircle className="h-3 w-3" />;
    case 'metadata':
      return <Info className="h-3 w-3" />;
    case 'tool_call':
      return <Wrench className="h-3 w-3" />;
    case 'stdout':
    default:
      return <MessageCircle className="h-3 w-3" />;
  }
}

function getBlockBorderClass(status: LogBlockProps['block']['status']): string {
  switch (status) {
    case 'running':
      return 'border-l-4 border-l-blue-500';
    case 'completed':
      return 'border-l-4 border-l-green-500';
    case 'error':
      return 'border-l-4 border-l-red-500';
    case 'pending':
      return 'border-l-4 border-l-yellow-500';
    default:
      return 'border-l-4 border-l-border';
  }
}

function getBlockTypeColor(type: LogBlockProps['block']['type']): string {
  switch (type) {
    case 'command':
      return 'text-blue-400';
    case 'tool':
      return 'text-green-400';
    case 'output':
      return 'text-foreground';
    case 'error':
      return 'text-red-400';
    case 'warning':
      return 'text-yellow-400';
    case 'info':
      return 'text-cyan-400';
    default:
      return 'text-foreground';
  }
}

function getStatusBadgeVariant(status: LogBlockProps['block']['status']): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' | 'outline' {
  switch (status) {
    case 'running':
      return 'info';
    case 'completed':
      return 'success';
    case 'error':
      return 'destructive';
    case 'pending':
      return 'warning';
    default:
      return 'secondary';
  }
}

function getStatusIcon(status: LogBlockProps['block']['status']) {
  switch (status) {
    case 'running':
      return <Loader2 className="h-3 w-3 animate-spin" />;
    case 'completed':
      return <CheckCircle className="h-3 w-3" />;
    case 'error':
      return <AlertCircle className="h-3 w-3" />;
    case 'pending':
      return <Clock className="h-3 w-3" />;
    default:
      return null;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export const LogBlock = memo(function LogBlock({
  block,
  isExpanded,
  onToggleExpand,
  onCopyCommand,
  onCopyOutput,
  onReRun,
  className,
}: LogBlockProps) {
  return (
    <div className={cn('border border-border rounded-lg overflow-hidden', getBlockBorderClass(block.status), className)}>
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 bg-card cursor-pointer hover:bg-accent/50 transition-colors',
          'group'
        )}
        onClick={onToggleExpand}
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
        <div className="shrink-0 text-muted-foreground">
          {getStatusIcon(block.status)}
        </div>

        {/* Title with type-specific color */}
        <div className={cn('font-medium text-sm truncate', getBlockTypeColor(block.type))}>
          {block.title}
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-1 min-w-0">
          {block.toolName && (
            <span className="truncate">{block.toolName}</span>
          )}
          <span className="shrink-0">{block.lineCount} lines</span>
          {block.duration !== undefined && (
            <span className="shrink-0">{formatDuration(block.duration)}</span>
          )}
        </div>

        {/* Status Badge */}
        <Badge variant={getStatusBadgeVariant(block.status)} className="shrink-0">
          {block.status}
        </Badge>

        {/* Action Buttons (visible on hover) */}
        <div
          className={cn(
            'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
            'shrink-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCopyCommand}
            title="Copy command"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCopyOutput}
            title="Copy output"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onReRun}
            title="Re-run"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="px-3 py-2 bg-background border-t border-border">
          <div className="font-mono text-xs space-y-1 max-h-96 overflow-y-auto">
            {block.lines.map((line, index) => (
              <div key={index} className={cn('flex gap-2', getOutputLineClass(line.type))}>
                <span className="text-muted-foreground shrink-0">
                  {getOutputLineIcon(line.type)}
                </span>
                <span className="break-all">{line.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for performance
  // Compare all relevant block fields to detect changes
  const prevBlock = prevProps.block;
  const nextBlock = nextProps.block;

  return (
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.className === nextProps.className &&
    prevBlock.id === nextBlock.id &&
    prevBlock.status === nextBlock.status &&
    prevBlock.title === nextBlock.title &&
    prevBlock.toolName === nextBlock.toolName &&
    prevBlock.lineCount === nextBlock.lineCount &&
    prevBlock.duration === nextBlock.duration
    // Note: We don't compare block.lines deeply for performance reasons.
    // The store's getBlocks method returns cached arrays, so if lines change
    // significantly, a new block object will be created and the id will change.
  );
});

export default LogBlock;
