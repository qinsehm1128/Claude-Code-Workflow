// ========================================
// useSkills Hook
// ========================================
// TanStack Query hooks for skills management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSkills,
  enableSkill,
  disableSkill,
  type Skill,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { workspaceQueryKeys } from '@/lib/queryKeys';
import { useNotifications } from './useNotifications';
import { sanitizeErrorMessage } from '@/utils/errorSanitizer';
import { formatMessage } from '@/lib/i18n';

// Query key factory
export const skillsKeys = {
  all: ['skills'] as const,
  lists: () => [...skillsKeys.all, 'list'] as const,
  list: (filters?: SkillsFilter) => [...skillsKeys.lists(), filters] as const,
};

// Default stale time: 5 minutes (skills don't change frequently)
const STALE_TIME = 5 * 60 * 1000;

export interface SkillsFilter {
  search?: string;
  category?: string;
  source?: Skill['source'];
  enabledOnly?: boolean;
  location?: 'project' | 'user';
}

export interface UseSkillsOptions {
  filter?: SkillsFilter;
  staleTime?: number;
  enabled?: boolean;
  cliType?: 'claude' | 'codex';
}

export interface UseSkillsReturn {
  skills: Skill[];
  enabledSkills: Skill[];
  categories: string[];
  skillsByCategory: Record<string, Skill[]>;
  totalCount: number;
  enabledCount: number;
  projectSkills: Skill[];
  userSkills: Skill[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching and filtering skills
 */
export function useSkills(options: UseSkillsOptions = {}): UseSkillsReturn {
  const { filter, staleTime = STALE_TIME, enabled = true, cliType = 'claude' } = options;
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  const queryKey = cliType === 'codex'
    ? workspaceQueryKeys.codexSkillsList(projectPath)
    : workspaceQueryKeys.skillsList(projectPath);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchSkills(projectPath, cliType),
    staleTime,
    enabled: enabled,
    retry: 2,
  });

  const allSkills = query.data?.skills ?? [];

  // Separate by location
  const projectSkills = allSkills.filter(s => s.location === 'project');
  const userSkills = allSkills.filter(s => s.location === 'user');

  // Apply filters
  const filteredSkills = (() => {
    let skills = allSkills;

    if (filter?.location) {
      skills = skills.filter((s) => s.location === filter.location);
    }

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      skills = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(searchLower) ||
          s.description.toLowerCase().includes(searchLower) ||
          s.triggers.some((t) => t.toLowerCase().includes(searchLower))
      );
    }

    if (filter?.category) {
      skills = skills.filter((s) => s.category === filter.category);
    }

    if (filter?.source) {
      skills = skills.filter((s) => s.source === filter.source);
    }

    if (filter?.enabledOnly) {
      skills = skills.filter((s) => s.enabled);
    }

    return skills;
  })();

  // Group by category
  const skillsByCategory: Record<string, Skill[]> = {};
  const categories = new Set<string>();

  for (const skill of allSkills) {
    const category = skill.category || 'Uncategorized';
    categories.add(category);
    if (!skillsByCategory[category]) {
      skillsByCategory[category] = [];
    }
    skillsByCategory[category].push(skill);
  }

  const enabledSkills = allSkills.filter((s) => s.enabled);

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    if (projectPath) {
      const invalidateKey = cliType === 'codex'
        ? workspaceQueryKeys.codexSkills(projectPath)
        : workspaceQueryKeys.skills(projectPath);
      await queryClient.invalidateQueries({ queryKey: invalidateKey });
    }
  };

  return {
    skills: filteredSkills,
    enabledSkills,
    categories: Array.from(categories).sort(),
    skillsByCategory,
    totalCount: allSkills.length,
    enabledCount: enabledSkills.length,
    projectSkills,
    userSkills,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

// ========== Mutations ==========

export interface UseToggleSkillReturn {
  toggleSkill: (skillName: string, enabled: boolean, location: 'project' | 'user', cliType?: 'claude' | 'codex') => Promise<Skill>;
  isToggling: boolean;
  error: Error | null;
}

export function useToggleSkill(): UseToggleSkillReturn {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);
  const { addToast, removeToast, success, error } = useNotifications();

  const mutation = useMutation({
    mutationFn: ({ skillName, enabled, location, cliType = 'claude' }: { skillName: string; enabled: boolean; location: 'project' | 'user'; cliType?: 'claude' | 'codex' }) =>
      enabled
        ? enableSkill(skillName, location, projectPath, cliType)
        : disableSkill(skillName, location, projectPath, cliType),
    onMutate: (): { loadingId: string } => {
      const loadingId = addToast('info', formatMessage('common.loading'), undefined, { duration: 0 });
      return { loadingId };
    },
    onSuccess: (_, variables, context) => {
      const { loadingId } = context ?? { loadingId: '' };
      if (loadingId) removeToast(loadingId);

      const operation = variables.enabled ? 'skillEnable' : 'skillDisable';
      success(formatMessage(`feedback.${operation}.success`));

      // Invalidate both claude and codex skills queries
      if (projectPath) {
        queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.skills(projectPath) });
        queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.codexSkills(projectPath) });
      } else {
        queryClient.invalidateQueries({ queryKey: ['skills'] });
      }
    },
    onError: (err, variables, context) => {
      const { loadingId } = context ?? { loadingId: '' };
      if (loadingId) removeToast(loadingId);

      const operation = variables.enabled ? 'skillEnable' : 'skillDisable';
      const sanitized = sanitizeErrorMessage(err, operation);
      error(formatMessage('common.error'), formatMessage(sanitized.messageKey));
    },
  });

  return {
    toggleSkill: (skillName, enabled, location, cliType) => mutation.mutateAsync({ skillName, enabled, location, cliType }),
    isToggling: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook for deleting a skill
 */
export function useDeleteSkill() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      skillName,
      location,
      projectPath,
      cliType,
    }: {
      skillName: string;
      location: 'project' | 'user';
      projectPath?: string;
      cliType: 'claude' | 'codex';
    }) => {
      const { deleteSkill } = await import('@/lib/api');
      return deleteSkill(skillName, location, projectPath, cliType);
    },
    onSuccess: () => {
      // Invalidate skills queries to refresh the list
      queryClient.invalidateQueries({ queryKey: skillsKeys.all });
    },
  });

  return {
    deleteSkill: (skillName: string, location: 'project' | 'user', projectPath?: string, cliType: 'claude' | 'codex' = 'claude') =>
      mutation.mutateAsync({ skillName, location, projectPath, cliType }),
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Combined hook for all skill mutations
 */
export function useSkillMutations() {
  const toggle = useToggleSkill();
  const deleteSkillHook = useDeleteSkill();

  return {
    toggleSkill: toggle.toggleSkill,
    isToggling: toggle.isToggling,
    deleteSkill: deleteSkillHook.deleteSkill,
    isDeleting: deleteSkillHook.isDeleting,
    isMutating: toggle.isToggling || deleteSkillHook.isDeleting,
  };
}
