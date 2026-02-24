// ========================================
// useTeamData Hook
// ========================================
// TanStack Query hooks for team execution visualization

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTeams, fetchTeamMessages, fetchTeamStatus, archiveTeam, unarchiveTeam, deleteTeam } from '@/lib/api';
import { useTeamStore } from '@/stores/teamStore';
import type {
  TeamSummaryExtended,
  TeamMessage,
  TeamMember,
  TeamMessageFilter,
  TeamMessagesResponse,
  TeamStatusResponse,
  TeamsListResponse,
} from '@/types/team';

// Query key factory
export const teamKeys = {
  all: ['teams'] as const,
  lists: () => [...teamKeys.all, 'list'] as const,
  listByLocation: (location: string) => [...teamKeys.lists(), location] as const,
  messages: (team: string, filter?: TeamMessageFilter) =>
    [...teamKeys.all, 'messages', team, filter] as const,
  status: (team: string) => [...teamKeys.all, 'status', team] as const,
};

/**
 * Hook: list all teams with location filter
 */
export function useTeams(location?: string) {
  const autoRefresh = useTeamStore((s) => s.autoRefresh);
  const effectiveLocation = location || 'active';

  const query = useQuery({
    queryKey: teamKeys.listByLocation(effectiveLocation),
    queryFn: async (): Promise<TeamsListResponse> => {
      const data = await fetchTeams(effectiveLocation);
      return { teams: (data.teams ?? []) as TeamSummaryExtended[] };
    },
    staleTime: 10_000,
    refetchInterval: autoRefresh ? 10_000 : false,
  });

  return {
    teams: (query.data?.teams ?? []) as TeamSummaryExtended[],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook: get messages for selected team
 */
export function useTeamMessages(
  teamName: string | null,
  filter?: TeamMessageFilter,
  options?: { last?: number; offset?: number }
) {
  const autoRefresh = useTeamStore((s) => s.autoRefresh);

  const query = useQuery({
    queryKey: teamKeys.messages(teamName ?? '', filter),
    queryFn: async (): Promise<TeamMessagesResponse> => {
      if (!teamName) return { total: 0, showing: 0, messages: [] };
      const data = await fetchTeamMessages(teamName, {
        ...filter,
        last: options?.last ?? 50,
        offset: options?.offset,
      });
      return {
        total: data.total,
        showing: data.showing,
        messages: data.messages as unknown as TeamMessage[],
      };
    },
    enabled: !!teamName,
    staleTime: 5_000,
    refetchInterval: autoRefresh ? 5_000 : false,
  });

  return {
    messages: (query.data?.messages ?? []) as TeamMessage[],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook: get member status for selected team
 */
export function useTeamStatus(teamName: string | null) {
  const autoRefresh = useTeamStore((s) => s.autoRefresh);

  const query = useQuery({
    queryKey: teamKeys.status(teamName ?? ''),
    queryFn: async (): Promise<TeamStatusResponse> => {
      if (!teamName) return { members: [], total_messages: 0 };
      const data = await fetchTeamStatus(teamName);
      return {
        members: data.members as TeamMember[],
        total_messages: data.total_messages,
      };
    },
    enabled: !!teamName,
    staleTime: 5_000,
    refetchInterval: autoRefresh ? 5_000 : false,
  });

  return {
    members: (query.data?.members ?? []) as TeamMember[],
    totalMessages: query.data?.total_messages ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook: invalidate all team queries
 */
export function useInvalidateTeamData() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: teamKeys.all });
}

// ========== Mutation Hooks ==========

/**
 * Hook: archive a team
 */
export function useArchiveTeam() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: archiveTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
    },
  });

  return {
    archiveTeam: mutation.mutateAsync,
    isArchiving: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook: unarchive a team
 */
export function useUnarchiveTeam() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: unarchiveTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
    },
  });

  return {
    unarchiveTeam: mutation.mutateAsync,
    isUnarchiving: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook: delete a team
 */
export function useDeleteTeam() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: deleteTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
    },
  });

  return {
    deleteTeam: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}
