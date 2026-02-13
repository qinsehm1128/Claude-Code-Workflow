// ========================================
// AssistantMessage Component
// ========================================

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Bot, ChevronDown, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

// Status indicator component
interface StatusIndicatorProps {
  status: 'thinking' | 'streaming' | 'completed' | 'error';
  duration?: number;
}

function StatusIndicator({ status, duration }: StatusIndicatorProps) {
  const { formatMessage } = useIntl();

  if (status === 'thinking') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
        {formatMessage({ id: 'cliMonitor.thinking' })}
        <span className="animate-pulse">●</span>
      </span>
    );
  }

  if (status === 'streaming') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400">
        {formatMessage({ id: 'cliMonitor.streaming' })}
        <span className="animate-pulse">●</span>
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400">
        Err
        <span>●</span>
      </span>
    );
  }

  if (duration !== undefined) {
    const seconds = (duration / 1000).toFixed(1);
    return (
      <span className="text-[10px] text-muted-foreground">
        {seconds}s
      </span>
    );
  }

  return null;
}

// Format duration helper
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

export interface AssistantMessageProps {
  content: string;
  modelName?: string;
  status?: 'thinking' | 'streaming' | 'completed' | 'error';
  duration?: number;
  tokenCount?: number;
  timestamp?: number;
  onCopy?: () => void;
  className?: string;
}

export function AssistantMessage({
  content,
  modelName = 'AI',
  status = 'completed',
  duration,
  tokenCount,
  // timestamp is kept for future use but not currently displayed
  // timestamp,
  onCopy,
  className
}: AssistantMessageProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = () => {
    onCopy?.();
    setCopied(true);
  };

  return (
    <div
      className={cn(
        'bg-violet-50/60 dark:bg-violet-950/40 border-l-2 border-violet-400 dark:border-violet-500 rounded-r-lg overflow-hidden transition-all',
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-violet-100/40 dark:hover:bg-violet-900/30 transition-colors',
          'group'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Bot className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
        <span className="text-xs font-medium text-violet-900 dark:text-violet-100">
          {modelName}
        </span>

        <div className="flex items-center gap-1.5 ml-auto">
          <StatusIndicator status={status} duration={duration} />
          <ChevronDown
            className={cn(
              'h-3 w-3 text-muted-foreground transition-transform',
              !isExpanded && '-rotate-90'
            )}
          />
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <>
          <div className="px-2.5 py-2 bg-violet-50/40 dark:bg-violet-950/30">
            <div className="bg-white/60 dark:bg-black/30 rounded border border-violet-200/40 dark:border-violet-800/30 p-2.5">
              <div className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed">
                {content}
              </div>
            </div>
          </div>

          {/* Metadata Footer - simplified */}
          <div
            className={cn(
              'flex items-center justify-between px-2.5 py-1 bg-violet-50/40 dark:bg-violet-950/30',
              'text-[10px] text-muted-foreground group'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              {duration !== undefined && (
                <span className="opacity-70">{formatDuration(duration)}</span>
              )}
              {tokenCount !== undefined && (
                <span className="opacity-50 group-hover:opacity-70 transition-opacity">
                  {tokenCount.toLocaleString()} tok
                </span>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-5 px-1.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {copied ? (
                <Check className="h-2.5 w-2.5" />
              ) : (
                <Copy className="h-2.5 w-2.5" />
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default AssistantMessage;
