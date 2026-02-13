// ========================================
// useIssues Hook
// ========================================
// TanStack Query hooks for issues with queue management

import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  fetchIssues,
  fetchIssueHistory,
  fetchIssueQueue,
  fetchQueueById,
  fetchQueueHistory,
  createIssue,
  updateIssue,
  deleteIssue,
  activateQueue,
  deactivateQueue,
  deleteQueue as deleteQueueApi,
  mergeQueues as mergeQueuesApi,
  splitQueue as splitQueueApi,
  reorderQueueGroup as reorderQueueGroupApi,
  moveQueueItem as moveQueueItemApi,
  fetchDiscoveries,
  fetchDiscoveryFindings,
  exportDiscoveryFindingsAsIssues,
  type Issue,
  type IssueQueue,
  type QueueHistoryIndex,
  type DiscoverySession,
  type Finding,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { workspaceQueryKeys } from '@/lib/queryKeys';
import { useState, useMemo } from 'react';

// Query key factory
export const issuesKeys = {
  all: ['issues'] as const,
  lists: () => [...issuesKeys.all, 'list'] as const,
  list: (filters?: IssuesFilter) => [...issuesKeys.lists(), filters] as const,
  history: () => [...issuesKeys.all, 'history'] as const,
  queue: () => [...issuesKeys.all, 'queue'] as const,
  details: () => [...issuesKeys.all, 'detail'] as const,
  detail: (id: string) => [...issuesKeys.details(), id] as const,
};

// Default stale time: 30 seconds
const STALE_TIME = 30 * 1000;

export interface IssuesFilter {
  status?: Issue['status'][];
  priority?: Issue['priority'][];
  search?: string;
  includeHistory?: boolean;
}

export interface UseIssuesOptions {
  filter?: IssuesFilter;
  projectPath?: string;
  staleTime?: number;
  enabled?: boolean;
  refetchInterval?: number;
}

export interface UseIssuesReturn {
  issues: Issue[];
  historyIssues: Issue[];
  allIssues: Issue[];
  issuesByStatus: Record<Issue['status'], Issue[]>;
  issuesByPriority: Record<Issue['priority'], Issue[]>;
  openCount: number;
  criticalCount: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching and filtering issues
 */
export function useIssues(options: UseIssuesOptions = {}): UseIssuesReturn {
  const { filter, staleTime = STALE_TIME, enabled = true, refetchInterval = 0 } = options;
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  // Only enable query when projectPath is available
  const queryEnabled = enabled && !!projectPath;

  const issuesQuery = useQuery({
    queryKey: workspaceQueryKeys.issuesList(projectPath),
    queryFn: () => fetchIssues(projectPath),
    staleTime,
    enabled: queryEnabled,
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
    retry: 2,
  });

  const historyQuery = useQuery({
    queryKey: workspaceQueryKeys.issuesHistory(projectPath),
    queryFn: () => fetchIssueHistory(projectPath),
    staleTime,
    enabled: queryEnabled && (filter?.includeHistory ?? false),
    retry: 2,
  });

  const allIssues = issuesQuery.data?.issues ?? [];
  const historyIssues = historyQuery.data?.issues ?? [];

  // Apply filters
  const filteredIssues = (() => {
    let issues = [...allIssues];

    if (filter?.includeHistory) {
      issues = [...issues, ...historyIssues];
    }

    if (filter?.status && filter.status.length > 0) {
      issues = issues.filter((i) => filter.status!.includes(i.status));
    }

    if (filter?.priority && filter.priority.length > 0) {
      issues = issues.filter((i) => filter.priority!.includes(i.priority));
    }

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      issues = issues.filter(
        (i) =>
          i.id.toLowerCase().includes(searchLower) ||
          i.title.toLowerCase().includes(searchLower) ||
          i.context?.toLowerCase().includes(searchLower)
      );
    }

    return issues;
  })();

  // Group by status
  const issuesByStatus: Record<Issue['status'], Issue[]> = {
    open: [],
    in_progress: [],
    resolved: [],
    closed: [],
    completed: [],
  };

  for (const issue of allIssues) {
    // Defensive check: only push if the status key exists
    if (issue.status in issuesByStatus) {
      issuesByStatus[issue.status].push(issue);
    }
  }

  // Group by priority
  const issuesByPriority: Record<Issue['priority'], Issue[]> = {
    low: [],
    medium: [],
    high: [],
    critical: [],
  };

