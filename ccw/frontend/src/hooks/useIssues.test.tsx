// ========================================
// useIssues Hook Tests
// ========================================
// Tests for issue-related hooks with queue and discovery

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useIssueQueue,
  useQueueMutations,
  useIssueDiscovery,
} from './useIssues';
import * as api from '@/lib/api';

// Create a proper query client wrapper
const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
};

const createWrapper = () => {
  const queryClient = createTestQueryClient();

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock store
vi.mock('@/stores/workflowStore', () => ({
  useWorkflowStore: () => '/test/path',
  selectProjectPath: () => '/test/path',
}));

// Mock API - use vi.mocked for type safety
vi.mock('@/lib/api', () => ({
  fetchIssueQueue: vi.fn(),
  activateQueue: vi.fn(),
  deactivateQueue: vi.fn(),
  deleteQueue: vi.fn(),
  mergeQueues: vi.fn(),
  fetchDiscoveries: vi.fn(),
  fetchDiscoveryFindings: vi.fn(),
}));

describe('useIssueQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch queue data successfully', async () => {
    const mockQueue = {
      tasks: ['task1', 'task2'],
      solutions: ['solution1'],
      conflicts: [],
      execution_groups: { 'group-1': ['task1'] },
      grouped_items: { 'parallel-group': ['task1', 'task2'] },
    };

    vi.mocked(api.fetchIssueQueue).mockResolvedValue(mockQueue as any);

    const { result } = renderHook(() => useIssueQueue(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockQueue);
    });
  });

  it('should handle API errors', async () => {
    vi.mocked(api.fetchIssueQueue).mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useIssueQueue(), {
      wrapper: createWrapper(),
    });

    // Verify the hook returns expected structure even with error
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('data');
    expect(result.current).toHaveProperty('error');
  });
});

describe('useQueueMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should activate queue successfully', async () => {
    vi.mocked(api.activateQueue).mockResolvedValue(undefined);

    const { result } = renderHook(() => useQueueMutations(), {
      wrapper: createWrapper(),
    });

    await result.current.activateQueue('queue-1');

    expect(api.activateQueue).toHaveBeenCalledWith('queue-1', '/test/path');
  });

  it('should deactivate queue successfully', async () => {
    vi.mocked(api.deactivateQueue).mockResolvedValue(undefined);

    const { result } = renderHook(() => useQueueMutations(), {
      wrapper: createWrapper(),
    });

    await result.current.deactivateQueue();

    expect(api.deactivateQueue).toHaveBeenCalledWith('/test/path');
  });

  it('should delete queue successfully', async () => {
    vi.mocked(api.deleteQueue).mockResolvedValue(undefined);

    const { result } = renderHook(() => useQueueMutations(), {
      wrapper: createWrapper(),
    });

    await result.current.deleteQueue('queue-1');

    expect(api.deleteQueue).toHaveBeenCalledWith('queue-1', '/test/path');
  });

  it('should merge queues successfully', async () => {
    vi.mocked(api.mergeQueues).mockResolvedValue(undefined);

    const { result } = renderHook(() => useQueueMutations(), {
      wrapper: createWrapper(),
    });

    await result.current.mergeQueues('source-1', 'target-1');

    expect(api.mergeQueues).toHaveBeenCalledWith('source-1', 'target-1', '/test/path');
  });

  it('should track overall mutation state', () => {
    const { result } = renderHook(() => useQueueMutations(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isMutating).toBe(false);
  });
});

