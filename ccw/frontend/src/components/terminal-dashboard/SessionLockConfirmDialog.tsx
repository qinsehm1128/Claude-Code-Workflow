// ========================================
// Session Lock Confirm Dialog
// ========================================
// Dialog shown when user tries to input in a locked session.
// Displays execution info and offers options to wait or unlock.

import { useIntl } from 'react-intl';
import { Lock, AlertTriangle } from 'lucide-react';
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
import { Progress } from '@/components/ui/Progress';

interface SessionLockConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  lockInfo: {
    reason: string;
    executionName?: string;
    currentStep?: string;
    progress?: number;
  };
}

export function SessionLockConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  lockInfo,
}: SessionLockConfirmDialogProps) {
  const { formatMessage } = useIntl();

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-500" />
            {formatMessage({ id: 'sessionLock.title', defaultMessage: '会话正在执行任务' })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {formatMessage({
              id: 'sessionLock.description',
              defaultMessage: '此会话当前正在执行工作流，手动输入可能会中断执行。'
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-4">
          {/* Execution info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {formatMessage({ id: 'sessionLock.workflow', defaultMessage: '工作流:' })}
              </span>
              <span className="font-medium">
                {lockInfo.executionName || lockInfo.reason}
              </span>
            </div>

            {lockInfo.currentStep && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatMessage({ id: 'sessionLock.currentStep', defaultMessage: '当前步骤:' })}
                </span>
                <span>{lockInfo.currentStep}</span>
              </div>
            )}

            {lockInfo.progress !== undefined && (
              <div className="space-y-1">
                <Progress value={lockInfo.progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">
                  {lockInfo.progress}% {formatMessage({ id: 'sessionLock.completed', defaultMessage: '完成' })}
                </p>
              </div>
            )}
          </div>

          {/* Warning alert */}
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-400">
                {formatMessage({ id: 'sessionLock.warning', defaultMessage: '注意' })}
              </p>
              <p className="text-muted-foreground">
                {formatMessage({
                  id: 'sessionLock.warningMessage',
                  defaultMessage: '继续输入将解锁会话，可能会影响正在执行的工作流。'
                })}
              </p>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onClose} className="w-full sm:w-auto">
            {formatMessage({ id: 'sessionLock.cancel', defaultMessage: '取消，等待完成' })}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {formatMessage({ id: 'sessionLock.confirm', defaultMessage: '解锁并继续输入' })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default SessionLockConfirmDialog;
