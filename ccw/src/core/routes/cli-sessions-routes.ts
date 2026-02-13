/**
 * CLI Sessions (PTY) Routes Module
 * Independent from existing /api/cli/* execution endpoints.
 *
 * Endpoints:
 * - GET  /api/cli-sessions
 * - POST /api/cli-sessions
 * - GET  /api/cli-sessions/:sessionKey/buffer
 * - GET  /api/cli-sessions/:sessionKey/stream (SSE, shareToken required)
 * - POST /api/cli-sessions/:sessionKey/send
 * - POST /api/cli-sessions/:sessionKey/execute
 * - POST /api/cli-sessions/:sessionKey/resize
 * - POST /api/cli-sessions/:sessionKey/close
 * - GET  /api/cli-sessions/:sessionKey/shares
 * - POST /api/cli-sessions/:sessionKey/share
 * - POST /api/cli-sessions/:sessionKey/share/revoke
 */

import type { RouteContext } from './types.js';
import { getCliSessionManager } from '../services/cli-session-manager.js';
import path from 'path';
import { getCliSessionPolicy } from '../services/cli-session-policy.js';
import { RateLimiter } from '../services/rate-limiter.js';
import { appendCliSessionAudit } from '../services/cli-session-audit.js';
import { describeShareAuthFailure, getCliSessionShareManager } from '../services/cli-session-share.js';

function clientKey(req: RouteContext['req']): string {
  const addr = req.socket?.remoteAddress ?? 'unknown';
  const ua = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
  return `${addr}|${ua ?? ''}`;
}

function clientInfo(req: RouteContext['req']): { ip?: string; userAgent?: string } {
  const ip = req.socket?.remoteAddress ?? undefined;
  const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
  return { ip: ip || undefined, userAgent: userAgent || undefined };
}

function resolveProjectRoot(ctx: RouteContext): string {
  const forced = (ctx.req as any).__cliSessionShareProjectRoot;
  if (typeof forced === 'string' && forced.trim()) return path.resolve(forced);
  const raw = ctx.url.searchParams.get('path');
  if (raw && raw.trim()) return path.resolve(raw);
  return path.resolve(ctx.initialPath || process.cwd());
}

function validateWorkingDir(projectRoot: string, workingDir: string, allowOutside: boolean): string | null {
  const resolved = path.resolve(workingDir);
  if (allowOutside) return null;

  const rel = path.relative(projectRoot, resolved);
  const isInside = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  return isInside ? null : `workingDir must be within project: ${projectRoot}`;
}

const policy = getCliSessionPolicy();
const createLimiter = new RateLimiter({ limit: policy.rateLimit.createPerMinute, windowMs: 60_000 });
const executeLimiter = new RateLimiter({ limit: policy.rateLimit.executePerMinute, windowMs: 60_000 });
const resizeLimiter = new RateLimiter({ limit: policy.rateLimit.resizePerMinute, windowMs: 60_000 });
const sendBytesLimiter = new RateLimiter({ limit: policy.rateLimit.sendBytesPerMinute, windowMs: 60_000 });
const shareManager = getCliSessionShareManager();

