// ========================================
// useProjectOverview Hook
// ========================================
// TanStack Query hook for project overview data

import { useQuery } from '@tanstack/react-query';
import { fetchProjectOverview } from '../lib/api';

// Query key factory
export const projectOverviewKeys = {
  all: ['projectOverview'] as const,
  detail: (path?: string) => [...projectOverviewKeys.all, 'detail', path] as const,
};

// Default stale time: 5 minutes
const STALE_TIME = 5 * 60 * 1000;

export interface UseProjectOverviewOptions {
  /** Override default stale time (ms) */
  staleTime?: number;
  /** Enable/disable the query */
  enabled?: boolean;
}

/**
 * Hook for fetching project overview data
 *
 * @example
 * ```tsx
 * const { projectOverview, isLoading } = useProjectOverview();
 * ```
 */
export function useProjectOverview(options: UseProjectOverviewOptions = {}) {
  const { staleTime = STALE_TIME, enabled = true } = options;

  const query = useQuery({
    queryKey: projectOverviewKeys.detail(),
    queryFn: fetchProjectOverview,
    staleTime,
    enabled,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  return {
    projectOverview: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
