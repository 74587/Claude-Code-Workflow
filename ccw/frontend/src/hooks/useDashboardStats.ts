// ========================================
// useDashboardStats Hook
// ========================================
// TanStack Query hook for dashboard statistics

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDashboardStats, type DashboardStats } from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { workspaceQueryKeys } from '@/lib/queryKeys';

// Query key factory
export const dashboardStatsKeys = {
  all: ['dashboardStats'] as const,
  detail: () => [...dashboardStatsKeys.all, 'detail'] as const,
};

// Default stale time: 30 seconds
const STALE_TIME = 30 * 1000;

export interface UseDashboardStatsOptions {
  /** Override default stale time (ms) */
  staleTime?: number;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Refetch interval (ms), 0 to disable */
  refetchInterval?: number;
}

export interface UseDashboardStatsReturn {
  /** Dashboard statistics data */
  stats: DashboardStats | undefined;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Fetching state (initial or refetch) */
  isFetching: boolean;
  /** Error object if query failed */
  error: Error | null;
  /** Whether data is stale */
  isStale: boolean;
  /** Manually refetch data */
  refetch: () => Promise<void>;
  /** Invalidate and refetch stats */
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching and managing dashboard statistics
 *
 * @example
 * ```tsx
 * const { stats, isLoading, error } = useDashboardStats();
 *
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return (
 *   <StatsGrid>
 *     <StatCard title="Sessions" value={stats.totalSessions} />
 *     <StatCard title="Tasks" value={stats.totalTasks} />
 *   </StatsGrid>
 * );
 * ```
 */
export function useDashboardStats(
  options: UseDashboardStatsOptions = {}
): UseDashboardStatsReturn {
  const { staleTime = STALE_TIME, enabled = true, refetchInterval = 0 } = options;
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  // Only enable query when projectPath is available
  const queryEnabled = enabled && !!projectPath;

  const query = useQuery({
    queryKey: workspaceQueryKeys.projectOverview(projectPath),
    queryFn: fetchDashboardStats,
    staleTime,
    enabled: queryEnabled,
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    if (projectPath) {
      await queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.all(projectPath) });
    }
  };

  return {
    stats: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    isStale: query.isStale,
    refetch,
    invalidate,
  };
}

/**
 * Hook to prefetch dashboard stats
 * Use this to prefetch data before navigating to home page
 */
export function usePrefetchDashboardStats() {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  return () => {
    if (projectPath) {
      queryClient.prefetchQuery({
        queryKey: workspaceQueryKeys.projectOverview(projectPath),
        queryFn: fetchDashboardStats,
        staleTime: STALE_TIME,
      });
    }
  };
}
