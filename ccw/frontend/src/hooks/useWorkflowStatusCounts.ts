// ========================================
// useWorkflowStatusCounts Hook
// ========================================
// TanStack Query hook for fetching workflow status distribution

import { useQuery } from '@tanstack/react-query';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

/**
 * Workflow status count data structure
 */
export interface WorkflowStatusCount {
  status: 'planning' | 'in_progress' | 'completed' | 'paused' | 'archived';
  count: number;
  percentage?: number;
}

// Query key factory
export const workflowStatusCountKeys = {
  all: ['workflowStatusCounts'] as const,
  detail: (projectPath: string) => [...workflowStatusCountKeys.all, 'detail', projectPath] as const,
};

// Default stale time: 30 seconds
const STALE_TIME = 30 * 1000;

export interface UseWorkflowStatusCountsOptions {
  /** Override default stale time (ms) */
  staleTime?: number;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Refetch interval (ms), 0 to disable */
  refetchInterval?: number;
}

export interface UseWorkflowStatusCountsReturn {
  /** Workflow status count data */
  data: WorkflowStatusCount[] | undefined;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Fetching state (initial or refetch) */
  isFetching: boolean;
  /** Error object if query failed */
  error: Error | null;
  /** Whether data is stale */
  isStale: boolean;
  /** Manually refetch data */
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching workflow status distribution
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useWorkflowStatusCounts();
 *
 * if (isLoading) return <ChartSkeleton />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return <WorkflowStatusPieChart data={data} />;
 * ```
 */
export function useWorkflowStatusCounts(
  options: UseWorkflowStatusCountsOptions = {}
): UseWorkflowStatusCountsReturn {
  const { staleTime = STALE_TIME, enabled = true, refetchInterval = 0 } = options;
  const projectPath = useWorkflowStore(selectProjectPath);

  // Only enable query when projectPath is available
  const queryEnabled = enabled && !!projectPath;

  const query = useQuery({
    queryKey: workflowStatusCountKeys.detail(projectPath || ''),
    queryFn: async () => {
      if (!projectPath) throw new Error('Project path is required');

      // TODO: Replace with actual API endpoint once backend is ready
      // For now, return mock data matching expected format
      const response = await fetch(`/api/workflow-status-counts?projectPath=${encodeURIComponent(projectPath)}`);
      if (!response.ok) throw new Error('Failed to fetch workflow status counts');
      return response.json() as Promise<WorkflowStatusCount[]>;
    },
    staleTime,
    enabled: queryEnabled,
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    isStale: query.isStale,
    refetch,
  };
}

/**
 * Mock data generator for development/testing
 */
export function generateMockWorkflowStatusCounts(): WorkflowStatusCount[] {
  const statuses: WorkflowStatusCount[] = [
    { status: 'completed', count: 45, percentage: 45 },
    { status: 'in_progress', count: 28, percentage: 28 },
    { status: 'planning', count: 15, percentage: 15 },
    { status: 'paused', count: 8, percentage: 8 },
    { status: 'archived', count: 4, percentage: 4 },
  ];
  return statuses;
}
