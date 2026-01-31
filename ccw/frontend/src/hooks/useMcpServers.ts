// ========================================
// useMcpServers Hook
// ========================================
// TanStack Query hooks for MCP server management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchMcpServers,
  updateMcpServer,
  createMcpServer,
  deleteMcpServer,
  toggleMcpServer,
  type McpServer,
  type McpServersResponse,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

// Query key factory
export const mcpServersKeys = {
  all: ['mcpServers'] as const,
  lists: () => [...mcpServersKeys.all, 'list'] as const,
  list: (scope?: 'project' | 'global') => [...mcpServersKeys.lists(), scope] as const,
};

// Default stale time: 2 minutes (MCP servers change occasionally)
const STALE_TIME = 2 * 60 * 1000;

export interface UseMcpServersOptions {
  scope?: 'project' | 'global';
  staleTime?: number;
  enabled?: boolean;
}

export interface UseMcpServersReturn {
  servers: McpServer[];
  projectServers: McpServer[];
  globalServers: McpServer[];
  totalCount: number;
  enabledCount: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/**
 * Hook for fetching MCP servers
 */
export function useMcpServers(options: UseMcpServersOptions = {}): UseMcpServersReturn {
  const { scope, staleTime = STALE_TIME, enabled = true } = options;
  const queryClient = useQueryClient();

  const projectPath = useWorkflowStore(selectProjectPath);
  const queryEnabled = enabled && !!projectPath;

  const query = useQuery({
    queryKey: mcpServersKeys.list(scope),
    queryFn: () => fetchMcpServers(projectPath),
    staleTime,
    enabled: queryEnabled,
    retry: 2,
  });

  const projectServers = query.data?.project ?? [];
  const globalServers = query.data?.global ?? [];
  const allServers = scope === 'project' ? projectServers : scope === 'global' ? globalServers : [...projectServers, ...globalServers];

  const enabledServers = allServers.filter((s) => s.enabled);

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
  };

  return {
    servers: allServers,
    projectServers,
    globalServers,
    totalCount: allServers.length,
    enabledCount: enabledServers.length,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

// ========== Mutations ==========

export interface UseUpdateMcpServerReturn {
  updateServer: (serverName: string, config: Partial<McpServer>) => Promise<McpServer>;
  isUpdating: boolean;
  error: Error | null;
}

export function useUpdateMcpServer(): UseUpdateMcpServerReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ serverName, config }: { serverName: string; config: Partial<McpServer> }) =>
      updateMcpServer(serverName, config),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
    },
  });

  return {
    updateServer: (serverName, config) => mutation.mutateAsync({ serverName, config }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseCreateMcpServerReturn {
  createServer: (server: Omit<McpServer, 'name'>) => Promise<McpServer>;
  isCreating: boolean;
  error: Error | null;
}

export function useCreateMcpServer(): UseCreateMcpServerReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (server: Omit<McpServer, 'name'>) => createMcpServer(server),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
    },
  });

  return {
    createServer: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseDeleteMcpServerReturn {
  deleteServer: (serverName: string) => Promise<void>;
  isDeleting: boolean;
  error: Error | null;
}

export function useDeleteMcpServer(): UseDeleteMcpServerReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (serverName: string) => deleteMcpServer(serverName),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
    },
  });

  return {
    deleteServer: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseToggleMcpServerReturn {
  toggleServer: (serverName: string, enabled: boolean) => Promise<McpServer>;
  isToggling: boolean;
  error: Error | null;
}

export function useToggleMcpServer(): UseToggleMcpServerReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ serverName, enabled }: { serverName: string; enabled: boolean }) =>
      toggleMcpServer(serverName, enabled),
    onMutate: async ({ serverName, enabled }) => {
      await queryClient.cancelQueries({ queryKey: mcpServersKeys.all });
      const previousServers = queryClient.getQueryData<McpServersResponse>(mcpServersKeys.list());

      // Optimistic update
      queryClient.setQueryData<McpServersResponse>(mcpServersKeys.list(), (old) => {
        if (!old) return old;
        const updateServer = (servers: McpServer[]) =>
          servers.map((s) => (s.name === serverName ? { ...s, enabled } : s));
        return {
          project: updateServer(old.project),
          global: updateServer(old.global),
        };
      });

      return { previousServers };
    },
    onError: (_error, _vars, context) => {
      if (context?.previousServers) {
        queryClient.setQueryData(mcpServersKeys.list(), context.previousServers);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
    },
  });

  return {
    toggleServer: (serverName, enabled) => mutation.mutateAsync({ serverName, enabled }),
    isToggling: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Combined hook for all MCP server mutations
 */
export function useMcpServerMutations() {
  const update = useUpdateMcpServer();
  const create = useCreateMcpServer();
  const remove = useDeleteMcpServer();
  const toggle = useToggleMcpServer();

  return {
    updateServer: update.updateServer,
    isUpdating: update.isUpdating,
    createServer: create.createServer,
    isCreating: create.isCreating,
    deleteServer: remove.deleteServer,
    isDeleting: remove.isDeleting,
    toggleServer: toggle.toggleServer,
    isToggling: toggle.isToggling,
    isMutating: update.isUpdating || create.isCreating || remove.isDeleting || toggle.isToggling,
  };
}
