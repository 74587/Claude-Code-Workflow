// ========================================
// useLiteTasks Hook
// ========================================
// Custom hook for fetching and managing lite tasks data

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLiteTasks, fetchLiteTaskSession, type LiteTaskSession, type LiteTasksResponse } from '@/lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { workspaceQueryKeys } from '@/lib/queryKeys';

type LiteTaskType = 'lite-plan' | 'lite-fix' | 'multi-cli-plan';

interface UseLiteTasksOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Hook for fetching all lite tasks sessions
 */
export function useLiteTasks(options: UseLiteTasksOptions = {}) {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  // Only enable query when projectPath is available
  const queryEnabled = (options.enabled ?? true) && !!projectPath;

  const {
    data = { litePlan: [], liteFix: [], multiCliPlan: [] },
    isLoading,
    error,
    refetch,
  } = useQuery<LiteTasksResponse>({
    queryKey: workspaceQueryKeys.liteTasks(projectPath),
    queryFn: () => fetchLiteTasks(projectPath),
    staleTime: 30000,
    refetchInterval: options.refetchInterval,
    enabled: queryEnabled,
  });

  // Get all sessions flattened
  const allSessions = [
    ...(data.litePlan || []).map(s => ({ ...s, _type: 'lite-plan' as LiteTaskType })),
    ...(data.liteFix || []).map(s => ({ ...s, _type: 'lite-fix' as LiteTaskType })),
    ...(data.multiCliPlan || []).map(s => ({ ...s, _type: 'multi-cli-plan' as LiteTaskType })),
  ];

  // Get sessions by type
  const getSessionsByType = (type: LiteTaskType): LiteTaskSession[] => {
    switch (type) {
      case 'lite-plan':
        return data.litePlan || [];
      case 'lite-fix':
        return data.liteFix || [];
      case 'multi-cli-plan':
        return data.multiCliPlan || [];
    }
  };

  // Prefetch a specific session
  const prefetchSession = (sessionId: string, type: LiteTaskType) => {
    queryClient.prefetchQuery({
      queryKey: ['liteTask', sessionId, type],
      queryFn: () => fetchLiteTaskSession(sessionId, type, projectPath),
      staleTime: 60000,
    });
  };

  return {
    litePlan: data.litePlan || [],
    liteFix: data.liteFix || [],
    multiCliPlan: data.multiCliPlan || [],
    allSessions,
    getSessionsByType,
    prefetchSession,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching a single lite task session
 */
export function useLiteTaskSession(sessionId: string | undefined, type: LiteTaskType) {
  const projectPath = useWorkflowStore(selectProjectPath);

  // Only enable query when sessionId, type, and projectPath are available
  const queryEnabled = !!sessionId && !!type && !!projectPath;

  const {
    data: session,
    isLoading,
    error,
    refetch,
  } = useQuery<LiteTaskSession | null>({
    queryKey: ['liteTask', sessionId, type, projectPath],
    queryFn: () => (sessionId ? fetchLiteTaskSession(sessionId, type, projectPath) : Promise.resolve(null)),
    enabled: queryEnabled,
    staleTime: 60000,
  });

  return {
    session,
    isLoading,
    error,
    refetch,
  };
}
