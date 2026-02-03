// ========================================
// useTaskTypeCounts Hook
// ========================================
// TanStack Query hook for fetching task type breakdown

import { useQuery } from '@tanstack/react-query';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

/**
 * Task type count data structure
 */
export interface TaskTypeCount {
  type: string;
  count: number;
  percentage?: number;
}

// Query key factory
export const taskTypeCountKeys = {
  all: ['taskTypeCounts'] as const,
  detail: (projectPath: string) => [...taskTypeCountKeys.all, 'detail', projectPath] as const,
};

// Default stale time: 30 seconds
const STALE_TIME = 30 * 1000;

export interface UseTaskTypeCountsOptions {
  /** Override default stale time (ms) */
  staleTime?: number;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Refetch interval (ms), 0 to disable */
  refetchInterval?: number;
}

export interface UseTaskTypeCountsReturn {
  /** Task type count data */
  data: TaskTypeCount[] | undefined;
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
}

/**
 * Hook for fetching task type breakdown
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useTaskTypeCounts();
 *
 * if (isLoading) return <ChartSkeleton />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return <TaskTypeBarChart data={data} />;
 * ```
 */
export function useTaskTypeCounts(
  options: UseTaskTypeCountsOptions = {}
): UseTaskTypeCountsReturn {
  const { staleTime = STALE_TIME, enabled = true, refetchInterval = 0 } = options;
  const projectPath = useWorkflowStore(selectProjectPath);

  // Only enable query when projectPath is available
  const queryEnabled = enabled && !!projectPath;

  const query = useQuery({
    queryKey: taskTypeCountKeys.detail(projectPath || ''),
    queryFn: async () => {
      if (!projectPath) throw new Error('Project path is required');

      // TODO: Replace with actual API endpoint once backend is ready
      const response = await fetch(`/api/task-type-counts?projectPath=${encodeURIComponent(projectPath)}`);
      if (!response.ok) throw new Error('Failed to fetch task type counts');
      return response.json() as Promise<TaskTypeCount[]>;
    },
    staleTime,
    enabled: queryEnabled,
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
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
    isStale: query.isStale,
    refetch,
  };
}

/**
 * Mock data generator for development/testing
 */
export function generateMockTaskTypeCounts(): TaskTypeCount[] {
  return [
    { type: 'implementation', count: 35, percentage: 35 },
    { type: 'bugfix', count: 25, percentage: 25 },
    { type: 'refactor', count: 18, percentage: 18 },
    { type: 'documentation', count: 12, percentage: 12 },
    { type: 'testing', count: 7, percentage: 7 },
    { type: 'other', count: 3, percentage: 3 },
  ];
}
