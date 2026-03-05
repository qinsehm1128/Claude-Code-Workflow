// ========================================
// useNativeSessions Hook
// ========================================
// TanStack Query hook for native CLI sessions list

import React from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import {
  fetchNativeSessions,
  type NativeSessionListItem,
  type NativeSessionsListResponse,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { workspaceQueryKeys } from '@/lib/queryKeys';

// ========== Constants ==========

const STALE_TIME = 2 * 60 * 1000;   // 2 minutes (increased from 30s)
const GC_TIME = 10 * 60 * 1000;     // 10 minutes (increased from 5min)
const PAGE_SIZE = 50;               // Default page size for pagination

// ========== Types ==========

export type NativeTool = 'gemini' | 'qwen' | 'codex' | 'claude' | 'opencode';

export interface UseNativeSessionsOptions {
  /** Filter by tool type */
  tool?: NativeTool;
  /** Override default stale time (ms) */
  staleTime?: number;
  /** Override default gc time (ms) */
  gcTime?: number;
  /** Enable/disable the query */
  enabled?: boolean;
}

export interface ByToolRecord {
  [tool: string]: NativeSessionListItem[];
}

export interface UseNativeSessionsReturn {
  /** All sessions data */
  sessions: NativeSessionListItem[];
  /** Sessions grouped by tool */
  byTool: ByToolRecord;
  /** Total count from API */
  count: number;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Fetching state (initial or refetch) */
  isFetching: boolean;
  /** Error object if query failed */
  error: Error | null;
  /** Manually refetch data */
  refetch: () => Promise<void>;
}

export interface UseNativeSessionsInfiniteReturn {
  /** All sessions data (flattened from all pages) */
  sessions: NativeSessionListItem[];
  /** Sessions grouped by tool */
  byTool: ByToolRecord;
  /** Total count from current pages */
  count: number;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Fetching state (initial or refetch) */
  isFetching: boolean;
  /** Fetching next page */
  isFetchingNextPage: boolean;
  /** Whether there are more pages */
  hasNextPage: boolean;
  /** Error object if query failed */
  error: Error | null;
  /** Fetch next page */
  fetchNextPage: () => Promise<void>;
  /** Manually refetch data */
  refetch: () => Promise<void>;
}

// ========== Helper Functions ==========

/**
 * Group sessions by tool type
 */
function groupByTool(sessions: NativeSessionListItem[]): ByToolRecord {
  return sessions.reduce<ByToolRecord>((acc, session) => {
    const tool = session.tool;
    if (!acc[tool]) {
      acc[tool] = [];
    }
    acc[tool].push(session);
    return acc;
  }, {});
}

// ========== Hook ==========

/**
 * Hook for fetching native CLI sessions list
 *
 * @example
 * ```tsx
 * const { sessions, byTool, isLoading } = useNativeSessions();
 * const geminiSessions = byTool['gemini'] ?? [];
 * ```
 *
 * @example
 * ```tsx
 * // Filter by tool
 * const { sessions } = useNativeSessions({ tool: 'gemini' });
 * ```
 */
export function useNativeSessions(
  options: UseNativeSessionsOptions = {}
): UseNativeSessionsReturn {
  const { tool, staleTime = STALE_TIME, gcTime = GC_TIME, enabled = true } = options;
  const projectPath = useWorkflowStore(selectProjectPath);

  const query = useQuery<NativeSessionsListResponse>({
    queryKey: workspaceQueryKeys.nativeSessionsList(projectPath, tool),
    queryFn: () => fetchNativeSessions({ tool, project: projectPath, limit: 200 }),
    staleTime,
    gcTime,
    enabled,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Memoize sessions and byTool calculations
  const { sessions, byTool } = React.useMemo(() => {
    const sessions = query.data?.sessions ?? [];
    const byTool = query.data?.byTool ?? groupByTool(sessions);
    return { sessions, byTool };
  }, [query.data]);

  const refetch = async () => {
    await query.refetch();
  };

  return {
    sessions,
    byTool,
    count: query.data?.count ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
  };
}

/**
 * Hook for fetching native CLI sessions with infinite scroll/pagination
 *
 * @example
 * ```tsx
 * const { sessions, fetchNextPage, hasNextPage, isFetchingNextPage } = useNativeSessionsInfinite();
 *
 * // Load more button
 * <button onClick={() => fetchNextPage()} disabled={!hasNextPage || isFetchingNextPage}>
 *   {isFetchingNextPage ? 'Loading...' : 'Load More'}
 * </button>
 * ```
 */
export function useNativeSessionsInfinite(
  options: UseNativeSessionsOptions = {}
): UseNativeSessionsInfiniteReturn {
  const { tool, staleTime = STALE_TIME, gcTime = GC_TIME, enabled = true } = options;
  const projectPath = useWorkflowStore(selectProjectPath);

  const query = useInfiniteQuery<NativeSessionsListResponse>({
    queryKey: [...workspaceQueryKeys.nativeSessionsList(projectPath, tool), 'infinite'],
    queryFn: ({ pageParam }) => fetchNativeSessions({
      tool,
      project: projectPath,
      limit: PAGE_SIZE,
      cursor: pageParam as string | null,
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || !lastPage.nextCursor) return undefined;
      return lastPage.nextCursor;
    },
    staleTime,
    gcTime,
    enabled,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Flatten all pages into a single array and group by tool
  const { sessions, byTool, count } = React.useMemo(() => {
    const allSessions = query.data?.pages.flatMap(page => page.sessions) ?? [];
    // Merge byTool from all pages
    const mergedByTool: ByToolRecord = {};
    for (const page of query.data?.pages ?? []) {
      for (const [toolKey, toolSessions] of Object.entries(page.byTool ?? {})) {
        if (!mergedByTool[toolKey]) {
          mergedByTool[toolKey] = [];
        }
        mergedByTool[toolKey].push(...toolSessions);
      }
    }
    return { sessions: allSessions, byTool: mergedByTool, count: allSessions.length };
  }, [query.data]);

  const fetchNextPage = async () => {
    await query.fetchNextPage();
  };

  const refetch = async () => {
    await query.refetch();
  };

  return {
    sessions,
    byTool,
    count,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    error: query.error,
    fetchNextPage,
    refetch,
  };
}