export async function handleCliSessionsRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, handlePostRequest, initialPath } = ctx;
  const projectRoot = resolveProjectRoot(ctx);
  const manager = getCliSessionManager(projectRoot);

  // GET /api/cli-sessions
  if (pathname === '/api/cli-sessions' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessions: manager.listSessions() }));
    return true;
  }

  // POST /api/cli-sessions
  if (pathname === '/api/cli-sessions' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: unknown) => {
      const rate = createLimiter.consume(clientKey(req), 1);
      if (!rate.ok) {
        return { error: 'Rate limited', status: 429 };
      }

      if (policy.maxSessions > 0 && manager.listSessions().length >= policy.maxSessions) {
        return { error: `Too many sessions (max ${policy.maxSessions})`, status: 429 };
      }

      const {
        workingDir,
        cols,
        rows,
        preferredShell,
        tool,
        model,
        resumeKey
      } = (body || {}) as any;

      if (tool && typeof tool === 'string') {
        const normalizedTool = tool.trim();
        if (!policy.allowedTools.includes(normalizedTool)) {
          return { error: `Tool not allowed: ${normalizedTool}`, status: 400 };
        }
      }

      const desiredWorkingDir = workingDir || initialPath;
      if (typeof desiredWorkingDir !== 'string' || !desiredWorkingDir.trim()) {
        return { error: 'workingDir is required', status: 400 };
      }
      const wdError = validateWorkingDir(projectRoot, desiredWorkingDir, policy.allowWorkingDirOutsideProject);
      if (wdError) return { error: wdError, status: 400 };

      const session = manager.createSession({
        workingDir: desiredWorkingDir,
        cols: typeof cols === 'number' ? cols : undefined,
        rows: typeof rows === 'number' ? rows : undefined,
        preferredShell: preferredShell === 'pwsh' ? 'pwsh' : 'bash',
        tool: typeof tool === 'string' ? tool.trim() : undefined,
        model,
        resumeKey
      });

      appendCliSessionAudit({
        type: 'session_created',
        timestamp: new Date().toISOString(),
        projectRoot,
        sessionKey: session.sessionKey,
        tool: session.tool,
        resumeKey: session.resumeKey,
        workingDir: session.workingDir,
        ...clientInfo(req),
      });

      return { success: true, session };
    });
    return true;
  }

  // GET /api/cli-sessions/:sessionKey/buffer
  const bufferMatch = pathname.match(/^\/api\/cli-sessions\/([^/]+)\/buffer$/);
  if (bufferMatch && req.method === 'GET') {
    const sessionKey = decodeURIComponent(bufferMatch[1]);

    const shareToken = ctx.url.searchParams.get('shareToken');
    if (shareToken) {
      const validated = shareManager.validateToken(shareToken, sessionKey);
      if (!validated || (validated.mode !== 'read' && validated.mode !== 'write')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: describeShareAuthFailure().error }));
        return true;
      }
    }

    const session = manager.getSession(sessionKey);
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return true;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ session, buffer: manager.getBuffer(sessionKey) }));
    return true;
  }

  // GET /api/cli-sessions/:sessionKey/stream (SSE)
  const streamMatch = pathname.match(/^\/api\/cli-sessions\/([^/]+)\/stream$/);
  if (streamMatch && req.method === 'GET') {
    const sessionKey = decodeURIComponent(streamMatch[1]);
    const shareToken = ctx.url.searchParams.get('shareToken');
    if (!shareToken) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'shareToken is required' }));
      return true;
    }
    const validated = shareManager.validateToken(shareToken, sessionKey);
    if (!validated || (validated.mode !== 'read' && validated.mode !== 'write')) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: describeShareAuthFailure().error }));
      return true;
    }

    const session = manager.getSession(sessionKey);
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return true;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    const includeBuffer = ctx.url.searchParams.get('includeBuffer') !== '0';
    if (includeBuffer) {
      const buffer = manager.getBuffer(sessionKey);
      res.write(`event: buffer\ndata: ${JSON.stringify({ sessionKey, buffer })}\n\n`);
    }

    // Keep the SSE connection alive through proxies even when output is idle.
    const keepAliveTimer = setInterval(() => {
      try {
        res.write(`: keepalive ${Date.now()}\n\n`);
      } catch {
        // ignore
      }
    }, 15_000);
    keepAliveTimer.unref?.();

    const unsubscribe = manager.onOutput((event) => {
      if (event.sessionKey !== sessionKey) return;
      res.write(`event: output\ndata: ${JSON.stringify(event)}\n\n`);
    });

    req.on('close', () => {
      clearInterval(keepAliveTimer);
      unsubscribe();
      try {
        res.end();
      } catch {
        // ignore
      }
    });

    return true;
  }

  // POST /api/cli-sessions/:sessionKey/send
  const sendMatch = pathname.match(/^\/api\/cli-sessions\/([^/]+)\/send$/);
  if (sendMatch && req.method === 'POST') {
    const sessionKey = decodeURIComponent(sendMatch[1]);
    handlePostRequest(req, res, async (body: unknown) => {
      const { text, appendNewline } = (body || {}) as any;
      if (typeof text !== 'string') {
        return { error: 'text is required', status: 400 };
      }

      const cost = Buffer.byteLength(text, 'utf8');
      const rate = sendBytesLimiter.consume(clientKey(req), cost);
      if (!rate.ok) {
        return { error: 'Rate limited', status: 429 };
      }

      manager.sendText(sessionKey, text, appendNewline !== false);
      appendCliSessionAudit({
        type: 'session_send',
        timestamp: new Date().toISOString(),
        projectRoot,
        sessionKey,
        ...clientInfo(req),
        details: { bytes: cost, appendNewline: appendNewline !== false },
      });
      return { success: true };
    });
    return true;
  }

  // GET /api/cli-sessions/:sessionKey/shares
  const sharesMatch = pathname.match(/^\/api\/cli-sessions\/([^/]+)\/shares$/);
  if (sharesMatch && req.method === 'GET') {
    const sessionKey = decodeURIComponent(sharesMatch[1]);
    const session = manager.getSession(sessionKey);
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return true;
    }
    const shares = shareManager
      .listTokensForSession(sessionKey, projectRoot)
      .map((s) => ({ shareToken: s.token, expiresAt: s.expiresAt, mode: s.mode }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ shares }));
    return true;
  }

  // POST /api/cli-sessions/:sessionKey/share
  const shareMatch = pathname.match(/^\/api\/cli-sessions\/([^/]+)\/share$/);
  if (shareMatch && req.method === 'POST') {
    const sessionKey = decodeURIComponent(shareMatch[1]);
    handlePostRequest(req, res, async (body: unknown) => {
      const { mode, ttlMs } = (body || {}) as any;
      const session = manager.getSession(sessionKey);
      if (!session) return { error: 'Session not found', status: 404 };

      const shareMode = mode === 'write' ? 'write' : 'read';
      const safeTtlMs = typeof ttlMs === 'number' ? Math.min(Math.max(60_000, ttlMs), 7 * 24 * 60 * 60_000) : undefined;
      const token = shareManager.createToken({
        sessionKey,
        projectRoot,
        mode: shareMode,
        ttlMs: safeTtlMs,
      });

      appendCliSessionAudit({
        type: 'session_share_created',
        timestamp: new Date().toISOString(),
        projectRoot,
        sessionKey,
        ...clientInfo(req),
        details: { shareMode, expiresAt: token.expiresAt },
      });

      return { success: true, shareToken: token.token, expiresAt: token.expiresAt, mode: token.mode };
    });
    return true;
  }

  // POST /api/cli-sessions/:sessionKey/share/revoke
  const revokeShareMatch = pathname.match(/^\/api\/cli-sessions\/([^/]+)\/share\/revoke$/);
  if (revokeShareMatch && req.method === 'POST') {
    const sessionKey = decodeURIComponent(revokeShareMatch[1]);
    handlePostRequest(req, res, async (body: unknown) => {
      const { shareToken } = (body || {}) as any;
      if (!shareToken || typeof shareToken !== 'string') {
        return { error: 'shareToken is required', status: 400 };
      }

      const validated = shareManager.validateToken(shareToken, sessionKey);
      if (!validated || validated.projectRoot !== projectRoot) {
        return { error: describeShareAuthFailure().error, status: 403 };
      }

      const revoked = shareManager.revokeToken(shareToken);
      appendCliSessionAudit({
        type: 'session_share_revoked',
        timestamp: new Date().toISOString(),
        projectRoot,
        sessionKey,
        ...clientInfo(req),
        details: { tokenTail: shareToken.slice(-6), revoked },
      });

      return { success: true, revoked };
    });
    return true;
  }

  // POST /api/cli-sessions/:sessionKey/execute
  const executeMatch = pathname.match(/^\/api\/cli-sessions\/([^/]+)\/execute$/);
  if (executeMatch && req.method === 'POST') {
    const sessionKey = decodeURIComponent(executeMatch[1]);
    handlePostRequest(req, res, async (body: unknown) => {
      const rate = executeLimiter.consume(clientKey(req), 1);
      if (!rate.ok) {
        return { error: 'Rate limited', status: 429 };
      }

      const {
        tool,
        prompt,
        mode,
        model,
        workingDir,
        category,
        resumeKey,
        resumeStrategy
      } = (body || {}) as any;

      if (!tool || typeof tool !== 'string') {
        return { error: 'tool is required', status: 400 };
      }
      if (!prompt || typeof prompt !== 'string') {
        return { error: 'prompt is required', status: 400 };
      }
      const normalizedTool = tool.trim();
      if (!policy.allowedTools.includes(normalizedTool)) {
        return { error: `Tool not allowed: ${normalizedTool}`, status: 400 };
      }

      if (workingDir && typeof workingDir === 'string') {
        const wdError = validateWorkingDir(projectRoot, workingDir, policy.allowWorkingDirOutsideProject);
        if (wdError) return { error: wdError, status: 400 };
      }

      const result = manager.execute(sessionKey, {
        tool: normalizedTool,
        prompt,
        mode,
        model,
        workingDir,
        category,
        resumeKey,
        resumeStrategy: resumeStrategy === 'promptConcat' ? 'promptConcat' : 'nativeResume'
      });

      appendCliSessionAudit({
        type: 'session_execute',
        timestamp: new Date().toISOString(),
        projectRoot,
        sessionKey,
        tool: normalizedTool,
        resumeKey: typeof resumeKey === 'string' ? resumeKey : undefined,
        workingDir: typeof workingDir === 'string' ? workingDir : undefined,
        ...clientInfo(req),
        details: { executionId: result.executionId, mode, category, resumeStrategy },
      });

      return { success: true, ...result };
    });
    return true;
  }

  // POST /api/cli-sessions/:sessionKey/resize
  const resizeMatch = pathname.match(/^\/api\/cli-sessions\/([^/]+)\/resize$/);
  if (resizeMatch && req.method === 'POST') {
    const sessionKey = decodeURIComponent(resizeMatch[1]);
    handlePostRequest(req, res, async (body: unknown) => {
      const rate = resizeLimiter.consume(clientKey(req), 1);
      if (!rate.ok) {
        return { error: 'Rate limited', status: 429 };
      }
      const { cols, rows } = (body || {}) as any;
      if (typeof cols !== 'number' || typeof rows !== 'number') {
        return { error: 'cols and rows are required', status: 400 };
      }
      manager.resize(sessionKey, cols, rows);
      appendCliSessionAudit({
        type: 'session_resize',
        timestamp: new Date().toISOString(),
        projectRoot,
        sessionKey,
        ...clientInfo(req),
        details: { cols, rows },
      });
      return { success: true };
    });
    return true;
  }

  // POST /api/cli-sessions/:sessionKey/close
  const closeMatch = pathname.match(/^\/api\/cli-sessions\/([^/]+)\/close$/);
  if (closeMatch && req.method === 'POST') {
    const sessionKey = decodeURIComponent(closeMatch[1]);
    manager.close(sessionKey);
    appendCliSessionAudit({
      type: 'session_closed',
      timestamp: new Date().toISOString(),
      projectRoot,
      sessionKey,
      ...clientInfo(req),
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return true;
  }

  return false;
}