  for (const issue of allIssues) {
    // Defensive check: only push if the priority key exists
    if (issue.priority in issuesByPriority) {
      issuesByPriority[issue.priority].push(issue);
    }
  }

  const refetch = async () => {
    await Promise.all([issuesQuery.refetch(), historyQuery.refetch()]);
  };

  const invalidate = async () => {
    if (projectPath) {
      await queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.issues(projectPath) });
    }
  };

  return {
    issues: filteredIssues,
    historyIssues,
    allIssues,
    issuesByStatus,
    issuesByPriority,
    openCount: issuesByStatus.open.length + issuesByStatus.in_progress.length,
    criticalCount: issuesByPriority.critical.length,
    isLoading: issuesQuery.isLoading,
    isFetching: issuesQuery.isFetching || historyQuery.isFetching,
    error: issuesQuery.error || historyQuery.error,
    refetch,
    invalidate,
  };
}

/**
 * Hook for fetching issue queue
 */
export function useIssueQueue(): UseQueryResult<IssueQueue> {
  const projectPath = useWorkflowStore(selectProjectPath);
  return useQuery<IssueQueue>({
    queryKey: projectPath ? workspaceQueryKeys.issueQueue(projectPath) : ['issueQueue', 'no-project'],
    queryFn: () => fetchIssueQueue(projectPath),
    staleTime: STALE_TIME,
    enabled: !!projectPath,
    retry: 2,
  });
}

/**
 * Hook for fetching a specific queue by ID
 */
export function useIssueQueueById(queueId?: string): UseQueryResult<IssueQueue> {
  const projectPath = useWorkflowStore(selectProjectPath);
  return useQuery<IssueQueue>({
    queryKey:
      projectPath && queueId
        ? workspaceQueryKeys.issueQueueById(projectPath, queueId)
        : ['issueQueueById', projectPath ?? 'no-project', queueId ?? 'no-queue'],
    queryFn: () => fetchQueueById(queueId!, projectPath),
    staleTime: STALE_TIME,
    enabled: !!projectPath && !!queueId,
    retry: 2,
  });
}

// ========== Mutations ==========

export interface UseCreateIssueReturn {
  createIssue: (input: { title: string; context?: string; priority?: Issue['priority'] }) => Promise<Issue>;
  isCreating: boolean;
  error: Error | null;
}

