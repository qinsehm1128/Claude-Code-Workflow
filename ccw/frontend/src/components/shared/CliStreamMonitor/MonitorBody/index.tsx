// ========================================
// MonitorBody Component
// ========================================
// Scrollable container for message list

import { useEffect, useRef, useCallback, forwardRef, ForwardedRef, useState, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';
import { ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ========== Types ==========

export interface MonitorBodyProps {
  children: React.ReactNode;
  className?: string;
  autoScroll?: boolean;
  onScroll?: () => void;
  showScrollButton?: boolean;
  scrollThreshold?: number;
}

export interface MonitorBodyRef {
  scrollToBottom: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

// ========== Helper Components ==========

interface ScrollToBottomButtonProps {
  onClick: () => void;
  className?: string;
}

function ScrollToBottomButton({ onClick, className }: ScrollToBottomButtonProps) {
  return (
    <div className="sticky bottom-4 flex justify-end">
      <Button
        size="sm"
        variant="secondary"
        className={cn('shadow-lg', className)}
        onClick={onClick}
        title="Scroll to bottom"
      >
        <ArrowDownToLine className="h-4 w-4 mr-1" />
        Scroll to bottom
      </Button>
    </div>
  );
}

// ========== Component ==========

function MonitorBodyComponent(
  props: MonitorBodyProps,
  ref: ForwardedRef<MonitorBodyRef>
) {
  const {
    children,
    className,
    autoScroll = true,
    onScroll,
    showScrollButton = true,
    scrollThreshold = 50,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      scrollToBottom: () => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setIsUserScrolling(false);
      },
      containerRef,
    }),
    []
  );

  // Auto-scroll to bottom when children change
  useEffect(() => {
    if (autoScroll && !isUserScrolling && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [children, autoScroll, isUserScrolling]);

  // Handle scroll to detect user scrolling
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < scrollThreshold;

    const wasScrolling = isUserScrolling;
    setIsUserScrolling(!isAtBottom);

    // Call onScroll callback when user starts/stops scrolling
    if (onScroll && wasScrolling !== !isAtBottom) {
      onScroll();
    }
  }, [scrollThreshold, isUserScrolling, onScroll]);

  return (
    <div
      ref={containerRef}
      className={cn('flex-1 min-h-0 overflow-y-auto bg-background relative', className)}
      onScroll={handleScroll}
    >
      {children}
      {/* Anchor for scroll to bottom */}
      <div ref={logsEndRef} />

      {/* Show scroll button when user is not at bottom */}
      {showScrollButton && isUserScrolling && (
        <ScrollToBottomButton
          onClick={() => {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setIsUserScrolling(false);
          }}
        />
      )}
    </div>
  );
}

// Export with forwardRef
export const MonitorBody = forwardRef<MonitorBodyRef, MonitorBodyProps>(
  MonitorBodyComponent
);

MonitorBody.displayName = 'MonitorBody';

export default MonitorBody;
