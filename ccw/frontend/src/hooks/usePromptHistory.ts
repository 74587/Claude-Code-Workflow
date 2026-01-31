// ========================================
// usePromptHistory Hook
// ========================================
// TanStack Query hooks for prompt history with real-time updates

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPrompts,
  fetchPromptInsights,
  analyzePrompts,
  deletePrompt,
  type Prompt,
  type PromptInsight,
  type Pattern,
  type Suggestion,
  type PromptsResponse,
  type PromptInsightsResponse,
} from '../lib/api';

// Query key factory
export const promptHistoryKeys = {
  all: ['promptHistory'] as const,
  lists: () => [...promptHistoryKeys.all, 'list'] as const,
  list: (filters?: PromptHistoryFilter) => [...promptHistoryKeys.lists(), filters] as const,
  insights: () => [...promptHistoryKeys.all, 'insights'] as const,
};

// Default stale time: 30 seconds (prompts update less frequently)
const STALE_TIME = 30 * 1000;

export interface PromptHistoryFilter {
  search?: string;
  intent?: string;
  dateRange?: { start: Date | null; end: Date | null };
}

export interface UsePromptHistoryOptions {
  filter?: PromptHistoryFilter;
  staleTime?: number;
  enabled?: boolean;
}

export interface UsePromptHistoryReturn {
  prompts: Prompt[];
  totalPrompts: number;
  promptsBySession: Record<string, Prompt[]>;
  stats: {
    totalCount: number;
    avgLength: number;
    topIntent: string | null;
  };
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching and filtering prompt history
 */
export function usePromptHistory(options: UsePromptHistoryOptions = {}): UsePromptHistoryReturn {
  const { filter, staleTime = STALE_TIME, enabled = true } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: promptHistoryKeys.list(filter),
    queryFn: fetchPrompts,
    staleTime,
    enabled,
    retry: 2,
  });

  const allPrompts = query.data?.prompts ?? [];
  const totalCount = query.data?.total ?? 0;

  // Apply filters
  const filteredPrompts = (() => {
    let prompts = allPrompts;

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      prompts = prompts.filter(
        (p) =>
          p.title?.toLowerCase().includes(searchLower) ||
          p.content.toLowerCase().includes(searchLower) ||
          p.tags?.some((t) => t.toLowerCase().includes(searchLower))
      );
    }

    if (filter?.intent) {
      prompts = prompts.filter((p) => p.category === filter.intent);
    }

    if (filter?.dateRange?.start || filter?.dateRange?.end) {
      prompts = prompts.filter((p) => {
        const date = new Date(p.createdAt);
        const start = filter.dateRange?.start;
        const end = filter.dateRange?.end;
        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      });
    }

    return prompts;
  })();

  // Group by session for timeline view
  const promptsBySession: Record<string, Prompt[]> = {};
  for (const prompt of allPrompts) {
    const sessionKey = prompt.tags?.find((t) => t.startsWith('session:'))?.replace('session:', '') || 'ungrouped';
    if (!promptsBySession[sessionKey]) {
      promptsBySession[sessionKey] = [];
    }
    promptsBySession[sessionKey].push(prompt);
  }

  // Calculate stats
  const avgLength = allPrompts.length > 0
    ? Math.round(allPrompts.reduce((sum, p) => sum + p.content.length, 0) / allPrompts.length)
    : 0;

  const intentCounts: Record<string, number> = {};
  for (const prompt of allPrompts) {
    const category = prompt.category || 'uncategorized';
    intentCounts[category] = (intentCounts[category] || 0) + 1;
  }
  const topIntent = Object.entries(intentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: promptHistoryKeys.all });
  };

  return {
    prompts: filteredPrompts,
    totalPrompts: totalCount,
    promptsBySession,
    stats: {
      totalCount: allPrompts.length,
      avgLength,
      topIntent,
    },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

/**
 * Hook for fetching prompt insights
 */
export function usePromptInsights(options: { enabled?: boolean; staleTime?: number } = {}) {
  const { enabled = true, staleTime = STALE_TIME } = options;

  return useQuery({
    queryKey: promptHistoryKeys.insights(),
    queryFn: fetchPromptInsights,
    staleTime,
    enabled,
    retry: 2,
  });
}

// ========== Mutations ==========

export interface UseAnalyzePromptsReturn {
  analyzePrompts: (request?: { tool?: 'gemini' | 'qwen' | 'codex'; limit?: number }) => Promise<PromptInsightsResponse>;
  isAnalyzing: boolean;
  error: Error | null;
}

export function useAnalyzePrompts(): UseAnalyzePromptsReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: analyzePrompts,
    onSuccess: () => {
      // Invalidate insights query after analysis
      queryClient.invalidateQueries({ queryKey: promptHistoryKeys.insights() });
    },
  });

  return {
    analyzePrompts: mutation.mutateAsync,
    isAnalyzing: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseDeletePromptReturn {
  deletePrompt: (promptId: string) => Promise<void>;
  isDeleting: boolean;
  error: Error | null;
}

export function useDeletePrompt(): UseDeletePromptReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: deletePrompt,
    onMutate: async (promptId) => {
      await queryClient.cancelQueries({ queryKey: promptHistoryKeys.all });
      const previousPrompts = queryClient.getQueryData<PromptsResponse>(promptHistoryKeys.list());

      queryClient.setQueryData<PromptsResponse>(promptHistoryKeys.list(), (old) => {
        if (!old) return old;
        return {
          ...old,
          prompts: old.prompts.filter((p) => p.id !== promptId),
          total: old.total - 1,
        };
      });

      return { previousPrompts };
    },
    onError: (_error, _promptId, context) => {
      if (context?.previousPrompts) {
        queryClient.setQueryData(promptHistoryKeys.list(), context.previousPrompts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: promptHistoryKeys.all });
    },
  });

  return {
    deletePrompt: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Combined hook for all prompt history mutations
 */
export function usePromptHistoryMutations() {
  const analyze = useAnalyzePrompts();
  const remove = useDeletePrompt();

  return {
    analyzePrompts: analyze.analyzePrompts,
    deletePrompt: remove.deletePrompt,
    isAnalyzing: analyze.isAnalyzing,
    isDeleting: remove.isDeleting,
    isMutating: analyze.isAnalyzing || remove.isDeleting,
  };
}
