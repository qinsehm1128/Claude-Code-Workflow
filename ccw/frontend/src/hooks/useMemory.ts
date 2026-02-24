// ========================================
// useMemory Hook
// ========================================
// TanStack Query hooks for core memory management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  archiveMemory as archiveMemoryApi,
  unarchiveMemory as unarchiveMemoryApi,
  type CoreMemory,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { workspaceQueryKeys } from '@/lib/queryKeys';
import { parseMemoryMetadata } from '@/lib/utils';

// Query key factory
export const memoryKeys = {
  all: ['memory'] as const,
  lists: () => [...memoryKeys.all, 'list'] as const,
  list: (filters?: MemoryFilter) => [...memoryKeys.lists(), filters] as const,
  details: () => [...memoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...memoryKeys.details(), id] as const,
};

// Default stale time: 1 minute
const STALE_TIME = 60 * 1000;

export interface MemoryFilter {
  search?: string;
  tags?: string[];
  favorite?: boolean;
  archived?: boolean;
}

export interface UseMemoryOptions {
  filter?: MemoryFilter;
  staleTime?: number;
  enabled?: boolean;
}

export interface UseMemoryReturn {
  memories: CoreMemory[];
  totalSize: number;
  claudeMdCount: number;
  allTags: string[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching and filtering memories
 */
export function useMemory(options: UseMemoryOptions = {}): UseMemoryReturn {
  const { filter, staleTime = STALE_TIME, enabled = true } = options;
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  // Only enable query when projectPath is available
  const queryEnabled = enabled && !!projectPath;

  const query = useQuery({
    queryKey: workspaceQueryKeys.memoryList(projectPath),
    queryFn: () => fetchMemories(projectPath),
    staleTime,
    enabled: queryEnabled,
    retry: 2,
  });

  const allMemories = query.data?.memories ?? [];
  const totalSize = query.data?.totalSize ?? 0;
  const claudeMdCount = query.data?.claudeMdCount ?? 0;

  // Apply filters
  const filteredMemories = (() => {
    let memories = allMemories;

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      memories = memories.filter(
        (m) =>
          m.content.toLowerCase().includes(searchLower) ||
          m.source?.toLowerCase().includes(searchLower) ||
          m.tags?.some((t) => t.toLowerCase().includes(searchLower))
      );
    }

    if (filter?.tags && filter.tags.length > 0) {
      memories = memories.filter((m) =>
        filter.tags!.some((tag) => m.tags?.includes(tag))
      );
    }

    // Filter by favorite status (from metadata)
    if (filter?.favorite === true) {
      memories = memories.filter((m) => {
        const metadata = parseMemoryMetadata(m.metadata);
        return metadata.favorite === true;
      });
    }

    // Filter by archived status
    if (filter?.archived === true) {
      memories = memories.filter((m) => m.archived === true);
    } else if (filter?.archived === false) {
      memories = memories.filter((m) => m.archived !== true);
    }

    return memories;
  })();

  // Collect all unique tags
  const allTags = Array.from(
    new Set(allMemories.flatMap((m) => m.tags ?? []))
  ).sort();

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    if (projectPath) {
      await queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.memory(projectPath) });
    }
  };

  return {
    memories: filteredMemories,
    totalSize,
    claudeMdCount,
    allTags,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

// ========== Mutations ==========

export interface UseCreateMemoryReturn {
  createMemory: (input: { content: string; tags?: string[]; metadata?: Record<string, any> }) => Promise<CoreMemory>;
  isCreating: boolean;
  error: Error | null;
}

export function useCreateMemory(): UseCreateMemoryReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: (input: { content: string; tags?: string[]; metadata?: Record<string, any> }) =>
      createMemory(input, projectPath),
    onSuccess: () => {
      // Invalidate memory cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: projectPath ? workspaceQueryKeys.memory(projectPath) : ['memory'] });
    },
  });

  return {
    createMemory: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseUpdateMemoryReturn {
  updateMemory: (memoryId: string, input: Partial<CoreMemory>) => Promise<CoreMemory>;
  isUpdating: boolean;
  error: Error | null;
}

export function useUpdateMemory(): UseUpdateMemoryReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: ({ memoryId, input }: { memoryId: string; input: Partial<CoreMemory> }) =>
      updateMemory(memoryId, input, projectPath),
    onSuccess: () => {
      // Invalidate memory cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: projectPath ? workspaceQueryKeys.memory(projectPath) : ['memory'] });
    },
  });

  return {
    updateMemory: (memoryId, input) => mutation.mutateAsync({ memoryId, input }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseDeleteMemoryReturn {
  deleteMemory: (memoryId: string) => Promise<void>;
  isDeleting: boolean;
  error: Error | null;
}

export function useDeleteMemory(): UseDeleteMemoryReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: (memoryId: string) => deleteMemory(memoryId, projectPath),
    onSuccess: () => {
      // Invalidate to ensure sync with server
      queryClient.invalidateQueries({ queryKey: projectPath ? workspaceQueryKeys.memory(projectPath) : ['memory'] });
    },
  });

  return {
    deleteMemory: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseArchiveMemoryReturn {
  archiveMemory: (memoryId: string) => Promise<void>;
  isArchiving: boolean;
  error: Error | null;
}

export function useArchiveMemory(): UseArchiveMemoryReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: (memoryId: string) => archiveMemoryApi(memoryId, projectPath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectPath ? workspaceQueryKeys.memory(projectPath) : ['memory'] });
    },
  });

  return {
    archiveMemory: mutation.mutateAsync,
    isArchiving: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseUnarchiveMemoryReturn {
  unarchiveMemory: (memoryId: string) => Promise<void>;
  isUnarchiving: boolean;
  error: Error | null;
}

export function useUnarchiveMemory(): UseUnarchiveMemoryReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: (memoryId: string) => unarchiveMemoryApi(memoryId, projectPath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectPath ? workspaceQueryKeys.memory(projectPath) : ['memory'] });
    },
  });

  return {
    unarchiveMemory: mutation.mutateAsync,
    isUnarchiving: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Combined hook for all memory mutations
 */
export function useMemoryMutations() {
  const create = useCreateMemory();
  const update = useUpdateMemory();
  const remove = useDeleteMemory();
  const archive = useArchiveMemory();
  const unarchive = useUnarchiveMemory();

  return {
    createMemory: create.createMemory,
    updateMemory: update.updateMemory,
    deleteMemory: remove.deleteMemory,
    archiveMemory: archive.archiveMemory,
    unarchiveMemory: unarchive.unarchiveMemory,
    isCreating: create.isCreating,
    isUpdating: update.isUpdating,
    isDeleting: remove.isDeleting,
    isArchiving: archive.isArchiving,
    isUnarchiving: unarchive.isUnarchiving,
    isMutating: create.isCreating || update.isUpdating || remove.isDeleting || archive.isArchiving || unarchive.isUnarchiving,
  };
}
