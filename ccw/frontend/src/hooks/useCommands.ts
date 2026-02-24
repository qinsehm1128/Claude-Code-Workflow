// ========================================
// useCommands Hook
// ========================================
// TanStack Query hooks for commands management

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  fetchCommands,
  toggleCommand as toggleCommandApi,
  toggleCommandGroup as toggleCommandGroupApi,
  type Command,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { useNotifications } from './useNotifications';
import { sanitizeErrorMessage } from '@/utils/errorSanitizer';
import { formatMessage } from '@/lib/i18n';
import { workspaceQueryKeys } from '@/lib/queryKeys';

// Default stale time: 10 minutes (commands are static)
const STALE_TIME = 10 * 60 * 1000;

export interface CommandsFilter {
  search?: string;
  category?: string;
  source?: Command['source'];
  group?: string;
  location?: 'project' | 'user';
  showDisabled?: boolean;
}

export interface UseCommandsOptions {
  filter?: CommandsFilter;
  staleTime?: number;
  enabled?: boolean;
}

export interface UseCommandsReturn {
  commands: Command[];
  categories: string[];
  commandsByCategory: Record<string, Command[]>;
  groupedCommands: Record<string, Command[]>;
  groups: string[];
  totalCount: number;
  enabledCount: number;
  disabledCount: number;
  projectCount: number;
  userCount: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching and filtering commands
 */

export interface UseCommandMutationsReturn {
  toggleCommand: (name: string, enabled: boolean, location: 'project' | 'user') => Promise<any>;
  toggleGroup: (groupName: string, enable: boolean, location: 'project' | 'user') => Promise<any>;
  isToggling: boolean;
}

export function useCommandMutations(): UseCommandMutationsReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);
  const { addToast, removeToast, success, error } = useNotifications();

  const toggleMutation = useMutation({
    mutationFn: ({ name, enabled, location }: { name: string; enabled: boolean; location: 'project' | 'user' }) =>
      toggleCommandApi(name, enabled, location, projectPath),
    onMutate: (): { loadingId: string } => {
      const loadingId = addToast('info', formatMessage('common.loading'), undefined, { duration: 0 });
      return { loadingId };
    },
    onSuccess: (_, __, context) => {
      const { loadingId } = context ?? { loadingId: '' };
      if (loadingId) removeToast(loadingId);
      success(formatMessage('feedback.commandToggle.success'));
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.commands(projectPath) });
    },
    onError: (err, __, context) => {
      const { loadingId } = context ?? { loadingId: '' };
      if (loadingId) removeToast(loadingId);
      const sanitized = sanitizeErrorMessage(err, 'commandToggle');
      error(formatMessage('common.error'), formatMessage(sanitized.messageKey));
    },
  });

  const toggleGroupMutation = useMutation({
    mutationFn: ({ groupName, enable, location }: { groupName: string; enable: boolean; location: 'project' | 'user' }) =>
      toggleCommandGroupApi(groupName, enable, location, projectPath),
    onMutate: (): { loadingId: string } => {
      const loadingId = addToast('info', formatMessage('common.loading'), undefined, { duration: 0 });
      return { loadingId };
    },
    onSuccess: (_, __, context) => {
      const { loadingId } = context ?? { loadingId: '' };
      if (loadingId) removeToast(loadingId);
      success(formatMessage('feedback.commandToggle.success'));
      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.commands(projectPath) });
    },
    onError: (err, __, context) => {
      const { loadingId } = context ?? { loadingId: '' };
      if (loadingId) removeToast(loadingId);
      const sanitized = sanitizeErrorMessage(err, 'commandToggle');
      error(formatMessage('common.error'), formatMessage(sanitized.messageKey));
    },
  });

  return {
    toggleCommand: (name, enabled, location) => toggleMutation.mutateAsync({ name, enabled, location }),
    toggleGroup: (groupName, enable, location) => toggleGroupMutation.mutateAsync({ groupName, enable, location }),
    isToggling: toggleMutation.isPending || toggleGroupMutation.isPending,
  };
}

export function useCommands(options: UseCommandsOptions = {}): UseCommandsReturn {
  const { filter, staleTime = STALE_TIME, enabled = true } = options;
  const queryClient = useQueryClient();

  const projectPath = useWorkflowStore(selectProjectPath);

  const query = useQuery({
    queryKey: workspaceQueryKeys.commandsList(projectPath),
    queryFn: () => fetchCommands(projectPath),
    staleTime,
    enabled: enabled,
    retry: 2,
  });

  const allCommands = query.data?.commands ?? [];

  // Per-location total counts (unfiltered, for tab badges)
  const projectCount = allCommands.filter(c => c.location === 'project').length;
  const userCount = allCommands.filter(c => c.location === 'user').length;

  // Apply filters (except showDisabled) for counts and grouping
  const baseFiltered = (() => {
    let commands = allCommands;

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      commands = commands.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.description.toLowerCase().includes(searchLower) ||
          c.aliases?.some((a) => a.toLowerCase().includes(searchLower))
      );
    }

    if (filter?.category) {
      commands = commands.filter((c) => c.category === filter.category);
    }

    if (filter?.source) {
      commands = commands.filter((c) => c.source === filter.source);
    }

    if (filter?.group) {
      commands = commands.filter((c) => c.group === filter.group);
    }

    if (filter?.location) {
      commands = commands.filter((c) => c.location === filter.location);
    }

    return commands;
  })();

  // Apply showDisabled filter for the returned commands list
  const filteredCommands = filter?.showDisabled === false
    ? baseFiltered.filter((c) => c.enabled !== false)
    : baseFiltered;

  // Group by category (from allCommands for global view)
  const commandsByCategory: Record<string, Command[]> = {};
  const categories = new Set<string>();

  for (const command of allCommands) {
    const category = command.category || 'Uncategorized';
    categories.add(category);
    if (!commandsByCategory[category]) {
      commandsByCategory[category] = [];
    }
    commandsByCategory[category].push(command);
  }

  // Group by group (from baseFiltered - respects location filter, includes disabled for accordion)
  const groupedCommands: Record<string, Command[]> = {};
  const groups = new Set<string>();
  const enabledCount = baseFiltered.filter(c => c.enabled !== false).length;
  const disabledCount = baseFiltered.length - enabledCount;

  for (const command of baseFiltered) {
    const group = command.group || 'other';
    groups.add(group);
    if (!groupedCommands[group]) {
      groupedCommands[group] = [];
    }
    groupedCommands[group].push(command);
  }

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.commands(projectPath) });
  };

  return {
    commands: filteredCommands,
    categories: Array.from(categories).sort(),
    commandsByCategory,
    groupedCommands,
    groups: Array.from(groups).sort(),
    enabledCount,
    disabledCount,
    projectCount,
    userCount,
    totalCount: allCommands.length,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

/**
 * Hook to search commands by name or alias
 */
export function useCommandSearch(searchTerm: string) {
  const { commands } = useCommands({ filter: { search: searchTerm } });
  return commands;
}
