// ========================================
// IssueTerminalTab
// ========================================
// Embedded xterm.js terminal for PTY-backed CLI sessions.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { Copy, Plus, RefreshCw, Share2, XCircle } from 'lucide-react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import {
  closeCliSession,
  createCliSession,
  createCliSessionShareToken,
  fetchCliSessionShares,
  revokeCliSessionShareToken,
  executeInCliSession,
  fetchCliSessionBuffer,
  fetchCliSessions,
  resizeCliSession,
  sendCliSessionText,
  type CliSession,
} from '@/lib/api';
import { useCliSessionStore } from '@/stores/cliSessionStore';

type ToolName = 'claude' | 'codex' | 'gemini';
type ResumeStrategy = 'nativeResume' | 'promptConcat';

export function IssueTerminalTab({ issueId }: { issueId: string }) {
  const { formatMessage } = useIntl();
  const projectPath = useWorkflowStore(selectProjectPath);

  const sessionsByKey = useCliSessionStore((s) => s.sessions);
  const outputChunks = useCliSessionStore((s) => s.outputChunks);
  const setSessions = useCliSessionStore((s) => s.setSessions);
  const upsertSession = useCliSessionStore((s) => s.upsertSession);
  const setBuffer = useCliSessionStore((s) => s.setBuffer);
  const clearOutput = useCliSessionStore((s) => s.clearOutput);

  const sessions = useMemo(() => Object.values(sessionsByKey).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [sessionsByKey]);

  const [selectedSessionKey, setSelectedSessionKey] = useState<string>('');
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tool, setTool] = useState<ToolName>('claude');
  const [mode, setMode] = useState<'analysis' | 'write'>('analysis');
  const [resumeKey, setResumeKey] = useState(issueId);
  const [resumeStrategy, setResumeStrategy] = useState<ResumeStrategy>('nativeResume');
  const [prompt, setPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareToken, setShareToken] = useState<string>('');
  const [shareExpiresAt, setShareExpiresAt] = useState<string>('');
  const [shareRecords, setShareRecords] = useState<Array<{ shareToken: string; expiresAt: string; mode: 'read' | 'write' }>>([]);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [isRevokingShare, setIsRevokingShare] = useState(false);

  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastChunkIndexRef = useRef<number>(0);

  const pendingInputRef = useRef<string>('');
  const flushTimerRef = useRef<number | null>(null);

  const flushInput = async () => {
    const sessionKey = selectedSessionKey;
    if (!sessionKey) return;
    const pending = pendingInputRef.current;
    pendingInputRef.current = '';
    if (!pending) return;
    try {
      await sendCliSessionText(sessionKey, { text: pending, appendNewline: false }, projectPath || undefined);
    } catch (e) {
      // Ignore transient failures (WS output still shows process state)
    }
  };

  const scheduleFlush = () => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = window.setTimeout(async () => {
      flushTimerRef.current = null;
      await flushInput();
    }, 30);
  };

  useEffect(() => {
    setIsLoadingSessions(true);
    setError(null);
    fetchCliSessions(projectPath || undefined)
      .then((r) => {
        setSessions(r.sessions as unknown as CliSession[]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoadingSessions(false));
  }, [projectPath, setSessions]);

  // Auto-select a session if none selected yet
  useEffect(() => {
    if (selectedSessionKey) return;
    if (sessions.length === 0) return;
    setSelectedSessionKey(sessions[sessions.length - 1]?.sessionKey ?? '');
  }, [sessions, selectedSessionKey]);

  const buildShareLink = (sessionKey: string, token: string): string => {
    const url = new URL(window.location.href);
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
    url.pathname = `${base}/cli-sessions/share`;
    url.search = `sessionKey=${encodeURIComponent(sessionKey)}&shareToken=${encodeURIComponent(token)}`;
    return url.toString();
  };

  const refreshShares = async (sessionKey: string) => {
    if (!sessionKey) {
      setShareRecords([]);
      return;
    }
    setIsLoadingShares(true);
    try {
      const r = await fetchCliSessionShares(sessionKey, projectPath || undefined);
      setShareRecords(r.shares || []);
    } catch {
      setShareRecords([]);
    } finally {
      setIsLoadingShares(false);
    }
  };

  // Refresh share tokens when session changes
  useEffect(() => {
    setShareUrl('');
    setShareToken('');
    setShareExpiresAt('');
    void refreshShares(selectedSessionKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionKey, projectPath]);

  // Init xterm
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
      if (!selectedSessionKey) return;
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

    if (!selectedSessionKey) return;
    clearOutput(selectedSessionKey);

    fetchCliSessionBuffer(selectedSessionKey, projectPath || undefined)
      .then(({ buffer }) => {
        setBuffer(selectedSessionKey, buffer || '');
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        fitAddon.fit();
      });
  }, [selectedSessionKey, projectPath, setBuffer, clearOutput]);

  // Stream new output chunks into xterm
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    if (!selectedSessionKey) return;

    const chunks = outputChunks[selectedSessionKey] ?? [];
    const start = lastChunkIndexRef.current;
    if (start >= chunks.length) return;

    for (let i = start; i < chunks.length; i++) {
      term.write(chunks[i].data);
    }
    lastChunkIndexRef.current = chunks.length;
  }, [outputChunks, selectedSessionKey]);

  // Resize observer -> fit + resize backend
  useEffect(() => {
    const host = terminalHostRef.current;
    const term = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    if (!host || !term || !fitAddon) return;

    const resize = () => {
      fitAddon.fit();
      if (selectedSessionKey) {
        void (async () => {
          try {
            await resizeCliSession(selectedSessionKey, { cols: term.cols, rows: term.rows }, projectPath || undefined);
          } catch {
            // ignore
          }
        })();
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    return () => ro.disconnect();
  }, [selectedSessionKey, projectPath]);

  const handleCreateSession = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const created = await createCliSession({
        workingDir: projectPath || undefined,
        preferredShell: 'bash',
        cols: xtermRef.current?.cols,
        rows: xtermRef.current?.rows,
        tool,
        model: undefined,
        resumeKey,
      }, projectPath || undefined);
      upsertSession(created.session as unknown as CliSession);
      setSelectedSessionKey(created.session.sessionKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCloseSession = async () => {
    if (!selectedSessionKey) return;
    setIsClosing(true);
    setError(null);
    try {
      await closeCliSession(selectedSessionKey, projectPath || undefined);
      setSelectedSessionKey('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsClosing(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedSessionKey) return;
    if (!prompt.trim()) return;
    setIsExecuting(true);
    setError(null);
    try {
      await executeInCliSession(selectedSessionKey, {
        tool,
        prompt: prompt.trim(),
        mode,
        resumeKey: resumeKey.trim() || undefined,
        resumeStrategy,
        category: 'user',
      }, projectPath || undefined);
      setPrompt('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRefreshSessions = async () => {
    setIsLoadingSessions(true);
    setError(null);
    try {
      const r = await fetchCliSessions(projectPath || undefined);
      setSessions(r.sessions as unknown as CliSession[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleCreateShareLink = async () => {
    if (!selectedSessionKey) return;
    setError(null);
    setShareUrl('');
    setShareToken('');
    setShareExpiresAt('');
    try {
      const r = await createCliSessionShareToken(selectedSessionKey, { mode: 'read' }, projectPath || undefined);
      setShareUrl(buildShareLink(selectedSessionKey, r.shareToken));
      setShareToken(r.shareToken);
      setShareExpiresAt(r.expiresAt);
      void refreshShares(selectedSessionKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRevokeShareLink = async (token: string) => {
    if (!selectedSessionKey || !token) return;
    setIsRevokingShare(true);
    setError(null);
    try {
      await revokeCliSessionShareToken(selectedSessionKey, { shareToken: token }, projectPath || undefined);
      if (token === shareToken) {
        setShareUrl('');
        setShareToken('');
        setShareExpiresAt('');
      }
      void refreshShares(selectedSessionKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRevokingShare(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="min-w-[240px] flex-1">
          <Select value={selectedSessionKey} onValueChange={setSelectedSessionKey}>
            <SelectTrigger>
              <SelectValue placeholder={formatMessage({ id: 'issues.terminal.session.select' })} />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((s) => (
                <SelectItem key={s.sessionKey} value={s.sessionKey}>
                  {(s.tool || 'cli') + ' · ' + s.sessionKey}
                </SelectItem>
              ))}
              {sessions.length === 0 && (
                <SelectItem value="__none__" disabled>
                  {formatMessage({ id: 'issues.terminal.session.none' })}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" onClick={handleRefreshSessions} disabled={isLoadingSessions}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {formatMessage({ id: 'issues.terminal.session.refresh' })}
        </Button>

        <Button onClick={handleCreateSession} disabled={isCreating}>
          <Plus className="w-4 h-4 mr-2" />
          {formatMessage({ id: 'issues.terminal.session.new' })}
        </Button>

        <Button
          variant="destructive"
          onClick={handleCloseSession}
          disabled={!selectedSessionKey || isClosing}
        >
          <XCircle className="w-4 h-4 mr-2" />
          {formatMessage({ id: 'issues.terminal.session.close' })}
        </Button>

        <Button variant="outline" onClick={handleCreateShareLink} disabled={!selectedSessionKey}>
          <Share2 className="w-4 h-4 mr-2" />
          {formatMessage({ id: 'issues.terminal.session.share' })}
        </Button>
      </div>

      {shareUrl && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input value={shareUrl} readOnly />
            <Button variant="outline" onClick={handleCopyShareLink}>
              <Copy className="w-4 h-4 mr-2" />
              {formatMessage({ id: 'common.actions.copy' })}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleRevokeShareLink(shareToken)}
              disabled={isRevokingShare || !shareToken}
            >
              {formatMessage({ id: 'issues.terminal.session.revokeShare' })}
            </Button>
          </div>
          {shareExpiresAt && (
            <div className="text-xs text-muted-foreground font-mono">
              {formatMessage({ id: 'issues.terminal.session.expiresAt' })}: {shareExpiresAt}
            </div>
          )}
        </div>
      )}

      {selectedSessionKey && shareRecords.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            {formatMessage({ id: 'issues.terminal.session.activeShares' })}
            {isLoadingShares ? '…' : ''}
          </div>
          <div className="space-y-1">
            {shareRecords.map((s) => (
              <div key={s.shareToken} className="flex items-center gap-2">
                <div className="text-xs font-mono truncate flex-1 min-w-0">
                  {s.shareToken.slice(0, 6)}…{s.shareToken.slice(-6)}
                </div>
                <div className="text-xs text-muted-foreground font-mono">{s.mode}</div>
                <div className="text-xs text-muted-foreground font-mono truncate max-w-[220px]">{s.expiresAt}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(buildShareLink(selectedSessionKey, s.shareToken));
                    } catch {
                      // ignore
                    }
                  }}
                >
                  {formatMessage({ id: 'common.actions.copy' })}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isRevokingShare}
                  onClick={() => handleRevokeShareLink(s.shareToken)}
                >
                  {formatMessage({ id: 'issues.terminal.session.revokeShare' })}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{formatMessage({ id: 'issues.terminal.exec.tool' })}</div>
          <Select value={tool} onValueChange={(v) => setTool(v as ToolName)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude">claude</SelectItem>
              <SelectItem value="codex">codex</SelectItem>
              <SelectItem value="gemini">gemini</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{formatMessage({ id: 'issues.terminal.exec.mode' })}</div>
          <Select value={mode} onValueChange={(v) => setMode(v as 'analysis' | 'write')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="analysis">analysis</SelectItem>
              <SelectItem value="write">write</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{formatMessage({ id: 'issues.terminal.exec.resumeKey' })}</div>
          <Input value={resumeKey} onChange={(e) => setResumeKey(e.target.value)} placeholder={issueId} />
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            {formatMessage({ id: 'issues.terminal.exec.resumeStrategy' })}
          </div>
          <Select value={resumeStrategy} onValueChange={(v) => setResumeStrategy(v as ResumeStrategy)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nativeResume">nativeResume</SelectItem>
              <SelectItem value="promptConcat">promptConcat</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">{formatMessage({ id: 'issues.terminal.exec.prompt.label' })}</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={formatMessage({ id: 'issues.terminal.exec.prompt.placeholder' })}
          className={cn(
            'w-full min-h-[90px] p-3 bg-background border border-input rounded-md text-sm resize-none',
            'focus:outline-none focus:ring-2 focus:ring-primary'
          )}
        />
        <div className="flex justify-end">
          <Button onClick={handleExecute} disabled={!selectedSessionKey || isExecuting || !prompt.trim()}>
            {formatMessage({ id: 'issues.terminal.exec.run' })}
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-md border border-border bg-black/90 overflow-hidden">
        <div ref={terminalHostRef} className="h-[420px] w-full" />
      </div>
    </div>
  );
}
