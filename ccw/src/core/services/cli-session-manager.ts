import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { randomBytes } from 'crypto';
import { spawnSync } from 'child_process';
import * as nodePty from 'node-pty';
import { EventEmitter } from 'events';
import { broadcastToClients } from '../websocket.js';
import {
  buildCliSessionExecuteCommand,
  type CliSessionShellKind,
  type CliSessionResumeStrategy
} from './cli-session-command-builder.js';
import { getCliSessionPolicy } from './cli-session-policy.js';
import { appendCliSessionAudit } from './cli-session-audit.js';

export interface CliSession {
  sessionKey: string;
  shellKind: CliSessionShellKind;
  workingDir: string;
  tool?: string;
  model?: string;
  resumeKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCliSessionOptions {
  workingDir: string;
  cols?: number;
  rows?: number;
  preferredShell?: 'bash' | 'pwsh';
  tool?: string;
  model?: string;
  resumeKey?: string;
}

export interface ExecuteInCliSessionOptions {
  tool: string;
  prompt: string;
  mode?: 'analysis' | 'write' | 'auto';
  model?: string;
  workingDir?: string;
  category?: 'user' | 'internal' | 'insight';
  resumeKey?: string;
  resumeStrategy?: CliSessionResumeStrategy;
}

export interface CliSessionOutputEvent {
  sessionKey: string;
  data: string;
  timestamp: string;
}

interface CliSessionInternal extends CliSession {
  pty: nodePty.IPty;
  buffer: string[];
  bufferBytes: number;
  lastActivityAt: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createSessionKey(): string {
  const suffix = randomBytes(4).toString('hex');
  return `cli-session-${Date.now()}-${suffix}`;
}

function normalizeWorkingDir(workingDir: string): string {
  return path.resolve(workingDir);
}

function findGitBashExe(): string | null {
  const candidates = [
    'C:\\\\Program Files\\\\Git\\\\bin\\\\bash.exe',
    'C:\\\\Program Files\\\\Git\\\\usr\\\\bin\\\\bash.exe',
    'C:\\\\Program Files (x86)\\\\Git\\\\bin\\\\bash.exe',
    'C:\\\\Program Files (x86)\\\\Git\\\\usr\\\\bin\\\\bash.exe'
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  try {
    const where = spawnSync('where', ['bash'], { encoding: 'utf8', windowsHide: true });
    if (where.status === 0) {
      const lines = (where.stdout || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const gitBash = lines.find(l => /\\Git\\.*\\bash\.exe$/i.test(l));
      return gitBash || (lines[0] || null);
    }
  } catch {
    // ignore
  }
  return null;
}

function isWslAvailable(): boolean {
  try {
    const probe = spawnSync('wsl.exe', ['-e', 'bash', '-lc', 'echo ok'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 1500
    });
    return probe.status === 0;
  } catch {
    return false;
  }
}

function pickShell(preferred: 'bash' | 'pwsh'): { shellKind: CliSessionShellKind; file: string; args: string[] } {
  if (os.platform() === 'win32') {
    if (preferred === 'bash') {
      if (isWslAvailable()) {
        return { shellKind: 'wsl-bash', file: 'wsl.exe', args: ['-e', 'bash', '-l', '-i'] };
      }
      const gitBash = findGitBashExe();
      if (gitBash) {
        return { shellKind: 'git-bash', file: gitBash, args: ['-l', '-i'] };
      }
    }

    // Fallback: PowerShell (pwsh preferred, windows powershell as final)
    const pwsh = spawnSync('where', ['pwsh'], { encoding: 'utf8', windowsHide: true });
    if (pwsh.status === 0) {
      return { shellKind: 'pwsh', file: 'pwsh', args: ['-NoLogo'] };
    }
    return { shellKind: 'pwsh', file: 'powershell', args: ['-NoLogo'] };
  }

  // Non-Windows: keep it simple (bash-first)
  if (preferred === 'pwsh') {
    return { shellKind: 'pwsh', file: 'pwsh', args: ['-NoLogo'] };
  }
  return { shellKind: 'git-bash', file: 'bash', args: ['-l', '-i'] };
}

function toWslPath(winPath: string): string {
  const normalized = winPath.replace(/\\/g, '/');
  const driveMatch = normalized.match(/^([a-zA-Z]):\/(.*)$/);
  if (!driveMatch) return normalized;
  return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`;
}

export class CliSessionManager {
  private sessions = new Map<string, CliSessionInternal>();
  private resumeKeyLastExecution = new Map<string, string>();
  private projectRoot: string;
  private emitter = new EventEmitter();
  private maxBufferBytes: number;
  private idleTimeoutMs: number;
  private reaperTimer: NodeJS.Timeout | null = null;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    const policy = getCliSessionPolicy();
    this.maxBufferBytes = policy.maxBufferBytes;
    this.idleTimeoutMs = policy.idleTimeoutMs;

    if (this.idleTimeoutMs > 0) {
      this.reaperTimer = setInterval(() => {
        const reaped = this.closeIdleSessions(this.idleTimeoutMs);
        for (const sessionKey of reaped) {
          appendCliSessionAudit({
            type: 'session_idle_reaped',
            timestamp: nowIso(),
            projectRoot: this.projectRoot,
            sessionKey,
          });
        }
      }, 60_000);
      this.reaperTimer.unref?.();
    }
  }

  listSessions(): CliSession[] {
    return Array.from(this.sessions.values()).map(({ pty: _pty, buffer: _buffer, bufferBytes: _bytes, ...rest }) => rest);
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  hasSession(sessionKey: string): boolean {
    return this.sessions.has(sessionKey);
  }

  getSession(sessionKey: string): CliSession | null {
    const session = this.sessions.get(sessionKey);
    if (!session) return null;
    const { pty: _pty, buffer: _buffer, bufferBytes: _bytes, ...rest } = session;
    return rest;
  }

  getBuffer(sessionKey: string): string {
    const session = this.sessions.get(sessionKey);
    if (!session) return '';
    return session.buffer.join('');
  }

  createSession(options: CreateCliSessionOptions): CliSession {
    const workingDir = normalizeWorkingDir(options.workingDir);
    const preferredShell = options.preferredShell ?? 'bash';
    const { shellKind, file, args } = pickShell(preferredShell);

    const sessionKey = createSessionKey();
    const createdAt = nowIso();

    const pty = nodePty.spawn(file, args, {
      name: 'xterm-256color',
      cols: options.cols ?? 120,
      rows: options.rows ?? 30,
      cwd: workingDir,
      env: process.env as Record<string, string>
    });

    const session: CliSessionInternal = {
      sessionKey,
      shellKind,
      workingDir,
      tool: options.tool,
      model: options.model,
      resumeKey: options.resumeKey,
      createdAt,
      updatedAt: createdAt,
      pty,
      buffer: [],
      bufferBytes: 0,
      lastActivityAt: Date.now(),
    };

    pty.onData((data) => {
      this.appendToBuffer(sessionKey, data);
      const now = Date.now();
      const s = this.sessions.get(sessionKey);
      if (s) {
        s.updatedAt = nowIso();
        s.lastActivityAt = now;
      }

      this.emitter.emit('output', {
        sessionKey,
        data,
        timestamp: nowIso(),
      } satisfies CliSessionOutputEvent);
      broadcastToClients({
        type: 'CLI_SESSION_OUTPUT',
        payload: {
          sessionKey,
          data,
          timestamp: nowIso()
        } satisfies CliSessionOutputEvent
      });
    });

    pty.onExit(({ exitCode, signal }) => {
      this.sessions.delete(sessionKey);
      broadcastToClients({
        type: 'CLI_SESSION_CLOSED',
        payload: {
          sessionKey,
          exitCode,
          signal,
          timestamp: nowIso()
        }
      });
    });

    this.sessions.set(sessionKey, session);

    // WSL often ignores Windows cwd; best-effort cd to mounted path.
    if (shellKind === 'wsl-bash') {
      const wslCwd = toWslPath(workingDir.replace(/\\/g, '/'));
      this.sendText(sessionKey, `cd ${wslCwd}`, true);
    }

    broadcastToClients({
      type: 'CLI_SESSION_CREATED',
      payload: { session: this.getSession(sessionKey), timestamp: nowIso() }
    });

    return this.getSession(sessionKey)!;
  }

  sendText(sessionKey: string, text: string, appendNewline: boolean): void {
    const session = this.sessions.get(sessionKey);
    if (!session) {
      throw new Error(`Session not found: ${sessionKey}`);
    }
    session.updatedAt = nowIso();
    session.lastActivityAt = Date.now();
    session.pty.write(text);
    if (appendNewline) {
      session.pty.write('\r');
    }
  }

  resize(sessionKey: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionKey);
    if (!session) {
      throw new Error(`Session not found: ${sessionKey}`);
    }
    session.updatedAt = nowIso();
    session.lastActivityAt = Date.now();
    session.pty.resize(cols, rows);
  }

  close(sessionKey: string): void {
    const session = this.sessions.get(sessionKey);
    if (!session) return;
    session.updatedAt = nowIso();
    session.lastActivityAt = Date.now();
    try {
      session.pty.kill();
    } finally {
      this.sessions.delete(sessionKey);
      broadcastToClients({ type: 'CLI_SESSION_CLOSED', payload: { sessionKey, timestamp: nowIso() } });
    }
  }

  execute(sessionKey: string, options: ExecuteInCliSessionOptions): { executionId: string; command: string } {
    const session = this.sessions.get(sessionKey);
    if (!session) {
      throw new Error(`Session not found: ${sessionKey}`);
    }
    session.updatedAt = nowIso();
    session.lastActivityAt = Date.now();

    const resumeKey = options.resumeKey ?? session.resumeKey;
    const resumeMapKey = resumeKey ? `${options.tool}:${resumeKey}` : null;
    const prevExecutionId = resumeMapKey ? this.resumeKeyLastExecution.get(resumeMapKey) : undefined;

    const executionId = resumeKey
      ? `${resumeKey}-${Date.now()}`
      : `exec-${Date.now()}-${randomBytes(3).toString('hex')}`;

    const { command } = buildCliSessionExecuteCommand({
      projectRoot: this.projectRoot,
      shellKind: session.shellKind,
      tool: options.tool,
      prompt: options.prompt,
      mode: options.mode,
      model: options.model,
      workingDir: options.workingDir ?? session.workingDir,
      category: options.category,
      resumeStrategy: options.resumeStrategy,
      prevExecutionId,
      executionId
    });

    // Best-effort: preemptively update mapping so subsequent queue items can chain.
    if (resumeMapKey) {
      this.resumeKeyLastExecution.set(resumeMapKey, executionId);
    }

    this.sendText(sessionKey, command, true);

    broadcastToClients({
      type: 'CLI_SESSION_EXECUTE',
      payload: { sessionKey, executionId, command, timestamp: nowIso() }
    });

    return { executionId, command };
  }

  private appendToBuffer(sessionKey: string, chunk: string): void {
    const session = this.sessions.get(sessionKey);
    if (!session) return;

    session.buffer.push(chunk);
    session.bufferBytes += Buffer.byteLength(chunk, 'utf8');

    while (session.bufferBytes > this.maxBufferBytes && session.buffer.length > 0) {
      const removed = session.buffer.shift();
      if (removed) session.bufferBytes -= Buffer.byteLength(removed, 'utf8');
    }
  }

  onOutput(listener: (event: CliSessionOutputEvent) => void): () => void {
    const handler = (event: CliSessionOutputEvent) => listener(event);
    this.emitter.on('output', handler);
    return () => this.emitter.off('output', handler);
  }

  closeIdleSessions(idleTimeoutMs: number): string[] {
    if (idleTimeoutMs <= 0) return [];
    const now = Date.now();
    const closed: string[] = [];
    for (const s of this.sessions.values()) {
      if (now - s.lastActivityAt >= idleTimeoutMs) {
        this.close(s.sessionKey);
        closed.push(s.sessionKey);
      }
    }
    return closed;
  }
}

const managersByRoot = new Map<string, CliSessionManager>();

export function getCliSessionManager(projectRoot: string = process.cwd()): CliSessionManager {
  const resolved = path.resolve(projectRoot);
  const existing = managersByRoot.get(resolved);
  if (existing) return existing;
  const created = new CliSessionManager(resolved);
  managersByRoot.set(resolved, created);
  return created;
}

/**
 * Find the manager that owns a given sessionKey.
 * Useful for cross-workspace routing (tmux-like send) where the executor
 * may not share the same workflowDir/projectRoot as the target session.
 */
export function findCliSessionManager(sessionKey: string): CliSessionManager | null {
  for (const manager of managersByRoot.values()) {
    if (manager.hasSession(sessionKey)) return manager;
  }
  return null;
}
