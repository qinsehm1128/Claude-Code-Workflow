// ========================================
// TerminalMainArea Component
// ========================================
// Main content area inside TerminalPanel.
// Renders terminal output (xterm.js) or queue view based on panelView.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { X, Terminal as TerminalIcon } from 'lucide-react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useTerminalPanelStore } from '@/stores/terminalPanelStore';
import { useCliSessionStore, type CliSessionMeta } from '@/stores/cliSessionStore';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import {
  fetchCliSessionBuffer,
  sendCliSessionText,
  resizeCliSession,
  executeInCliSession,
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

  const sessions = useCliSessionStore((s) => s.sessions);
  const outputChunks = useCliSessionStore((s) => s.outputChunks);
  const setBuffer = useCliSessionStore((s) => s.setBuffer);
  const clearOutput = useCliSessionStore((s) => s.clearOutput);

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

  // Command execution
  const [prompt, setPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

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

  // ========== Command Execution ==========

  const handleExecute = async () => {
    if (!activeTerminalId || !prompt.trim()) return;
    setIsExecuting(true);
    const sessionTool = (activeSession?.tool || 'claude') as 'claude' | 'codex' | 'gemini';
    try {
      await executeInCliSession(activeTerminalId, {
        tool: sessionTool,
        prompt: prompt.trim(),
        mode: 'analysis',
        category: 'user',
      }, projectPath || undefined);
      setPrompt('');
    } catch (err) {
      // Error shown in terminal output; log for DevTools debugging
      console.error('[TerminalMainArea] executeInCliSession failed:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleExecute();
    }
  };

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

      {/* Content */}
      {panelView === 'queue' ? (
        /* Queue View - Placeholder */
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <TerminalIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">{formatMessage({ id: 'home.terminalPanel.executionQueueDesc' })}</p>
            <p className="text-xs mt-1">{formatMessage({ id: 'home.terminalPanel.executionQueuePhase2' })}</p>
          </div>
        </div>
      ) : activeTerminalId ? (
        /* Terminal View */
        <div className="flex-1 flex flex-col min-h-0">
          {/* xterm container */}
          <div className="flex-1 min-h-0">
            <div
              ref={terminalHostRef}
              className="h-full w-full bg-black/90 rounded-none"
            />
          </div>

          {/* Command Input */}
          <div className="border-t border-border p-3 bg-card">
            <div className="space-y-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={formatMessage({ id: 'home.terminalPanel.commandPlaceholder' })}
                className={cn(
                  'w-full min-h-[60px] p-2 bg-background border border-input rounded-md text-sm resize-none',
                  'focus:outline-none focus:ring-2 focus:ring-primary'
                )}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleExecute}
                  disabled={!activeTerminalId || isExecuting || !prompt.trim()}
                >
                  {formatMessage({ id: 'home.terminalPanel.execute' })}
                </Button>
              </div>
            </div>
          </div>
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
