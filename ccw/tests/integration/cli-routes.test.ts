/**
 * Integration tests for CLI routes.
 *
 * Notes:
 * - Targets runtime implementation shipped in `ccw/dist`.
 * - Uses a temporary CCW data directory (CCW_DATA_DIR) to isolate config writes.
 */

import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-cli-routes-home-'));
const PROJECT_ROOT = mkdtempSync(join(tmpdir(), 'ccw-cli-routes-project-'));

const cliRoutesUrl = new URL('../../dist/core/routes/cli-routes.js', import.meta.url);
cliRoutesUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

const originalEnv = { CCW_DATA_DIR: process.env.CCW_DATA_DIR };

type JsonResponse = { status: number; json: any; text: string };

async function requestJson(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<JsonResponse> {
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
          let json: any = null;
          try {
            json = responseBody ? JSON.parse(responseBody) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode || 0, json, text: responseBody });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function handlePostRequest(req: http.IncomingMessage, res: http.ServerResponse, handler: (body: unknown) => Promise<any>): void {
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
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err?.message || String(err) }));
    }
  });
}

async function createServer(initialPath: string, broadcasts: any[]): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;

    const ctx = {
      pathname,
      url,
      req,
      res,
      initialPath,
      handlePostRequest,
      broadcastToClients(data: unknown) {
        broadcasts.push(data);
      },
    };

    try {
      const handled = await mod.handleCliRoutes(ctx);
      if (!handled) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
      }
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err?.message || String(err) }));
    }
  });

  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

