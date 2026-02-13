// ========================================
// CLI Session Share Page
// ========================================
// Read-only viewer for a PTY-backed CLI session using SSE + shareToken.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useSearchParams } from 'react-router-dom';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Copy, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

function buildStreamUrl(sessionKey: string, shareToken: string): string {
  const apiPath = `/api/cli-sessions/${encodeURIComponent(sessionKey)}/stream`;
  const params = new URLSearchParams({
    shareToken,
    includeBuffer: '1',
  });
  return `${apiPath}?${params.toString()}`;
}

export function CliSessionSharePage() {
  const { formatMessage } = useIntl();
  const [searchParams] = useSearchParams();

  const sessionKey = searchParams.get('sessionKey') ?? '';
  const shareToken = searchParams.get('shareToken') ?? '';

  const shareUrl = useMemo(() => (typeof window !== 'undefined' ? window.location.href : ''), []);

  const [connection, setConnection] = useState<ConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);

  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Init xterm
  useEffect(() => {
    if (!terminalHostRef.current) return;
    if (xtermRef.current) return;

    const term = new XTerm({
      convertEol: true,
      cursorBlink: false,
      disableStdin: true,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      scrollback: 10_000,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalHostRef.current);
    fitAddon.fit();

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
  }, []);

  // Resize observer -> fit
  useEffect(() => {
    const host = terminalHostRef.current;
    const fitAddon = fitAddonRef.current;
    if (!host || !fitAddon) return;

    const ro = new ResizeObserver(() => fitAddon.fit());
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  // Connect SSE
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;

    if (!sessionKey || !shareToken) {
      setConnection('error');
      setError(formatMessage({ id: 'issues.terminal.share.missingParams' }));
      return;
    }

    setError(null);
    setConnection('connecting');

    const streamUrl = buildStreamUrl(sessionKey, shareToken);
    const es = new EventSource(streamUrl);

    let hasConnected = false;

    const onBuffer = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { buffer?: string };
        term.reset();
        term.clear();
        term.write(payload.buffer || '');
        hasConnected = true;
        setConnection('connected');
      } catch {
        // ignore parse errors
      }
    };

    const onOutput = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { data?: string };
        if (typeof payload.data === 'string') {
          term.write(payload.data);
        }
        if (!hasConnected) {
          hasConnected = true;
          setConnection('connected');
        }
      } catch {
        // ignore parse errors
      }
    };

    const onError = () => {
      setConnection(hasConnected ? 'reconnecting' : 'connecting');
    };

    es.addEventListener('buffer', onBuffer as any);
    es.addEventListener('output', onOutput as any);
    es.onerror = onError;

    return () => {
      try {
        es.close();
      } catch {
        // ignore
      }
    };
  }, [formatMessage, sessionKey, shareToken]);

  const connectionBadge = useMemo(() => {
    switch (connection) {
      case 'connected':
        return <Badge variant="success">{formatMessage({ id: 'issues.terminal.share.connected' })}</Badge>;
      case 'reconnecting':
      case 'connecting':
        return <Badge variant="secondary">{formatMessage({ id: 'issues.terminal.share.connecting' })}</Badge>;
      case 'error':
        return <Badge variant="destructive">{formatMessage({ id: 'issues.terminal.share.error' })}</Badge>;
      default:
        return <Badge variant="secondary">—</Badge>;
    }
  }, [connection, formatMessage]);

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold text-foreground truncate">
                {formatMessage({ id: 'issues.terminal.share.pageTitle' })}
              </h1>
              {connectionBadge}
            </div>
            <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
              {sessionKey || '—'}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={handleCopyLink} disabled={!shareUrl}>
              <Copy className="w-4 h-4 mr-2" />
              {formatMessage({ id: 'common.actions.copy' })}
            </Button>
          </div>
        </div>

        {error && (
          <Card className="p-4 border-destructive/50 bg-destructive/5">
            <div className="text-sm text-destructive">{error}</div>
          </Card>
        )}

        <Card className="p-3 space-y-2">
          <div className="text-xs text-muted-foreground">{formatMessage({ id: 'issues.terminal.share.linkLabel' })}</div>
          <Input value={shareUrl} readOnly />
        </Card>

        <div className={cn('rounded-md border border-border bg-black/90 overflow-hidden')}>
          <div ref={terminalHostRef} className="h-[70vh] w-full" />
        </div>
      </div>
    </div>
  );
}

export default CliSessionSharePage;