export function useCreateIssue(): UseCreateIssueReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: createIssue,
    onSuccess: () => {
      // Invalidate issues cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: projectPath ? workspaceQueryKeys.issues(projectPath) : ['issues'] });
    },
  });

  return {
    createIssue: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseUpdateIssueReturn {
  updateIssue: (issueId: string, input: Partial<Issue>) => Promise<Issue>;
  isUpdating: boolean;
  error: Error | null;
}

export function useUpdateIssue(): UseUpdateIssueReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: ({ issueId, input }: { issueId: string; input: Partial<Issue> }) =>
      updateIssue(issueId, input),
    onSuccess: () => {
      // Invalidate issues cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: projectPath ? workspaceQueryKeys.issues(projectPath) : ['issues'] });
    },
  });

  return {
    updateIssue: (issueId, input) => mutation.mutateAsync({ issueId, input }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseDeleteIssueReturn {
  deleteIssue: (issueId: string) => Promise<void>;
  isDeleting: boolean;
  error: Error | null;
}

export function useDeleteIssue(): UseDeleteIssueReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: deleteIssue,
    onSuccess: () => {
      // Invalidate to ensure sync with server
      queryClient.invalidateQueries({ queryKey: projectPath ? workspaceQueryKeys.issues(projectPath) : ['issues'] });
    },
  });

  return {
    deleteIssue: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Combined hook for all issue mutations
 */
export function useIssueMutations() {
  const create = useCreateIssue();
  const update = useUpdateIssue();
  const remove = useDeleteIssue();

  return {
    createIssue: create.createIssue,
    updateIssue: update.updateIssue,
    deleteIssue: remove.deleteIssue,
    isCreating: create.isCreating,
    isUpdating: update.isUpdating,
    isDeleting: remove.isDeleting,
    isMutating: create.isCreating || update.isUpdating || remove.isDeleting,
  };
}

// ========== Queue Mutations ==========

export interface UseQueueMutationsReturn {
  activateQueue: (queueId: string) => Promise<void>;
  deactivateQueue: () => Promise<void>;
  deleteQueue: (queueId: string) => Promise<void>;
  mergeQueues: (sourceId: string, targetId: string) => Promise<void>;
  splitQueue: (sourceQueueId: string, itemIds: string[]) => Promise<void>;
  reorderQueueGroup: (groupId: string, newOrder: string[]) => Promise<void>;
  moveQueueItem: (itemId: string, toGroupId: string, toIndex?: number) => Promise<void>;
  isActivating: boolean;
  isDeactivating: boolean;
  isDeleting: boolean;
  isMerging: boolean;
  isSplitting: boolean;
  isReordering: boolean;
  isMoving: boolean;
  isMutating: boolean;
}

export function useQueueHistory(options?: { enabled?: boolean; refetchInterval?: number }): UseQueryResult<QueueHistoryIndex> {
  const { enabled = true, refetchInterval = 0 } = options ?? {};
  const projectPath = useWorkflowStore(selectProjectPath);
  return useQuery({
    queryKey: workspaceQueryKeys.issueQueueHistory(projectPath),
    queryFn: () => fetchQueueHistory(projectPath),
    staleTime: STALE_TIME,
    enabled: enabled && !!projectPath,
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
    retry: 2,
  });
}

export function useQueueMutations(): UseQueueMutationsReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const activateMutation = useMutation({
    mutationFn: (queueId: string) => activateQueue(queueId, projectPath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.issueQueue(projectPath) });
      queryClient.invalidateQueries({ queryKey: [...workspaceQueryKeys.issues(projectPath), 'queueById'] });
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.issueQueueHistory(projectPath) });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateQueue(projectPath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.issueQueue(projectPath) });
      queryClient.invalidateQueries({ queryKey: [...workspaceQueryKeys.issues(projectPath), 'queueById'] });
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.issueQueueHistory(projectPath) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (queueId: string) => deleteQueueApi(queueId, projectPath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.issueQueue(projectPath) });
      queryClient.invalidateQueries({ queryKey: [...workspaceQueryKeys.issues(projectPath), 'queueById'] });
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.issueQueueHistory(projectPath) });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      mergeQueuesApi(sourceId, targetId, projectPath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.issueQueue(projectPath) });
      queryClient.invalidateQueries({ queryKey: [...workspaceQueryKeys.issues(projectPath), 'queueById'] });
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.issueQueueHistory(projectPath) });
    },
  });

  const splitMutation = useMutation({
    mutationFn: ({ sourceQueueId, itemIds }: { sourceQueueId: string; itemIds: string[] }) =>
      splitQueueApi(sourceQueueId, itemIds, projectPath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.issueQueue(projectPath) });
      queryClient.invalidateQueries({ queryKey: [...workspaceQueryKeys.issues(projectPath), 'queueById'] });
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.issueQueueHistory(projectPath) });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: ({ groupId, newOrder }: { groupId: string; newOrder: string[] }) =>
      reorderQueueGroupApi(projectPath, { groupId, newOrder }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.issueQueue(projectPath) });
      queryClient.invalidateQueries({ queryKey: [...workspaceQueryKeys.issues(projectPath), 'queueById'] });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ itemId, toGroupId, toIndex }: { itemId: string; toGroupId: string; toIndex?: number }) =>
      moveQueueItemApi(projectPath, { itemId, toGroupId, toIndex }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.issueQueue(projectPath) });
      queryClient.invalidateQueries({ queryKey: [...workspaceQueryKeys.issues(projectPath), 'queueById'] });
    },
  });

  return {
    activateQueue: activateMutation.mutateAsync,
    deactivateQueue: deactivateMutation.mutateAsync,
    deleteQueue: deleteMutation.mutateAsync,
    mergeQueues: (sourceId, targetId) => mergeMutation.mutateAsync({ sourceId, targetId }),
    splitQueue: (sourceQueueId, itemIds) => splitMutation.mutateAsync({ sourceQueueId, itemIds }),
    reorderQueueGroup: (groupId, newOrder) => reorderMutation.mutateAsync({ groupId, newOrder }).then(() => {}),
    moveQueueItem: (itemId, toGroupId, toIndex) => moveMutation.mutateAsync({ itemId, toGroupId, toIndex }).then(() => {}),
    isActivating: activateMutation.isPending,
    isDeactivating: deactivateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isMerging: mergeMutation.isPending,
    isSplitting: splitMutation.isPending,
    isReordering: reorderMutation.isPending,
    isMoving: moveMutation.isPending,
    isMutating:
      activateMutation.isPending ||
      deactivateMutation.isPending ||
      deleteMutation.isPending ||
      mergeMutation.isPending ||
      splitMutation.isPending ||
      reorderMutation.isPending ||
      moveMutation.isPending,
  };
}

