// ========================================
// useMcpServers Hook
// ========================================
// TanStack Query hooks for MCP server management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchMcpServers,
  updateMcpServer,
  createMcpServer,
  deleteMcpServer,
  toggleMcpServer,
  fetchMcpTemplates,
  saveMcpTemplate,
  deleteMcpTemplate,
  installMcpTemplate,
  codexRemoveServer,
  codexToggleServer,
  fetchAllProjects,
  fetchOtherProjectsServers,
  crossCliCopy,
  type McpServer,
  type McpServersResponse,
  type McpServerConflict,
  type McpProjectConfigType,
  type McpTemplate,
  type McpTemplateInstallRequest,
  type OtherProjectsServersResponse,
  type CrossCliCopyRequest,
  type CrossCliCopyResponse,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

// Query key factory
export const mcpServersKeys = {
  all: ['mcpServers'] as const,
  lists: () => [...mcpServersKeys.all, 'list'] as const,
  list: (scope?: 'project' | 'global') => [...mcpServersKeys.lists(), scope] as const,
};

// Query key factory for MCP templates
export const mcpTemplatesKeys = {
  all: ['mcpTemplates'] as const,
  lists: () => [...mcpTemplatesKeys.all, 'list'] as const,
  list: (category?: string) => [...mcpTemplatesKeys.lists(), category] as const,
  search: (query: string) => [...mcpTemplatesKeys.all, 'search', query] as const,
  categories: () => [...mcpTemplatesKeys.all, 'categories'] as const,
};

// Query key factory for projects
export const projectsKeys = {
  all: ['projects'] as const,
  list: () => [...projectsKeys.all, 'list'] as const,
  servers: (paths?: string[]) => [...projectsKeys.all, 'servers', ...(paths ?? [])] as const,
};

// Default stale time: 2 minutes (MCP servers change occasionally)
const STALE_TIME = 2 * 60 * 1000;

export interface UseMcpServersOptions {
  scope?: 'project' | 'global';
  staleTime?: number;
  enabled?: boolean;
}

export interface UseMcpServersReturn {
  servers: McpServer[];
  projectServers: McpServer[];
  globalServers: McpServer[];
  conflicts: McpServerConflict[];
  totalCount: number;
  enabledCount: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching MCP servers
 */
export function useMcpServers(options: UseMcpServersOptions = {}): UseMcpServersReturn {
  const { scope, staleTime = STALE_TIME, enabled = true } = options;
  const queryClient = useQueryClient();

  const projectPath = useWorkflowStore(selectProjectPath);
  const queryEnabled = enabled && !!projectPath;

  const query = useQuery({
    queryKey: mcpServersKeys.list(scope),
    queryFn: () => fetchMcpServers(projectPath),
    staleTime,
    enabled: queryEnabled,
    retry: 2,
  });

  const projectServers = query.data?.project ?? [];
  const globalServers = query.data?.global ?? [];
  const conflicts = query.data?.conflicts ?? [];
  const allServers = scope === 'project' ? projectServers : scope === 'global' ? globalServers : [...projectServers, ...globalServers];

  const enabledServers = allServers.filter((s) => s.enabled);

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
  };

