// ========================================
// useUnifiedSearch Hook
// ========================================
// TanStack Query hooks for unified memory search, stats, and recommendations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchUnifiedSearch,
  fetchUnifiedStats,
  fetchRecommendations,
  triggerReindex,
  type UnifiedSearchResult,
  type UnifiedMemoryStats,
  type RecommendationResult,
  type ReindexResponse,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { workspaceQueryKeys } from '@/lib/queryKeys';

// Default stale time: 1 minute
const STALE_TIME = 60 * 1000;

// ========== Unified Search ==========

export interface UseUnifiedSearchOptions {
  query: string;
  categories?: string;
  topK?: number;
  minScore?: number;
  enabled?: boolean;
  staleTime?: number;
}

export interface UseUnifiedSearchReturn {
  results: UnifiedSearchResult[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for unified vector + FTS5 search across all memory categories
 */
export function useUnifiedSearch(options: UseUnifiedSearchOptions): UseUnifiedSearchReturn {
  const {
    query,
    categories,
    topK,
    minScore,
    enabled = true,
    staleTime = STALE_TIME,
  } = options;
  const projectPath = useWorkflowStore(selectProjectPath);

  // Only enable query when projectPath exists and query is non-empty
  const queryEnabled = enabled && !!projectPath && query.trim().length > 0;

  const result = useQuery({
    queryKey: workspaceQueryKeys.unifiedSearch(projectPath || '', query, categories),
    queryFn: () =>
      fetchUnifiedSearch(
        query,
        { topK, minScore, category: categories },
        projectPath || undefined
      ),
    staleTime,
    enabled: queryEnabled,
    retry: 1,
  });

  const refetch = async () => {
    await result.refetch();
  };

  return {
    results: result.data?.results ?? [],
    total: result.data?.total ?? 0,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch,
  };
}

// ========== Unified Stats ==========

export interface UseUnifiedStatsReturn {
  stats: UnifiedMemoryStats | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching unified memory statistics
 */
export function useUnifiedStats(): UseUnifiedStatsReturn {
  const projectPath = useWorkflowStore(selectProjectPath);
  const queryEnabled = !!projectPath;

  const result = useQuery({
    queryKey: workspaceQueryKeys.unifiedStats(projectPath || ''),
    queryFn: () => fetchUnifiedStats(projectPath || undefined),
    staleTime: STALE_TIME,
    enabled: queryEnabled,
    retry: 2,
  });

  const refetch = async () => {
    await result.refetch();
  };

  return {
    stats: result.data?.stats ?? null,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch,
  };
}

// ========== Recommendations ==========

export interface UseRecommendationsOptions {
  memoryId: string;
  limit?: number;
  enabled?: boolean;
}

export interface UseRecommendationsReturn {
  recommendations: RecommendationResult[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
}

/**
 * Hook for KNN-based memory recommendations
 */
export function useRecommendations(options: UseRecommendationsOptions): UseRecommendationsReturn {
  const { memoryId, limit = 5, enabled = true } = options;
  const projectPath = useWorkflowStore(selectProjectPath);

  const queryEnabled = enabled && !!projectPath && !!memoryId;

  const result = useQuery({
    queryKey: workspaceQueryKeys.unifiedRecommendations(projectPath || '', memoryId),
    queryFn: () => fetchRecommendations(memoryId, limit, projectPath || undefined),
    staleTime: STALE_TIME,
    enabled: queryEnabled,
    retry: 1,
  });

  return {
    recommendations: result.data?.recommendations ?? [],
    total: result.data?.total ?? 0,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
  };
}

// ========== Reindex Mutation ==========

export interface UseReindexReturn {
  reindex: () => Promise<ReindexResponse>;
  isReindexing: boolean;
  error: Error | null;
}

/**
 * Hook for triggering vector index rebuild
 */
export function useReindex(): UseReindexReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: () => triggerReindex(projectPath || undefined),
    onSuccess: () => {
      // Invalidate unified memory cache after reindex
      if (projectPath) {
        queryClient.invalidateQueries({
          queryKey: workspaceQueryKeys.unifiedMemory(projectPath),
        });
      }
    },
  });

  return {
    reindex: mutation.mutateAsync,
    isReindexing: mutation.isPending,
    error: mutation.error,
  };
}
