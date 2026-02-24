// ========================================
// TerminalMainArea Component
// ========================================
// Main content area inside TerminalPanel.
// Renders terminal output (xterm.js) or queue view based on panelView.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useIntl } from 'react-intl';
import {
  X,
  Terminal as TerminalIcon,
  Trash2,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Button } from '@/components/ui/Button';
import { useTerminalPanelStore } from '@/stores/terminalPanelStore';
import { useCliSessionStore, type CliSessionMeta } from '@/stores/cliSessionStore';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { QueuePanel } from '@/components/terminal-dashboard/QueuePanel';
import {
  fetchCliSessionBuffer,
  sendCliSessionText,
  resizeCliSession,
  closeCliSession,
} from '@/lib/api';

// ========== Types ==========

interface TerminalMainAreaProps {
  onClose: () => void;
}

// ========== Component ==========

export function TerminalMainArea({ onClose }: TerminalMainAreaProps) {
  const { formatMessage } = useIntl();
  const panelView = useTerminalPanelStore((s) => s.panelView);
  const activeTerminalId = useTerminalPanelStore((s) => s.activeTerminalId);
  const removeTerminal = useTerminalPanelStore((s) => s.removeTerminal);

  const sessions = useCliSessionStore((s) => s.sessions);
  const outputChunks = useCliSessionStore((s) => s.outputChunks);
  const setBuffer = useCliSessionStore((s) => s.setBuffer);
  const clearOutput = useCliSessionStore((s) => s.clearOutput);
  const removeSessionFromStore = useCliSessionStore((s) => s.removeSession);

  const projectPath = useWorkflowStore(selectProjectPath);

  const activeSession: CliSessionMeta | undefined = activeTerminalId
    ? sessions[activeTerminalId]
    : undefined;

  // ========== xterm State ==========

  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastChunkIndexRef = useRef<number>(0);

  // PTY input batching
  const pendingInputRef = useRef<string>('');
  const flushTimerRef = useRef<number | null>(null);

  // Toolbar state
  const [isClosing, setIsClosing] = useState(false);

  const flushInput = useCallback(async () => {
    const sessionKey = activeTerminalId;
    if (!sessionKey) return;
    const pending = pendingInputRef.current;
    pendingInputRef.current = '';
    if (!pending) return;
    try {
      await sendCliSessionText(sessionKey, { text: pending, appendNewline: false }, projectPath || undefined);
    } catch {
      // Ignore transient failures
    }
  }, [activeTerminalId, projectPath]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = window.setTimeout(async () => {
      flushTimerRef.current = null;
      await flushInput();
    }, 30);
  }, [flushInput]);

  // ========== xterm Lifecycle ==========

  // Init xterm instance
  useEffect(() => {
    if (!terminalHostRef.current) return;
    if (xtermRef.current) return;

    const term = new XTerm({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      scrollback: 5000,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalHostRef.current);
    fitAddon.fit();

    // Forward keystrokes to backend (batched)
    term.onData((data) => {
      if (!activeTerminalId) return;
      pendingInputRef.current += data;
      scheduleFlush();
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => {
      try {
        term.dispose();
      } finally {
        xtermRef.current = null;
        fitAddonRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach to selected session: clear terminal and load buffer
  useEffect(() => {
    const term = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;

    lastChunkIndexRef.current = 0;
    term.reset();
    term.clear();

    if (!activeTerminalId) return;
    clearOutput(activeTerminalId);

    fetchCliSessionBuffer(activeTerminalId, projectPath || undefined)
      .then(({ buffer }) => {
        setBuffer(activeTerminalId, buffer || '');
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        fitAddon.fit();
      });
  }, [activeTerminalId, projectPath, setBuffer, clearOutput]);

  // Stream new output chunks into xterm
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    if (!activeTerminalId) return;

    const chunks = outputChunks[activeTerminalId] ?? [];
    const start = lastChunkIndexRef.current;
    if (start >= chunks.length) return;

    for (let i = start; i < chunks.length; i++) {
      term.write(chunks[i].data);
    }
    lastChunkIndexRef.current = chunks.length;
  }, [outputChunks, activeTerminalId]);

  // Resize observer -> fit + resize backend
  useEffect(() => {
    const host = terminalHostRef.current;
    const term = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    if (!host || !term || !fitAddon) return;

    const resize = () => {
      fitAddon.fit();
      if (activeTerminalId) {
        void (async () => {
          try {
            await resizeCliSession(activeTerminalId, { cols: term.cols, rows: term.rows }, projectPath || undefined);
          } catch {
            // ignore
          }
        })();
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    return () => ro.disconnect();
  }, [activeTerminalId, projectPath]);

  // ========== CLI Session Actions ==========

  const handleCloseSession = useCallback(async () => {
    if (!activeTerminalId || isClosing) return;
    setIsClosing(true);
    try {
      await closeCliSession(activeTerminalId, projectPath || undefined);
      removeTerminal(activeTerminalId);
      removeSessionFromStore(activeTerminalId);
    } catch (err) {
      console.error('[TerminalMainArea] closeCliSession failed:', err);
    } finally {
      setIsClosing(false);
    }
  }, [activeTerminalId, isClosing, projectPath, removeTerminal, removeSessionFromStore]);

  const handleClearTerminal = useCallback(() => {
    const term = xtermRef.current;
    if (!term) return;
    term.clear();
  }, []);

  // ========== Render ==========

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2 min-w-0">
          <TerminalIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-semibold text-foreground truncate">
            {panelView === 'queue'
              ? formatMessage({ id: 'home.terminalPanel.executionQueue' })
              : activeSession
                ? `${activeSession.tool || 'cli'} - ${activeSession.sessionKey}`
                : formatMessage({ id: 'home.terminalPanel.title' })}
          </span>
          {activeSession?.workingDir && panelView === 'terminal' && (
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">
              {activeSession.workingDir}
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0 hover:bg-secondary">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Toolbar */}
      {panelView === 'terminal' && activeTerminalId && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-muted/30">
          <div className="flex-1" />

          {/* Terminal actions */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleClearTerminal}
            title="Clear terminal"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            disabled={isClosing}
            onClick={handleCloseSession}
            title="Close session"
          >
            {isClosing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </Button>
        </div>
      )}

      {/* Content */}
      {panelView === 'queue' ? (
        /* Queue View */
        <QueuePanel />
      ) : activeTerminalId ? (
        /* Terminal View */
        <div className="flex-1 min-h-0">
          <div
            ref={terminalHostRef}
            className="h-full w-full bg-black/90 rounded-none"
          />
        </div>
      ) : (
        /* Empty State */
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <TerminalIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">{formatMessage({ id: 'home.terminalPanel.noTerminalSelected' })}</p>
            <p className="text-xs mt-1">{formatMessage({ id: 'home.terminalPanel.selectTerminalHint' })}</p>
          </div>
        </div>
      )}
    </div>
  );
}