  return {
    servers: allServers,
    projectServers,
    globalServers,
    conflicts,
    totalCount: allServers.length,
    enabledCount: enabledServers.length,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

// ========== Mutations ==========

export interface UseUpdateMcpServerReturn {
  updateServer: (serverName: string, config: Partial<McpServer>, configType?: McpProjectConfigType) => Promise<McpServer>;
  isUpdating: boolean;
  error: Error | null;
}

export function useUpdateMcpServer(): UseUpdateMcpServerReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: ({ serverName, config, configType }: { serverName: string; config: Partial<McpServer>; configType?: McpProjectConfigType }) =>
      updateMcpServer(serverName, config, { projectPath: projectPath ?? undefined, configType }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
    },
  });

  return {
    updateServer: (serverName, config, configType) => mutation.mutateAsync({ serverName, config, configType }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseCreateMcpServerReturn {
  createServer: (server: McpServer, configType?: McpProjectConfigType) => Promise<McpServer>;
  isCreating: boolean;
  error: Error | null;
}

export function useCreateMcpServer(): UseCreateMcpServerReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: ({ server, configType }: { server: McpServer; configType?: McpProjectConfigType }) =>
      createMcpServer(server, { projectPath: projectPath ?? undefined, configType }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
    },
  });

  return {
    createServer: (server, configType) => mutation.mutateAsync({ server, configType }),
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseDeleteMcpServerReturn {
  deleteServer: (serverName: string, scope: 'project' | 'global') => Promise<void>;
  isDeleting: boolean;
  error: Error | null;
}

export function useDeleteMcpServer(): UseDeleteMcpServerReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: ({ serverName, scope }: { serverName: string; scope: 'project' | 'global' }) =>
      deleteMcpServer(serverName, scope, { projectPath: projectPath ?? undefined }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
      queryClient.invalidateQueries({ queryKey: ['ccwMcpConfig'] });
    },
  });

  return {
    deleteServer: (serverName, scope) => mutation.mutateAsync({ serverName, scope }),
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseToggleMcpServerReturn {
  toggleServer: (serverName: string, enabled: boolean) => Promise<McpServer>;
  isToggling: boolean;
  error: Error | null;
}

export function useToggleMcpServer(): UseToggleMcpServerReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const mutation = useMutation({
    mutationFn: ({ serverName, enabled }: { serverName: string; enabled: boolean }) =>
      toggleMcpServer(serverName, enabled, { projectPath: projectPath ?? undefined }),
    onMutate: async ({ serverName, enabled }) => {
      await queryClient.cancelQueries({ queryKey: mcpServersKeys.all });
      const previousServers = queryClient.getQueryData<McpServersResponse>(mcpServersKeys.list());

      // Optimistic update
      queryClient.setQueryData<McpServersResponse>(mcpServersKeys.list(), (old) => {
        if (!old) return old;
        const updateServer = (servers: McpServer[]) =>
          servers.map((s) => (s.name === serverName ? { ...s, enabled } : s));
        return {
          project: updateServer(old.project),
          global: updateServer(old.global),
          conflicts: old.conflicts ?? [],
        };
      });

      return { previousServers };
    },
    onError: (_error, _vars, context) => {
      if (context?.previousServers) {
        queryClient.setQueryData(mcpServersKeys.list(), context.previousServers);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
    },
  });

  return {
    toggleServer: (serverName, enabled) => mutation.mutateAsync({ serverName, enabled }),
    isToggling: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Combined hook for all MCP server mutations
 */
export function useMcpServerMutations() {
  const update = useUpdateMcpServer();
  const create = useCreateMcpServer();
  const remove = useDeleteMcpServer();
  const toggle = useToggleMcpServer();

  return {
    updateServer: update.updateServer,
    isUpdating: update.isUpdating,
    createServer: create.createServer,
    isCreating: create.isCreating,
    deleteServer: remove.deleteServer,
    isDeleting: remove.isDeleting,
    toggleServer: toggle.toggleServer,
    isToggling: toggle.isToggling,
    isMutating: update.isUpdating || create.isCreating || remove.isDeleting || toggle.isToggling,
  };
}

// ========================================
// MCP Template Hooks
// ========================================

// Default stale time for templates: 5 minutes (templates change rarely)
const TEMPLATES_STALE_TIME = 5 * 60 * 1000;

export interface UseMcpTemplatesOptions {
  category?: string;
  staleTime?: number;
  enabled?: boolean;
}

export interface UseMcpTemplatesReturn {
  templates: McpTemplate[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching MCP templates with optional category filter
 */
export function useMcpTemplates(options: UseMcpTemplatesOptions = {}): UseMcpTemplatesReturn {
  const { category, staleTime = TEMPLATES_STALE_TIME, enabled = true } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: mcpTemplatesKeys.list(category),
    queryFn: () => fetchMcpTemplates(),
    staleTime,
    enabled,
    retry: 2,
  });

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: mcpTemplatesKeys.all });
  };

  return {
    templates: category
      ? query.data?.filter((t) => t.category === category) ?? []
      : query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

export interface UseCreateTemplateReturn {
  createTemplate: (template: Omit<McpTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; id?: number; error?: string }>;
  isCreating: boolean;
  error: Error | null;
}

/**
 * Hook for creating or updating MCP templates
 */
export function useCreateTemplate(): UseCreateTemplateReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (template: Omit<McpTemplate, 'id' | 'createdAt' | 'updatedAt'>) =>
      saveMcpTemplate(template),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mcpTemplatesKeys.all });
    },
  });

  return {
    createTemplate: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseDeleteTemplateReturn {
  deleteTemplate: (templateName: string) => Promise<{ success: boolean; error?: string }>;
  isDeleting: boolean;
  error: Error | null;
}

/**
 * Hook for deleting MCP templates
 */
export function useDeleteTemplate(): UseDeleteTemplateReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (templateName: string) => deleteMcpTemplate(templateName),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mcpTemplatesKeys.all });
    },
  });

  return {
    deleteTemplate: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseInstallTemplateReturn {
  installTemplate: (request: McpTemplateInstallRequest) => Promise<{ success: boolean; serverName?: string; error?: string }>;
  isInstalling: boolean;
  error: Error | null;
}

/**
 * Hook for installing MCP templates to project or global scope
 */
export function useInstallTemplate(): UseInstallTemplateReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (request: McpTemplateInstallRequest) => installMcpTemplate(request),
    onSettled: () => {
      // Invalidate both templates and servers since installation affects both
      queryClient.invalidateQueries({ queryKey: mcpTemplatesKeys.all });
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
    },
  });

  return {
    installTemplate: mutation.mutateAsync,
    isInstalling: mutation.isPending,
    error: mutation.error,
  };
}

