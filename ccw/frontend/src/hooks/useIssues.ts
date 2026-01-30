// ========================================
// useIssues Hook
// ========================================
// TanStack Query hooks for issues with queue management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchIssues,
  fetchIssueHistory,
  fetchIssueQueue,
  createIssue,
  updateIssue,
  deleteIssue,
  type Issue,
  type IssuesResponse,
} from '../lib/api';

// Query key factory
export const issuesKeys = {
  all: ['issues'] as const,
  lists: () => [...issuesKeys.all, 'list'] as const,
  list: (filters?: IssuesFilter) => [...issuesKeys.lists(), filters] as const,
  history: () => [...issuesKeys.all, 'history'] as const,
  queue: () => [...issuesKeys.all, 'queue'] as const,
  details: () => [...issuesKeys.all, 'detail'] as const,
  detail: (id: string) => [...issuesKeys.details(), id] as const,
};

// Default stale time: 30 seconds
const STALE_TIME = 30 * 1000;

export interface IssuesFilter {
  status?: Issue['status'][];
  priority?: Issue['priority'][];
  search?: string;
  includeHistory?: boolean;
}

export interface UseIssuesOptions {
  filter?: IssuesFilter;
  projectPath?: string;
  staleTime?: number;
  enabled?: boolean;
  refetchInterval?: number;
}

export interface UseIssuesReturn {
  issues: Issue[];
  historyIssues: Issue[];
  allIssues: Issue[];
  issuesByStatus: Record<Issue['status'], Issue[]>;
  issuesByPriority: Record<Issue['priority'], Issue[]>;
  openCount: number;
  criticalCount: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching and filtering issues
 */
export function useIssues(options: UseIssuesOptions = {}): UseIssuesReturn {
  const { filter, projectPath, staleTime = STALE_TIME, enabled = true, refetchInterval = 0 } = options;
  const queryClient = useQueryClient();

  const issuesQuery = useQuery({
    queryKey: issuesKeys.list(filter),
    queryFn: () => fetchIssues(projectPath),
    staleTime,
    enabled,
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
    retry: 2,
  });

  const historyQuery = useQuery({
    queryKey: issuesKeys.history(),
    queryFn: () => fetchIssueHistory(projectPath),
    staleTime,
    enabled: enabled && (filter?.includeHistory ?? false),
    retry: 2,
  });

  const allIssues = issuesQuery.data?.issues ?? [];
  const historyIssues = historyQuery.data?.issues ?? [];

  // Apply filters
  const filteredIssues = (() => {
    let issues = [...allIssues];

    if (filter?.includeHistory) {
      issues = [...issues, ...historyIssues];
    }

    if (filter?.status && filter.status.length > 0) {
      issues = issues.filter((i) => filter.status!.includes(i.status));
    }

    if (filter?.priority && filter.priority.length > 0) {
      issues = issues.filter((i) => filter.priority!.includes(i.priority));
    }

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      issues = issues.filter(
        (i) =>
          i.id.toLowerCase().includes(searchLower) ||
          i.title.toLowerCase().includes(searchLower) ||
          i.context?.toLowerCase().includes(searchLower)
      );
    }

    return issues;
  })();

  // Group by status
  const issuesByStatus: Record<Issue['status'], Issue[]> = {
    open: [],
    in_progress: [],
    resolved: [],
    closed: [],
    completed: [],
  };

  for (const issue of allIssues) {
    issuesByStatus[issue.status].push(issue);
  }

  // Group by priority
  const issuesByPriority: Record<Issue['priority'], Issue[]> = {
    low: [],
    medium: [],
    high: [],
    critical: [],
  };

  for (const issue of allIssues) {
    issuesByPriority[issue.priority].push(issue);
  }

  const refetch = async () => {
    await Promise.all([issuesQuery.refetch(), historyQuery.refetch()]);
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: issuesKeys.all });
  };

  return {
    issues: filteredIssues,
    historyIssues,
    allIssues,
    issuesByStatus,
    issuesByPriority,
    openCount: issuesByStatus.open.length + issuesByStatus.in_progress.length,
    criticalCount: issuesByPriority.critical.length,
    isLoading: issuesQuery.isLoading,
    isFetching: issuesQuery.isFetching || historyQuery.isFetching,
    error: issuesQuery.error || historyQuery.error,
    refetch,
    invalidate,
  };
}

/**
 * Hook for fetching issue queue
 */
export function useIssueQueue(projectPath?: string) {
  return useQuery({
    queryKey: issuesKeys.queue(),
    queryFn: () => fetchIssueQueue(projectPath),
    staleTime: STALE_TIME,
    retry: 2,
  });
}

// ========== Mutations ==========

export interface UseCreateIssueReturn {
  createIssue: (input: { title: string; context?: string; priority?: Issue['priority'] }) => Promise<Issue>;
  isCreating: boolean;
  error: Error | null;
}

export function useCreateIssue(): UseCreateIssueReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createIssue,
    onSuccess: (newIssue) => {
      queryClient.setQueryData<IssuesResponse>(issuesKeys.list(), (old) => {
        if (!old) return { issues: [newIssue] };
        return {
          issues: [newIssue, ...old.issues],
        };
      });
    },
  });

  return {
    createIssue: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseUpdateIssueReturn {
  updateIssue: (issueId: string, input: Partial<Issue>) => Promise<Issue>;
  isUpdating: boolean;
  error: Error | null;
}

export function useUpdateIssue(): UseUpdateIssueReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ issueId, input }: { issueId: string; input: Partial<Issue> }) =>
      updateIssue(issueId, input),
    onSuccess: (updatedIssue) => {
      queryClient.setQueryData<IssuesResponse>(issuesKeys.list(), (old) => {
        if (!old) return old;
        return {
          issues: old.issues.map((i) => (i.id === updatedIssue.id ? updatedIssue : i)),
        };
      });
    },
  });

  return {
    updateIssue: (issueId, input) => mutation.mutateAsync({ issueId, input }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseDeleteIssueReturn {
  deleteIssue: (issueId: string) => Promise<void>;
  isDeleting: boolean;
  error: Error | null;
}

export function useDeleteIssue(): UseDeleteIssueReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: deleteIssue,
    onMutate: async (issueId) => {
      await queryClient.cancelQueries({ queryKey: issuesKeys.all });
      const previousIssues = queryClient.getQueryData<IssuesResponse>(issuesKeys.list());

      queryClient.setQueryData<IssuesResponse>(issuesKeys.list(), (old) => {
        if (!old) return old;
        return {
          issues: old.issues.filter((i) => i.id !== issueId),
        };
      });

      return { previousIssues };
    },
    onError: (_error, _issueId, context) => {
      if (context?.previousIssues) {
        queryClient.setQueryData(issuesKeys.list(), context.previousIssues);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: issuesKeys.all });
    },
  });

  return {
    deleteIssue: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Combined hook for all issue mutations
 */
export function useIssueMutations() {
  const create = useCreateIssue();
  const update = useUpdateIssue();
  const remove = useDeleteIssue();

  return {
    createIssue: create.createIssue,
    updateIssue: update.updateIssue,
    deleteIssue: remove.deleteIssue,
    isCreating: create.isCreating,
    isUpdating: update.isUpdating,
    isDeleting: remove.isDeleting,
    isMutating: create.isCreating || update.isUpdating || remove.isDeleting,
  };
}
