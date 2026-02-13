// ========================================
// ErrorMessage Component
// ========================================

import { useIntl } from 'react-intl';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface ErrorMessageProps {
  title: string;
  message: string;
  timestamp?: number;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorMessage({
  title,
  message,
  onRetry,
  onDismiss,
  className
}: ErrorMessageProps) {
  const { formatMessage } = useIntl();

  return (
    <div
      className={cn(
        'bg-rose-50/60 dark:bg-rose-950/40 border-l-2 border-rose-500 dark:border-rose-400 rounded-r-lg overflow-hidden transition-all',
        className
      )}
    >
      {/* Header - simplified */}
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
        <span className="text-xs font-medium text-rose-900 dark:text-rose-100">
          {title}
        </span>
      </div>

      {/* Content */}
      <div className="px-2.5 py-2 bg-rose-50/40 dark:bg-rose-950/30">
        <p className="text-xs text-rose-900 dark:text-rose-100 whitespace-pre-wrap break-words">
          {message}
        </p>
      </div>

      {/* Actions */}
      {(onRetry || onDismiss) && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-rose-50/40 dark:bg-rose-950/30">
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="h-6 px-2 text-[10px] border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
            >
              {formatMessage({ id: 'cliMonitor.retry' })}
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            >
              {formatMessage({ id: 'cliMonitor.dismiss' })}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default ErrorMessage;
