// ========================================
// useSessionDetail Hook
// ========================================
// TanStack Query hook for session detail data

import { useQuery } from '@tanstack/react-query';
import { fetchSessionDetail } from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

// Query key factory - include projectPath as part of the key
export const sessionDetailKeys = {
  all: ['sessionDetail'] as const,
  detail: (id: string, projectPath: string) => [...sessionDetailKeys.all, 'detail', id, projectPath] as const,
};

// Default stale time: 30 seconds
const STALE_TIME = 30 * 1000;

export interface UseSessionDetailOptions {
  /** Override default stale time (ms) */
  staleTime?: number;
  /** Enable/disable the query */
  enabled?: boolean;
}

/**
 * Hook for fetching session detail data
 *
 * @example
 * ```tsx
 * const { sessionDetail, isLoading } = useSessionDetail(sessionId);
 * ```
 */
export function useSessionDetail(sessionId: string, options: UseSessionDetailOptions = {}) {
  const { staleTime = STALE_TIME, enabled = true } = options;

  const projectPath = useWorkflowStore(selectProjectPath);
  const queryEnabled = enabled && !!sessionId && !!projectPath;

  const query = useQuery({
    queryKey: sessionDetailKeys.detail(sessionId, projectPath),
    queryFn: () => fetchSessionDetail(sessionId, projectPath),
    staleTime,
    enabled: queryEnabled,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  return {
    sessionDetail: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