describe('cli routes integration', async () => {
  before(async () => {
    process.env.CCW_DATA_DIR = CCW_HOME;
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    mod = await import(cliRoutesUrl.href);
  });

  after(async () => {
    try {
      // Close cached sqlite stores to avoid Windows EBUSY when cleaning temp dirs.
      const historyStoreUrl = new URL('../../dist/tools/cli-history-store.js', import.meta.url);
      const historyStoreMod: any = await import(historyStoreUrl.href);
      historyStoreMod?.closeAllStores?.();
    } catch {
      // ignore
    }
    mock.restoreAll();
    process.env.CCW_DATA_DIR = originalEnv.CCW_DATA_DIR;
    rmSync(CCW_HOME, { recursive: true, force: true });
    rmSync(PROJECT_ROOT, { recursive: true, force: true });
  });

  it('GET /api/cli/status returns status object', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(PROJECT_ROOT, broadcasts);
    try {
      const res = await requestJson(baseUrl, 'GET', '/api/cli/status');
      assert.equal(res.status, 200);
      assert.equal(typeof res.json, 'object');
      assert.equal(Array.isArray(broadcasts), true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/cli/history returns an array (empty when no history exists)', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(PROJECT_ROOT, broadcasts);
    try {
      const res = await requestJson(baseUrl, 'GET', `/api/cli/history?path=${encodeURIComponent(PROJECT_ROOT)}&limit=5`);
      assert.equal(res.status, 200);
      assert.equal(typeof res.json, 'object');
      assert.equal(typeof res.json.total, 'number');
      assert.equal(typeof res.json.count, 'number');
      assert.equal(Array.isArray(res.json.executions), true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/cli/execution validates required id and returns 404 when missing', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(PROJECT_ROOT, broadcasts);
    try {
      const missing = await requestJson(baseUrl, 'GET', '/api/cli/execution');
      assert.equal(missing.status, 400);
      assert.ok(String(missing.json.error).includes('Execution ID is required'));

      const notFound = await requestJson(
        baseUrl,
        'GET',
        `/api/cli/execution?path=${encodeURIComponent(PROJECT_ROOT)}&id=NOPE`,
      );
      assert.equal(notFound.status, 404);
      assert.ok(String(notFound.json.error).includes('Conversation not found'));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/cli/execution prefers newer saved conversation over stale active running state', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(PROJECT_ROOT, broadcasts);
    const historyStoreUrl = new URL('../../dist/tools/cli-history-store.js', import.meta.url);
    const historyStoreMod: any = await import(historyStoreUrl.href);
    const executionId = `EXEC-STALE-DETAIL-${Date.now()}`;
    const now = 1_741_392_000_000;

    try {
      const store = new historyStoreMod.CliHistoryStore(PROJECT_ROOT);
      store.saveConversation({
        id: executionId,
        created_at: new Date(now - 10_000).toISOString(),
        updated_at: new Date(now - 5_000).toISOString(),
        tool: 'codex',
        model: 'default',
        mode: 'analysis',
        category: 'user',
        total_duration_ms: 2300,
        turn_count: 1,
        latest_status: 'success',
        turns: [{
          turn: 1,
          timestamp: new Date(now - 5_000).toISOString(),
          prompt: 'SAVED DETAIL SHOULD WIN',
          duration_ms: 2300,
          status: 'success',
          exit_code: 0,
          output: {
            stdout: 'saved output',
            stderr: '',
            truncated: false,
            cached: false,
          }
        }]
      });
      store.close();

      mock.method(Date, 'now', () => now - 60_000);
      mod.updateActiveExecution({
        type: 'started',
        executionId,
        tool: 'codex',
        mode: 'analysis',
        prompt: 'STALE ACTIVE DETAIL'
      });
      mock.restoreAll();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});

      const res = await requestJson(
        baseUrl,
        'GET',
        `/api/cli/execution?path=${encodeURIComponent(PROJECT_ROOT)}&id=${encodeURIComponent(executionId)}`,
      );

      assert.equal(res.status, 200);
      assert.equal(res.json?._active, undefined);
      assert.equal(res.json?.turns?.[0]?.prompt, 'SAVED DETAIL SHOULD WIN');
      assert.equal(res.json?.latest_status, 'success');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/cli/active filters stale running state when saved conversation is newer', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(PROJECT_ROOT, broadcasts);
    const historyStoreUrl = new URL('../../dist/tools/cli-history-store.js', import.meta.url);
    const historyStoreMod: any = await import(historyStoreUrl.href);
    const executionId = `EXEC-STALE-ACTIVE-${Date.now()}`;
    const now = 1_741_392_500_000;

    try {
      const store = new historyStoreMod.CliHistoryStore(PROJECT_ROOT);
      store.saveConversation({
        id: executionId,
        created_at: new Date(now - 12_000).toISOString(),
        updated_at: new Date(now - 4_000).toISOString(),
        tool: 'codex',
        model: 'default',
        mode: 'analysis',
        category: 'user',
        total_duration_ms: 3200,
        turn_count: 1,
        latest_status: 'success',
        turns: [{
          turn: 1,
          timestamp: new Date(now - 4_000).toISOString(),
          prompt: 'SAVED ACTIVE SHOULD WIN',
          duration_ms: 3200,
          status: 'success',
          exit_code: 0,
          output: {
            stdout: 'saved output',
            stderr: '',
            truncated: false,
            cached: false,
          }
        }]
      });
      store.close();

      mock.method(Date, 'now', () => now - 60_000);
      mod.updateActiveExecution({
        type: 'started',
        executionId,
        tool: 'codex',
        mode: 'analysis',
        prompt: 'STALE ACTIVE SHOULD DISAPPEAR'
      });
      mock.restoreAll();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});

      const res = await requestJson(
        baseUrl,
        'GET',
        `/api/cli/active?path=${encodeURIComponent(PROJECT_ROOT)}`,
      );

      assert.equal(res.status, 200);
      assert.equal(Array.isArray(res.json?.executions), true);
      assert.equal(res.json.executions.some((exec: any) => exec.id === executionId), false);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/cli/active keeps running state when saved conversation is older', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(PROJECT_ROOT, broadcasts);
    const historyStoreUrl = new URL('../../dist/tools/cli-history-store.js', import.meta.url);
    const historyStoreMod: any = await import(historyStoreUrl.href);
    const executionId = `EXEC-ACTIVE-RESUME-${Date.now()}`;
    const now = 1_741_393_000_000;

    try {
      const store = new historyStoreMod.CliHistoryStore(PROJECT_ROOT);
      store.saveConversation({
        id: executionId,
        created_at: new Date(now - 120_000).toISOString(),
        updated_at: new Date(now - 110_000).toISOString(),
        tool: 'codex',
        model: 'default',
        mode: 'analysis',
        category: 'user',
        total_duration_ms: 1200,
        turn_count: 1,
        latest_status: 'success',
        turns: [{
          turn: 1,
          timestamp: new Date(now - 110_000).toISOString(),
          prompt: 'OLDER SAVED TURN',
          duration_ms: 1200,
          status: 'success',
          exit_code: 0,
          output: {
            stdout: 'older output',
            stderr: '',
            truncated: false,
            cached: false,
          }
        }]
      });
      store.close();

      mock.method(Date, 'now', () => now - 20_000);
      mod.updateActiveExecution({
        type: 'started',
        executionId,
        tool: 'codex',
        mode: 'analysis',
        prompt: 'NEWER ACTIVE SHOULD STAY'
      });
      mock.restoreAll();
      mock.method(console, 'log', () => {});
      mock.method(console, 'error', () => {});

      const res = await requestJson(
        baseUrl,
        'GET',
        `/api/cli/active?path=${encodeURIComponent(PROJECT_ROOT)}`,
      );

      assert.equal(res.status, 200);
      assert.equal(Array.isArray(res.json?.executions), true);
      const activeExecution = res.json.executions.find((exec: any) => exec.id === executionId);
      assert.ok(activeExecution);
      assert.equal(activeExecution.status, 'running');
      assert.equal(activeExecution.prompt, 'NEWER ACTIVE SHOULD STAY');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('PUT /api/cli/config/gemini updates config and broadcasts event', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(PROJECT_ROOT, broadcasts);
    try {
      const res = await requestJson(baseUrl, 'PUT', '/api/cli/config/gemini', {
        enabled: true,
        primaryModel: 'test-model',
      });
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);
      assert.ok(res.json.config);

      assert.ok(broadcasts.some((b) => (b as any)?.type === 'CLI_CONFIG_UPDATED'));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
