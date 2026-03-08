// ========================================
// useActiveCliExecutions Hook Tests
// ========================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import * as api from '@/lib/api';
import { useActiveCliExecutions } from './useActiveCliExecutions';

const mockProjectState = vi.hoisted(() => ({
  projectPath: '/test/project',
}));

const mockStoreState = vi.hoisted(() => ({
  executions: {} as Record<string, any>,
  cleanupUserClosedExecutions: vi.fn(),
  isExecutionClosedByUser: vi.fn(() => false),
  removeExecution: vi.fn(),
  upsertExecution: vi.fn(),
  setCurrentExecution: vi.fn(),
}));

const mockUseCliStreamStore = vi.hoisted(() => {
  const store = vi.fn();
  Object.assign(store, {
    getState: vi.fn(() => mockStoreState),
  });
  return store;
});

vi.mock('@/stores/cliStreamStore', () => ({
  useCliStreamStore: mockUseCliStreamStore,
}));

vi.mock('@/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn((selector?: (state: { projectPath: string }) => unknown) => (
    selector
      ? selector({ projectPath: mockProjectState.projectPath })
      : { projectPath: mockProjectState.projectPath }
  )),
  selectProjectPath: (state: { projectPath: string }) => state.projectPath,
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    fetchExecutionDetail: vi.fn(),
  };
});

const fetchMock = vi.fn();

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function createActiveResponse(executions: Array<Record<string, unknown>>) {
  return {
    ok: true,
    statusText: 'OK',
    json: vi.fn().mockResolvedValue({ executions }),
  };
}

describe('useActiveCliExecutions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);

    mockProjectState.projectPath = '/test/project';
    mockStoreState.executions = {};
    mockStoreState.cleanupUserClosedExecutions.mockReset();
    mockStoreState.isExecutionClosedByUser.mockReset();
    mockStoreState.isExecutionClosedByUser.mockReturnValue(false);
    mockStoreState.removeExecution.mockReset();
    mockStoreState.upsertExecution.mockReset();
    mockStoreState.setCurrentExecution.mockReset();
    (mockUseCliStreamStore as any).getState.mockReset();
    (mockUseCliStreamStore as any).getState.mockImplementation(() => mockStoreState);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests active executions with scoped project path', async () => {
    fetchMock.mockResolvedValue(createActiveResponse([]));

    const { result } = renderHook(() => useActiveCliExecutions(true, 60_000), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/cli/active?path=%2Ftest%2Fproject');
  });

  it('filters stale recovered running executions when saved detail is newer', async () => {
    const startTime = 1_741_392_000_000;
    mockStoreState.executions = {
      'exec-stale': {
        tool: 'codex',
        mode: 'analysis',
        status: 'running',
        output: [],
        startTime,
        recovered: true,
      },
    };

    fetchMock.mockResolvedValue(createActiveResponse([
      {
        id: 'exec-stale',
        tool: 'codex',
        mode: 'analysis',
        status: 'running',
        output: '[响应] stale output',
        startTime,
      },
    ]));

    vi.mocked(api.fetchExecutionDetail).mockResolvedValue({
      id: 'exec-stale',
      tool: 'codex',
      mode: 'analysis',
      turns: [],
      turn_count: 1,
      created_at: new Date(startTime - 2_000).toISOString(),
      updated_at: new Date(startTime + 2_000).toISOString(),
    } as any);

    const { result } = renderHook(() => useActiveCliExecutions(true, 60_000), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });

    expect(api.fetchExecutionDetail).toHaveBeenCalledWith('exec-stale', '/test/project');
    expect(mockStoreState.removeExecution).toHaveBeenCalledWith('exec-stale');
    expect(mockStoreState.upsertExecution).not.toHaveBeenCalled();
  });

  it('removes recovered running executions that are absent from the current workspace active list', async () => {
    mockStoreState.executions = {
      'exec-old-workspace': {
        tool: 'codex',
        mode: 'analysis',
        status: 'running',
        output: [],
        startTime: 1_741_394_000_000,
        recovered: true,
      },
    };

    fetchMock.mockResolvedValue(createActiveResponse([]));

    const { result } = renderHook(() => useActiveCliExecutions(true, 60_000), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });

    expect(mockStoreState.removeExecution).toHaveBeenCalledWith('exec-old-workspace');
    expect(api.fetchExecutionDetail).not.toHaveBeenCalled();
  });

  it('reselects the best remaining execution when current selection becomes invalid', async () => {
    mockStoreState.executions = {
      'exec-running': {
        tool: 'codex',
        mode: 'analysis',
        status: 'running',
        output: [],
        startTime: 1_741_395_000_000,
        recovered: false,
      },
      'exec-completed': {
        tool: 'codex',
        mode: 'analysis',
        status: 'completed',
        output: [],
        startTime: 1_741_394_000_000,
        recovered: false,
      },
    };

    (mockUseCliStreamStore as any).getState.mockImplementation(() => ({
      ...mockStoreState,
      currentExecutionId: 'exec-missing',
    }));
    fetchMock.mockResolvedValue(createActiveResponse([]));

    const { result } = renderHook(() => useActiveCliExecutions(true, 60_000), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });

    expect(mockStoreState.setCurrentExecution).toHaveBeenCalledWith('exec-running');
  });

  it('clears current selection when no executions remain after sync', async () => {
    mockStoreState.executions = {};
    (mockUseCliStreamStore as any).getState.mockImplementation(() => ({
      ...mockStoreState,
      currentExecutionId: 'exec-missing',
    }));
    fetchMock.mockResolvedValue(createActiveResponse([]));

    const { result } = renderHook(() => useActiveCliExecutions(true, 60_000), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });

    expect(mockStoreState.setCurrentExecution).toHaveBeenCalledWith(null);
  });

  it('keeps running executions when saved detail is older than active start time', async () => {
    const startTime = 1_741_393_000_000;

    fetchMock.mockResolvedValue(createActiveResponse([
      {
        id: 'exec-live',
        tool: 'codex',
        mode: 'analysis',
        status: 'running',
        output: '[响应] live output',
        startTime,
      },
    ]));

    vi.mocked(api.fetchExecutionDetail).mockResolvedValue({
      id: 'exec-live',
      tool: 'codex',
      mode: 'analysis',
      turns: [],
      turn_count: 1,
      created_at: new Date(startTime - 20_000).toISOString(),
      updated_at: new Date(startTime - 10_000).toISOString(),
    } as any);

    const { result } = renderHook(() => useActiveCliExecutions(true, 60_000), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data?.map((execution) => execution.id)).toEqual(['exec-live']);
    });

    expect(mockStoreState.removeExecution).not.toHaveBeenCalled();
    expect(mockStoreState.upsertExecution).toHaveBeenCalledWith(
      'exec-live',
      expect.objectContaining({
        status: 'running',
        recovered: true,
      })
    );
    expect(mockStoreState.setCurrentExecution).toHaveBeenCalledWith('exec-live');
  });
});
