// ========================================
// usePromptHistory Hook
// ========================================
// TanStack Query hooks for prompt history with real-time updates

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPrompts,
  fetchPromptInsights,
  fetchInsightsHistory,
  analyzePrompts,
  deletePrompt,
  batchDeletePrompts,
  deleteInsight,
  type Prompt,
  type PromptsResponse,
  type PromptInsightsResponse,
  type InsightsHistoryResponse,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { workspaceQueryKeys } from '@/lib/queryKeys';

// Default stale time: 30 seconds (prompts update less frequently)
const STALE_TIME = 30 * 1000;

export interface PromptHistoryFilter {
  search?: string;
  intent?: string;
  project?: string;
  dateRange?: { start: Date | null; end: Date | null };
}

export interface UsePromptHistoryOptions {
  filter?: PromptHistoryFilter;
  staleTime?: number;
  enabled?: boolean;
}

export interface UsePromptHistoryReturn {
  prompts: Prompt[];
  allPrompts: Prompt[];
  totalPrompts: number;
  promptsBySession: Record<string, Prompt[]>;
  stats: {
    totalCount: number;
    avgLength: number;
    topIntent: string | null;
    avgQualityScore?: number;
    qualityDistribution?: {
      high: number;
      medium: number;
      low: number;
    };
  };
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching and filtering prompt history
 */
export function usePromptHistory(options: UsePromptHistoryOptions = {}): UsePromptHistoryReturn {
  const { filter, staleTime = STALE_TIME, enabled = true } = options;
  const queryClient = useQueryClient();

  const projectPath = useWorkflowStore(selectProjectPath);
  const queryEnabled = enabled && !!projectPath;

  const query = useQuery({
    queryKey: workspaceQueryKeys.promptsList(projectPath),
    queryFn: () => fetchPrompts(projectPath),
    staleTime,
    enabled: queryEnabled,
    retry: 2,
  });

  const allPrompts = query.data?.prompts ?? [];
  const totalCount = query.data?.total ?? 0;

  // Apply filters
  const filteredPrompts = (() => {
    let prompts = allPrompts;

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      prompts = prompts.filter(
        (p) =>
          p.title?.toLowerCase().includes(searchLower) ||
          p.content.toLowerCase().includes(searchLower) ||
          p.tags?.some((t) => t.toLowerCase().includes(searchLower))
      );
    }

    if (filter?.intent) {
      prompts = prompts.filter((p) => p.category === filter.intent);
    }

    if (filter?.project) {
      prompts = prompts.filter((p) => p.project === filter.project);
    }

    if (filter?.dateRange?.start || filter?.dateRange?.end) {
      prompts = prompts.filter((p) => {
        const date = new Date(p.createdAt);
        const start = filter.dateRange?.start;
        const end = filter.dateRange?.end;
        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      });
    }

    return prompts;
  })();

  // Group by session for timeline view
  const promptsBySession: Record<string, Prompt[]> = {};
  for (const prompt of allPrompts) {
    const sessionKey = prompt.tags?.find((t) => t.startsWith('session:'))?.replace('session:', '') || 'ungrouped';
    if (!promptsBySession[sessionKey]) {
      promptsBySession[sessionKey] = [];
    }
    promptsBySession[sessionKey].push(prompt);
  }

  // Calculate stats
  const avgLength = allPrompts.length > 0
    ? Math.round(allPrompts.reduce((sum, p) => sum + p.content.length, 0) / allPrompts.length)
    : 0;

  const intentCounts: Record<string, number> = {};
  for (const prompt of allPrompts) {
    const category = prompt.category || 'uncategorized';
    intentCounts[category] = (intentCounts[category] || 0) + 1;
  }
  const topIntent = Object.entries(intentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Calculate quality distribution
  const qualityDistribution = {
    high: 0,
    medium: 0,
    low: 0,
  };
  let totalQualityScore = 0;
  let qualityScoreCount = 0;

  for (const prompt of allPrompts) {
    if (prompt.quality_score !== undefined && prompt.quality_score !== null) {
      totalQualityScore += prompt.quality_score;
      qualityScoreCount++;

      if (prompt.quality_score >= 80) {
        qualityDistribution.high++;
      } else if (prompt.quality_score >= 60) {
        qualityDistribution.medium++;
      } else {
        qualityDistribution.low++;
      }
    }
  }

  const avgQualityScore = qualityScoreCount > 0
    ? totalQualityScore / qualityScoreCount
    : undefined;

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.prompts(projectPath) });
  };

  return {
    prompts: filteredPrompts,
    allPrompts,
    totalPrompts: totalCount,
    promptsBySession,
    stats: {
      totalCount: allPrompts.length,
      avgLength,
      topIntent,
      avgQualityScore,
      qualityDistribution,
    },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}



/**
 * Hook for fetching prompt insights
 */
export function usePromptInsights(options: { enabled?: boolean; staleTime?: number } = {}) {
  const { enabled = true, staleTime = STALE_TIME } = options;

  const projectPath = useWorkflowStore(selectProjectPath);
  const queryEnabled = enabled && !!projectPath;

  return useQuery({
    queryKey: workspaceQueryKeys.promptsInsights(projectPath),
    queryFn: () => fetchPromptInsights(projectPath),
    staleTime,
    enabled: queryEnabled,
    retry: 2,
  });
}

/**
 * Hook for fetching insights history (past CLI analyses)
 */
