// ========================================
// useMemory Hook
// ========================================
// TanStack Query hooks for core memory management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  type CoreMemory,
  type MemoryResponse,
} from '../lib/api';

// Query key factory
export const memoryKeys = {
  all: ['memory'] as const,
  lists: () => [...memoryKeys.all, 'list'] as const,
  list: (filters?: MemoryFilter) => [...memoryKeys.lists(), filters] as const,
  details: () => [...memoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...memoryKeys.details(), id] as const,
};

// Default stale time: 1 minute
const STALE_TIME = 60 * 1000;

export interface MemoryFilter {
  search?: string;
  tags?: string[];
}

export interface UseMemoryOptions {
  filter?: MemoryFilter;
  staleTime?: number;
  enabled?: boolean;
}

export interface UseMemoryReturn {
  memories: CoreMemory[];
  totalSize: number;
  claudeMdCount: number;
  allTags: string[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching and filtering memories
 */
export function useMemory(options: UseMemoryOptions = {}): UseMemoryReturn {
  const { filter, staleTime = STALE_TIME, enabled = true } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: memoryKeys.list(filter),
    queryFn: fetchMemories,
    staleTime,
    enabled,
    retry: 2,
  });

  const allMemories = query.data?.memories ?? [];
  const totalSize = query.data?.totalSize ?? 0;
  const claudeMdCount = query.data?.claudeMdCount ?? 0;

  // Apply filters
  const filteredMemories = (() => {
    let memories = allMemories;

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      memories = memories.filter(
        (m) =>
          m.content.toLowerCase().includes(searchLower) ||
          m.source?.toLowerCase().includes(searchLower) ||
          m.tags?.some((t) => t.toLowerCase().includes(searchLower))
      );
    }

    if (filter?.tags && filter.tags.length > 0) {
      memories = memories.filter((m) =>
        filter.tags!.some((tag) => m.tags?.includes(tag))
      );
    }

    return memories;
  })();

  // Collect all unique tags
  const allTags = Array.from(
    new Set(allMemories.flatMap((m) => m.tags ?? []))
  ).sort();

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: memoryKeys.all });
  };

  return {
    memories: filteredMemories,
    totalSize,
    claudeMdCount,
    allTags,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

// ========== Mutations ==========

export interface UseCreateMemoryReturn {
  createMemory: (input: { content: string; tags?: string[] }) => Promise<CoreMemory>;
  isCreating: boolean;
  error: Error | null;
}

export function useCreateMemory(): UseCreateMemoryReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createMemory,
    onSuccess: (newMemory) => {
      queryClient.setQueryData<MemoryResponse>(memoryKeys.list(), (old) => {
        if (!old) return { memories: [newMemory], totalSize: 0, claudeMdCount: 0 };
        return {
          ...old,
          memories: [newMemory, ...old.memories],
          totalSize: old.totalSize + (newMemory.size ?? 0),
        };
      });
    },
  });

  return {
    createMemory: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseUpdateMemoryReturn {
  updateMemory: (memoryId: string, input: Partial<CoreMemory>) => Promise<CoreMemory>;
  isUpdating: boolean;
  error: Error | null;
}

export function useUpdateMemory(): UseUpdateMemoryReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ memoryId, input }: { memoryId: string; input: Partial<CoreMemory> }) =>
      updateMemory(memoryId, input),
    onSuccess: (updatedMemory) => {
      queryClient.setQueryData<MemoryResponse>(memoryKeys.list(), (old) => {
        if (!old) return old;
        return {
          ...old,
          memories: old.memories.map((m) =>
            m.id === updatedMemory.id ? updatedMemory : m
          ),
        };
      });
    },
  });

  return {
    updateMemory: (memoryId, input) => mutation.mutateAsync({ memoryId, input }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseDeleteMemoryReturn {
  deleteMemory: (memoryId: string) => Promise<void>;
  isDeleting: boolean;
  error: Error | null;
}

export function useDeleteMemory(): UseDeleteMemoryReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: deleteMemory,
    onMutate: async (memoryId) => {
      await queryClient.cancelQueries({ queryKey: memoryKeys.all });
      const previousMemories = queryClient.getQueryData<MemoryResponse>(memoryKeys.list());

      queryClient.setQueryData<MemoryResponse>(memoryKeys.list(), (old) => {
        if (!old) return old;
        const removedMemory = old.memories.find((m) => m.id === memoryId);
        return {
          ...old,
          memories: old.memories.filter((m) => m.id !== memoryId),
          totalSize: old.totalSize - (removedMemory?.size ?? 0),
        };
      });

      return { previousMemories };
    },
    onError: (_error, _memoryId, context) => {
      if (context?.previousMemories) {
        queryClient.setQueryData(memoryKeys.list(), context.previousMemories);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.all });
    },
  });

  return {
    deleteMemory: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Combined hook for all memory mutations
 */
export function useMemoryMutations() {
  const create = useCreateMemory();
  const update = useUpdateMemory();
  const remove = useDeleteMemory();

  return {
    createMemory: create.createMemory,
    updateMemory: update.updateMemory,
    deleteMemory: remove.deleteMemory,
    isCreating: create.isCreating,
    isUpdating: update.isUpdating,
    isDeleting: remove.isDeleting,
    isMutating: create.isCreating || update.isUpdating || remove.isDeleting,
  };
}
