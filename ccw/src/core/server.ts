import http from 'http';
import { URL } from 'url';
// Import route handlers
import { handleStatusRoutes } from './routes/status-routes.js';
import { handleCliRoutes, cleanupStaleExecutions } from './routes/cli-routes.js';
import { handleCliSettingsRoutes } from './routes/cli-settings-routes.js';
import { handleCliSessionsRoutes } from './routes/cli-sessions-routes.js';
import { handleAuditRoutes } from './routes/audit-routes.js';
import { handleProviderRoutes } from './routes/provider-routes.js';
import { handleMemoryRoutes } from './routes/memory-routes.js';
import { handleCoreMemoryRoutes } from './routes/core-memory-routes.js';
import { handleMcpRoutes } from './routes/mcp-routes.js';
import { handleHooksRoutes } from './routes/hooks-routes.js';
import { handleUnsplashRoutes, handleBackgroundRoutes } from './routes/unsplash-routes.js';
import { handleCodexLensRoutes } from './routes/codexlens-routes.js';
import { handleGraphRoutes } from './routes/graph-routes.js';
import { handleSystemRoutes } from './routes/system-routes.js';
import { handleFilesRoutes } from './routes/files-routes.js';
import { handleSkillsRoutes } from './routes/skills-routes.js';
import { handleCommandsRoutes } from './routes/commands-routes.js';
import { handleIssueRoutes } from './routes/issue-routes.js';
import { handleDiscoveryRoutes } from './routes/discovery-routes.js';
import { handleRulesRoutes } from './routes/rules-routes.js';
import { handleSessionRoutes } from './routes/session-routes.js';
import { handleCcwRoutes } from './routes/ccw-routes.js';
import { handleClaudeRoutes } from './routes/claude-routes.js';
import { handleHelpRoutes } from './routes/help-routes.js';
import { handleLiteLLMRoutes } from './routes/litellm-routes.js';
import { handleLiteLLMApiRoutes } from './routes/litellm-api-routes.js';
import { handleNavStatusRoutes } from './routes/nav-status-routes.js';
import { handleAuthRoutes } from './routes/auth-routes.js';
import { handleLoopRoutes } from './routes/loop-routes.js';
import { handleLoopV2Routes, initializeCliToolsCache } from './routes/loop-v2-routes.js';
import { handleTestLoopRoutes } from './routes/test-loop-routes.js';
import { handleTaskRoutes } from './routes/task-routes.js';
import { handleDashboardRoutes } from './routes/dashboard-routes.js';
import { handleOrchestratorRoutes } from './routes/orchestrator-routes.js';
import { handleConfigRoutes } from './routes/config-routes.js';
import { handleTeamRoutes } from './routes/team-routes.js';

// Import WebSocket handling
import { handleWebSocketUpgrade, broadcastToClients, extractSessionIdFromPath } from './websocket.js';

import { getTokenManager } from './auth/token-manager.js';
import { authMiddleware, isLocalhostRequest, setAuthCookie } from './auth/middleware.js';
import { getCorsOrigin } from './cors.js';
import { csrfValidation } from './auth/csrf-middleware.js';
import { getCsrfTokenManager } from './auth/csrf-manager.js';
import { randomBytes } from 'crypto';

// Import health check service
import { getHealthCheckService } from './services/health-check-service.js';
import { getCliSessionShareManager } from './services/cli-session-share.js';

// Import status check functions for warmup
import { checkSemanticStatus, checkVenvStatus } from '../tools/codex-lens.js';
import { getCliToolsStatus } from '../tools/cli-executor.js';

import type { ServerConfig } from '../types/config.js';
import type { PostRequestHandler } from './routes/types.js';

interface ServerOptions {
  port?: number;
  initialPath?: string;
  host?: string;
  open?: boolean;
  reactPort?: number;
}

type PostHandler = PostRequestHandler;

/**
 * Handle POST request with JSON body
 */
