/**
 * Integration tests for audit routes.
 *
 * Targets runtime implementation shipped in `ccw/dist`.
 */

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const auditRoutesUrl = new URL('../dist/core/routes/audit-routes.js', import.meta.url);
auditRoutesUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod;

async function requestJson(baseUrl, method, path) {
  const url = new URL(path, baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      { method, headers: { Accept: 'application/json' } },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk.toString();
        });
        res.on('end', () => {
          let json = null;
          try {
            json = responseBody ? JSON.parse(responseBody) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode || 0, json, text: responseBody });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('audit routes integration', async () => {
  let server = null;
  let baseUrl = '';
  let projectRoot = '';

  before(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'ccw-audit-routes-project-'));

    mod = await import(auditRoutesUrl.href);

    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const pathname = url.pathname;

      const ctx = {
        pathname,
        url,
        req,
        res,
        initialPath: projectRoot,
        handlePostRequest() {},
        broadcastToClients() {},
      };

      try {
        const handled = await mod.handleAuditRoutes(ctx);
        if (!handled) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not Found' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
    });

    await new Promise((resolve) => server.listen(0, () => resolve()));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(() => {
    if (server) server.close();
    if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns empty list when audit file is missing', async () => {
    const r = await requestJson(baseUrl, 'GET', `/api/audit/cli-sessions?path=${encodeURIComponent(projectRoot)}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.success, true);
    assert.deepEqual(r.json.data.events, []);
    assert.equal(r.json.data.total, 0);
  });

  it('lists events newest-first and supports filters', async () => {
    const auditDir = join(projectRoot, '.workflow', 'audit');
    mkdirSync(auditDir, { recursive: true });
    const filePath = join(auditDir, 'cli-sessions.jsonl');

    const ev1 = {
      type: 'session_created',
      timestamp: '2026-02-09T00:00:00.000Z',
      projectRoot,
      sessionKey: 's-1',
      tool: 'claude',
      resumeKey: 'ISSUE-1',
      details: { a: 1 },
    };
    const ev2 = {
      type: 'session_execute',
      timestamp: '2026-02-09T00:00:01.000Z',
      projectRoot,
      sessionKey: 's-1',
      tool: 'claude',
      resumeKey: 'ISSUE-1',
      details: { q: 'hello' },
    };
    const ev3 = {
      type: 'session_send',
      timestamp: '2026-02-09T00:00:02.000Z',
      projectRoot,
      sessionKey: 's-2',
      tool: 'codex',
      resumeKey: 'ISSUE-2',
      details: { bytes: 10 },
    };

    writeFileSync(filePath, [ev1, ev2, ev3].map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');

    const all = await requestJson(baseUrl, 'GET', `/api/audit/cli-sessions?path=${encodeURIComponent(projectRoot)}&limit=10&offset=0`);
    assert.equal(all.status, 200);
    assert.equal(all.json.success, true);
    assert.equal(all.json.data.total, 3);
    // Newest-first
    assert.equal(all.json.data.events[0].type, 'session_send');
    assert.equal(all.json.data.events[0].sessionKey, 's-2');

    const bySession = await requestJson(baseUrl, 'GET', `/api/audit/cli-sessions?path=${encodeURIComponent(projectRoot)}&sessionKey=s-1`);
    assert.equal(bySession.json.data.total, 2);
    assert.equal(bySession.json.data.events[0].type, 'session_execute');

    const byType = await requestJson(baseUrl, 'GET', `/api/audit/cli-sessions?path=${encodeURIComponent(projectRoot)}&type=session_created`);
    assert.equal(byType.json.data.total, 1);
    assert.equal(byType.json.data.events[0].type, 'session_created');

    const bySearch = await requestJson(baseUrl, 'GET', `/api/audit/cli-sessions?path=${encodeURIComponent(projectRoot)}&q=hello`);
    assert.equal(bySearch.json.data.total, 1);
    assert.equal(bySearch.json.data.events[0].type, 'session_execute');
  });
});
