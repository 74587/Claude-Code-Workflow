// ========================================
// useV2SearchManager Hook
// ========================================
// React hook for v2 search management via smart_search tool

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ========== Types ==========

export interface V2IndexStatus {
  indexed: boolean;
  totalFiles: number;
  totalChunks: number;
  lastIndexedAt: string | null;
  dbSizeBytes: number;
  vectorDimension: number | null;
  ftsEnabled: boolean;
}

export interface V2SearchTestResult {
  query: string;
  results: Array<{
    file: string;
    score: number;
    snippet: string;
  }>;
  timingMs: number;
  totalResults: number;
}

export interface UseV2SearchManagerReturn {
  status: V2IndexStatus | null;
  isLoadingStatus: boolean;
  statusError: Error | null;
  refetchStatus: () => void;
  search: (query: string) => Promise<V2SearchTestResult>;
  isSearching: boolean;
  searchResult: V2SearchTestResult | null;
  reindex: () => Promise<void>;
  isReindexing: boolean;
}

// ========== API helpers ==========

async function fetchWithJson<T>(url: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

async function fetchV2Status(): Promise<V2IndexStatus> {
  const data = await fetchWithJson<{ result?: V2IndexStatus; error?: string }>('/api/tools', {
    tool_name: 'smart_search',
    action: 'status',
  });
  if (data.error) {
    throw new Error(data.error);
  }
  // Provide defaults for fields that may be missing
  return {
    indexed: false,
    totalFiles: 0,
    totalChunks: 0,
    lastIndexedAt: null,
    dbSizeBytes: 0,
    vectorDimension: null,
    ftsEnabled: false,
    ...data.result,
  };
}

async function fetchV2Search(query: string): Promise<V2SearchTestResult> {
  const data = await fetchWithJson<{ result?: V2SearchTestResult; error?: string }>('/api/tools', {
    tool_name: 'smart_search',
    action: 'search',
    params: { query, limit: 10 },
  });
  if (data.error) {
    throw new Error(data.error);
  }
  return data.result ?? { query, results: [], timingMs: 0, totalResults: 0 };
}

async function fetchV2Reindex(): Promise<void> {
  const data = await fetchWithJson<{ error?: string }>('/api/tools', {
    tool_name: 'smart_search',
    action: 'reindex',
  });
  if (data.error) {
    throw new Error(data.error);
  }
}

// ========== Query Keys ==========

export const v2SearchKeys = {
  all: ['v2-search'] as const,
  status: () => [...v2SearchKeys.all, 'status'] as const,
};

// ========== Hook ==========

export function useV2SearchManager(): UseV2SearchManagerReturn {
  const queryClient = useQueryClient();
  const [searchResult, setSearchResult] = useState<V2SearchTestResult | null>(null);

  // Status query
  const statusQuery = useQuery({
    queryKey: v2SearchKeys.status(),
    queryFn: fetchV2Status,
    staleTime: 30_000,
    retry: 1,
  });

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: (query: string) => fetchV2Search(query),
    onSuccess: (data) => {
      setSearchResult(data);
    },
  });

  // Reindex mutation
  const reindexMutation = useMutation({
    mutationFn: fetchV2Reindex,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: v2SearchKeys.status() });
    },
  });

  const search = useCallback(async (query: string) => {
    const result = await searchMutation.mutateAsync(query);
    return result;
  }, [searchMutation]);

  const reindex = useCallback(async () => {
    await reindexMutation.mutateAsync();
  }, [reindexMutation]);

  return {
    status: statusQuery.data ?? null,
    isLoadingStatus: statusQuery.isLoading,
    statusError: statusQuery.error as Error | null,
    refetchStatus: () => statusQuery.refetch(),
    search,
    isSearching: searchMutation.isPending,
    searchResult,
    reindex,
    isReindexing: reindexMutation.isPending,
  };
}
