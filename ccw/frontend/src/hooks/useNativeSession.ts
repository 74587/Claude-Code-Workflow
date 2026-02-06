// ========================================
// useNativeSession Hook
// ========================================
// TanStack Query hook for native CLI session content

import { useQuery } from '@tanstack/react-query';
import {
  fetchNativeSession,
  type NativeSession,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

// ========== Query Keys ==========

export const nativeSessionKeys = {
  all: ['nativeSession'] as const,
  details: () => [...nativeSessionKeys.all, 'detail'] as const,
  detail: (id: string | null) => [...nativeSessionKeys.details(), id] as const,
};

// ========== Constants ==========

const STALE_TIME = 5 * 60 * 1000;
const GC_TIME = 10 * 60 * 1000;

// ========== Types ==========

export interface UseNativeSessionOptions {
  staleTime?: number;
  gcTime?: number;
  enabled?: boolean;
}

export interface UseNativeSessionReturn {
  data: NativeSession | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ========== Hook ==========

/**
 * Hook for fetching native CLI session content
 *
 * @param executionId - The CCW execution ID to fetch native session for
 * @param options - Query options
 */
export function useNativeSession(
  executionId: string | null,
  options: UseNativeSessionOptions = {}
): UseNativeSessionReturn {
  const { staleTime = STALE_TIME, gcTime = GC_TIME, enabled = true } = options;
  const projectPath = useWorkflowStore(selectProjectPath);

  const query = useQuery<NativeSession>({
    queryKey: nativeSessionKeys.detail(executionId),
    queryFn: () => {
      if (!executionId) throw new Error('executionId is required');
      return fetchNativeSession(executionId, projectPath);
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
