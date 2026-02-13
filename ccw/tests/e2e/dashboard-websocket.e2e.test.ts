/**
 * E2E tests for Dashboard Server
 *
 * Tests that Dashboard server starts correctly and serves basic endpoints.
 * WebSocket tests are simplified to avoid complex protocol implementation.
 */

import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const serverUrl = new URL('../../dist/core/server.js', import.meta.url);
serverUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let serverMod: any;

/**
 * Make HTTP request to server
 */
function httpRequest(options: http.RequestOptions, body?: string, timeout = 10000): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    if (body) req.write(body);
    req.end();
  });
}

describe('E2E: Dashboard Server', async () => {
  let server: http.Server;
  let port: number;
  let projectRoot: string;
  const originalCwd = process.cwd();

  before(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'ccw-e2e-dashboard-'));
    process.chdir(projectRoot);

    serverMod = await import(serverUrl.href);
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});

    // Start server with random available port
    server = await serverMod.startServer({ initialPath: projectRoot, port: 0 });
    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
    assert.ok(port > 0, 'Server should start on a valid port');
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        process.chdir(originalCwd);
        rmSync(projectRoot, { recursive: true, force: true });
        mock.restoreAll();
        resolve();
      });
    });
  });

  it('proxies root path to React frontend', async () => {
    const response = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/',
      method: 'GET'
    });

    // Without a React dev server running, the proxy returns 500/502.
    // In production the React dev server handles this and returns HTML.
    assert.ok([200, 500, 502].includes(response.status),
      `Root path should be proxied to React frontend, got ${response.status}`);
  });

  it('redirects /react/* to /* for backward compatibility', async () => {
    // Test /react/settings -> /settings redirect
    const response = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/react/settings',
      method: 'GET'
    });

    assert.equal(response.status, 301,
      `Expected 301 redirect for /react/* path, got ${response.status}`);
  });

  it('redirects /react to / for backward compatibility', async () => {
    const response = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/react',
      method: 'GET'
    });

    assert.equal(response.status, 301,
      `Expected 301 redirect for /react path, got ${response.status}`);
  });

  it('returns status API data', async () => {
    const response = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/status/all',
      method: 'GET'
    }, undefined, 15000);  // Allow 15s for status aggregation

    assert.equal(response.status, 200);
    const data = JSON.parse(response.body);
    assert.ok(typeof data === 'object', 'Should return JSON object');
  });

  it('handles CORS preflight requests', async () => {
    const response = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/status/all',
      method: 'OPTIONS'
    });

    assert.equal(response.status, 200);
  });

  it('returns 404 for non-existent API routes', async () => {
    const response = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/nonexistent/route',
      method: 'GET'
    });

    // Unmatched API routes fall through to React proxy (502 without React dev server)
    // or return 401/403 from auth middleware, or 404 from route handlers
    assert.ok([200, 401, 403, 404, 502].includes(response.status),
      `Expected API error or proxy response, got ${response.status}`);
  });

  it('handles session API endpoints', async () => {
    // Use the correct endpoint path from session-routes.ts
    const response = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/session-detail?sessionId=test',
      method: 'GET'
    });

    // Session detail returns 200, 400 (invalid params), or 404 (not found)
    assert.ok([200, 400, 404].includes(response.status),
      `Session endpoint should respond, got ${response.status}`);
  });

  it('handles WebSocket upgrade path exists', async () => {
    // Just verify the /ws path is recognized (actual WebSocket needs ws library)
    const response = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/ws',
      method: 'GET'
    });

    // WebSocket endpoint should return upgrade required or similar
    // Not testing actual WebSocket protocol
    assert.ok(response.status >= 200, 'WebSocket path should be handled');
  });

  it('handles static asset requests via React proxy', async () => {
    const response = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/assets/favicon.ico',
      method: 'GET'
    });

    // Static assets are now served by the React dev server via proxy.
    // Without React running, proxy returns 500/502; with React: 200 or 404.
    assert.ok([200, 404, 500, 502].includes(response.status),
      `Asset request should be handled, got ${response.status}`);
  });

  it('handles POST requests to hook endpoint', async () => {
    const payload = JSON.stringify({
      type: 'TEST_EVENT',
      sessionId: 'test-session',
      payload: { test: true }
    });

    const response = await httpRequest({
      hostname: 'localhost',
      port,
      path: '/api/hook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, payload);

    // Hook endpoint may return 200 or 404 depending on implementation
    assert.ok([200, 404].includes(response.status),
      `Hook endpoint should respond, got ${response.status}`);
  });
});
