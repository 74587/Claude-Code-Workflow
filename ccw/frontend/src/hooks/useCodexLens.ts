// ========================================
// useCodexLens Hook
// ========================================
// TanStack Query hooks for CodexLens management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCodexLensDashboardInit,
  fetchCodexLensStatus,
  fetchCodexLensWorkspaceStatus,
  fetchCodexLensConfig,
  updateCodexLensConfig,
  bootstrapCodexLens,
  uninstallCodexLens,
  fetchCodexLensModels,
  fetchCodexLensModelInfo,
  downloadCodexLensModel,
  downloadCodexLensCustomModel,
  deleteCodexLensModel,
  deleteCodexLensModelByPath,
  fetchCodexLensEnv,
  updateCodexLensEnv,
  fetchCodexLensGpuDetect,
  fetchCodexLensGpuList,
  selectCodexLensGpu,
  resetCodexLensGpu,
  fetchCodexLensIgnorePatterns,
  updateCodexLensIgnorePatterns,
  type CodexLensDashboardInitResponse,
  type CodexLensVenvStatus,
  type CodexLensConfig,
  type CodexLensModelsResponse,
  type CodexLensModelInfoResponse,
  type CodexLensEnvResponse,
  type CodexLensUpdateEnvResponse,
  type CodexLensGpuDetectResponse,
  type CodexLensGpuListResponse,
  type CodexLensIgnorePatternsResponse,
  type CodexLensUpdateEnvRequest,
  type CodexLensUpdateIgnorePatternsRequest,
  type CodexLensWorkspaceStatus,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

// Query key factory
export const codexLensKeys = {
  all: ['codexLens'] as const,
  dashboard: () => [...codexLensKeys.all, 'dashboard'] as const,
  status: () => [...codexLensKeys.all, 'status'] as const,
  workspace: (path?: string) => [...codexLensKeys.all, 'workspace', path] as const,
  config: () => [...codexLensKeys.all, 'config'] as const,
  models: () => [...codexLensKeys.all, 'models'] as const,
  modelInfo: (profile: string) => [...codexLensKeys.models(), 'info', profile] as const,
  env: () => [...codexLensKeys.all, 'env'] as const,
  gpu: () => [...codexLensKeys.all, 'gpu'] as const,
  gpuList: () => [...codexLensKeys.gpu(), 'list'] as const,
  gpuDetect: () => [...codexLensKeys.gpu(), 'detect'] as const,
  ignorePatterns: () => [...codexLensKeys.all, 'ignorePatterns'] as const,
};

// Default stale times
const STALE_TIME_SHORT = 30 * 1000; // 30 seconds for frequently changing data
const STALE_TIME_MEDIUM = 2 * 60 * 1000; // 2 minutes for moderately changing data
const STALE_TIME_LONG = 10 * 60 * 1000; // 10 minutes for rarely changing data

// ========== Query Hooks ==========

export interface UseCodexLensDashboardOptions {
  enabled?: boolean;
  staleTime?: number;
}