// ========== Discovery Hook ==========

export interface FindingFilters {
  severity?: 'critical' | 'high' | 'medium' | 'low';
  type?: string;
  search?: string;
  exported?: boolean;
  hasIssue?: boolean;
}

export interface UseIssueDiscoveryReturn {
  sessions: DiscoverySession[];
  activeSession: DiscoverySession | null;
  findings: Finding[];
  filteredFindings: Finding[];
  isLoadingSessions: boolean;
  isLoadingFindings: boolean;
  error: Error | null;
  filters: FindingFilters;
  setFilters: (filters: FindingFilters) => void;
  selectSession: (sessionId: string) => void;
  refetchSessions: () => void;
  exportFindings: () => void;
  exportSelectedFindings: (findingIds: string[]) => Promise<{ success: boolean; message?: string; exported?: number }>;
  isExporting: boolean;
}

export function useIssueDiscovery(options?: { refetchInterval?: number }): UseIssueDiscoveryReturn {
  const { refetchInterval = 0 } = options ?? {};
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FindingFilters>({});
  const [isExporting, setIsExporting] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: workspaceQueryKeys.discoveries(projectPath),
    queryFn: () => fetchDiscoveries(projectPath),
    staleTime: STALE_TIME,
    enabled: !!projectPath,
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
    retry: 2,
  });

  const findingsQuery = useQuery({
    queryKey: activeSessionId ? ['discoveryFindings', activeSessionId, projectPath] : ['discoveryFindings', 'no-session'],
    queryFn: () => activeSessionId ? fetchDiscoveryFindings(activeSessionId, projectPath) : [],
    staleTime: STALE_TIME,
    enabled: !!activeSessionId && !!projectPath,
    retry: 2,
  });

  const activeSession = useMemo(
    () => sessionsQuery.data?.find(s => s.id === activeSessionId) ?? null,
    [sessionsQuery.data, activeSessionId]
  );

  const filteredFindings = useMemo(() => {
    let findings = findingsQuery.data ?? [];
    if (filters.severity) {
      findings = findings.filter(f => f.severity === filters.severity);
    }
    if (filters.type) {
      findings = findings.filter(f => f.type === filters.type);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      findings = findings.filter(f =>
        f.title.toLowerCase().includes(searchLower) ||
        f.description.toLowerCase().includes(searchLower)
      );
    }
    // Filter by exported status
    if (filters.exported !== undefined) {
      findings = findings.filter(f => f.exported === filters.exported);
    }
    // Filter by hasIssue (has associated issue_id)
    if (filters.hasIssue !== undefined) {
      findings = findings.filter(f => !!f.issue_id === filters.hasIssue);
    }
    return findings;
  }, [findingsQuery.data, filters]);

  const selectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
  };

  const exportFindings = () => {
    if (!activeSessionId || !findingsQuery.data) return;
    const data = {
      session: activeSession,
      findings: findingsQuery.data,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discovery-${activeSessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSelectedFindings = async (findingIds: string[]) => {
    if (!activeSessionId) return { success: false, message: 'No active session' };
    setIsExporting(true);
    try {
      const result = await exportDiscoveryFindingsAsIssues(
        activeSessionId,
        { findingIds },
        projectPath
      );
      // Invalidate queries to refresh findings with updated exported status
      await queryClient.invalidateQueries({ queryKey: ['discoveryFindings', activeSessionId, projectPath] });
      await queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.issues(projectPath) });
      return result;
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Export failed' };
    } finally {
      setIsExporting(false);
    }
  };

  return {
    sessions: sessionsQuery.data ?? [],
    activeSession,
    findings: findingsQuery.data ?? [],
    filteredFindings,
    isLoadingSessions: sessionsQuery.isLoading,
    isLoadingFindings: findingsQuery.isLoading,
    error: sessionsQuery.error || findingsQuery.error,
    filters,
    setFilters,
    selectSession,
    refetchSessions: () => {
      sessionsQuery.refetch();
    },
    exportFindings,
    exportSelectedFindings,
    isExporting,
  };
}
