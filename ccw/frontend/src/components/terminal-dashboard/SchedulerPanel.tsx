// ========================================
// SchedulerPanel Component
// ========================================
// Standalone queue scheduler control panel.
// Shows scheduler status, start/pause/stop controls, concurrency config,
// progress bar, and session pool overview.

import { useCallback, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Play,
  Pause,
  Square,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/AlertDialog';
import { cn } from '@/lib/utils';
import {
  useQueueSchedulerStore,
  selectQueueSchedulerStatus,
  selectSchedulerProgress,
  selectSchedulerConfig,
  selectSessionPool,
  selectCurrentConcurrency,
  selectSchedulerError,
} from '@/stores/queueSchedulerStore';
import type { QueueSchedulerStatus } from '@/types/queue-frontend-types';

// ========== Status Badge Config ==========

const SCHEDULER_STATUS_CLASS: Record<QueueSchedulerStatus, string> = {
  idle: 'bg-muted text-muted-foreground border-border',
  running: 'bg-primary/10 text-primary border-primary/50',
  paused: 'bg-amber-500/10 text-amber-500 border-amber-500/50',
  stopping: 'bg-orange-500/10 text-orange-500 border-orange-500/50',
  completed: 'bg-green-500/10 text-green-500 border-green-500/50',
  failed: 'bg-destructive/10 text-destructive border-destructive/50',
};

// ========== Component ==========

export function SchedulerPanel() {
  const { formatMessage } = useIntl();

  const schedulerStatus = useQueueSchedulerStore(selectQueueSchedulerStatus);
  const progress = useQueueSchedulerStore(selectSchedulerProgress);
  const config = useQueueSchedulerStore(selectSchedulerConfig);
  const sessionPool = useQueueSchedulerStore(selectSessionPool);
  const concurrency = useQueueSchedulerStore(selectCurrentConcurrency);
  const error = useQueueSchedulerStore(selectSchedulerError);
  const startQueue = useQueueSchedulerStore((s) => s.startQueue);
  const pauseQueue = useQueueSchedulerStore((s) => s.pauseQueue);
  const stopQueue = useQueueSchedulerStore((s) => s.stopQueue);
  const updateConfig = useQueueSchedulerStore((s) => s.updateConfig);

  const isIdle = schedulerStatus === 'idle';
  const isRunning = schedulerStatus === 'running';
  const isPaused = schedulerStatus === 'paused';
  const isStopping = schedulerStatus === 'stopping';
  const isTerminal = schedulerStatus === 'completed' || schedulerStatus === 'failed';

  const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false);

  const handleConcurrencyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1 && value <= 10) {
        updateConfig({ maxConcurrentSessions: value });
      }
    },
    [updateConfig]
  );

  const sessionEntries = Object.entries(sessionPool ?? {});

  return (
    <div className="flex flex-col h-full">
      {/* Status + Controls */}
      <div className="px-3 py-3 border-b border-border space-y-3 shrink-0">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium border',
              SCHEDULER_STATUS_CLASS[schedulerStatus]
            )}
          >
            {formatMessage({
              id: `terminalDashboard.queuePanel.scheduler.status.${schedulerStatus}`,
              defaultMessage: schedulerStatus,
            })}
          </span>
          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
            {concurrency}/{config?.maxConcurrentSessions ?? 2}
          </span>
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-2">
          {(isIdle || isTerminal) && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 flex-1"
              onClick={() => startQueue()}
            >
              <Play className="w-3.5 h-3.5" />
              {formatMessage({ id: 'terminalDashboard.queuePanel.scheduler.start', defaultMessage: 'Start' })}
            </Button>
          )}
          {isPaused && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 flex-1"
              onClick={() => startQueue()}
            >
              <Play className="w-3.5 h-3.5" />
              {formatMessage({ id: 'terminalDashboard.queuePanel.scheduler.start', defaultMessage: 'Resume' })}
            </Button>
          )}
          {isRunning && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 flex-1"
              onClick={pauseQueue}
            >
              <Pause className="w-3.5 h-3.5" />
              {formatMessage({ id: 'terminalDashboard.queuePanel.scheduler.pause', defaultMessage: 'Pause' })}
            </Button>
          )}
          {(isRunning || isPaused) && (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs gap-1.5"
              disabled={isStopping}
              onClick={() => setIsStopConfirmOpen(true)}
            >
              {isStopping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
              {formatMessage({ id: 'terminalDashboard.queuePanel.scheduler.stop', defaultMessage: 'Stop' })}
            </Button>
          )}
        </div>

        {/* Progress bar (visible when not idle) */}
        {!isIdle && (
          <div className="flex items-center gap-2">
            <Progress
              value={progress}
              className="h-1.5 flex-1"
              indicatorClassName={cn(
                schedulerStatus === 'failed' && 'bg-destructive',
                schedulerStatus === 'completed' && 'bg-green-500',
                schedulerStatus === 'paused' && 'bg-amber-500',
                (schedulerStatus === 'running' || schedulerStatus === 'stopping') && 'bg-primary',
              )}
            />
            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
              {formatMessage(
                { id: 'terminalDashboard.queuePanel.scheduler.progress', defaultMessage: '{percent}%' },
                { percent: progress }
              )}
            </span>
          </div>
        )}
      </div>

      {/* Concurrency Config */}
      <div className="px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {formatMessage({ id: 'terminalDashboard.queuePanel.scheduler.concurrency', defaultMessage: 'Concurrency' })}
          </span>
          <input
            type="number"
            min={1}
            max={10}
            value={config?.maxConcurrentSessions ?? 2}
            onChange={handleConcurrencyChange}
            className="w-14 h-6 text-xs text-center rounded border border-border bg-background px-1"
          />
        </div>
      </div>

      {/* Session Pool */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-3 py-2">
          <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {formatMessage({ id: 'terminalDashboard.schedulerPanel.sessionPool', defaultMessage: 'Session Pool' })}
          </h4>
          {sessionEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 py-2">
              {formatMessage({ id: 'terminalDashboard.schedulerPanel.noSessions', defaultMessage: 'No active sessions' })}
            </p>
          ) : (
            <div className="space-y-1">
              {sessionEntries.map(([resumeKey, binding]) => (
                <div
                  key={resumeKey}
                  className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/30 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-foreground truncate block">{binding.sessionKey}</span>
                    <span className="text-[10px] text-muted-foreground truncate block">{resumeKey}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2 tabular-nums">
                    {new Date(binding.lastUsed).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 border-t border-destructive/30 bg-destructive/5 shrink-0">
          <p className="text-xs text-destructive break-words">{error}</p>
        </div>
      )}

      {/* Stop confirmation dialog */}
      <AlertDialog open={isStopConfirmOpen} onOpenChange={setIsStopConfirmOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              {formatMessage({ id: 'terminalDashboard.queuePanel.scheduler.stopConfirmTitle', defaultMessage: 'Stop Queue?' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {formatMessage({ id: 'terminalDashboard.queuePanel.scheduler.stopConfirmMessage', defaultMessage: 'Executing tasks will finish, but no new tasks will be started. Pending items will remain in the queue.' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">
              {formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { stopQueue(); setIsStopConfirmOpen(false); }}
            >
              {formatMessage({ id: 'terminalDashboard.queuePanel.scheduler.stop', defaultMessage: 'Stop' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
