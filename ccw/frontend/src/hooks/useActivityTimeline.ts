// ========================================
// useActivityTimeline Hook
// ========================================
// TanStack Query hook for fetching activity timeline data

import { useQuery } from '@tanstack/react-query';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

/**
 * Activity timeline data point structure
 */
export interface ActivityTimelineData {
  date: string; // ISO date string (YYYY-MM-DD)
  sessions: number;
  tasks: number;
}

// Query key factory
export const activityTimelineKeys = {
  all: ['activityTimeline'] as const,
  detail: (projectPath: string, start: string, end: string) =>
    [...activityTimelineKeys.all, 'detail', projectPath, start, end] as const,
};

// Default stale time: 30 seconds
const STALE_TIME = 30 * 1000;

export interface DateRange {
  start: Date;
  end: Date;
}

export interface UseActivityTimelineOptions {
  /** Date range for the timeline (default: last 7 days) */
  dateRange?: DateRange;
  /** Override default stale time (ms) */
  staleTime?: number;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Refetch interval (ms), 0 to disable */
  refetchInterval?: number;
}

export interface UseActivityTimelineReturn {
  /** Activity timeline data */
  data: ActivityTimelineData[] | undefined;
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
 * Get default date range (last 7 days)
 */
function getDefaultDateRange(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return { start, end };
}

/**
 * Format date to ISO date string (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Hook for fetching activity timeline data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useActivityTimeline();
 *
 * if (isLoading) return <ChartSkeleton />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return <ActivityLineChart data={data} />;
 * ```
 */
export function useActivityTimeline(
  options: UseActivityTimelineOptions = {}
): UseActivityTimelineReturn {
  const {
    dateRange = getDefaultDateRange(),
    staleTime = STALE_TIME,
    enabled = true,
    refetchInterval = 0,
  } = options;
  const projectPath = useWorkflowStore(selectProjectPath);

  const startStr = formatDate(dateRange.start);
  const endStr = formatDate(dateRange.end);

  // Only enable query when projectPath is available
  const queryEnabled = enabled && !!projectPath;

  const query = useQuery({
    queryKey: activityTimelineKeys.detail(projectPath || '', startStr, endStr),
    queryFn: async () => {
      if (!projectPath) throw new Error('Project path is required');

      // TODO: Replace with actual API endpoint once backend is ready
      const response = await fetch(
        `/api/activity-timeline?projectPath=${encodeURIComponent(projectPath)}&start=${startStr}&end=${endStr}`
      );
      if (!response.ok) throw new Error('Failed to fetch activity timeline');
      return response.json() as Promise<ActivityTimelineData[]>;
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
export function generateMockActivityTimeline(days: number = 7): ActivityTimelineData[] {
  const data: ActivityTimelineData[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    data.push({
      date: formatDate(date),
      sessions: Math.floor(Math.random() * 10) + 1,
      tasks: Math.floor(Math.random() * 25) + 5,
    });
  }

  return data;
}
