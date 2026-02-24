// ========================================
// BottomInspector Component
// ========================================
// Association chain visualization (Issue -> Queue -> Session).
// Exports InspectorContent (pure content) for embedding in BottomPanel,
// and BottomInspector (legacy standalone collapsible wrapper).

import { useState, useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
  ListChecks,
  Terminal,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useIssueQueueIntegrationStore,
  selectAssociationChain,
} from '@/stores/issueQueueIntegrationStore';
import { useQueueExecutionStore } from '@/stores/queueExecutionStore';
import { useCliSessionStore } from '@/stores/cliSessionStore';
import { useAssociationHighlight } from './AssociationHighlight';

// ========== Chain Node ==========

function ChainNode({
  icon: Icon,
  label,
  entityId,
  status,
  timestamp,
  isLast = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  entityId: string | null;
  status?: string;
  timestamp?: string;
  isLast?: boolean;
}) {
  if (!entityId) {
    return (
      <div className="flex items-center gap-2 opacity-40">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground italic">--</span>
        {!isLast && <ArrowRight className="w-3 h-3 text-muted-foreground mx-1" />}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono font-semibold text-foreground px-1.5 py-0.5 rounded bg-muted">
        {entityId}
      </span>
      {status && (
        <span className="text-[10px] text-muted-foreground px-1 py-0.5 rounded border border-border">
          {status}
        </span>
      )}
      {timestamp && (
        <span className="text-[10px] text-muted-foreground">
          {formatTimestamp(timestamp)}
        </span>
      )}
      {!isLast && <ArrowRight className="w-3 h-3 text-muted-foreground mx-1" />}
    </div>
  );
}

/** Format ISO timestamp to short readable form */
function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

// ========== InspectorContent (Pure content, no collapsible wrapper) ==========

export function InspectorContent() {
  const { formatMessage } = useIntl();
  const associationChain = useIssueQueueIntegrationStore(selectAssociationChain);
  const { chain: highlightedChain } = useAssociationHighlight();

  const activeChain = highlightedChain ?? associationChain;

  const chainDetails = useMemo(() => {
    if (!activeChain) return null;

    const executions = Object.values(useQueueExecutionStore.getState().executions);
    const sessions = useCliSessionStore.getState().sessions;

    let queueStatus: string | undefined;
    let executionTimestamp: string | undefined;
    if (activeChain.queueItemId) {
      const exec = executions.find((e) => e.queueItemId === activeChain.queueItemId);
      if (exec) {
        queueStatus = exec.status;
        executionTimestamp = exec.startedAt;
      }
    }

    let sessionStatus: string | undefined;
    let sessionTimestamp: string | undefined;
    if (activeChain.sessionId) {
      const session = sessions[activeChain.sessionId];
      if (session) {
        sessionStatus = 'active';
        sessionTimestamp = session.createdAt;
      }
    }

    return { queueStatus, executionTimestamp, sessionStatus, sessionTimestamp };
  }, [activeChain]);

  const hasChain = activeChain !== null;

  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      {hasChain ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {formatMessage({ id: 'terminalDashboard.inspector.associationChain' })}
          </p>
          <div className="flex items-center gap-1 flex-wrap">
            <ChainNode
              icon={AlertCircle}
              label="Issue"
              entityId={activeChain.issueId}
            />
            <ChainNode
              icon={ListChecks}
              label="Queue"
              entityId={activeChain.queueItemId}
              status={chainDetails?.queueStatus}
              timestamp={chainDetails?.executionTimestamp}
            />
            <ChainNode
              icon={Terminal}
              label="Session"
              entityId={activeChain.sessionId}
              status={chainDetails?.sessionStatus}
              timestamp={chainDetails?.sessionTimestamp}
              isLast
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {formatMessage({ id: 'terminalDashboard.inspector.noSelection' })}
        </p>
      )}
    </div>
  );
}

// ========== Legacy Standalone Component ==========

export function BottomInspector() {
  const { formatMessage } = useIntl();
  const [isOpen, setIsOpen] = useState(false);

  const associationChain = useIssueQueueIntegrationStore(selectAssociationChain);
  const { chain: highlightedChain } = useAssociationHighlight();

  // Use highlighted chain from context, fall back to store association chain
  const activeChain = highlightedChain ?? associationChain;

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Resolve additional details from stores
  const chainDetails = useMemo(() => {
    if (!activeChain) return null;

    const executions = Object.values(useQueueExecutionStore.getState().executions);
    const sessions = useCliSessionStore.getState().sessions;

    // Find matching execution for queue status
    let queueStatus: string | undefined;
    let executionTimestamp: string | undefined;
    if (activeChain.queueItemId) {
      const exec = executions.find((e) => e.queueItemId === activeChain.queueItemId);
      if (exec) {
        queueStatus = exec.status;
        executionTimestamp = exec.startedAt;
      }
    }

    // Find session metadata
    let sessionStatus: string | undefined;
    let sessionTimestamp: string | undefined;
    if (activeChain.sessionId) {
      const session = sessions[activeChain.sessionId];
      if (session) {
        sessionStatus = 'active';
        sessionTimestamp = session.createdAt;
      }
    }

    return {
      queueStatus,
      executionTimestamp,
      sessionStatus,
      sessionTimestamp,
    };
  }, [activeChain]);

  const hasChain = activeChain !== null;

  return (
    <div className={cn('border-t border-border bg-muted/30 shrink-0 transition-all duration-200')}>
      {/* Toggle button */}
      <button
        onClick={toggle}
        className="flex items-center gap-2 w-full px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Info className="w-4 h-4" />
        <span className="font-medium">
          {formatMessage({ id: 'terminalDashboard.inspector.title' })}
        </span>
        {hasChain && (
          <span className="ml-1 w-2 h-2 rounded-full bg-primary shrink-0" />
        )}
        {isOpen ? (
          <ChevronDown className="w-4 h-4 ml-auto" />
        ) : (
          <ChevronUp className="w-4 h-4 ml-auto" />
        )}
      </button>

      {/* Collapsible content */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="px-4 pb-3">
          {hasChain ? (
            <div className="space-y-2">
              {/* Chain label */}
              <p className="text-xs font-medium text-muted-foreground">
                {formatMessage({ id: 'terminalDashboard.inspector.associationChain' })}
              </p>
              {/* Chain visualization: Issue -> Queue -> Session */}
              <div className="flex items-center gap-1 flex-wrap">
                <ChainNode
                  icon={AlertCircle}
                  label="Issue"
                  entityId={activeChain.issueId}
                />
                <ChainNode
                  icon={ListChecks}
                  label="Queue"
                  entityId={activeChain.queueItemId}
                  status={chainDetails?.queueStatus}
                  timestamp={chainDetails?.executionTimestamp}
                />
                <ChainNode
                  icon={Terminal}
                  label="Session"
                  entityId={activeChain.sessionId}
                  status={chainDetails?.sessionStatus}
                  timestamp={chainDetails?.sessionTimestamp}
                  isLast
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'terminalDashboard.inspector.noSelection' })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
