/**
 * Integration tests for orchestrator execution wiring.
 *
 * Verifies that POST /api/orchestrator/flows/:id/execute triggers the FlowExecutor
 * and persists a completed execution for an empty flow (no nodes).
 */

import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const orchestratorRoutesUrl = new URL('../dist/core/routes/orchestrator-routes.js', import.meta.url);
orchestratorRoutesUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod;

async function requestJson(baseUrl, method, path, body) {
  const url = new URL(path, baseUrl);
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body), 'utf8');

  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': String(payload.length) }
            : {}),
        },
      },
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
    if (payload) req.write(payload);
    req.end();
  });
}

function handlePostRequest(req, res, handler) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const parsed = body ? JSON.parse(body) : {};
      const result = await handler(parsed);

      if (result?.error) {
        res.writeHead(result.status || 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.error }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  });
}

describe('orchestrator execution integration', async () => {
  let server = null;
  let baseUrl = '';
  let projectRoot = '';

  before(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'ccw-orchestrator-project-'));

    // Reduce noise from executor internals during tests
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});

    mod = await import(orchestratorRoutesUrl.href);

    // Seed a minimal empty flow (no nodes)
    const flowsDir = join(projectRoot, '.workflow', '.orchestrator', 'flows');
    mkdirSync(flowsDir, { recursive: true });
    const flowId = 'flow-test-empty';
    const now = new Date().toISOString();
    writeFileSync(
      join(flowsDir, `${flowId}.json`),
      JSON.stringify({
        id: flowId,
        name: 'Empty Flow',
        description: '',
        version: '1.0.0',
        created_at: now,
        updated_at: now,
        nodes: [],
        edges: [],
        variables: {},
        metadata: { source: 'local' },
      }, null, 2),
      'utf8'
    );

    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const pathname = url.pathname;

      const ctx = {
        pathname,
        url,
        req,
        res,
        initialPath: projectRoot,
        handlePostRequest,
        broadcastToClients() {},
      };

      try {
        const handled = await mod.handleOrchestratorRoutes(ctx);
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

  it('executes an empty flow to completion', async () => {
    const start = await requestJson(baseUrl, 'POST', '/api/orchestrator/flows/flow-test-empty/execute', {});
    assert.equal(start.status, 200);
    assert.equal(start.json.success, true);
    assert.ok(start.json.data.execId);

    const execId = start.json.data.execId;

    // Poll until completed (should be very fast for empty flow)
    let state = null;
    for (let i = 0; i < 50; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 20));
      // eslint-disable-next-line no-await-in-loop
      const r = await requestJson(baseUrl, 'GET', `/api/orchestrator/executions/${encodeURIComponent(execId)}`);
      if (r.status === 200 && r.json?.success) {
        state = r.json.data;
        if (state.status === 'completed') break;
      }
    }

    assert.ok(state, 'expected execution state to be readable');
    assert.equal(state.status, 'completed');
    assert.ok(state.startedAt);
    assert.ok(state.completedAt);
  });
});

