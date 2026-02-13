/**
 * Audit Routes Module
 * Read-only APIs for audit/observability panels.
 *
 * Currently supported:
 * - GET /api/audit/cli-sessions - Read CLI session (PTY) audit events (JSONL)
 */

import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { validatePath as validateAllowedPath } from '../../utils/path-validator.js';
import type { CliSessionAuditEvent, CliSessionAuditEventType } from '../services/cli-session-audit.js';
import type { RouteContext } from './types.js';

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function parseCsvParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function isCliSessionAuditEventType(value: string): value is CliSessionAuditEventType {
  return [
    'session_created',
    'session_closed',
    'session_send',
    'session_execute',
    'session_resize',
    'session_share_created',
    'session_share_revoked',
    'session_idle_reaped',
  ].includes(value);
}

function matchesSearch(event: CliSessionAuditEvent, qLower: string): boolean {
  if (!qLower) return true;

  const haystacks: string[] = [];
  if (event.type) haystacks.push(event.type);
  if (event.timestamp) haystacks.push(event.timestamp);
  if (event.sessionKey) haystacks.push(event.sessionKey);
  if (event.tool) haystacks.push(event.tool);
  if (event.resumeKey) haystacks.push(event.resumeKey);
  if (event.workingDir) haystacks.push(event.workingDir);
  if (event.ip) haystacks.push(event.ip);
  if (event.userAgent) haystacks.push(event.userAgent);
  if (event.details) {
    try {
      haystacks.push(JSON.stringify(event.details));
    } catch {
      // Ignore non-serializable details
    }
  }

  return haystacks.some((h) => h.toLowerCase().includes(qLower));
}

/**
 * Handle audit routes
 * @returns true if route was handled, false otherwise
 */
export async function handleAuditRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath } = ctx;

  // GET /api/audit/cli-sessions
  if (pathname === '/api/audit/cli-sessions' && req.method === 'GET') {
    const projectPathParam = url.searchParams.get('path') || initialPath;

    const limit = clampInt(parseInt(url.searchParams.get('limit') || '200', 10), 1, 1000);
    const offset = clampInt(parseInt(url.searchParams.get('offset') || '0', 10), 0, Number.MAX_SAFE_INTEGER);

    const sessionKey = url.searchParams.get('sessionKey');
    const qLower = (url.searchParams.get('q') || '').trim().toLowerCase();

    const typeFilters = parseCsvParam(url.searchParams.get('type'))
      .filter(isCliSessionAuditEventType);
    const typeFilterSet = typeFilters.length > 0 ? new Set<CliSessionAuditEventType>(typeFilters) : null;

    try {
      const projectRoot = await validateAllowedPath(projectPathParam, {
        mustExist: true,
        allowedDirectories: [initialPath],
      });

      const filePath = join(projectRoot, '.workflow', 'audit', 'cli-sessions.jsonl');
      if (!existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          data: { events: [], total: 0, limit, offset, hasMore: false },
        }));
        return true;
      }

      const raw = await readFile(filePath, 'utf-8');
      const parsed: CliSessionAuditEvent[] = [];
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          parsed.push(JSON.parse(trimmed) as CliSessionAuditEvent);
        } catch {
          // Skip invalid JSONL line
        }
      }

      const filtered = parsed.filter((ev) => {
        if (sessionKey && ev.sessionKey !== sessionKey) return false;
        if (typeFilterSet && !typeFilterSet.has(ev.type)) return false;
        if (qLower && !matchesSearch(ev, qLower)) return false;
        return true;
      });

      // Best-effort: file is append-only, so reverse for newest-first.
      filtered.reverse();

      const total = filtered.length;
      const page = filtered.slice(offset, offset + limit);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: true,
        data: {
          events: page,
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      }));
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const lowered = message.toLowerCase();
      const status = lowered.includes('access denied') ? 403 : 400;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: false,
        error: status === 403 ? 'Access denied' : 'Invalid request',
      }));
      return true;
    }
  }

  return false;
}

