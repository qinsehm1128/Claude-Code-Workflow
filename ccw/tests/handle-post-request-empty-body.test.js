/**
 * Regression test: handlePostRequest should tolerate empty request bodies.
 *
 * Background:
 * - Several endpoints use POST with no JSON payload (e.g. "install"/"uninstall" actions).
 * - The server's handlePostRequest previously called JSON.parse(''), throwing:
 *   "Unexpected end of JSON input".
 *
 * This test exercises a safe no-body endpoint:
 *   POST /api/mcp/apply-windows-fix
 */

import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function httpRequest(options, body, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({
        status: res.statusCode || 0,
        body: data,
        headers: res.headers,
      }));
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

const ORIGINAL_ENV = { ...process.env };
const serverUrl = new URL('../dist/core/server.js', import.meta.url);
serverUrl.searchParams.set('t', String(Date.now()));

describe('handlePostRequest (empty body)', async () => {
  let server;
  let port;
  let projectRoot;
  let ccwHome;

  before(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'ccw-empty-body-project-'));
    ccwHome = mkdtempSync(join(tmpdir(), 'ccw-empty-body-home-'));
    process.env = { ...ORIGINAL_ENV, CCW_DATA_DIR: ccwHome };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serverMod = await import(serverUrl.href);

    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});

    server = await serverMod.startServer({ initialPath: projectRoot, port: 0 });
    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
    assert.ok(port > 0, 'Server should start on a valid port');
  });

  after(async () => {
    await new Promise((resolve) => server.close(() => resolve()));
    mock.restoreAll();
    process.env = ORIGINAL_ENV;
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(ccwHome, { recursive: true, force: true });
  });

  it('accepts POST routes with no body', async () => {
    const tokenRes = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/auth/token',
      method: 'GET',
    });

    assert.equal(tokenRes.status, 200);
    const { token } = JSON.parse(tokenRes.body);
    assert.ok(typeof token === 'string' && token.length > 0);

    const response = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/mcp/apply-windows-fix',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Make it explicit: empty body
        'Content-Length': '0',
      },
    });

    assert.equal(response.status, 200);
    assert.doesNotMatch(response.body, /Unexpected end of JSON input/);

    const payload = JSON.parse(response.body);
    assert.equal(payload.success, false);
    assert.equal(
      payload.message,
      'Auto-fix is not supported. Please install missing commands manually.',
    );
  });
});

