// ========================================
// useCodexLens Hook
// ========================================
// TanStack Query hooks for CodexLens v2 API management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';

// ========================================
// Domain types (exported for component use)
// ========================================

export interface ModelEntry {
  name: string;
  installed: boolean;
  type?: string;
  cache_path?: string;
}

export interface IndexStatusData {
  status?: string;
  files_tracked?: number;
  total_chunks?: number;
  deleted_chunks?: number;
  db_path?: string;
}

export type McpConfigData = Record<string, unknown>;
export interface CodexLensEnvData {
  values: Record<string, string>;
  defaults: Record<string, string>;
}

// Internal API response wrappers
interface ModelsResponse { success: boolean; models: ModelEntry[] }
interface IndexStatusResponse { success: boolean; status: IndexStatusData }
interface EnvResponse {
  success: boolean;
  env: Record<string, string>;
  defaults?: Record<string, string>;
}
interface McpConfigResponse { success: boolean; config: McpConfigData }

// ========================================
// Query Key Factory
// ========================================

export const codexLensKeys = {
  all: ['codexLens'] as const,
  models: () => [...codexLensKeys.all, 'models'] as const,
  indexStatus: (path: string) => [...codexLensKeys.all, 'indexStatus', path] as const,
  env: () => [...codexLensKeys.all, 'env'] as const,
  mcpConfig: () => [...codexLensKeys.all, 'mcpConfig'] as const,
};

// ========================================
// Models Hooks
// ========================================

export function useCodexLensModels() {
  return useQuery({
    queryKey: codexLensKeys.models(),
    queryFn: () => fetchApi<ModelsResponse>('/api/codexlens/models').then(r => r.models),
    staleTime: 30_000,
  });
}

export function useDownloadModel() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (modelName: string) =>
      fetchApi<{ success: boolean }>('/api/codexlens/models/download', {
        method: 'POST',
        body: JSON.stringify({ name: modelName }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.models() });
    },
  });

  return {
    downloadModel: mutation.mutateAsync,
    isDownloading: mutation.isPending,
    error: mutation.error,
  };
}

export function useDeleteModel() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (modelName: string) =>
      fetchApi<{ success: boolean }>('/api/codexlens/models/delete', {
        method: 'POST',
        body: JSON.stringify({ name: modelName }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.models() });
    },
  });

  return {
    deleteModel: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

// ========================================
// Index Hooks
// ========================================

export function useIndexStatus(projectPath: string) {
  return useQuery({
    queryKey: codexLensKeys.indexStatus(projectPath),
    queryFn: () =>
      fetchApi<IndexStatusResponse>(
        `/api/codexlens/index/status?projectPath=${encodeURIComponent(projectPath)}`
      ).then(r => r.status),
    enabled: !!projectPath,
    staleTime: 10_000,
  });
}

export function useSyncIndex() {
  const mutation = useMutation({
    mutationFn: (projectPath: string) =>
      fetchApi<{ success: boolean }>('/api/codexlens/index/sync', {
        method: 'POST',
        body: JSON.stringify({ projectPath }),
      }),
  });

  return {
    syncIndex: mutation.mutateAsync,
    isSyncing: mutation.isPending,
    error: mutation.error,
  };
}

export function useRebuildIndex() {
  const mutation = useMutation({
    mutationFn: (projectPath: string) =>
      fetchApi<{ success: boolean }>('/api/codexlens/index/rebuild', {
        method: 'POST',
        body: JSON.stringify({ projectPath }),
      }),
  });

  return {
    rebuildIndex: mutation.mutateAsync,
    isRebuilding: mutation.isPending,
    error: mutation.error,
  };
}

// ========================================
// Env Hooks
// ========================================

export function useCodexLensEnv() {
  return useQuery({
    queryKey: codexLensKeys.env(),
    queryFn: () =>
      fetchApi<EnvResponse>('/api/codexlens/env').then((r): CodexLensEnvData => ({
        values: r.env ?? {},
        defaults: r.defaults ?? {},
      })),
    staleTime: 60_000,
  });
}

export function useSaveCodexLensEnv() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (env: Record<string, string>) =>
      fetchApi<{ success: boolean }>('/api/codexlens/env', {
        method: 'POST',
        body: JSON.stringify({ env }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.env() });
      queryClient.invalidateQueries({ queryKey: codexLensKeys.mcpConfig() });
    },
  });

  return {
    saveEnv: mutation.mutateAsync,
    isSaving: mutation.isPending,
    error: mutation.error,
  };
}

// ========================================
// MCP Config Hooks
// ========================================

export function useCodexLensMcpConfig() {
  return useQuery({
    queryKey: codexLensKeys.mcpConfig(),
    queryFn: () => fetchApi<McpConfigResponse>('/api/codexlens/mcp-config').then(r => r.config),
    staleTime: 30_000,
  });
}