function handlePostRequest(req: http.IncomingMessage, res: http.ServerResponse, handler: PostHandler): void {
  const cachedParsed = (req as any).body;
  const cachedRawBody = (req as any).__ccwRawBody;

  const handleBody = async (parsed: unknown) => {
    try {
      const result = await handler(parsed);

      const isObjectResult = typeof result === 'object' && result !== null;
      const errorValue = isObjectResult && 'error' in result ? (result as { error?: unknown }).error : undefined;
      const statusValue = isObjectResult && 'status' in result ? (result as { status?: unknown }).status : undefined;

      if (typeof errorValue === 'string' && errorValue.length > 0) {
        const status = typeof statusValue === 'number' ? statusValue : 500;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errorValue }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
  };

  if (cachedParsed !== undefined) {
    void handleBody(cachedParsed);
    return;
  }

  if (typeof cachedRawBody === 'string') {
    try {
      void handleBody(JSON.parse(cachedRawBody));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
    return;
  }

  let body = '';
  req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
  req.on('end', async () => {
    try {
      (req as any).__ccwRawBody = body;
      const parsed = JSON.parse(body);
      (req as any).body = parsed;
      await handleBody(parsed);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
  });
}

function getHeaderValue(header: string | string[] | undefined): string | null {
  if (!header) return null;
  if (Array.isArray(header)) return header[0] ?? null;
  return header;
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

function appendSetCookie(res: http.ServerResponse, cookie: string): void {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookie);
    return;
  }

  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookie]);
    return;
  }

  res.setHeader('Set-Cookie', [String(existing), cookie]);
}

function getOrCreateSessionId(req: http.IncomingMessage, res: http.ServerResponse): string {
  const cookies = parseCookieHeader(getHeaderValue(req.headers.cookie));
  const existing = cookies.ccw_session_id;
  if (existing) return existing;

  const created = randomBytes(16).toString('hex');
  const attributes = [
    `ccw_session_id=${encodeURIComponent(created)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${24 * 60 * 60}`,
  ];
  appendSetCookie(res, attributes.join('; '));
  return created;
}