// ========================================
// Codex MCP Hooks
// ========================================

export interface UseCodexMutationsReturn {
  removeServer: (serverName: string) => Promise<{ success: boolean; error?: string }>;
  toggleServer: (serverName: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  isRemoving: boolean;
  isToggling: boolean;
  error: Error | null;
}

/**
 * Combined hook for Codex MCP mutations (remove and toggle)
 */
export function useCodexMutations(): UseCodexMutationsReturn {
  const queryClient = useQueryClient();

  const removeMutation = useMutation({
    mutationFn: (serverName: string) => codexRemoveServer(serverName),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ serverName, enabled }: { serverName: string; enabled: boolean }) =>
      codexToggleServer(serverName, enabled),
    onMutate: async ({ serverName, enabled }) => {
      // Optimistic update could be added here if needed
      return { serverName, enabled };
    },
    onError: (_error, _vars, _context) => {
      // Rollback on error
      console.error('Failed to toggle Codex MCP server:', _error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
    },
  });

  return {
    removeServer: removeMutation.mutateAsync,
    isRemoving: removeMutation.isPending,
    toggleServer: (serverName, enabled) => toggleMutation.mutateAsync({ serverName, enabled }),
    isToggling: toggleMutation.isPending,
    error: removeMutation.error || toggleMutation.error,
  };
}

// ========================================
// Project Operations Hooks
// ========================================

export interface UseProjectOperationsReturn {
  projects: string[];
  currentProject?: string;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  copyToCodex: (request: CrossCliCopyRequest) => Promise<CrossCliCopyResponse>;
  copyFromCodex: (request: CrossCliCopyRequest) => Promise<CrossCliCopyResponse>;
  isCopying: boolean;
  fetchOtherServers: (projectPaths?: string[]) => Promise<OtherProjectsServersResponse>;
  isFetchingServers: boolean;
}

const EMPTY_PROJECTS: string[] = [];

/**
 * Combined hook for project operations (all projects, cross-CLI copy, other projects' servers)
 */
export function useProjectOperations(): UseProjectOperationsReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  // Fetch all projects
  const projectsQuery = useQuery({
    queryKey: projectsKeys.list(),
    queryFn: () => fetchAllProjects(),
    staleTime: STALE_TIME,
    enabled: true,
    retry: 2,
  });

  // Cross-CLI copy mutation
  const copyMutation = useMutation({
    mutationFn: (request: CrossCliCopyRequest) => crossCliCopy(request),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
    },
  });

  // Other projects servers query
  const serversQuery = useQuery({
    queryKey: projectsKeys.servers(),
    queryFn: () => fetchOtherProjectsServers(),
    staleTime: STALE_TIME,
    enabled: false, // Manual trigger only
    retry: 1,
  });

  const refetch = async () => {
    await projectsQuery.refetch();
  };

  const fetchOtherServers = async (projectPaths?: string[]) => {
    return await queryClient.fetchQuery({
      queryKey: projectsKeys.servers(projectPaths),
      queryFn: () => fetchOtherProjectsServers(projectPaths),
      staleTime: STALE_TIME,
    });
  };

  return {
    projects: projectsQuery.data?.projects ?? EMPTY_PROJECTS,
    currentProject: projectsQuery.data?.currentProject ?? projectPath ?? undefined,
    isLoading: projectsQuery.isLoading,
    error: projectsQuery.error,
    refetch,
    copyToCodex: (request) => copyMutation.mutateAsync({
      ...request,
      source: 'claude',
      target: 'codex',
      projectPath: request.projectPath ?? projectPath ?? undefined,
    }),
    copyFromCodex: (request) => copyMutation.mutateAsync({
      ...request,
      source: 'codex',
      target: 'claude',
      projectPath: request.projectPath ?? projectPath ?? undefined,
    }),
    isCopying: copyMutation.isPending,
    fetchOtherServers,
    isFetchingServers: serversQuery.isFetching,
  };
}
