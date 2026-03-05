import type http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import type { TokenManager } from './token-manager.js';

export interface AuthMiddlewareContext {
  pathname: string;
  req: IncomingMessage;
  res: ServerResponse;
  tokenManager: TokenManager;
  secretKey: string;
  unauthenticatedPaths?: Set<string>;
}

function parseCookieHeader(cookieHeader: string | null | undefined): Record<string, string> {
  if (!cookieHeader) return {};

  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValueParts] = part.trim().split('=');
    if (!rawName) continue;
    const rawValue = rawValueParts.join('=');
    try {
      cookies[rawName] = decodeURIComponent(rawValue);
    } catch {
      cookies[rawName] = rawValue;
    }
  }
  return cookies;
}

function getHeaderValue(header: string | string[] | undefined): string | null {
  if (!header) return null;
  if (Array.isArray(header)) return header[0] ?? null;
  return header;
}

export function extractAuthToken(req: IncomingMessage): string | null {
  const authorization = getHeaderValue(req.headers.authorization);
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) return match[1].trim();
  }

  const cookies = parseCookieHeader(getHeaderValue(req.headers.cookie));
  if (cookies.auth_token) return cookies.auth_token;

  return null;
}

/**
 * Check if request is from localhost
 * @param req - The incoming request
 * @param allowAllInterfaces - When true (server bound to 0.0.0.0), allows requests from any interface
 */
export function isLocalhostRequest(req: IncomingMessage, allowAllInterfaces: boolean = false): boolean {
  // When server is bound to 0.0.0.0, allow token acquisition from any interface
  // This is safe because the token endpoint only provides auth for the dashboard
  if (allowAllInterfaces) {
    return true;
  }

  const remote = req.socket?.remoteAddress ?? '';
  return remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
}

/**
 * Check if host binding allows all network interfaces
 * @param host - The host address the server is bound to
 */
export function isWildcardHost(host: string | undefined): boolean {
  if (!host) return false;
  return host === '0.0.0.0' || host === '::' || host === '';
}

export function setAuthCookie(res: ServerResponse, token: string, expiresAt: Date): void {
  const maxAgeSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

  const attributes = [
    `auth_token=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ];

  res.setHeader('Set-Cookie', attributes.join('; '));
}

function writeJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

/**
 * Public API endpoints that can be accessed from localhost without authentication
 * These are read-only endpoints used by the dashboard for data fetching
 */
const LOCALHOST_PUBLIC_PATHS = [
  '/api/data',
  '/api/orchestrator/flows',
  '/api/orchestrator/templates',
  '/api/orchestrator/executions',
  '/api/orchestrator/templates/remote',
  '/api/mcp-config',
  '/api/ccw/tools',
  '/api/ccw/installations',
  '/api/cli/endpoints',
  '/api/skills',
  '/api/providers',
  '/api/litellm-api/providers',
  '/api/litellm-api/endpoints',
  '/api/health',
  '/api/a2ui/answer',
];

/**
 * Check if a path is a public API endpoint (accessible from localhost without auth)
 */
function isLocalPublicPath(pathname: string): boolean {
  // Exact match
  if (LOCALHOST_PUBLIC_PATHS.includes(pathname)) return true;

  // Prefix match for paths with parameters (e.g., /api/orchestrator/flows/:id)
  for (const publicPath of LOCALHOST_PUBLIC_PATHS) {
    if (pathname.startsWith(publicPath + '/') || pathname.startsWith(publicPath.replace(/\/[^/]*$/, '/'))) {
      return true;
    }
  }

  // Special handling for paths with wildcards
  if (pathname.startsWith('/api/orchestrator/flows/')) return true;
  if (pathname.startsWith('/api/orchestrator/executions/')) return true;
  if (pathname.startsWith('/api/orchestrator/templates/')) return true;
  if (pathname.startsWith('/api/litellm-api/providers/')) return true;
  if (pathname.startsWith('/api/litellm-api/endpoints/')) return true;
  if (pathname.startsWith('/api/litellm-api/models/')) return true;

  return false;
}

export function authMiddleware(ctx: AuthMiddlewareContext): boolean {
  const { pathname, req, res, tokenManager, secretKey, unauthenticatedPaths } = ctx;

  if (!pathname.startsWith('/api/')) return true;
  if (unauthenticatedPaths?.has(pathname)) return true;

  // Allow localhost requests to public API endpoints without authentication
  // This enables the Vite dev server (localhost:5173) to proxy API requests
  if (isLocalhostRequest(req) && isLocalPublicPath(pathname)) {
    (req as http.IncomingMessage & { authenticated?: boolean }).authenticated = true;
    return true;
  }

  const token = extractAuthToken(req);
  if (!token) {
    writeJson(res, 401, { error: 'Unauthorized' });
    return false;
  }

  const ok = tokenManager.validateToken(token, secretKey);
  if (!ok) {
    writeJson(res, 401, { error: 'Unauthorized' });
    return false;
  }

  (req as http.IncomingMessage & { authenticated?: boolean }).authenticated = true;
  return true;
}
