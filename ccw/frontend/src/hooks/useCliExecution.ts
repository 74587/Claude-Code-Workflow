// ========================================
// useCliExecution Hook
// ========================================
// TanStack Query hook for CLI execution details

import { useQuery } from '@tanstack/react-query';
import {
  fetchExecutionDetail,
  type ConversationRecord,
} from '../lib/api';

// ========== Query Keys ==========

/**
 * Query key factory for CLI execution queries
 */
export const cliExecutionKeys = {
  all: ['cliExecution'] as const,
  details: () => [...cliExecutionKeys.all, 'detail'] as const,
  detail: (id: string | null) => [...cliExecutionKeys.details(), id] as const,
};

// ========== Constants ==========

/**
 * Default stale time: 5 minutes
 * Execution details don't change frequently after completion
 */
const STALE_TIME = 5 * 60 * 1000;

/**
 * Cache time: 10 minutes
 * Keep cached data available for potential re-use
 */
const GC_TIME = 10 * 60 * 1000;

// ========== Types ==========

export interface UseCliExecutionOptions {
  /** Override default stale time (ms) */
  staleTime?: number;
  /** Override default cache time (ms) */
  gcTime?: number;
  /** Enable/disable the query */
  enabled?: boolean;
}

export interface UseCliExecutionReturn {
  /** Execution detail data */
  data: ConversationRecord | undefined;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Fetching state (initial or refetch) */
  isFetching: boolean;
  /** Error object if query failed */
  error: Error | null;
  /** Manually refetch data */
  refetch: () => Promise<void>;
}

// ========== Hook ==========

/**
 * Hook for fetching CLI execution detail (conversation records)
 *
 * @param executionId - The CLI execution ID to fetch details for
 * @param options - Query options
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useCliExecutionDetail('exec-123');
 * ```
 *
 * @remarks
 * - Query is disabled when executionId is null/undefined
 * - Data is cached for 5 minutes by default
 * - Auto-refetch is disabled (execution details don't change)
 */
export function useCliExecutionDetail(
  executionId: string | null,
  options: UseCliExecutionOptions = {}
): UseCliExecutionReturn {
  const { staleTime = STALE_TIME, gcTime = GC_TIME, enabled = true } = options;

  const query = useQuery<ConversationRecord>({
    queryKey: cliExecutionKeys.detail(executionId),
    queryFn: () => {
      if (!executionId) throw new Error('executionId is required');
      return fetchExecutionDetail(executionId);
    },
    enabled: !!executionId && enabled,
    staleTime,
    gcTime,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
  };
}
