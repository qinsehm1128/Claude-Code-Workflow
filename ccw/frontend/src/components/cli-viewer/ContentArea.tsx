// ========================================
// ContentArea Component
// ========================================
// Displays CLI output for the active tab in a pane

import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Terminal, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useViewerStore,
  selectActiveTab,
  type PaneId,
} from '@/stores/viewerStore';
import { useCliStreamStore, type CliExecutionState, type CliOutputLine } from '@/stores/cliStreamStore';
import { MonitorBody } from '@/components/shared/CliStreamMonitor/MonitorBody';
import { MessageRenderer } from '@/components/shared/CliStreamMonitor/MessageRenderer';
import { useActiveCliExecutions } from '@/hooks/useActiveCliExecutions';

// ========== Types ==========

export interface ContentAreaProps {
  paneId: PaneId;
  className?: string;
}

// ========== Helper Components ==========

/**
 * Empty state when no tab is active
 */
function EmptyTabState() {
  const { formatMessage } = useIntl();

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
      <Terminal className="h-12 w-12 opacity-30" />
      <div className="text-center">
        <p className="text-sm font-medium">
          {formatMessage({ id: 'cliViewer.noActiveTab', defaultMessage: 'No active tab' })}
        </p>
        <p className="text-xs mt-1">
          {formatMessage({
            id: 'cliViewer.selectOrCreate',
            defaultMessage: 'Select a tab or start a new CLI execution',
          })}
        </p>
      </div>
    </div>
  );
}

/**
 * Execution not found state
 */
function ExecutionNotFoundState({ executionId }: { executionId: string }) {
  const { formatMessage } = useIntl();

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
      <Terminal className="h-12 w-12 opacity-30" />
      <div className="text-center">
        <p className="text-sm font-medium">
          {formatMessage({ id: 'cliViewer.executionNotFound', defaultMessage: 'Execution not found' })}
        </p>
        <p className="text-xs mt-1 font-mono opacity-50">{executionId}</p>
      </div>
    </div>
  );
}

/**
 * FIX-002: Loading state while syncing executions from server
 * Shown after page refresh while execution data is being recovered
 */
function ExecutionLoadingState() {
  const { formatMessage } = useIntl();

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
      <Loader2 className="h-8 w-8 animate-spin opacity-50" />
      <div className="text-center">
        <p className="text-sm">
          {formatMessage({ id: 'cliViewer.syncingExecution', defaultMessage: 'Syncing execution data...' })}
        </p>
      </div>
    </div>
  );
}

/**
 * Single output line component with type-based styling
 */
function OutputLineItem({ line }: { line: CliOutputLine }) {
  // Type-based styling
  const typeStyles: Record<CliOutputLine['type'], string> = {
    stdout: 'text-foreground',
    stderr: 'text-rose-600 dark:text-rose-400 bg-rose-500/5',
    thought: 'text-blue-600 dark:text-blue-400 italic bg-blue-500/5',
    system: 'text-amber-600 dark:text-amber-400 bg-amber-500/5',
    metadata: 'text-muted-foreground text-xs',
    tool_call: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 font-mono',
  };

  return (
    <div
      className={cn(
        'px-3 py-1 text-sm',
        'border-l-2 border-transparent',
        typeStyles[line.type] || 'text-foreground',
        line.type === 'stderr' && 'border-l-rose-500',
        line.type === 'thought' && 'border-l-blue-500',
        line.type === 'system' && 'border-l-amber-500',
        line.type === 'tool_call' && 'border-l-emerald-500'
      )}
    >
      {line.type === 'thought' || line.type === 'tool_call' ? (
        <MessageRenderer content={line.content} format="markdown" />
      ) : (
        <pre className="whitespace-pre-wrap break-words font-mono text-xs">
          {line.content}
        </pre>
      )}
    </div>
  );
}

/**
 * CLI output display component
 */
function CliOutputDisplay({ execution, executionId }: { execution: CliExecutionState; executionId: string }) {
  const { formatMessage } = useIntl();

  if (!execution.output || execution.output.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
        <Terminal className="h-12 w-12 opacity-30" />
        <div className="text-center">
          <p className="text-sm">
            {execution.status === 'running'
              ? formatMessage({ id: 'cliViewer.waitingForOutput', defaultMessage: 'Waiting for output...' })
              : formatMessage({ id: 'cliViewer.noOutput', defaultMessage: 'No output' })}
          </p>
          {execution.status === 'running' && (
            <Loader2 className="h-4 w-4 animate-spin mt-2 mx-auto opacity-50" />
          )}
        </div>
      </div>
    );
  }

  return (
    <MonitorBody autoScroll={execution.status === 'running'} showScrollButton>
      <div className="py-2">
        {execution.output.map((line, index) => (
          <OutputLineItem
            key={`${executionId}-line-${index}`}
            line={line}
          />
        ))}
      </div>
    </MonitorBody>
  );
}

// ========== Main Component ==========

/**
 * ContentArea - Displays CLI output for active tab
 *
 * Features:
 * - Integration with CliStreamStore for execution data
 * - Auto-scroll during active execution
 * - Empty state handling
 * - Message rendering with proper formatting
 */
export function ContentArea({ paneId, className }: ContentAreaProps) {
  // Get active tab using the selector
  const activeTab = useViewerStore((state) => selectActiveTab(state, paneId));

  // Get execution data from cliStreamStore
  const executions = useCliStreamStore((state) => state.executions);

  // FIX-002: Get loading state from useActiveCliExecutions
  // This helps distinguish between "not found" and "still loading"
  const { isLoading: isSyncing } = useActiveCliExecutions(true);

  const execution = useMemo(() => {
    if (!activeTab?.executionId) return null;
    return executions[activeTab.executionId] || null;
  }, [activeTab?.executionId, executions]);

  // Determine what to render
  const content = useMemo(() => {
    // No active tab
    if (!activeTab) {
      return <EmptyTabState />;
    }

    // FIX-002: Show loading state while syncing if execution not yet available
    if (!execution && isSyncing) {
      return <ExecutionLoadingState />;
    }

    // No execution data found (after sync completed)
    if (!execution) {
      return <ExecutionNotFoundState executionId={activeTab.executionId} />;
    }

    // Show CLI output
    return <CliOutputDisplay execution={execution} executionId={activeTab.executionId} />;
  }, [activeTab, execution, isSyncing]);

  return (
    <div
      className={cn(
        'flex-1 min-h-0 flex flex-col overflow-hidden',
        'bg-background',
        className
      )}
    >
      {content}
    </div>
  );
}

export default ContentArea;