export interface UseCodexLensDashboardReturn {
  data: CodexLensDashboardInitResponse | undefined;
  installed: boolean;
  status: CodexLensVenvStatus | undefined;
  config: CodexLensConfig | undefined;
  semantic: { available: boolean } | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching CodexLens dashboard initialization data
 */
export function useCodexLensDashboard(options: UseCodexLensDashboardOptions = {}): UseCodexLensDashboardReturn {
  const { enabled = true, staleTime = STALE_TIME_SHORT } = options;

  const query = useQuery({
    queryKey: codexLensKeys.dashboard(),
    queryFn: fetchCodexLensDashboardInit,
    staleTime,
    enabled,
    retry: 2,
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    data: query.data,
    installed: query.data?.installed ?? false,
    status: query.data?.status,
    config: query.data?.config,
    semantic: query.data?.semantic,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
  };
}

export interface UseCodexLensStatusOptions {
  enabled?: boolean;
  staleTime?: number;
}

export interface UseCodexLensStatusReturn {
  status: CodexLensVenvStatus | undefined;
  ready: boolean;
  installed: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching CodexLens venv status
 */
export function useCodexLensStatus(options: UseCodexLensStatusOptions = {}): UseCodexLensStatusReturn {
  const { enabled = true, staleTime = STALE_TIME_SHORT } = options;

  const query = useQuery({
    queryKey: codexLensKeys.status(),
    queryFn: fetchCodexLensStatus,
    staleTime,
    enabled,
    retry: 2,
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    status: query.data,
    ready: query.data?.ready ?? false,
    installed: query.data?.installed ?? false,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

export interface UseCodexLensWorkspaceStatusOptions {
  projectPath?: string;
  enabled?: boolean;
  staleTime?: number;
}

export interface UseCodexLensWorkspaceStatusReturn {
  data: CodexLensWorkspaceStatus | undefined;
  hasIndex: boolean;
  ftsPercent: number;
  vectorPercent: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching CodexLens workspace index status
 */
export function useCodexLensWorkspaceStatus(options: UseCodexLensWorkspaceStatusOptions = {}): UseCodexLensWorkspaceStatusReturn {
  const { projectPath, enabled = true, staleTime = STALE_TIME_SHORT } = options;
  const projectPathFromStore = useWorkflowStore(selectProjectPath);
  const actualProjectPath = projectPath ?? projectPathFromStore;
  const queryEnabled = enabled && !!actualProjectPath;

  const query = useQuery({
    queryKey: codexLensKeys.workspace(actualProjectPath),
    queryFn: () => fetchCodexLensWorkspaceStatus(actualProjectPath),
    staleTime,
    enabled: queryEnabled,
    retry: 2,
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    data: query.data,
    hasIndex: query.data?.hasIndex ?? false,
    ftsPercent: query.data?.fts.percent ?? 0,
    vectorPercent: query.data?.vector.percent ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

export interface UseCodexLensConfigOptions {
  enabled?: boolean;
  staleTime?: number;
}

export interface UseCodexLensConfigReturn {
  config: CodexLensConfig | undefined;
  indexDir: string;
  indexCount: number;
  apiMaxWorkers: number;
  apiBatchSize: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching CodexLens configuration
 */
export function useCodexLensConfig(options: UseCodexLensConfigOptions = {}): UseCodexLensConfigReturn {
  const { enabled = true, staleTime = STALE_TIME_MEDIUM } = options;

  const query = useQuery({
    queryKey: codexLensKeys.config(),
    queryFn: fetchCodexLensConfig,
    staleTime,
    enabled,
    retry: 2,
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    config: query.data,
    indexDir: query.data?.index_dir ?? '~/.codexlens/indexes',
    indexCount: query.data?.index_count ?? 0,
    apiMaxWorkers: query.data?.api_max_workers ?? 4,
    apiBatchSize: query.data?.api_batch_size ?? 8,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

export interface UseCodexLensModelsOptions {
  enabled?: boolean;
  staleTime?: number;
}

export interface UseCodexLensModelsReturn {
  models: CodexLensModelsResponse['models'] | undefined;
  embeddingModels: CodexLensModelsResponse['models'] | undefined;
  rerankerModels: CodexLensModelsResponse['models'] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching CodexLens models list
 */
export function useCodexLensModels(options: UseCodexLensModelsOptions = {}): UseCodexLensModelsReturn {
  const { enabled = true, staleTime = STALE_TIME_MEDIUM } = options;

  const query = useQuery({
    queryKey: codexLensKeys.models(),
    queryFn: fetchCodexLensModels,
    staleTime,
    enabled,
    retry: 2,
  });

  const refetch = async () => {
    await query.refetch();
  };

  const models = query.data?.models ?? [];
  const embeddingModels = models?.filter(m => m.type === 'embedding');
  const rerankerModels = models?.filter(m => m.type === 'reranker');

  return {
    models,
    embeddingModels,
    rerankerModels,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

export interface UseCodexLensModelInfoOptions {
  profile: string;
  enabled?: boolean;
  staleTime?: number;
}

export interface UseCodexLensModelInfoReturn {
  info: CodexLensModelInfoResponse['info'] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching CodexLens model info by profile
 */
export function useCodexLensModelInfo(options: UseCodexLensModelInfoOptions): UseCodexLensModelInfoReturn {
  const { profile, enabled = true, staleTime = STALE_TIME_LONG } = options;
  const queryEnabled = enabled && !!profile;

  const query = useQuery({
    queryKey: codexLensKeys.modelInfo(profile),
    queryFn: () => fetchCodexLensModelInfo(profile),
    staleTime,
    enabled: queryEnabled,
    retry: 2,
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    info: query.data?.info,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

export interface UseCodexLensEnvOptions {
  enabled?: boolean;
  staleTime?: number;
}

export interface UseCodexLensEnvReturn {
  data: CodexLensEnvResponse | undefined;
  env: Record<string, string> | undefined;
  settings: Record<string, string> | undefined;
  raw: string | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching CodexLens environment variables
 */
export function useCodexLensEnv(options: UseCodexLensEnvOptions = {}): UseCodexLensEnvReturn {
  const { enabled = true, staleTime = STALE_TIME_MEDIUM } = options;

  const query = useQuery({
    queryKey: codexLensKeys.env(),
    queryFn: fetchCodexLensEnv,
    staleTime,
    enabled,
    retry: 2,
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    data: query.data,
    env: query.data?.env,
    settings: query.data?.settings,
    raw: query.data?.raw,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

export interface UseCodexLensGpuOptions {
  enabled?: boolean;
  staleTime?: number;
}

export interface UseCodexLensGpuReturn {
  detectData: CodexLensGpuDetectResponse | undefined;
  listData: CodexLensGpuListResponse | undefined;
  supported: boolean;
  devices: CodexLensGpuListResponse['devices'] | undefined;
  selectedDeviceId: string | number | undefined;
  isLoadingDetect: boolean;
  isLoadingList: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching CodexLens GPU information
 * Combines both detect and list queries
 */
export function useCodexLensGpu(options: UseCodexLensGpuOptions = {}): UseCodexLensGpuReturn {
  const { enabled = true, staleTime = STALE_TIME_LONG } = options;

  const detectQuery = useQuery({
    queryKey: codexLensKeys.gpuDetect(),
    queryFn: fetchCodexLensGpuDetect,
    staleTime,
    enabled,
    retry: 2,
  });

  const listQuery = useQuery({
    queryKey: codexLensKeys.gpuList(),
    queryFn: fetchCodexLensGpuList,
    staleTime,
    enabled,
    retry: 2,
  });

  const refetch = async () => {
    await Promise.all([detectQuery.refetch(), listQuery.refetch()]);
  };

  return {
    detectData: detectQuery.data,
    listData: listQuery.data,
    supported: detectQuery.data?.supported ?? false,
    devices: listQuery.data?.devices,
    selectedDeviceId: listQuery.data?.selected_device_id,
    isLoadingDetect: detectQuery.isLoading,
    isLoadingList: listQuery.isLoading,
    error: detectQuery.error || listQuery.error,
    refetch,
  };
}

export interface UseCodexLensIgnorePatternsOptions {
  enabled?: boolean;
  staleTime?: number;
}

export interface UseCodexLensIgnorePatternsReturn {
  data: CodexLensIgnorePatternsResponse | undefined;
  patterns: string[] | undefined;
  extensionFilters: string[] | undefined;
  defaults: CodexLensIgnorePatternsResponse['defaults'] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching CodexLens ignore patterns
 */
export function useCodexLensIgnorePatterns(options: UseCodexLensIgnorePatternsOptions = {}): UseCodexLensIgnorePatternsReturn {
  const { enabled = true, staleTime = STALE_TIME_LONG } = options;

  const query = useQuery({
    queryKey: codexLensKeys.ignorePatterns(),
    queryFn: fetchCodexLensIgnorePatterns,
    staleTime,
    enabled,
    retry: 2,
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    data: query.data,
    patterns: query.data?.patterns,
    extensionFilters: query.data?.extensionFilters,
    defaults: query.data?.defaults,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

// ========== Mutation Hooks ==========

export interface UseUpdateCodexLensConfigReturn {
  updateConfig: (config: { index_dir: string; api_max_workers?: number; api_batch_size?: number }) => Promise<{ success: boolean; message?: string }>;
  isUpdating: boolean;
  error: Error | null;
}

/**
 * Hook for updating CodexLens configuration
 */
export function useUpdateCodexLensConfig(): UseUpdateCodexLensConfigReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: updateCodexLensConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.config() });
      queryClient.invalidateQueries({ queryKey: codexLensKeys.dashboard() });
    },
  });

  return {
    updateConfig: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseBootstrapCodexLensReturn {
  bootstrap: () => Promise<{ success: boolean; message?: string; version?: string }>;
  isBootstrapping: boolean;
  error: Error | null;
}

/**
 * Hook for bootstrapping/installing CodexLens
 */
export function useBootstrapCodexLens(): UseBootstrapCodexLensReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: bootstrapCodexLens,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.all });
    },
  });

  return {
    bootstrap: mutation.mutateAsync,
    isBootstrapping: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseUninstallCodexLensReturn {
  uninstall: () => Promise<{ success: boolean; message?: string }>;
  isUninstalling: boolean;
  error: Error | null;
}

/**
 * Hook for uninstalling CodexLens
 */
export function useUninstallCodexLens(): UseUninstallCodexLensReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: uninstallCodexLens,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.all });
    },
  });

  return {
    uninstall: mutation.mutateAsync,
    isUninstalling: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseDownloadModelReturn {
  downloadModel: (profile: string) => Promise<{ success: boolean; message?: string }>;
  downloadCustomModel: (modelName: string, modelType?: string) => Promise<{ success: boolean; message?: string }>;
  isDownloading: boolean;
  error: Error | null;
}

/**
 * Hook for downloading CodexLens models
 */
export function useDownloadModel(): UseDownloadModelReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ profile, modelName, modelType }: { profile?: string; modelName?: string; modelType?: string }) => {
      if (profile) return downloadCodexLensModel(profile);
      if (modelName) return downloadCodexLensCustomModel(modelName, modelType);
      throw new Error('Either profile or modelName must be provided');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.models() });
    },
  });

  return {
    downloadModel: (profile) => mutation.mutateAsync({ profile }),
    downloadCustomModel: (modelName, modelType) => mutation.mutateAsync({ modelName, modelType }),
    isDownloading: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseDeleteModelReturn {
  deleteModel: (profile: string) => Promise<{ success: boolean; message?: string }>;
  deleteModelByPath: (cachePath: string) => Promise<{ success: boolean; message?: string }>;
  isDeleting: boolean;
  error: Error | null;
}

/**
 * Hook for deleting CodexLens models
 */
export function useDeleteModel(): UseDeleteModelReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ profile, cachePath }: { profile?: string; cachePath?: string }) => {
      if (profile) return deleteCodexLensModel(profile);
      if (cachePath) return deleteCodexLensModelByPath(cachePath);
      throw new Error('Either profile or cachePath must be provided');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.models() });
    },
  });

  return {
    deleteModel: (profile) => mutation.mutateAsync({ profile }),
    deleteModelByPath: (cachePath) => mutation.mutateAsync({ cachePath }),
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseUpdateCodexLensEnvReturn {
  updateEnv: (request: CodexLensUpdateEnvRequest) => Promise<CodexLensUpdateEnvResponse>;
  isUpdating: boolean;
  error: Error | null;
}

/**
 * Hook for updating CodexLens environment variables
 */
export function useUpdateCodexLensEnv(): UseUpdateCodexLensEnvReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (request: CodexLensUpdateEnvRequest) => updateCodexLensEnv(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.env() });
      queryClient.invalidateQueries({ queryKey: codexLensKeys.dashboard() });
    },
  });

  return {
    updateEnv: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseSelectGpuReturn {
  selectGpu: (deviceId: string | number) => Promise<{ success: boolean; message?: string }>;
  resetGpu: () => Promise<{ success: boolean; message?: string }>;
  isSelecting: boolean;
  isResetting: boolean;
  error: Error | null;
}

/**
 * Hook for selecting/resetting GPU for CodexLens
 */
export function useSelectGpu(): UseSelectGpuReturn {
  const queryClient = useQueryClient();

  const selectMutation = useMutation({
    mutationFn: (deviceId: string | number) => selectCodexLensGpu(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.gpu() });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetCodexLensGpu(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.gpu() });
    },
  });

  return {
    selectGpu: selectMutation.mutateAsync,
    resetGpu: resetMutation.mutateAsync,
    isSelecting: selectMutation.isPending,
    isResetting: resetMutation.isPending,
    error: selectMutation.error || resetMutation.error,
  };
}

export interface UseUpdateIgnorePatternsReturn {
  updatePatterns: (request: CodexLensUpdateIgnorePatternsRequest) => Promise<CodexLensIgnorePatternsResponse>;
  isUpdating: boolean;
  error: Error | null;
}

/**
 * Hook for updating CodexLens ignore patterns
 */
export function useUpdateIgnorePatterns(): UseUpdateIgnorePatternsReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: updateCodexLensIgnorePatterns,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.ignorePatterns() });
    },
  });

  return {
    updatePatterns: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Combined hook for all CodexLens mutations
 */
export function useCodexLensMutations() {
  const updateConfig = useUpdateCodexLensConfig();
  const bootstrap = useBootstrapCodexLens();
  const uninstall = useUninstallCodexLens();
  const download = useDownloadModel();
  const deleteModel = useDeleteModel();
  const updateEnv = useUpdateCodexLensEnv();
  const gpu = useSelectGpu();
  const updatePatterns = useUpdateIgnorePatterns();

  return {
    updateConfig: updateConfig.updateConfig,
    isUpdatingConfig: updateConfig.isUpdating,
    bootstrap: bootstrap.bootstrap,
    isBootstrapping: bootstrap.isBootstrapping,
    uninstall: uninstall.uninstall,
    isUninstalling: uninstall.isUninstalling,
    downloadModel: download.downloadModel,
    downloadCustomModel: download.downloadCustomModel,
    isDownloading: download.isDownloading,
    deleteModel: deleteModel.deleteModel,
    deleteModelByPath: deleteModel.deleteModelByPath,
    isDeleting: deleteModel.isDeleting,
    updateEnv: updateEnv.updateEnv,
    isUpdatingEnv: updateEnv.isUpdating,
    selectGpu: gpu.selectGpu,
    resetGpu: gpu.resetGpu,
    isSelectingGpu: gpu.isSelecting || gpu.isResetting,
    updatePatterns: updatePatterns.updatePatterns,
    isUpdatingPatterns: updatePatterns.isUpdating,
    isMutating:
      updateConfig.isUpdating ||
      bootstrap.isBootstrapping ||
      uninstall.isUninstalling ||
      download.isDownloading ||
      deleteModel.isDeleting ||
      updateEnv.isUpdating ||
      gpu.isSelecting ||
      gpu.isResetting ||
      updatePatterns.isUpdating,
  };
}
