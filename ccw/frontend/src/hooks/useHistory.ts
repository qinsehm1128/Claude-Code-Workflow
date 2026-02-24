// ========================================
// useHistory Hook
// ========================================
// TanStack Query hook for CLI execution history

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchHistory,
  deleteExecution,
  deleteExecutionsByTool,
  deleteAllHistory,
  type HistoryResponse,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { workspaceQueryKeys } from '@/lib/queryKeys';

export interface HistoryFilter {
  search?: string;
  tool?: string;
}

// Default stale time: 30 seconds
const STALE_TIME = 30 * 1000;

export interface UseHistoryOptions {
  /** Filter options */
  filter?: HistoryFilter;
  /** Override default stale time (ms) */
  staleTime?: number;
  /** Enable/disable the query */
  enabled?: boolean;
}

export interface UseHistoryReturn {
  /** All executions data */
  executions: HistoryResponse['executions'];
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Fetching state (initial or refetch) */
  isFetching: boolean;
  /** Error object if query failed */
  error: Error | null;
  /** Manually refetch data */
  refetch: () => Promise<void>;
  /** Delete a single execution */
  deleteExecution: (id: string) => Promise<void>;
  /** Delete executions by tool */
  deleteByTool: (tool: string) => Promise<void>;
  /** Delete all history */
  deleteAll: () => Promise<void>;
  /** Is any mutation in progress */
  isDeleting: boolean;
}

/**
 * Hook for fetching CLI execution history
 *
 * @example
 * ```tsx
 * const { executions, isLoading, deleteExecution } = useHistory();
 * ```
 */
export function useHistory(options: UseHistoryOptions = {}): UseHistoryReturn {
  const { filter, staleTime = STALE_TIME, enabled = true } = options;
  const queryClient = useQueryClient();

  const projectPath = useWorkflowStore(selectProjectPath);
  const queryEnabled = enabled && !!projectPath;

  const query = useQuery({
    queryKey: workspaceQueryKeys.cliHistoryList(projectPath),
    queryFn: () => fetchHistory(projectPath),
    staleTime,
    enabled: queryEnabled,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Apply client-side filtering
  const executions = React.useMemo(() => {
    let executions = query.data?.executions ?? [];

    // Apply search filter
    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      executions = executions.filter(
        (exec) =>
          exec.prompt_preview.toLowerCase().includes(searchLower) ||
          exec.tool.toLowerCase().includes(searchLower)
      );
    }

    // Apply tool filter
    if (filter?.tool) {
      executions = executions.filter((exec) => exec.tool === filter.tool);
    }

    return executions;
  }, [query.data, filter]);

  const refetch = async () => {
    await query.refetch();
  };

  // Delete single execution
  const deleteSingleMutation = useMutation({
    mutationFn: deleteExecution,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.cliHistory(projectPath) });
    },
  });

  // Delete by tool
  const deleteByToolMutation = useMutation({
    mutationFn: deleteExecutionsByTool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.cliHistory(projectPath) });
    },
  });

  // Delete all
  const deleteAllMutation = useMutation({
    mutationFn: deleteAllHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.cliHistory(projectPath) });
    },
  });

  const isDeleting =
    deleteSingleMutation.isPending ||
    deleteByToolMutation.isPending ||
    deleteAllMutation.isPending;

  return {
    executions,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    deleteExecution: deleteSingleMutation.mutateAsync,
    deleteByTool: deleteByToolMutation.mutateAsync,
    deleteAll: deleteAllMutation.mutateAsync,
    isDeleting,
  };
}
