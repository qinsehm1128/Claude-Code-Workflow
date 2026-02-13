// ========================================
// UserMessage Component
// ========================================

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { User, ChevronDown, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface UserMessageProps {
  content: string;
  timestamp?: number;
  onCopy?: () => void;
  onViewRaw?: () => void;
  className?: string;
}

export function UserMessage({
  content,
  onCopy,
  onViewRaw,
  className
}: UserMessageProps) {
  const { formatMessage } = useIntl();
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  // Auto-reset copied state
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
        'bg-sky-50/60 dark:bg-sky-950/40 border-l-2 border-sky-500 dark:border-sky-400 rounded-r-lg overflow-hidden transition-all',
        className
      )}
    >
      {/* Header - simplified */}
      <div
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-sky-100/40 dark:hover:bg-sky-900/30 transition-colors',
          'group'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <User className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
        <span className="text-xs font-medium text-sky-900 dark:text-sky-100">
          {formatMessage({ id: 'cliMonitor.user' })}
        </span>
        <ChevronDown
          className={cn(
            'h-3 w-3 text-muted-foreground transition-transform ml-auto',
            !isExpanded && '-rotate-90'
          )}
        />
      </div>

      {/* Content */}
      {isExpanded && (
        <>
          <div className="px-2.5 py-2 bg-sky-50/40 dark:bg-sky-950/30">
            <div className="bg-white/60 dark:bg-black/30 rounded border border-sky-200/40 dark:border-sky-800/30 p-2.5">
              <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-sans leading-relaxed">
                {content}
              </pre>
            </div>
          </div>

          {/* Actions - simplified */}
          <div
            className={cn(
              'flex items-center justify-end gap-1.5 px-2.5 py-1 bg-sky-50/40 dark:bg-sky-950/30 group',
            )}
            onClick={(e) => e.stopPropagation()}
          >
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
            {onViewRaw && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewRaw}
                className="h-5 px-1.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {formatMessage({ id: 'cliMonitor.rawJson' })}
                <ChevronDown className="h-2.5 w-2.5 ml-1" />
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default UserMessage;
