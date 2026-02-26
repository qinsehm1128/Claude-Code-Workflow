// ========================================
// StreamingOutput Component
// ========================================
// Real-time streaming output display with auto-scroll

import * as React from 'react';
import { useRef, useCallback, useEffect } from 'react';
import { ArrowDownToLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import type { CliOutputLine } from '@/stores/cliStreamStore';

export interface StreamingOutputProps {
  /** Output lines to display */
  outputs: CliOutputLine[];
  /** Whether new output is being streamed */
  isStreaming?: boolean;
  /** Enable auto-scroll (default: true) */
  autoScroll?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * Get CSS class for log type coloring
 */
const getLogTypeColor = (type: CliOutputLine['type']) => {
  const colors = {
    stdout: 'text-foreground',
    stderr: 'text-destructive',
    metadata: 'text-warning',
    thought: 'text-info',
    system: 'text-muted-foreground',
    tool_call: 'text-purple-500',
  };
  return colors[type] || colors.stdout;
};

/**
 * StreamingOutput component - Display real-time streaming logs
 *
 * @remarks
 * Displays CLI output lines with timestamps and type labels.
 * Auto-scrolls to bottom when new output arrives, with user scroll detection.
 *
 * @example
 * ```tsx
 * <StreamingOutput
 *   outputs={outputLines}
 *   isStreaming={isActive}
 * />
 * ```
 */
export function StreamingOutput({
  outputs,
  isStreaming = false,
  autoScroll = true,
  className,
}: StreamingOutputProps) {
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = React.useState(false);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (autoScroll && !isUserScrolling && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [outputs, autoScroll, isUserScrolling]);

  // Handle scroll to detect user scrolling
  const handleScroll = useCallback(() => {
    if (!logsContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    setIsUserScrolling(!isAtBottom);
  }, []);

  // Scroll to bottom handler
  const scrollToBottom = useCallback(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsUserScrolling(false);
  }, []);

  return (
    <div className={cn('flex-1 flex flex-col relative', className)}>
      {/* Logs container */}
      <div
        ref={logsContainerRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs"
        onScroll={handleScroll}
      >
        {outputs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {isStreaming
              ? 'Waiting for output...'
              : 'No output available'}
          </div>
        ) : (
          <div className="space-y-1">
            {outputs.map((line, index) => (
              <div key={index} className="flex gap-2">
                <span className="text-muted-foreground shrink-0">
                  {new Date(line.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={cn(
                    'uppercase w-20 shrink-0',
                    getLogTypeColor(line.type)
                  )}
                >
                  [{line.type}]
                </span>
                <span className="text-foreground break-all">
                  {line.content}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {isUserScrolling && outputs.length > 0 && (
        <div className="sticky bottom-3 flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            className="shadow-lg"
            onClick={scrollToBottom}
          >
            <ArrowDownToLine className="h-4 w-4 mr-1" />
            Scroll to bottom
          </Button>
        </div>
      )}
    </div>
  );
}
