// ========================================
// TerminalInstance Component
// ========================================
// xterm.js terminal wrapper for the Terminal Dashboard.
// Reuses exact integration pattern from TerminalMainArea:
// XTerm instance in ref, FitAddon, ResizeObserver, batched PTY input (30ms),
// output chunk streaming from cliSessionStore.

import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { useCliSessionStore } from '@/stores/cliSessionStore';
import { useSessionManagerStore } from '@/stores/sessionManagerStore';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import {
  fetchCliSessionBuffer,
  sendCliSessionText,
  resizeCliSession,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { detectCcArtifacts, type CcArtifact } from '@/lib/ccw-artifacts';
import { ArtifactTag } from './ArtifactTag';

// ========== Types ==========

interface TerminalInstanceProps {
  /** Session key to render terminal for */
  sessionId: string;
  /** Additional CSS classes */
  className?: string;
  /** Optional callback to reveal a detected artifact path (e.g. open file browser) */
  onRevealPath?: (path: string) => void;
}

// ========== Component ==========

const ARTIFACT_DEBOUNCE_MS = 250;
const MAX_ARTIFACT_TAGS = 12;

function isAbsolutePath(p: string): boolean {
  if (!p) return false;
  if (p.startsWith('/') || p.startsWith('\\')) return true;
  if (/^[A-Za-z]:[\\/]/.test(p)) return true;
  if (p.startsWith('~')) return true;
  return false;
}

function joinPath(base: string, relative: string): string {
  const sep = base.includes('\\') ? '\\' : '/';
  const b = base.replace(/[\\/]+$/, '');
  const r = relative.replace(/^[\\/]+/, '');
  return `${b}${sep}${r}`;
}

function resolveArtifactPath(path: string, projectPath: string | null): string {
  if (!path) return path;
  if (isAbsolutePath(path)) return path;
  if (!projectPath) return path;
  return joinPath(projectPath, path);
}

function mergeArtifacts(prev: CcArtifact[], next: CcArtifact[]): CcArtifact[] {
  if (next.length === 0) return prev;
  const map = new Map<string, CcArtifact>();
  for (const a of prev) map.set(`${a.type}:${a.path}`, a);
  let changed = false;
  for (const a of next) {
    const key = `${a.type}:${a.path}`;
    if (map.has(key)) continue;
    map.set(key, a);
    changed = true;
  }
  if (!changed) return prev;
  const merged = Array.from(map.values());
  return merged.length > MAX_ARTIFACT_TAGS ? merged.slice(merged.length - MAX_ARTIFACT_TAGS) : merged;
}

export function TerminalInstance({ sessionId, className, onRevealPath }: TerminalInstanceProps) {
  const projectPath = useWorkflowStore(selectProjectPath);

  // cliSessionStore selectors
  const outputChunks = useCliSessionStore((s) => s.outputChunks);
  const setBuffer = useCliSessionStore((s) => s.setBuffer);
  const clearOutput = useCliSessionStore((s) => s.clearOutput);

  const [artifacts, setArtifacts] = useState<CcArtifact[]>([]);

  // ========== xterm Refs ==========

  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastChunkIndexRef = useRef<number>(0);

  // Debounced artifact detection
  const pendingArtifactTextRef = useRef<string>('');
  const artifactTimerRef = useRef<number | null>(null);

  // PTY input batching (30ms, matching TerminalMainArea)
  const pendingInputRef = useRef<string>('');
  const flushTimerRef = useRef<number | null>(null);

  // Track sessionId in a ref so xterm onData callback always has latest value
  const sessionIdRef = useRef<string>(sessionId);
  sessionIdRef.current = sessionId;

  const projectPathRef = useRef<string | null>(projectPath);
  projectPathRef.current = projectPath;

  const handleArtifactClick = useCallback((path: string) => {
    const resolved = resolveArtifactPath(path, projectPathRef.current);
    navigator.clipboard.writeText(resolved).catch((err) => {
      console.error('[TerminalInstance] copy artifact path failed:', err);
    });
    onRevealPath?.(resolved);
  }, [onRevealPath]);

  const scheduleArtifactParse = useCallback((text: string) => {
    if (!text) return;
    pendingArtifactTextRef.current += text;
    if (artifactTimerRef.current !== null) return;
    artifactTimerRef.current = window.setTimeout(() => {
      artifactTimerRef.current = null;
      const pending = pendingArtifactTextRef.current;
      pendingArtifactTextRef.current = '';
      const detected = detectCcArtifacts(pending);
      if (detected.length === 0) return;
      setArtifacts((prev) => mergeArtifacts(prev, detected));
    }, ARTIFACT_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (artifactTimerRef.current !== null) {
        window.clearTimeout(artifactTimerRef.current);
        artifactTimerRef.current = null;
      }
    };
  }, []);

  // ========== PTY Input Batching ==========

  const flushInput = useCallback(async () => {
    const key = sessionIdRef.current;
    if (!key) return;
    const pending = pendingInputRef.current;
    pendingInputRef.current = '';
    if (!pending) return;
    try {
      await sendCliSessionText(
        key,
        { text: pending, appendNewline: false },
        projectPathRef.current || undefined
      );
    } catch {
      // Ignore transient failures
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = window.setTimeout(async () => {
      flushTimerRef.current = null;
      await flushInput();
    }, 30);
  }, [flushInput]);

  // ========== xterm Lifecycle ==========

  // Initialize xterm instance (once per mount)
  useEffect(() => {
    if (!terminalHostRef.current) return;
    if (xtermRef.current) return;

    const term = new XTerm({
      convertEol: true,
      cursorBlink: true,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      scrollback: 5000,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalHostRef.current);
    fitAddon.fit();

    // Forward keystrokes to backend (batched 30ms)
    term.onData((data) => {
      if (!sessionIdRef.current) return;
      pendingInputRef.current += data;
      scheduleFlush();
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => {
      // Flush any pending input before cleanup
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      try {
        term.dispose();
      } finally {
        xtermRef.current = null;
        fitAddonRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach to session: clear terminal and load buffer
  useEffect(() => {
    const term = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;

    lastChunkIndexRef.current = 0;
    term.reset();
    term.clear();

    // Reset artifact detection state per session
    setArtifacts([]);
    pendingArtifactTextRef.current = '';
    if (artifactTimerRef.current !== null) {
      window.clearTimeout(artifactTimerRef.current);
      artifactTimerRef.current = null;
    }

    if (!sessionId) return;
    clearOutput(sessionId);

    fetchCliSessionBuffer(sessionId, projectPath || undefined)
      .then(({ buffer }) => {
        setBuffer(sessionId, buffer || '');
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        fitAddon.fit();
      });
  }, [sessionId, projectPath, setBuffer, clearOutput]);

  // Stream new output chunks into xterm and forward to monitor worker
  useEffect(() => {
    const term = xtermRef.current;
    if (!term || !sessionId) return;

    const chunks = outputChunks[sessionId] ?? [];
    const start = lastChunkIndexRef.current;
    if (start >= chunks.length) return;

    const { feedMonitor } = useSessionManagerStore.getState();
    const newTextParts: string[] = [];
    for (let i = start; i < chunks.length; i++) {
      term.write(chunks[i].data);
      feedMonitor(sessionId, chunks[i].data);
      newTextParts.push(chunks[i].data);
    }
    lastChunkIndexRef.current = chunks.length;

    if (newTextParts.length > 0) {
      scheduleArtifactParse(newTextParts.join(''));
    }
  }, [outputChunks, sessionId, scheduleArtifactParse]);

  // ResizeObserver -> fit + resize backend
  useEffect(() => {
    const host = terminalHostRef.current;
    const term = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    if (!host || !term || !fitAddon) return;

    const resize = () => {
      fitAddon.fit();
      if (sessionIdRef.current) {
        void (async () => {
          try {
            await resizeCliSession(
              sessionIdRef.current,
              { cols: term.cols, rows: term.rows },
              projectPathRef.current || undefined
            );
          } catch {
            // ignore
          }
        })();
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    return () => ro.disconnect();
  }, [sessionId, projectPath]);

  // ========== Render ==========

  return (
    <div className={cn('relative h-full w-full', className)}>
      {artifacts.length > 0 && (
        <div className="absolute top-2 left-2 right-2 z-10 flex flex-wrap gap-1 pointer-events-none">
          {artifacts.map((a) => (
            <ArtifactTag
              key={`${a.type}:${a.path}`}
              type={a.type}
              path={a.path}
              onClick={handleArtifactClick}
              className="pointer-events-auto"
            />
          ))}
        </div>
      )}
      <div ref={terminalHostRef} className="h-full w-full bg-black/90" />
    </div>
  );
}
