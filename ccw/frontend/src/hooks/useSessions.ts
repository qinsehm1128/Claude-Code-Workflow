// ========================================
// useSessions Hook
// ========================================
// TanStack Query hooks for sessions with optimistic updates

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSessions,
  createSession,
  updateSession,
  archiveSession,
  deleteSession,
  type SessionsResponse,
  type CreateSessionInput,
  type UpdateSessionInput,
} from '../lib/api';
import type { SessionMetadata } from '../types/store';
import { dashboardStatsKeys } from './useDashboardStats';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { workspaceQueryKeys } from '@/lib/queryKeys';

// Query key factory
export const sessionsKeys = {
  all: ['sessions'] as const,
  lists: () => [...sessionsKeys.all, 'list'] as const,
  list: (filters?: SessionsFilter) => [...sessionsKeys.lists(), filters] as const,
  details: () => [...sessionsKeys.all, 'detail'] as const,
  detail: (id: string) => [...sessionsKeys.details(), id] as const,
};

// Default stale time: 30 seconds
const STALE_TIME = 30 * 1000;

export interface SessionsFilter {
  status?: SessionMetadata['status'][];
  search?: string;
  location?: 'active' | 'archived' | 'all';
}

export interface UseSessionsOptions {
  /** Filter options */
  filter?: SessionsFilter;
  /** Override default stale time (ms) */
  staleTime?: number;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Refetch interval (ms), 0 to disable */
  refetchInterval?: number;
}

export interface UseSessionsReturn {
  /** All sessions data */
  sessions: SessionsResponse | undefined;
  /** Active sessions */
  activeSessions: SessionMetadata[];
  /** Archived sessions */
  archivedSessions: SessionMetadata[];
  /** Filtered sessions based on filter options */
  filteredSessions: SessionMetadata[];
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Fetching state (initial or refetch) */
  isFetching: boolean;
  /** Error object if query failed */
  error: Error | null;
  /** Manually refetch data */
  refetch: () => Promise<void>;
  /** Invalidate and refetch sessions */
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching sessions data
 *
 * @example
 * ```tsx
 * const { activeSessions, isLoading } = useSessions({
 *   filter: { location: 'active' }
 * });
 * ```
 */
export function useSessions(options: UseSessionsOptions = {}): UseSessionsReturn {
  const { filter, staleTime = STALE_TIME, enabled = true, refetchInterval = 0 } = options;
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  // Only enable query when projectPath is available
  const queryEnabled = enabled && !!projectPath;

  const query = useQuery({
    queryKey: workspaceQueryKeys.sessionsList(projectPath),
    queryFn: () => fetchSessions(projectPath),
    staleTime,
    enabled: queryEnabled,
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const activeSessions = query.data?.activeSessions ?? [];
  const archivedSessions = query.data?.archivedSessions ?? [];

  // Apply client-side filtering
  const filteredSessions = (() => {
    let sessions: SessionMetadata[] = [];

    if (!filter?.location || filter.location === 'all') {
      sessions = [...activeSessions, ...archivedSessions];
    } else if (filter.location === 'active') {
      sessions = activeSessions;
    } else {
      sessions = archivedSessions;
    }

    // Apply status filter
    if (filter?.status && filter.status.length > 0) {
      sessions = sessions.filter((s) => filter.status!.includes(s.status));
    }

    // Apply search filter
    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      sessions = sessions.filter(
        (s) =>
          s.session_id.toLowerCase().includes(searchLower) ||
          s.title?.toLowerCase().includes(searchLower) ||
          s.description?.toLowerCase().includes(searchLower)
      );
    }

    return sessions;
  })();

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.sessions(projectPath) });
  };

  return {
    sessions: query.data,
    activeSessions,
    archivedSessions,
    filteredSessions,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

// ========== Mutations ==========

export interface UseCreateSessionReturn {
  createSession: (input: CreateSessionInput) => Promise<SessionMetadata>;
  isCreating: boolean;
  error: Error | null;
}

/**
 * Hook for creating a new session
 */
export function useCreateSession(): UseCreateSessionReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createSession,
    onSuccess: () => {
      // Invalidate sessions cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      // Invalidate dashboard stats
      queryClient.invalidateQueries({ queryKey: dashboardStatsKeys.all });
    },
  });

  return {
    createSession: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseUpdateSessionReturn {
  updateSession: (sessionId: string, input: UpdateSessionInput) => Promise<SessionMetadata>;
  isUpdating: boolean;
  error: Error | null;
}

/**
 * Hook for updating a session
 */
export function useUpdateSession(): UseUpdateSessionReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ sessionId, input }: { sessionId: string; input: UpdateSessionInput }) =>
      updateSession(sessionId, input),
    onSuccess: () => {
      // Invalidate sessions cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
  });

  return {
    updateSession: (sessionId, input) => mutation.mutateAsync({ sessionId, input }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseArchiveSessionReturn {
  archiveSession: (sessionId: string) => Promise<SessionMetadata>;
  isArchiving: boolean;
  error: Error | null;
}

/**
 * Hook for archiving a session with optimistic update
 */
export function useArchiveSession(): UseArchiveSessionReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: archiveSession,
    onSuccess: () => {
      // Invalidate to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      queryClient.invalidateQueries({ queryKey: dashboardStatsKeys.all });
    },
  });

  return {
    archiveSession: mutation.mutateAsync,
    isArchiving: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseDeleteSessionReturn {
  deleteSession: (sessionId: string) => Promise<void>;
  isDeleting: boolean;
  error: Error | null;
}

/**
 * Hook for deleting a session with optimistic update
 */
export function useDeleteSession(): UseDeleteSessionReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => {
      // Invalidate to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      queryClient.invalidateQueries({ queryKey: dashboardStatsKeys.all });
    },
  });

  return {
    deleteSession: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Combined hook for all session mutations
 */
export function useSessionMutations() {
  const create = useCreateSession();
  const update = useUpdateSession();
  const archive = useArchiveSession();
  const remove = useDeleteSession();

  return {
    createSession: create.createSession,
    updateSession: update.updateSession,
    archiveSession: archive.archiveSession,
    deleteSession: remove.deleteSession,
    isCreating: create.isCreating,
    isUpdating: update.isUpdating,
    isArchiving: archive.isArchiving,
    isDeleting: remove.isDeleting,
    isMutating: create.isCreating || update.isUpdating || archive.isArchiving || remove.isDeleting,
  };
}

/**
 * Hook to prefetch sessions data
 */
export function usePrefetchSessions() {
  const queryClient = useQueryClient();

  return (filter?: SessionsFilter) => {
    queryClient.prefetchQuery({
      queryKey: sessionsKeys.list(filter),
      queryFn: () => fetchSessions(),
      staleTime: STALE_TIME,
    });
  };
}
