import { describe, expect, it, vi } from 'vitest';
import {
  fetchMcpServers,
  toggleMcpServer,
  deleteMcpServer,
  createMcpServer,
  updateMcpServer,
  fetchCodexMcpServers,
  crossCliCopy,
  fetchAllProjects,
  fetchOtherProjectsServers,
  type McpServer,
} from './api';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function getLastFetchCall(fetchMock: any) {
  const calls = fetchMock.mock.calls;
  return calls[calls.length - 1] as [RequestInfo | URL, RequestInit | undefined];
}

describe('MCP API (frontend ↔ backend contract)', () => {
  it('fetchMcpServers derives lists from /api/mcp-config and computes enabled from disabledMcpServers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        projects: {
          'D:/ws': {
            mcpServers: {
              projOnly: { command: 'node', args: ['x'], env: { A: '1' } },
              globalDup: { command: 'should-not-appear-in-project' },
              entDup: { command: 'should-not-appear-in-project' },
            },
            disabledMcpServers: ['global1'],
          },
        },
        userServers: {
          global1: { command: 'npx', args: ['-y', 'foo'] },
          globalDup: { command: 'npx', args: ['-y', 'bar'] },
        },
        enterpriseServers: {
          entDup: { command: 'enterprise-tool' },
        },
        globalServers: {},
        configSources: [],
      })
    );

    const result = await fetchMcpServers('D:\\ws');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/mcp-config');

    expect(result.global.map((s) => s.name).sort()).toEqual(['global1', 'globalDup']);
    expect(result.project.map((s) => s.name)).toEqual(['projOnly']);

    const global1 = result.global.find((s) => s.name === 'global1');
    expect(global1?.enabled).toBe(false);
    expect(global1?.scope).toBe('global');

    const projOnly = result.project[0];
    expect(projOnly?.command).toBe('node');
    expect(projOnly?.enabled).toBe(true);
    expect(projOnly?.scope).toBe('project');
    expect(projOnly?.env).toEqual({ A: '1' });
    expect(projOnly?.args).toEqual(['x']);
  });

  it('toggleMcpServer uses /api/mcp-toggle with { projectPath, serverName, enable }', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, _init) => {
        if (input === '/api/mcp-toggle') {
          return jsonResponse({ success: true, serverName: 'global1', enabled: false });
        }
        if (input === '/api/mcp-config') {
          return jsonResponse({
            projects: {
              'D:/ws': { mcpServers: {}, disabledMcpServers: ['global1'] },
            },
            userServers: {
              global1: { command: 'npx', args: ['-y', 'foo'] },
            },
            enterpriseServers: {},
            globalServers: {},
            configSources: [],
          });
        }
        throw new Error(`Unexpected fetch: ${String(input)}`);
      });

    const updated = await toggleMcpServer('global1', false, { projectPath: 'D:/ws' });

    const toggleCall = fetchMock.mock.calls.find((c) => c[0] === '/api/mcp-toggle');
    expect(toggleCall).toBeTruthy();
    const [, init] = toggleCall!;
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ projectPath: 'D:/ws', serverName: 'global1', enable: false });

    expect(updated.enabled).toBe(false);
    expect(updated.name).toBe('global1');
  });

  it('deleteMcpServer calls the correct backend endpoint for project/global scopes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (input === '/api/mcp-remove-global-server') {
        return jsonResponse({ success: true });
      }
      if (input === '/api/mcp-remove-server') {
        return jsonResponse({ success: true });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    await deleteMcpServer('g1', 'global');
    expect(getLastFetchCall(fetchMock)[0]).toBe('/api/mcp-remove-global-server');

    await deleteMcpServer('p1', 'project', { projectPath: 'D:/ws' });
    expect(getLastFetchCall(fetchMock)[0]).toBe('/api/mcp-remove-server');
  });

  it('createMcpServer (project) uses /api/mcp-copy-server and includes serverName + serverConfig', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        if (input === '/api/mcp-copy-server') {
          return jsonResponse({ success: true });
        }
        if (input === '/api/mcp-config') {
          return jsonResponse({
            projects: {
              'D:/ws': {
                mcpServers: { s1: { command: 'node', args: ['a'], env: { K: 'V' } } },
                disabledMcpServers: [],
              },
            },
            userServers: {},
            enterpriseServers: {},
            globalServers: {},
            configSources: [],
          });
        }
        throw new Error(`Unexpected fetch: ${String(input)}`);
      });

    const inputServer: McpServer = {
      name: 's1',
      command: 'node',
      args: ['a'],
      env: { K: 'V' },
      enabled: true,
      scope: 'project',
    };

    const created = await createMcpServer(inputServer, { projectPath: 'D:/ws', configType: 'mcp' });

    const copyCall = fetchMock.mock.calls.find((c) => c[0] === '/api/mcp-copy-server');
    expect(copyCall).toBeTruthy();
    const [, init] = copyCall!;
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      projectPath: 'D:/ws',
      serverName: 's1',
      serverConfig: { command: 'node', args: ['a'], env: { K: 'V' } },
      configType: 'mcp',
    });

    expect(created.name).toBe('s1');
    expect(created.scope).toBe('project');
    expect(created.enabled).toBe(true);
  });

  it('updateMcpServer (global) upserts via /api/mcp-add-global-server', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (input === '/api/mcp-add-global-server') {
        return jsonResponse({ success: true });
      }
      return jsonResponse({
        projects: {},
        userServers: { g1: { command: 'npx' } },
        enterpriseServers: {},
        globalServers: {},
        configSources: [],
      });
    });

    const updated = await updateMcpServer(
      'g1',
      { scope: 'global', command: 'npx', args: ['-y', 'x'], env: { A: '1' }, enabled: true },
      { projectPath: 'D:/ws' }
    );

    const addCall = fetchMock.mock.calls.find((c) => c[0] === '/api/mcp-add-global-server');
    expect(addCall).toBeTruthy();
    const [, init] = addCall!;
    expect(JSON.parse(String(init?.body))).toEqual({
      serverName: 'g1',
      serverConfig: { command: 'npx', args: ['-y', 'x'], env: { A: '1' } },
    });

    expect(updated.name).toBe('g1');
  });

  it('fetchCodexMcpServers maps /api/codex-mcp-config servers record into array', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        servers: {
          s1: { command: 'node', args: ['a'], env: { K: 'V' }, enabled: true },
          s2: { command: 'python', enabled: false },
        },
        configPath: 'C:/Users/me/.codex/config.toml',
        exists: true,
      })
    );

    const result = await fetchCodexMcpServers();
    expect(fetchMock).toHaveBeenCalledWith('/api/codex-mcp-config', expect.anything());
    expect(result.configPath).toContain('config.toml');

    const s2 = result.servers.find((s) => s.name === 's2');
    expect(s2?.enabled).toBe(false);
  });

  it('crossCliCopy codex->claude copies via /api/mcp-copy-server per server', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (input === '/api/codex-mcp-config') {
        return jsonResponse({ servers: { s1: { command: 'node' } }, configPath: 'x', exists: true });
      }
      if (input === '/api/mcp-copy-server') {
        return jsonResponse({ success: true });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    const res = await crossCliCopy({
      source: 'codex',
      target: 'claude',
      serverNames: ['s1'],
      projectPath: 'D:/ws',
    });

    expect(res.success).toBe(true);
    expect(res.copied).toEqual(['s1']);
    expect(res.failed).toEqual([]);

    const copyCall = fetchMock.mock.calls.find((c) => c[0] === '/api/mcp-copy-server');
    expect(copyCall).toBeTruthy();
  });

  it('fetchAllProjects derives project list from /api/mcp-config (no /api/projects/all)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        projects: { 'D:/a': { mcpServers: {} }, 'D:/b': { mcpServers: {} } },
        userServers: {},
        enterpriseServers: {},
        globalServers: {},
        configSources: [],
      })
    );

    const res = await fetchAllProjects();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/mcp-config');
    expect(res.projects).toEqual(['D:/a', 'D:/b']);
  });

  it('fetchOtherProjectsServers derives per-project servers from /api/mcp-config', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        projects: {
          'D:/a': {
            mcpServers: { p1: { command: 'node' } },
            disabledMcpServers: ['p1'],
          },
        },
        userServers: { g1: { command: 'npx' } },
        enterpriseServers: {},
        globalServers: {},
        configSources: [],
      })
    );

    const res = await fetchOtherProjectsServers(['D:/a']);
    expect(Object.keys(res.servers)).toEqual(['D:/a']);
    expect(res.servers['D:/a']?.[0]?.name).toBe('p1');
    expect(res.servers['D:/a']?.[0]?.enabled).toBe(false);
  });
});