function setCsrfCookie(res: http.ServerResponse, token: string, maxAgeSeconds: number): void {
  const attributes = [
    `XSRF-TOKEN=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ];
  appendSetCookie(res, attributes.join('; '));
}

/**
 * Warmup function to pre-populate caches on server startup
 * This runs asynchronously and non-blocking after the server starts
 */
async function warmupCaches(initialPath: string): Promise<void> {
  console.log('[WARMUP] Starting cache warmup...');
  const startTime = Date.now();

  // Run all warmup tasks in parallel for faster startup
  const warmupTasks = [
    // Warmup semantic status cache (Python process startup - can be slow first time)
    (async () => {
      const taskStart = Date.now();
      try {
        const semanticStatus = await checkSemanticStatus();
        console.log(`[WARMUP] Semantic status: ${semanticStatus.available ? 'available' : 'not available'} (${Date.now() - taskStart}ms)`);
      } catch (err) {
        console.warn(`[WARMUP] Semantic status check failed: ${(err as Error).message}`);
      }
    })(),

    // Warmup venv status cache
    (async () => {
      const taskStart = Date.now();
      try {
        const venvStatus = await checkVenvStatus();
        console.log(`[WARMUP] Venv status: ${venvStatus.ready ? 'ready' : 'not ready'} (${Date.now() - taskStart}ms)`);
      } catch (err) {
        console.warn(`[WARMUP] Venv status check failed: ${(err as Error).message}`);
      }
    })(),

    // Warmup CLI tools status cache
    (async () => {
      const taskStart = Date.now();
      try {
        const cliStatus = await getCliToolsStatus();
        const availableCount = Object.values(cliStatus).filter(s => s.available).length;
        const totalCount = Object.keys(cliStatus).length;
        console.log(`[WARMUP] CLI tools status: ${availableCount}/${totalCount} available (${Date.now() - taskStart}ms)`);
      } catch (err) {
        console.warn(`[WARMUP] CLI tools status check failed: ${(err as Error).message}`);
      }
    })()
  ];

  await Promise.allSettled(warmupTasks);
  console.log(`[WARMUP] Cache warmup complete (${Date.now() - startTime}ms total)`);
}

/**
 * Read request body as text for proxy requests
 * @param req - HTTP request object
 * @returns Promise that resolves to body text
 */
async function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => { resolve(body); });
    req.on('error', reject);
  });
}

/**
 * Create and start the dashboard server
 * @param {Object} options - Server options
 * @param {number} options.port - Port to listen on (default: 3456)
 * @param {string} options.initialPath - Initial project path
 * @returns {Promise<http.Server>}
 */
export async function startServer(options: ServerOptions = {}): Promise<http.Server> {
  let serverPort = options.port ?? 3456;
  const initialPath = options.initialPath || process.cwd();
  const host = options.host ?? '127.0.0.1';
  const reactPort = options.reactPort || serverPort + 1;

  console.log(`[Server] React proxy configured: /* -> http://localhost:${reactPort}`);

  const tokenManager = getTokenManager();
  const secretKey = tokenManager.getSecretKey();
  tokenManager.getOrCreateAuthToken();
  const unauthenticatedPaths = new Set<string>(['/api/auth/token', '/api/csrf-token', '/api/hook', '/api/test/ask-question', '/api/a2ui/answer']);
  const cliSessionShareManager = getCliSessionShareManager();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${serverPort}`);
    const pathname = url.pathname;

    // CORS headers for API requests
    const originHeader = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', getCorsOrigin(originHeader, serverPort));
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'X-CSRF-Token');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      // Debug log for API requests
      if (pathname.startsWith('/api/')) {
        console.log(`[API] ${req.method} ${pathname}`);
      }

      // Route context for all handlers
      const routeContext = {
        pathname,
        url,
        req,
        res,
        initialPath,
        handlePostRequest,
        broadcastToClients,
        extractSessionIdFromPath,
        server
      };

      // Token acquisition endpoint (localhost-only)
      if (pathname === '/api/auth/token') {
        if (!isLocalhostRequest(req)) {
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }

        const tokenResult = tokenManager.getOrCreateAuthToken();
        setAuthCookie(res, tokenResult.token, tokenResult.expiresAt);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ token: tokenResult.token, expiresAt: tokenResult.expiresAt.toISOString() }));
        return;
      }

      // Authentication middleware for all API routes
      if (pathname.startsWith('/api/')) {
        let shareBypass = false;
        const shareToken = url.searchParams.get('shareToken');
        if (shareToken) {
          const match = pathname.match(/^\/api\/cli-sessions\/([^/]+)\/(buffer|stream)$/);
          if (match?.[1]) {
            const sessionKey = decodeURIComponent(match[1]);
            const validated = cliSessionShareManager.validateToken(shareToken, sessionKey);
            if (validated && (validated.mode === 'read' || validated.mode === 'write')) {
              (req as any).__cliSessionShareProjectRoot = validated.projectRoot;
              shareBypass = true;
            }
          }
        }

        if (!shareBypass) {
          const ok = authMiddleware({ pathname, req, res, tokenManager, secretKey, unauthenticatedPaths });
          if (!ok) return;
        }
      }

      // CSRF validation middleware for state-changing API routes
      if (pathname.startsWith('/api/')) {
        const ok = await csrfValidation({ pathname, req, res });
        if (!ok) return;
      }

      // Try each route handler in order
      // Order matters: more specific routes should come before general ones

      // Test endpoint for ask_question tool (temporary for E2E testing)
      if (pathname === '/api/test/ask-question' && req.method === 'POST') {
        const { executeTool } = await import('../tools/index.js');

        // Get question params from request body if provided, or use default
        let questionParams = {
          question: {
            id: 'test-question-' + Date.now(),
            type: 'confirm',
            title: 'Test Question',
            message: 'This is a test of the ask_question tool integration',
            description: 'Click Confirm or Cancel to complete the test'
          },
          timeout: 30000
        };

        if (req.headers['content-type']?.includes('application/json')) {
          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(chunk);
            }
            const body = JSON.parse(Buffer.concat(chunks).toString());
            if (body.question) {
              questionParams.question = { ...questionParams.question, ...body.question };
            }
            if (body.timeout) {
              questionParams.timeout = body.timeout;
            }
          } catch (e) {
            // Use defaults if parsing fails
          }
        }

        const result = await executeTool('ask_question', questionParams);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }

      // Auth routes (/api/csrf-token)
      if (await handleAuthRoutes(routeContext)) return;

      // Status routes (/api/status/*) - Aggregated endpoint for faster loading
      if (pathname.startsWith('/api/status/')) {
        if (await handleStatusRoutes(routeContext)) return;
      }

      // Navigation status routes (/api/nav-status) - Aggregated badge counts
      if (pathname === '/api/nav-status') {
        if (await handleNavStatusRoutes(routeContext)) return;
      }

      // Dashboard routes (/api/dashboard/*, /api/workflow-status-counts)
      if (pathname.startsWith('/api/dashboard/') || pathname === '/api/workflow-status-counts') {
        if (await handleDashboardRoutes(routeContext)) return;
      }

      // CLI sessions (PTY) routes (/api/cli-sessions/*) - independent from /api/cli/*
      if (pathname.startsWith('/api/cli-sessions')) {
        if (await handleCliSessionsRoutes(routeContext)) return;
      }

      // Audit routes (/api/audit/*)
      if (pathname.startsWith('/api/audit')) {
        if (await handleAuditRoutes(routeContext)) return;
      }

      // CLI routes (/api/cli/*)
      if (pathname.startsWith('/api/cli/')) {
        // CLI Settings routes first (more specific path /api/cli/settings/*)
        if (await handleCliSettingsRoutes(routeContext)) return;
        if (await handleCliRoutes(routeContext)) return;
      }

      // Provider routes (/api/providers/*)
      if (pathname.startsWith('/api/providers')) {
        if (await handleProviderRoutes(routeContext)) return;
      }

      // Claude CLAUDE.md routes (/api/memory/claude/*) and Language routes (/api/language/*)
      if (pathname.startsWith('/api/memory/claude/') || pathname.startsWith('/api/language/')) {
        if (await handleClaudeRoutes(routeContext)) return;
      }

      // Memory routes (/api/memory and /api/memory/*)
      if (pathname === '/api/memory' || pathname.startsWith('/api/memory/')) {
        if (await handleMemoryRoutes(routeContext)) return;
      }

      // Core Memory routes (/api/core-memory/*)
      if (pathname.startsWith('/api/core-memory/')) {
        if (await handleCoreMemoryRoutes(routeContext)) return;
      }


      // MCP routes (/api/mcp*, /api/codex-mcp*)
      if (pathname.startsWith('/api/mcp') || pathname.startsWith('/api/codex-mcp')) {
        if (await handleMcpRoutes(routeContext)) return;
      }

      // Hooks routes (/api/hooks, /api/hook)
      if (pathname.startsWith('/api/hook')) {
        if (await handleHooksRoutes(routeContext)) return;
      }

      // Background image upload/serve routes (/api/background/*)
      if (pathname.startsWith('/api/background/')) {
        if (await handleBackgroundRoutes(routeContext)) return;
      }

      // Unsplash proxy routes (/api/unsplash/*)
      if (pathname.startsWith('/api/unsplash/')) {
        if (await handleUnsplashRoutes(routeContext)) return;
      }

      // CodexLens routes (/api/codexlens/*)
      if (pathname.startsWith('/api/codexlens/')) {
        if (await handleCodexLensRoutes(routeContext)) return;
      }

      // LiteLLM routes (/api/litellm/*)
      if (pathname.startsWith('/api/litellm/')) {
        if (await handleLiteLLMRoutes(routeContext)) return;
      }

      // LiteLLM API routes (/api/litellm-api/*)
      if (pathname.startsWith('/api/litellm-api/')) {
        if (await handleLiteLLMApiRoutes(routeContext)) return;
      }

      // Graph routes (/api/graph/*)
      if (pathname.startsWith('/api/graph/')) {
        if (await handleGraphRoutes(routeContext)) return;
      }

      // CCW routes (/api/ccw and /api/ccw/*)
      if (pathname.startsWith('/api/ccw')) {
        if (await handleCcwRoutes(routeContext)) return;
      }

      // Orchestrator routes (/api/orchestrator/*)
      if (pathname.startsWith('/api/orchestrator/')) {
        if (await handleOrchestratorRoutes(routeContext)) return;
      }

      // Config routes (/api/config/*)
      if (pathname.startsWith('/api/config/')) {
        if (await handleConfigRoutes(routeContext)) return;
      }

      // Loop V2 routes (/api/loops/v2/*) - must be checked before v1
      if (pathname.startsWith('/api/loops/v2')) {
        if (await handleLoopV2Routes(routeContext)) return;
      }

      // Loop V1 routes (/api/loops/*) - backward compatibility
      if (pathname.startsWith('/api/loops')) {
        if (await handleLoopRoutes(routeContext)) return;
      }

      // Team routes (/api/teams*)
      if (pathname.startsWith('/api/teams')) {
        if (await handleTeamRoutes(routeContext)) return;
      }

      // Task routes (/api/tasks)
      if (pathname.startsWith('/api/tasks')) {
        if (await handleTaskRoutes(routeContext)) return;
      }

      // Test loop routes (/api/test/loop*)
      if (pathname.startsWith('/api/test/loop')) {
        if (await handleTestLoopRoutes(routeContext)) return;
      }

      // Skills routes (/api/skills*)
      if (pathname.startsWith('/api/skills')) {
        if (await handleSkillsRoutes(routeContext)) return;
      }

      // Commands routes (/api/commands*)
      if (pathname.startsWith('/api/commands')) {
        if (await handleCommandsRoutes(routeContext)) return;
      }

      // Queue routes (/api/queue*) - top-level queue API
      if (pathname.startsWith('/api/queue')) {
        if (await handleIssueRoutes(routeContext)) return;
      }

      // Issue routes (/api/issues*)
      if (pathname.startsWith('/api/issues')) {
        if (await handleIssueRoutes(routeContext)) return;
      }

      // Discovery routes (/api/discoveries*)
      if (pathname.startsWith('/api/discoveries')) {
        if (await handleDiscoveryRoutes(routeContext)) return;
      }

      // Rules routes (/api/rules*)
      if (pathname.startsWith('/api/rules')) {
        if (await handleRulesRoutes(routeContext)) return;
      }

      // Help routes (/api/help/*)
      if (pathname.startsWith('/api/help/')) {
        if (await handleHelpRoutes(routeContext)) return;
      }

      // Session routes (/api/session-detail, /api/update-task-status, /api/bulk-update-task-status)
      if (pathname.includes('session') || pathname.includes('task-status')) {
        if (await handleSessionRoutes(routeContext)) return;
      }

      // Files routes (/api/files, /api/file, /api/file-content, /api/update-claude-md)
      if (pathname === '/api/files' || pathname === '/api/file' ||
          pathname === '/api/file-content' || pathname === '/api/update-claude-md') {
        if (await handleFilesRoutes(routeContext)) return;
      }

      // System routes (data, health, version, paths, shutdown, notify, storage, dialog, a2ui answer broker)
      if (pathname === '/api/data' || pathname === '/api/health' ||
          pathname === '/api/version-check' || pathname === '/api/shutdown' ||
          pathname === '/api/recent-paths' || pathname === '/api/switch-path' ||
          pathname === '/api/remove-recent-path' || pathname === '/api/system/notify' ||
          pathname === '/api/a2ui/answer' ||
          pathname.startsWith('/api/storage/') || pathname.startsWith('/api/dialog/')) {
        if (await handleSystemRoutes(routeContext)) return;
      }

      // Handle favicon.ico (return empty response to prevent 404)
      if (pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Backward compatibility: redirect /react/* to /* (strip /react prefix)
      if (pathname === '/react' || pathname.startsWith('/react/')) {
        const newPath = pathname === '/react' ? '/' : pathname.slice('/react'.length);
        res.writeHead(301, { 'Location': `${newPath}${url.search}` });
        res.end();
        return;
      }

      // React frontend proxy - forward all non-API requests to Vite dev server
      {
        const reactUrl = `http://localhost:${reactPort}${pathname}${url.search}`;

        try {
          // Convert headers to plain object for fetch
          const proxyHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') {
              proxyHeaders[key] = value;
            } else if (Array.isArray(value)) {
              proxyHeaders[key] = value.join(', ');
            }
          }
          proxyHeaders['host'] = `localhost:${reactPort}`;

          const reactResponse = await fetch(reactUrl, {
            method: req.method,
            headers: proxyHeaders,
            body: req.method !== 'GET' && req.method !== 'HEAD' ? await readRequestBody(req) : undefined,
          });

          const contentType = reactResponse.headers.get('content-type') || 'text/html';
          const body = await reactResponse.text();

          res.writeHead(reactResponse.status, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache',
          });
          res.end(body);
          return;
        } catch (err) {
          console.error(`[React Proxy] Failed to proxy to ${reactUrl}:`, (err as Error).message);
          res.writeHead(502, { 'Content-Type': 'text/plain' });
          res.end(`Bad Gateway: React frontend not available at ${reactUrl}\nError: ${(err as Error).message}`);
          return;
        }
      }

    } catch (error: unknown) {
      console.error('Server error:', error);
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
  });

  // Handle WebSocket upgrade requests
  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/ws') {
      handleWebSocketUpgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(serverPort, host, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        serverPort = addr.port;
      }

      console.log(`Dashboard server running at http://${host}:${serverPort}`);
      console.log(`WebSocket endpoint available at ws://${host}:${serverPort}/ws`);
      console.log(`Hook endpoint available at POST http://${host}:${serverPort}/api/hook`);

      // Initialize CLI tools cache for Loop V2 routes
      initializeCliToolsCache();

      // Start periodic cleanup of stale CLI executions (every 2 minutes)
      const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;
      const cleanupInterval = setInterval(cleanupStaleExecutions, CLEANUP_INTERVAL_MS);
      server.on('close', () => {
        clearInterval(cleanupInterval);
        console.log('[Server] Stopped CLI execution cleanup interval');
      });

      // Start health check service for all enabled providers
      try {
        const healthCheckService = getHealthCheckService();
        healthCheckService.startAllHealthChecks(initialPath);

        // Graceful shutdown: stop health checks when server closes
        server.on('close', () => {
          console.log('[Server] Shutting down health check service...');
          healthCheckService.stopAllHealthChecks();
        });
      } catch (err) {
        console.warn('[Server] Failed to start health check service:', err);
      }

      // Start cache warmup asynchronously (non-blocking)
      // Uses setImmediate to not delay server startup response
      const warmupDisabled = ['1', 'true', 'yes'].includes(
        (process.env.CCW_DISABLE_WARMUP ?? '').trim().toLowerCase(),
      );
      if (!warmupDisabled) {
        setImmediate(() => {
          warmupCaches(initialPath).catch((err) => {
            console.warn('[WARMUP] Cache warmup failed:', err);
          });
        });
      }

      resolve(server);
    });
    server.on('error', reject);
  });
}
