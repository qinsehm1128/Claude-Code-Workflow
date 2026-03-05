// ========================================
// useLoops Hook
// ========================================
// TanStack Query hooks for loops with real-time updates

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchLoops,
  fetchLoop,
  createLoop,
  updateLoopStatus,
  deleteLoop,
  type Loop,
  type LoopsResponse,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { workspaceQueryKeys } from '@/lib/queryKeys';

// Default stale time: 10 seconds (loops update frequently)
const STALE_TIME = 10 * 1000;

export interface LoopsFilter {
  status?: Loop['status'][];
  search?: string;
}

export interface UseLoopsOptions {
  filter?: LoopsFilter;
  staleTime?: number;
  enabled?: boolean;
  refetchInterval?: number;
}

export interface UseLoopsReturn {
  loops: Loop[];
  loopsByStatus: Record<Loop['status'], Loop[]>;
  runningCount: number;
  completedCount: number;
  failedCount: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching and filtering loops
 */
export function useLoops(options: UseLoopsOptions = {}): UseLoopsReturn {
  const { filter, staleTime = STALE_TIME, enabled = true, refetchInterval = 0 } = options;
  const queryClient = useQueryClient();

  const projectPath = useWorkflowStore(selectProjectPath);
  const queryEnabled = enabled && !!projectPath;

  const query = useQuery({
    queryKey: workspaceQueryKeys.loopsList(projectPath),
    queryFn: () => fetchLoops(projectPath),
    staleTime,
    enabled: queryEnabled,
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
    retry: 2,
  });

  const allLoops = query.data?.loops ?? [];

  // Apply filters
  const filteredLoops = (() => {
    let loops = allLoops;

    if (filter?.status && filter.status.length > 0) {
      loops = loops.filter((l) => filter.status!.includes(l.status));
    }

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      loops = loops.filter(
        (l) =>
          l.id.toLowerCase().includes(searchLower) ||
          l.name?.toLowerCase().includes(searchLower) ||
          l.prompt?.toLowerCase().includes(searchLower)
      );
    }

    return loops;
  })();

  // Group by status for Kanban (use filteredLoops to respect search filter)
  const loopsByStatus: Record<Loop['status'], Loop[]> = {
    created: [],
    running: [],
    paused: [],
    completed: [],
    failed: [],
  };

  for (const loop of filteredLoops) {
    loopsByStatus[loop.status].push(loop);
  }

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.loops(projectPath) });
  };

  return {
    loops: filteredLoops,
    loopsByStatus,
    runningCount: loopsByStatus.running.length,
    completedCount: loopsByStatus.completed.length,
    failedCount: loopsByStatus.failed.length,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

/**
 * Hook for fetching a single loop
 */
export function useLoop(loopId: string, options: { enabled?: boolean } = {}) {
  const projectPath = useWorkflowStore(selectProjectPath);
  const queryEnabled = (options.enabled ?? !!loopId) && !!projectPath;

  return useQuery({
    queryKey: workspaceQueryKeys.loopDetail(projectPath, loopId),
    queryFn: () => fetchLoop(loopId, projectPath),
    enabled: queryEnabled,
    staleTime: STALE_TIME,
  });
}

// ========== Mutations ==========

export interface UseCreateLoopReturn {
  createLoop: (input: { prompt: string; tool?: string; mode?: string }) => Promise<Loop>;
  isCreating: boolean;
  error: Error | null;
}

export function useCreateLoop(): UseCreateLoopReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: createLoop,
    onSuccess: (newLoop) => {
      queryClient.setQueryData<LoopsResponse>(workspaceQueryKeys.loopsList(projectPath), (old) => {
        if (!old) return { loops: [newLoop], total: 1 };
        return {
          loops: [newLoop, ...old.loops],
          total: old.total + 1,
        };
      });
    },
  });

  return {
    createLoop: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseUpdateLoopStatusReturn {
  updateStatus: (loopId: string, action: 'pause' | 'resume' | 'stop') => Promise<Loop>;
  isUpdating: boolean;
  error: Error | null;
}

export function useUpdateLoopStatus(): UseUpdateLoopStatusReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: ({ loopId, action }: { loopId: string; action: 'pause' | 'resume' | 'stop' }) =>
      updateLoopStatus(loopId, action),
    onSuccess: (updatedLoop) => {
      queryClient.setQueryData<LoopsResponse>(workspaceQueryKeys.loopsList(projectPath), (old) => {
        if (!old) return old;
        return {
          ...old,
          loops: old.loops.map((l) => (l.id === updatedLoop.id ? updatedLoop : l)),
        };
      });
      queryClient.setQueryData(workspaceQueryKeys.loopDetail(projectPath, updatedLoop.id), updatedLoop);
    },
  });

  return {
    updateStatus: (loopId, action) => mutation.mutateAsync({ loopId, action }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseDeleteLoopReturn {
  deleteLoop: (loopId: string) => Promise<void>;
  isDeleting: boolean;
  error: Error | null;
}

export function useDeleteLoop(): UseDeleteLoopReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: deleteLoop,
    onMutate: async (loopId) => {
      await queryClient.cancelQueries({ queryKey: workspaceQueryKeys.loops(projectPath) });
      const previousLoops = queryClient.getQueryData<LoopsResponse>(workspaceQueryKeys.loopsList(projectPath));

      queryClient.setQueryData<LoopsResponse>(workspaceQueryKeys.loopsList(projectPath), (old) => {
        if (!old) return old;
        return {
          ...old,
          loops: old.loops.filter((l) => l.id !== loopId),
          total: old.total - 1,
        };
      });

      return { previousLoops };
    },
    onError: (_error, _loopId, context) => {
      if (context?.previousLoops) {
        queryClient.setQueryData(workspaceQueryKeys.loopsList(projectPath), context.previousLoops);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.loops(projectPath) });
    },
  });

  return {
    deleteLoop: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Combined hook for all loop mutations
 */
export function useLoopMutations() {
  const create = useCreateLoop();
  const update = useUpdateLoopStatus();
  const remove = useDeleteLoop();

  return {
    createLoop: create.createLoop,
    updateStatus: update.updateStatus,
    deleteLoop: remove.deleteLoop,
    isCreating: create.isCreating,
    isUpdating: update.isUpdating,
    isDeleting: remove.isDeleting,
    isMutating: create.isCreating || update.isUpdating || remove.isDeleting,
  };
}
