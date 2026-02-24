// ========================================
// useIndex Hook
// ========================================
// TanStack Query hooks for index management with real-time updates

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchIndexStatus,
  rebuildIndex,
  type IndexStatus,
  type IndexRebuildRequest,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { workspaceQueryKeys } from '@/lib/queryKeys';

// ========== Stale Time ==========

// Default stale time: 30 seconds (index status updates less frequently)
const STALE_TIME = 30 * 1000;

// ========== Query Hook ==========

export interface UseIndexStatusOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number;
}

export interface UseIndexStatusReturn {
  status: IndexStatus | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching index status
 *
 * @example
 * ```tsx
 * const { status, isLoading, refetch } = useIndexStatus();
 * ```
 */
export function useIndexStatus(options: UseIndexStatusOptions = {}): UseIndexStatusReturn {
  const { staleTime = STALE_TIME, enabled = true, refetchInterval = 0 } = options;
  const queryClient = useQueryClient();

  const projectPath = useWorkflowStore(selectProjectPath);
  const queryEnabled = enabled && !!projectPath;

  const query = useQuery({
    queryKey: workspaceQueryKeys.indexStatus(projectPath),
    queryFn: () => fetchIndexStatus(projectPath),
    staleTime,
    enabled: queryEnabled,
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
    retry: 2,
  });

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.index(projectPath) });
  };

  return {
    status: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

// ========== Mutation Hooks ==========

export interface UseRebuildIndexReturn {
  rebuildIndex: (request?: IndexRebuildRequest) => Promise<IndexStatus>;
  isRebuilding: boolean;
  error: Error | null;
}

/**
 * Hook for rebuilding index
 *
 * @example
 * ```tsx
 * const { rebuildIndex, isRebuilding } = useRebuildIndex();
 *
 * const handleRebuild = async () => {
 *   await rebuildIndex({ force: true });
 * };
 * ```
 */
export function useRebuildIndex(): UseRebuildIndexReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: rebuildIndex,
    onSuccess: (updatedStatus) => {
      // Update the status query cache
      queryClient.setQueryData(workspaceQueryKeys.indexStatus(projectPath), updatedStatus);
    },
  });

  return {
    rebuildIndex: mutation.mutateAsync,
    isRebuilding: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Combined hook for all index operations
 *
 * @example
 * ```tsx
 * const {
 *   status,
 *   isLoading,
 *   rebuildIndex,
 *   isRebuilding,
 * } = useIndex();
 * ```
 */
export function useIndex() {
  const status = useIndexStatus();
  const rebuild = useRebuildIndex();

  return {
    ...status,
    rebuildIndex: rebuild.rebuildIndex,
    isRebuilding: rebuild.isRebuilding,
    rebuildError: rebuild.error,
  };
}