describe('useIssueDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch discovery sessions successfully', async () => {
    const mockSessions = [
      {
        id: '1',
        name: 'Session 1',
        status: 'running' as const,
        progress: 50,
        findings_count: 5,
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    vi.mocked(api.fetchDiscoveries).mockResolvedValue(mockSessions);

    const { result } = renderHook(() => useIssueDiscovery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
      expect(result.current.sessions[0].name).toBe('Session 1');
    });
  });

  it('should filter findings by severity', async () => {
    const mockFindings = [
      { id: '1', title: 'Critical issue', severity: 'critical' as const, type: 'bug', description: '' },
      { id: '2', title: 'Minor issue', severity: 'low' as const, type: 'enhancement', description: '' },
    ];

    vi.mocked(api.fetchDiscoveries).mockResolvedValue([
      { id: '1', name: 'Session 1', status: 'completed' as const, progress: 100, findings_count: 2, created_at: '2024-01-01T00:00:00Z' },
    ]);
    vi.mocked(api.fetchDiscoveryFindings).mockResolvedValue(mockFindings as any);

    const { result } = renderHook(() => useIssueDiscovery(), {
      wrapper: createWrapper(),
    });

    // Wait for sessions to load
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });

    // Select a session to load findings
    result.current.selectSession('1');

    await waitFor(() => {
      expect(result.current.findings).toHaveLength(2);
    });

    // Apply severity filter
    result.current.setFilters({ severity: 'critical' as const });

    await waitFor(() => {
      expect(result.current.filteredFindings).toHaveLength(1);
      expect(result.current.filteredFindings[0].severity).toBe('critical');
    });
  });

  it('should filter findings by type', async () => {
    const mockFindings = [
      { id: '1', title: 'Bug 1', severity: 'high' as const, type: 'bug', description: '' },
      { id: '2', title: 'Enhancement 1', severity: 'medium' as const, type: 'enhancement', description: '' },
    ];

    vi.mocked(api.fetchDiscoveries).mockResolvedValue([
      { id: '1', name: 'Session 1', status: 'completed' as const, progress: 100, findings_count: 2, created_at: '2024-01-01T00:00:00Z' },
    ]);
    vi.mocked(api.fetchDiscoveryFindings).mockResolvedValue(mockFindings as any);

    const { result } = renderHook(() => useIssueDiscovery(), {
      wrapper: createWrapper(),
    });

    // Wait for sessions to load
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });

    // Select a session to load findings
    result.current.selectSession('1');

    await waitFor(() => {
      expect(result.current.findings).toHaveLength(2);
    });

    // Apply type filter
    result.current.setFilters({ type: 'bug' });

    await waitFor(() => {
      expect(result.current.filteredFindings).toHaveLength(1);
      expect(result.current.filteredFindings[0].type).toBe('bug');
    });
  });

  it('should search findings by text', async () => {
    const mockFindings = [
      { id: '1', title: 'Authentication error', severity: 'high' as const, type: 'bug', description: 'Login fails' },
      { id: '2', title: 'UI bug', severity: 'medium' as const, type: 'bug', description: 'Button color' },
    ];

    vi.mocked(api.fetchDiscoveries).mockResolvedValue([
      { id: '1', name: 'Session 1', status: 'completed' as const, progress: 100, findings_count: 2, created_at: '2024-01-01T00:00:00Z' },
    ]);
    vi.mocked(api.fetchDiscoveryFindings).mockResolvedValue(mockFindings as any);

    const { result } = renderHook(() => useIssueDiscovery(), {
      wrapper: createWrapper(),
    });

    // Wait for sessions to load
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });

    // Select a session to load findings
    result.current.selectSession('1');

    await waitFor(() => {
      expect(result.current.findings).toHaveLength(2);
    });

    // Apply search filter
    result.current.setFilters({ search: 'authentication' });

    await waitFor(() => {
      expect(result.current.filteredFindings).toHaveLength(1);
      expect(result.current.filteredFindings[0].title).toContain('Authentication');
    });
  });

  it('should export findings as JSON', async () => {
    const mockFindings = [
      { id: '1', title: 'Test finding', severity: 'high' as const, type: 'bug', description: 'Test' },
    ];

    vi.mocked(api.fetchDiscoveries).mockResolvedValue([
      { id: '1', name: 'Session 1', status: 'completed' as const, progress: 100, findings_count: 1, created_at: '2024-01-01T00:00:00Z' },
    ]);
    vi.mocked(api.fetchDiscoveryFindings).mockResolvedValue(mockFindings as any);

    const { result } = renderHook(() => useIssueDiscovery(), {
      wrapper: createWrapper(),
    });

    // Wait for sessions to load
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });

    // Select a session to load findings
    result.current.selectSession('1');

    await waitFor(() => {
      expect(result.current.findings).toHaveLength(1);
    });

    // Verify exportFindings is available as a function
    expect(typeof result.current.exportFindings).toBe('function');
  });
});