export function useInsightsHistory(options: {
  limit?: number;
  enabled?: boolean;
  staleTime?: number;
} = {}) {
  const { limit = 20, enabled = true, staleTime = STALE_TIME } = options;

  const projectPath = useWorkflowStore(selectProjectPath);
  const queryEnabled = enabled && !!projectPath;

  return useQuery({
    queryKey: workspaceQueryKeys.promptsInsightsHistory(projectPath),
    queryFn: () => fetchInsightsHistory(projectPath, limit),
    staleTime,
    enabled: queryEnabled,
    retry: 2,
  });
}

// ========== Mutations ==========

export interface UseAnalyzePromptsReturn {
  analyzePrompts: (request?: { tool?: 'gemini' | 'qwen' | 'codex'; limit?: number }) => Promise<PromptInsightsResponse>;
  isAnalyzing: boolean;
  error: Error | null;
}

export function useAnalyzePrompts(): UseAnalyzePromptsReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: analyzePrompts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.promptsInsights(projectPath) });
    },
  });

  return {
    analyzePrompts: mutation.mutateAsync,
    isAnalyzing: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseDeletePromptReturn {
  deletePrompt: (promptId: string) => Promise<void>;
  isDeleting: boolean;
  error: Error | null;
}

export function useDeletePrompt(): UseDeletePromptReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: deletePrompt,
    onMutate: async (promptId) => {
      await queryClient.cancelQueries({ queryKey: workspaceQueryKeys.prompts(projectPath) });
      const previousPrompts = queryClient.getQueryData<PromptsResponse>(workspaceQueryKeys.promptsList(projectPath));

      queryClient.setQueryData<PromptsResponse>(workspaceQueryKeys.promptsList(projectPath), (old) => {
        if (!old) return old;
        return {
          ...old,
          prompts: old.prompts.filter((p) => p.id !== promptId),
          total: old.total - 1,
        };
      });

      return { previousPrompts };
    },
    onError: (_error, _promptId, context) => {
      if (context?.previousPrompts) {
        queryClient.setQueryData(workspaceQueryKeys.promptsList(projectPath), context.previousPrompts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.prompts(projectPath) });
    },
  });

  return {
    deletePrompt: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseBatchDeletePromptsReturn {
  batchDeletePrompts: (promptIds: string[]) => Promise<{ deleted: number }>;
  isBatchDeleting: boolean;
  error: Error | null;
}

export function useBatchDeletePrompts(): UseBatchDeletePromptsReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: batchDeletePrompts,
    onMutate: async (promptIds) => {
      await queryClient.cancelQueries({ queryKey: workspaceQueryKeys.prompts(projectPath) });
      const previousPrompts = queryClient.getQueryData<PromptsResponse>(workspaceQueryKeys.promptsList(projectPath));

      queryClient.setQueryData<PromptsResponse>(workspaceQueryKeys.promptsList(projectPath), (old) => {
        if (!old) return old;
        return {
          ...old,
          prompts: old.prompts.filter((p) => !promptIds.includes(p.id)),
          total: old.total - promptIds.length,
        };
      });

      return { previousPrompts };
    },
    onError: (_error, _promptIds, context) => {
      if (context?.previousPrompts) {
        queryClient.setQueryData(workspaceQueryKeys.promptsList(projectPath), context.previousPrompts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.prompts(projectPath) });
    },
  });

  return {
    batchDeletePrompts: mutation.mutateAsync,
    isBatchDeleting: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseDeleteInsightReturn {
  deleteInsight: (insightId: string) => Promise<{ success: boolean }>;
  isDeleting: boolean;
  error: Error | null;
}

export function useDeleteInsight(): UseDeleteInsightReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: (insightId: string) => deleteInsight(insightId, projectPath),
    onMutate: async (insightId) => {
      await queryClient.cancelQueries({ queryKey: workspaceQueryKeys.promptsInsightsHistory(projectPath) });
      const previousInsights = queryClient.getQueryData<InsightsHistoryResponse>(workspaceQueryKeys.promptsInsightsHistory(projectPath));

      queryClient.setQueryData<InsightsHistoryResponse>(workspaceQueryKeys.promptsInsightsHistory(projectPath), (old) => {
        if (!old) return old;
        return {
          ...old,
          insights: old.insights.filter((i) => i.id !== insightId),
        };
      });

      return { previousInsights };
    },
    onError: (_error, _insightId, context) => {
      if (context?.previousInsights) {
        queryClient.setQueryData(workspaceQueryKeys.promptsInsightsHistory(projectPath), context.previousInsights);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.promptsInsightsHistory(projectPath) });
    },
  });

  return {
    deleteInsight: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Combined hook for all prompt history mutations
 */
export function usePromptHistoryMutations() {
  const analyze = useAnalyzePrompts();
  const remove = useDeletePrompt();
  const batchRemove = useBatchDeletePrompts();

  return {
    analyzePrompts: analyze.analyzePrompts,
    deletePrompt: remove.deletePrompt,
    batchDeletePrompts: batchRemove.batchDeletePrompts,
    isAnalyzing: analyze.isAnalyzing,
    isDeleting: remove.isDeleting,
    isBatchDeleting: batchRemove.isBatchDeleting,
    isMutating: analyze.isAnalyzing || remove.isDeleting || batchRemove.isBatchDeleting,
  };
}

/**
 * Extract unique projects from prompts list
 */
export function extractUniqueProjects(prompts: Prompt[]): string[] {
  const projectsSet = new Set<string>();
  for (const prompt of prompts) {
    if (prompt.project) {
      projectsSet.add(prompt.project);
    }
  }
  return Array.from(projectsSet).sort();
}
