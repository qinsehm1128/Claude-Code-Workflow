// ========================================
// TerminalNavBar Component
// ========================================
// Left-side icon navigation bar (w-16) inside TerminalPanel.
// Shows fixed queue entry icon + dynamic terminal icons with status badges.

import { useIntl } from 'react-intl';
import { ClipboardList, Terminal, Loader2, CheckCircle, XCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTerminalPanelStore } from '@/stores/terminalPanelStore';
import { useCliSessionStore, type CliSessionMeta, type CliSessionOutputChunk } from '@/stores/cliSessionStore';

// ========== Status Badge Mapping ==========

type SessionStatus = 'running' | 'completed' | 'failed' | 'idle';

/** Activity detection threshold in milliseconds */
const ACTIVITY_THRESHOLD_MS = 10_000;

function getSessionStatus(
  session: CliSessionMeta | undefined,
  chunks: CliSessionOutputChunk[] | undefined,
): SessionStatus {
  if (!session) return 'idle';
  if (!chunks || chunks.length === 0) return 'idle';
  const lastChunk = chunks[chunks.length - 1];
  if (Date.now() - lastChunk.timestamp < ACTIVITY_THRESHOLD_MS) return 'running';
  return 'idle';
}

const statusStyles: Record<SessionStatus, string> = {
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  idle: 'bg-gray-500',
};

const StatusIcon: Record<SessionStatus, React.ComponentType<{ className?: string }>> = {
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  idle: Circle,
};

export function TerminalNavBar() {
  const panelView = useTerminalPanelStore((s) => s.panelView);
  const activeTerminalId = useTerminalPanelStore((s) => s.activeTerminalId);
  const terminalOrder = useTerminalPanelStore((s) => s.terminalOrder);
  const setPanelView = useTerminalPanelStore((s) => s.setPanelView);
  const setActiveTerminal = useTerminalPanelStore((s) => s.setActiveTerminal);

  const sessions = useCliSessionStore((s) => s.sessions);
  const outputChunks = useCliSessionStore((s) => s.outputChunks);
  const { formatMessage } = useIntl();

  const handleQueueClick = () => {
    setPanelView('queue');
  };

  const handleTerminalClick = (sessionKey: string) => {
    setActiveTerminal(sessionKey);
    setPanelView('terminal');
  };

  return (
    <div className="w-16 flex-shrink-0 border-r border-border bg-card flex flex-col items-center py-2">
      {/* Queue Entry - Fixed at top */}
      <button
        className={cn(
          'w-10 h-10 rounded-md flex items-center justify-center transition-colors hover:bg-accent',
          panelView === 'queue' && 'bg-accent'
        )}
        onClick={handleQueueClick}
        title={formatMessage({ id: 'home.terminalPanel.executionQueue' })}
      >
        <ClipboardList className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* Separator */}
      <div className="w-8 border-t border-border my-2" />

      {/* Dynamic Terminal Icons */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center gap-1 w-full px-1">
        {terminalOrder.map((sessionKey) => {
          const session = sessions[sessionKey];
          const status = getSessionStatus(session, outputChunks[sessionKey]);
          const StatusIconComp = StatusIcon[status];
          const isActive = activeTerminalId === sessionKey && panelView === 'terminal';
          const label = session
            ? `${session.tool || 'cli'} - ${session.sessionKey}`
            : sessionKey;

          return (
            <button
              key={sessionKey}
              className={cn(
                'relative w-10 h-10 rounded-md flex items-center justify-center transition-colors hover:bg-accent',
                isActive && 'bg-accent'
              )}
              onClick={() => handleTerminalClick(sessionKey)}
              title={label}
            >
              <Terminal className="h-5 w-5 text-muted-foreground" />

              {/* Status Badge - bottom-right overlay */}
              <span
                className={cn(
                  'absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center',
                  statusStyles[status]
                )}
              >
                <StatusIconComp
                  className={cn(
                    'h-2 w-2 text-white',
                    status === 'running' && 'animate-spin'
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
