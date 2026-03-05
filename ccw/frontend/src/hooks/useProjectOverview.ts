// ========================================
// useProjectOverview Hook
// ========================================
// TanStack Query hook for project overview data

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProjectOverview, updateProjectGuidelines, type ProjectGuidelines } from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

// Query key factory
export const projectOverviewKeys = {
  all: ['projectOverview'] as const,
  detail: (path?: string) => [...projectOverviewKeys.all, 'detail', path] as const,
};

// Default stale time: 5 minutes
const STALE_TIME = 5 * 60 * 1000;

export interface UseProjectOverviewOptions {
  /** Override default stale time (ms) */
  staleTime?: number;
  /** Enable/disable the query */
  enabled?: boolean;
}

/**
 * Hook for fetching project overview data
 *
 * @example
 * ```tsx
 * const { projectOverview, isLoading } = useProjectOverview();
 * ```
 */
export function useProjectOverview(options: UseProjectOverviewOptions = {}) {
  const { staleTime = STALE_TIME, enabled = true } = options;

  const projectPath = useWorkflowStore(selectProjectPath);
  const queryEnabled = enabled && !!projectPath;

  const query = useQuery({
    queryKey: projectOverviewKeys.detail(projectPath),
    queryFn: () => fetchProjectOverview(projectPath),
    staleTime,
    enabled: queryEnabled,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  return {
    projectOverview: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ========== Mutations ==========

export interface UseUpdateGuidelinesReturn {
  updateGuidelines: (guidelines: ProjectGuidelines) => Promise<{ success: boolean; guidelines?: ProjectGuidelines; error?: string }>;
  isUpdating: boolean;
  error: Error | null;
}

/**
 * Hook for updating project guidelines
 *
 * @example
 * ```tsx
 * const { updateGuidelines, isUpdating } = useUpdateGuidelines();
 * await updateGuidelines({ conventions: { ... }, constraints: { ... } });
 * ```
 */
export function useUpdateGuidelines(): UseUpdateGuidelinesReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: (guidelines: ProjectGuidelines) => updateProjectGuidelines(guidelines, projectPath),
    onSuccess: () => {
      // Invalidate project overview cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: projectOverviewKeys.detail() });
    },
  });

  return {
    updateGuidelines: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}
