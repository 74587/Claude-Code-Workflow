// ========================================
// useTeamData Hook
// ========================================
// TanStack Query hooks for team execution visualization

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTeams, fetchTeamMessages, fetchTeamStatus } from '@/lib/api';
import { useTeamStore } from '@/stores/teamStore';
import type {
  TeamSummary,
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
  messages: (team: string, filter?: TeamMessageFilter) =>
    [...teamKeys.all, 'messages', team, filter] as const,
  status: (team: string) => [...teamKeys.all, 'status', team] as const,
};

/**
 * Hook: list all teams
 */
export function useTeams() {
  const autoRefresh = useTeamStore((s) => s.autoRefresh);

  const query = useQuery({
    queryKey: teamKeys.lists(),
    queryFn: async (): Promise<TeamsListResponse> => {
      const data = await fetchTeams();
      return { teams: data.teams ?? [] };
    },
    staleTime: 10_000,
    refetchInterval: autoRefresh ? 10_000 : false,
  });

  return {
    teams: (query.data?.teams ?? []) as TeamSummary[],
    isLoading: query.isLoading,
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
