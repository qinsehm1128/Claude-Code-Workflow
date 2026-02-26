// ========================================
// useCodexLens Hook
// ========================================
// TanStack Query hooks for CodexLens management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFormatMessage } from '../hooks/useLocale';
import { useNotifications } from '../hooks/useNotifications';
import { sanitizeErrorMessage } from '../utils/errorSanitizer';
import {
  fetchCodexLensDashboardInit,
  fetchCodexLensStatus,
  fetchCodexLensWorkspaceStatus,
  fetchCodexLensConfig,
  updateCodexLensConfig,
  bootstrapCodexLens,
  installCodexLensSemantic,
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
  searchCodexLens,
  searchFilesCodexLens,
  searchSymbolCodexLens,
  fetchCodexLensIndexes,
  rebuildCodexLensIndex,
  updateCodexLensIndex,
  cancelCodexLensIndexing,
  checkCodexLensIndexingStatus,
  fetchCodexLensWatcherStatus,
  startCodexLensWatcher,
  stopCodexLensWatcher,
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
  type CodexLensSearchParams,
  type CodexLensSearchResponse,
  type CodexLensFileSearchResponse,
  type CodexLensSymbolSearchResponse,
  type CodexLensIndexesResponse,
  type CodexLensIndexingStatusResponse,
  type CodexLensWatcherStatusResponse,
  type CodexLensLspStatusResponse,
  type CodexLensSemanticSearchParams,
  type CodexLensSemanticSearchResponse,
  type RerankerConfigResponse,
  type RerankerConfigUpdateRequest,
  type RerankerConfigUpdateResponse,
  fetchCodexLensLspStatus,
  startCodexLensLsp,
  stopCodexLensLsp,
  restartCodexLensLsp,
  semanticSearchCodexLens,
  fetchRerankerConfig,
  updateRerankerConfig,
  fetchCcwTools,
  type CcwToolInfo,
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
  indexes: () => [...codexLensKeys.all, 'indexes'] as const,
  indexingStatus: () => [...codexLensKeys.all, 'indexingStatus'] as const,
  search: (params: CodexLensSearchParams) => [...codexLensKeys.all, 'search', params] as const,
  filesSearch: (params: CodexLensSearchParams) => [...codexLensKeys.all, 'filesSearch', params] as const,
  symbolSearch: (params: Pick<CodexLensSearchParams, 'query' | 'limit'>) => [...codexLensKeys.all, 'symbolSearch', params] as const,
  lspStatus: () => [...codexLensKeys.all, 'lspStatus'] as const,
  semanticSearch: (params: CodexLensSemanticSearchParams) => [...codexLensKeys.all, 'semanticSearch', params] as const,
  watcher: () => [...codexLensKeys.all, 'watcher'] as const,
  rerankerConfig: () => [...codexLensKeys.all, 'rerankerConfig'] as const,
  ccwTools: () => [...codexLensKeys.all, 'ccwTools'] as const,
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
  const formatMessage = useFormatMessage();
  const { success, info, error: errorToast } = useNotifications();

  const mutation = useMutation({
    mutationFn: updateCodexLensConfig,
    onMutate: () => {
      info(
        formatMessage({ id: 'common.status.inProgress' }),
        formatMessage({ id: 'common.feedback.codexLensConfigUpdate.success' })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.config() });
      queryClient.invalidateQueries({ queryKey: codexLensKeys.dashboard() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'common.feedback.codexLensConfigUpdate.success' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensConfigUpdate');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
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
  const formatMessage = useFormatMessage();
  const { success, info, error: errorToast } = useNotifications();

  const mutation = useMutation({
    mutationFn: bootstrapCodexLens,
    onMutate: () => {
      info(
        formatMessage({ id: 'codexlens.bootstrapping' }),
        formatMessage({ id: 'common.feedback.codexLensBootstrap.success' })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.all });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'common.feedback.codexLensBootstrap.success' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensBootstrap');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
    },
  });

  return {
    bootstrap: mutation.mutateAsync,
    isBootstrapping: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseInstallSemanticReturn {
  installSemantic: (gpuMode: 'cpu' | 'cuda' | 'directml') => Promise<{ success: boolean; message?: string; gpuMode?: string }>;
  isInstalling: boolean;
  error: Error | null;
}

/**
 * Hook for installing CodexLens semantic dependencies
 */
export function useInstallSemantic(): UseInstallSemanticReturn {
  const queryClient = useQueryClient();
  const formatMessage = useFormatMessage();
  const { success, info, error: errorToast } = useNotifications();

  const mutation = useMutation({
    mutationFn: installCodexLensSemantic,
    onMutate: () => {
      info(
        formatMessage({ id: 'codexlens.semantic.installing' }),
        formatMessage({ id: 'common.feedback.codexLensInstallSemantic.success' })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.all });
      queryClient.invalidateQueries({ queryKey: codexLensKeys.dashboard() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'common.feedback.codexLensInstallSemantic.success' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensInstallSemantic');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
    },
  });

  return {
    installSemantic: mutation.mutateAsync,
    isInstalling: mutation.isPending,
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
  const formatMessage = useFormatMessage();
  const { success, info, error: errorToast } = useNotifications();

  const mutation = useMutation({
    mutationFn: uninstallCodexLens,
    onMutate: () => {
      info(
        formatMessage({ id: 'codexlens.uninstalling' }),
        formatMessage({ id: 'common.feedback.codexLensUninstall.success' })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.all });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'common.feedback.codexLensUninstall.success' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensUninstall');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
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
  const formatMessage = useFormatMessage();
  const { success, info, error: errorToast } = useNotifications();

  const mutation = useMutation({
    mutationFn: async ({ profile, modelName, modelType }: { profile?: string; modelName?: string; modelType?: string }) => {
      if (profile) return downloadCodexLensModel(profile);
      if (modelName) return downloadCodexLensCustomModel(modelName, modelType);
      throw new Error('Either profile or modelName must be provided');
    },
    onMutate: () => {
      info(
        formatMessage({ id: 'codexlens.models.downloading' }),
        formatMessage({ id: 'common.feedback.codexLensDownloadModel.success' })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.models() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'common.feedback.codexLensDownloadModel.success' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensDownloadModel');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
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
  const formatMessage = useFormatMessage();
  const { success, info, error: errorToast } = useNotifications();

  const mutation = useMutation({
    mutationFn: async ({ profile, cachePath }: { profile?: string; cachePath?: string }) => {
      if (profile) return deleteCodexLensModel(profile);
      if (cachePath) return deleteCodexLensModelByPath(cachePath);
      throw new Error('Either profile or cachePath must be provided');
    },
    onMutate: () => {
      info(
        formatMessage({ id: 'common.actions.deleting' }),
        formatMessage({ id: 'common.feedback.codexLensDeleteModel.success' })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.models() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'common.feedback.codexLensDeleteModel.success' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensDeleteModel');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
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
  const formatMessage = useFormatMessage();
  const { success, info, error: errorToast } = useNotifications();

  const mutation = useMutation({
    mutationFn: (request: CodexLensUpdateEnvRequest) => updateCodexLensEnv(request),
    onMutate: () => {
      info(
        formatMessage({ id: 'common.status.inProgress' }),
        formatMessage({ id: 'common.feedback.codexLensUpdateEnv.success' })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.env() });
      queryClient.invalidateQueries({ queryKey: codexLensKeys.dashboard() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'common.feedback.codexLensUpdateEnv.success' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensUpdateEnv');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
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
  const formatMessage = useFormatMessage();
  const { success, info, error: errorToast } = useNotifications();

  const selectMutation = useMutation({
    mutationFn: (deviceId: string | number) => selectCodexLensGpu(deviceId),
    onMutate: () => {
      info(
        formatMessage({ id: 'common.status.inProgress' }),
        formatMessage({ id: 'common.feedback.codexLensSelectGpu.success' })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.gpu() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'common.feedback.codexLensSelectGpu.success' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensSelectGpu');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetCodexLensGpu(),
    onMutate: () => {
      info(
        formatMessage({ id: 'common.status.inProgress' }),
        formatMessage({ id: 'common.feedback.codexLensResetGpu.success' })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.gpu() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'common.feedback.codexLensResetGpu.success' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensResetGpu');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
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
  const formatMessage = useFormatMessage();
  const { success, info, error: errorToast } = useNotifications();

  const mutation = useMutation({
    mutationFn: updateCodexLensIgnorePatterns,
    onMutate: () => {
      info(
        formatMessage({ id: 'common.status.inProgress' }),
        formatMessage({ id: 'common.feedback.codexLensUpdatePatterns.success' })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.ignorePatterns() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'common.feedback.codexLensUpdatePatterns.success' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensUpdatePatterns');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
    },
  });

  return {
    updatePatterns: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

// ========== Index Management Hooks ==========

export interface UseCodexLensIndexesOptions {
  enabled?: boolean;
  staleTime?: number;
}

export interface UseCodexLensIndexesReturn {
  data: CodexLensIndexesResponse | undefined;
  indexes: CodexLensIndexesResponse['indexes'] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching CodexLens indexes
 */
export function useCodexLensIndexes(options: UseCodexLensIndexesOptions = {}): UseCodexLensIndexesReturn {
  const { enabled = true, staleTime = STALE_TIME_MEDIUM } = options;

  const query = useQuery({
    queryKey: codexLensKeys.indexes(),
    queryFn: fetchCodexLensIndexes,
    staleTime,
    enabled,
    retry: 2,
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    data: query.data,
    indexes: query.data?.indexes,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

export interface UseCodexLensIndexingStatusReturn {
  data: CodexLensIndexingStatusResponse | undefined;
  inProgress: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for checking CodexLens indexing status
 */
export function useCodexLensIndexingStatus(): UseCodexLensIndexingStatusReturn {
  const query = useQuery({
    queryKey: codexLensKeys.indexingStatus(),
    queryFn: checkCodexLensIndexingStatus,
    staleTime: STALE_TIME_SHORT,
    refetchInterval: (query) => ((query.state.data as any)?.inProgress ? 2000 : false), // Poll every 2s when indexing
    retry: false,
  });

  return {
    data: query.data,
    inProgress: query.data?.inProgress ?? false,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export interface UseRebuildIndexReturn {
  rebuildIndex: (projectPath: string, options?: {
    indexType?: 'normal' | 'vector';
    embeddingModel?: string;
    embeddingBackend?: 'fastembed' | 'litellm';
    maxWorkers?: number;
  }) => Promise<{ success: boolean; message?: string; error?: string }>;
  isRebuilding: boolean;
  error: Error | null;
}

/**
 * Hook for rebuilding CodexLens index (full rebuild)
 */
export function useRebuildIndex(): UseRebuildIndexReturn {
  const queryClient = useQueryClient();
  const formatMessage = useFormatMessage();
  const { success, info, error: errorToast } = useNotifications();

  const mutation = useMutation({
    mutationFn: async ({
      projectPath,
      options = {},
    }: {
      projectPath: string;
      options?: {
        indexType?: 'normal' | 'vector';
        embeddingModel?: string;
        embeddingBackend?: 'fastembed' | 'litellm';
        maxWorkers?: number;
      };
    }) => rebuildCodexLensIndex(projectPath, options),
    onMutate: () => {
      info(
        formatMessage({ id: 'common.status.inProgress' }),
        formatMessage({ id: 'common.feedback.codexLensRebuildIndex.success' })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.indexes() });
      queryClient.invalidateQueries({ queryKey: codexLensKeys.dashboard() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'common.feedback.codexLensRebuildIndex.success' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensRebuildIndex');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
    },
  });

  return {
    rebuildIndex: (projectPath, options) =>
      mutation.mutateAsync({ projectPath, options }),
    isRebuilding: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseUpdateIndexReturn {
  updateIndex: (projectPath: string, options?: {
    indexType?: 'normal' | 'vector';
    embeddingModel?: string;
    embeddingBackend?: 'fastembed' | 'litellm';
    maxWorkers?: number;
  }) => Promise<{ success: boolean; message?: string; error?: string }>;
  isUpdating: boolean;
  error: Error | null;
}

/**
 * Hook for updating CodexLens index (incremental update)
 */
export function useUpdateIndex(): UseUpdateIndexReturn {
  const queryClient = useQueryClient();
  const formatMessage = useFormatMessage();
  const { success, info, error: errorToast } = useNotifications();

  const mutation = useMutation({
    mutationFn: async ({
      projectPath,
      options = {},
    }: {
      projectPath: string;
      options?: {
        indexType?: 'normal' | 'vector';
        embeddingModel?: string;
        embeddingBackend?: 'fastembed' | 'litellm';
        maxWorkers?: number;
      };
    }) => updateCodexLensIndex(projectPath, options),
    onMutate: () => {
      info(
        formatMessage({ id: 'common.status.inProgress' }),
        formatMessage({ id: 'common.feedback.codexLensUpdateIndex.success' })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.indexes() });
      queryClient.invalidateQueries({ queryKey: codexLensKeys.dashboard() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'common.feedback.codexLensUpdateIndex.success' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensUpdateIndex');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
    },
  });

  return {
    updateIndex: (projectPath, options) =>
      mutation.mutateAsync({ projectPath, options }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

export interface UseCancelIndexingReturn {
  cancelIndexing: () => Promise<{ success: boolean; error?: string }>;
  isCancelling: boolean;
  error: Error | null;
}

/**
 * Hook for canceling CodexLens indexing
 */
export function useCancelIndexing(): UseCancelIndexingReturn {
  const queryClient = useQueryClient();
  const formatMessage = useFormatMessage();
  const { success, info, error: errorToast } = useNotifications();

  const mutation = useMutation({
    mutationFn: cancelCodexLensIndexing,
    onMutate: () => {
      info(
        formatMessage({ id: 'common.status.inProgress' }),
        formatMessage({ id: 'common.feedback.codexLensCancelIndexing.success' })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.indexingStatus() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'common.feedback.codexLensCancelIndexing.success' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensCancelIndexing');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
    },
  });

  return {
    cancelIndexing: mutation.mutateAsync,
    isCancelling: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Combined hook for all CodexLens mutations
 */
export function useCodexLensMutations() {
  const updateConfig = useUpdateCodexLensConfig();
  const bootstrap = useBootstrapCodexLens();
  const installSemantic = useInstallSemantic();
  const uninstall = useUninstallCodexLens();
  const download = useDownloadModel();
  const deleteModel = useDeleteModel();
  const updateEnv = useUpdateCodexLensEnv();
  const gpu = useSelectGpu();
  const updatePatterns = useUpdateIgnorePatterns();
  const rebuildIndex = useRebuildIndex();
  const updateIndex = useUpdateIndex();
  const cancelIndexing = useCancelIndexing();

  return {
    updateConfig: updateConfig.updateConfig,
    isUpdatingConfig: updateConfig.isUpdating,
    bootstrap: bootstrap.bootstrap,
    isBootstrapping: bootstrap.isBootstrapping,
    installSemantic: installSemantic.installSemantic,
    isInstallingSemantic: installSemantic.isInstalling,
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
    rebuildIndex: rebuildIndex.rebuildIndex,
    isRebuildingIndex: rebuildIndex.isRebuilding,
    updateIndex: updateIndex.updateIndex,
    isUpdatingIndex: updateIndex.isUpdating,
    cancelIndexing: cancelIndexing.cancelIndexing,
    isCancellingIndexing: cancelIndexing.isCancelling,
    isMutating:
      updateConfig.isUpdating ||
      bootstrap.isBootstrapping ||
      installSemantic.isInstalling ||
      uninstall.isUninstalling ||
      download.isDownloading ||
      deleteModel.isDeleting ||
      updateEnv.isUpdating ||
      gpu.isSelecting ||
      gpu.isResetting ||
      updatePatterns.isUpdating ||
      rebuildIndex.isRebuilding ||
      updateIndex.isUpdating ||
      cancelIndexing.isCancelling,
  };
}

// ========== Search Hooks ==========

export interface UseCodexLensSearchOptions {
  enabled?: boolean;
}

export interface UseCodexLensSearchReturn {
  data: CodexLensSearchResponse | undefined;
  results: CodexLensSearchResponse['results'] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for content search using CodexLens
 */
export function useCodexLensSearch(params: CodexLensSearchParams, options: UseCodexLensSearchOptions = {}): UseCodexLensSearchReturn {
  const { enabled = false } = options;

  const query = useQuery({
    queryKey: codexLensKeys.search(params),
    queryFn: () => searchCodexLens(params),
    enabled,
    staleTime: STALE_TIME_SHORT,
    retry: 1,
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    data: query.data,
    results: query.data?.results,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

export interface UseCodexLensFileSearchReturn {
  data: CodexLensFileSearchResponse | undefined;
  files: string[] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for file search using CodexLens
 */
export function useCodexLensFilesSearch(params: CodexLensSearchParams, options: UseCodexLensSearchOptions = {}): UseCodexLensFileSearchReturn {
  const { enabled = false } = options;

  const query = useQuery({
    queryKey: codexLensKeys.filesSearch(params),
    queryFn: () => searchFilesCodexLens(params),
    enabled,
    staleTime: STALE_TIME_SHORT,
    retry: 1,
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    data: query.data,
    files: query.data?.files,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

export interface UseCodexLensSymbolSearchOptions {
  enabled?: boolean;
}

export interface UseCodexLensSymbolSearchReturn {
  data: CodexLensSymbolSearchResponse | undefined;
  symbols: CodexLensSymbolSearchResponse['symbols'] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for symbol search using CodexLens
 */
export function useCodexLensSymbolSearch(
  params: Pick<CodexLensSearchParams, 'query' | 'limit'>,
  options: UseCodexLensSymbolSearchOptions = {}
): UseCodexLensSymbolSearchReturn {
  const { enabled = false } = options;

  const query = useQuery({
    queryKey: codexLensKeys.symbolSearch(params),
    queryFn: () => searchSymbolCodexLens(params),
    enabled,
    staleTime: STALE_TIME_SHORT,
    retry: 1,
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    data: query.data,
    symbols: query.data?.symbols,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

// ========== LSP / Semantic Search Hooks ==========

export interface UseCodexLensLspStatusOptions {
  enabled?: boolean;
  staleTime?: number;
}

export interface UseCodexLensLspStatusReturn {
  data: CodexLensLspStatusResponse | undefined;
  available: boolean;
  semanticAvailable: boolean;
  vectorIndex: boolean;
  projectCount: number;
  embeddings: Record<string, unknown> | undefined;
  modes: string[];
  strategies: string[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for checking CodexLens LSP/semantic search availability
 * Polls every 5 seconds when the LSP server is available
 */
export function useCodexLensLspStatus(options: UseCodexLensLspStatusOptions = {}): UseCodexLensLspStatusReturn {
  const { enabled = true, staleTime = STALE_TIME_MEDIUM } = options;

  const query = useQuery({
    queryKey: codexLensKeys.lspStatus(),
    queryFn: fetchCodexLensLspStatus,
    staleTime,
    enabled,
    refetchInterval: (query) => {
      const data = query.state.data as CodexLensLspStatusResponse | undefined;
      return data?.available ? 5000 : false;
    },
    retry: 2,
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    data: query.data,
    available: query.data?.available ?? false,
    semanticAvailable: query.data?.semantic_available ?? false,
    vectorIndex: query.data?.vector_index ?? false,
    projectCount: query.data?.project_count ?? 0,
    embeddings: query.data?.embeddings,
    modes: query.data?.modes ?? [],
    strategies: query.data?.strategies ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

export interface UseCodexLensLspMutationsReturn {
  startLsp: (path?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  stopLsp: (path?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  restartLsp: (path?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  isStarting: boolean;
  isStopping: boolean;
  isRestarting: boolean;
}

/**
 * Hook for LSP server start/stop/restart mutations
 */
export function useCodexLensLspMutations(): UseCodexLensLspMutationsReturn {
  const queryClient = useQueryClient();
  const formatMessage = useFormatMessage();
  const { success, error: errorToast } = useNotifications();

  const startMutation = useMutation({
    mutationFn: ({ path }: { path?: string }) => startCodexLensLsp(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.lspStatus() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'codexlens.lsp.started' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensLspStart');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
    },
  });

  const stopMutation = useMutation({
    mutationFn: ({ path }: { path?: string }) => stopCodexLensLsp(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.lspStatus() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'codexlens.lsp.stopped' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensLspStop');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
    },
  });

  const restartMutation = useMutation({
    mutationFn: ({ path }: { path?: string }) => restartCodexLensLsp(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.lspStatus() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'codexlens.lsp.restarted' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensLspRestart');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
    },
  });

  return {
    startLsp: (path?: string) => startMutation.mutateAsync({ path }),
    stopLsp: (path?: string) => stopMutation.mutateAsync({ path }),
    restartLsp: (path?: string) => restartMutation.mutateAsync({ path }),
    isStarting: startMutation.isPending,
    isStopping: stopMutation.isPending,
    isRestarting: restartMutation.isPending,
  };
}

export interface UseCodexLensSemanticSearchOptions {
  enabled?: boolean;
}

export interface UseCodexLensSemanticSearchReturn {
  data: CodexLensSemanticSearchResponse | undefined;
  results: CodexLensSemanticSearchResponse['results'] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for semantic search using CodexLens Python API
 */
export function useCodexLensSemanticSearch(
  params: CodexLensSemanticSearchParams,
  options: UseCodexLensSemanticSearchOptions = {}
): UseCodexLensSemanticSearchReturn {
  const { enabled = false } = options;

  const query = useQuery({
    queryKey: codexLensKeys.semanticSearch(params),
    queryFn: () => semanticSearchCodexLens(params),
    enabled,
    staleTime: STALE_TIME_SHORT,
    retry: 1,
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    data: query.data,
    results: query.data?.results,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

// ========== File Watcher Hooks ==========

export interface UseCodexLensWatcherOptions {
  enabled?: boolean;
}

export interface UseCodexLensWatcherReturn {
  data: CodexLensWatcherStatusResponse | undefined;
  running: boolean;
  rootPath: string;
  eventsProcessed: number;
  uptimeSeconds: number;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for checking CodexLens file watcher status
 * Polls every 3 seconds when watcher is running
 */
export function useCodexLensWatcher(options: UseCodexLensWatcherOptions = {}): UseCodexLensWatcherReturn {
  const { enabled = true } = options;

  const query = useQuery({
    queryKey: codexLensKeys.watcher(),
    queryFn: fetchCodexLensWatcherStatus,
    staleTime: STALE_TIME_SHORT,
    enabled,
    refetchInterval: (query) => {
      const data = query.state.data as CodexLensWatcherStatusResponse | undefined;
      return data?.running ? 3000 : false;
    },
    retry: 2,
  });

  return {
    data: query.data,
    running: query.data?.running ?? false,
    rootPath: query.data?.root_path ?? '',
    eventsProcessed: query.data?.events_processed ?? 0,
    uptimeSeconds: query.data?.uptime_seconds ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export interface UseCodexLensWatcherMutationsReturn {
  startWatcher: (path?: string, debounceMs?: number) => Promise<{ success: boolean; message?: string; error?: string }>;
  stopWatcher: () => Promise<{ success: boolean; message?: string; error?: string }>;
  isStarting: boolean;
  isStopping: boolean;
}

/**
 * Hook for file watcher start/stop mutations
 */
export function useCodexLensWatcherMutations(): UseCodexLensWatcherMutationsReturn {
  const queryClient = useQueryClient();
  const formatMessage = useFormatMessage();
  const { success, error: errorToast } = useNotifications();

  const startMutation = useMutation({
    mutationFn: ({ path, debounceMs }: { path?: string; debounceMs?: number }) =>
      startCodexLensWatcher(path, debounceMs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.watcher() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'codexlens.watcher.started' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensWatcherStart');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => stopCodexLensWatcher(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.watcher() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'codexlens.watcher.stopped' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'codexLensWatcherStop');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
    },
  });

  return {
    startWatcher: (path?: string, debounceMs?: number) =>
      startMutation.mutateAsync({ path, debounceMs }),
    stopWatcher: () => stopMutation.mutateAsync(),
    isStarting: startMutation.isPending,
    isStopping: stopMutation.isPending,
  };
}

// ========== Reranker Config Hooks ==========

export interface UseCodexLensRerankerConfigOptions {
  enabled?: boolean;
  staleTime?: number;
}

export interface UseCodexLensRerankerConfigReturn {
  data: RerankerConfigResponse | undefined;
  backend: string;
  modelName: string;
  apiProvider: string;
  apiKeySet: boolean;
  availableBackends: string[];
  apiProviders: string[];
  litellmModels: RerankerConfigResponse['litellm_models'];
  configSource: string;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching reranker configuration (backends, models, providers)
 */
export function useCodexLensRerankerConfig(
  options: UseCodexLensRerankerConfigOptions = {}
): UseCodexLensRerankerConfigReturn {
  const { enabled = true, staleTime = STALE_TIME_MEDIUM } = options;

  const query = useQuery({
    queryKey: codexLensKeys.rerankerConfig(),
    queryFn: fetchRerankerConfig,
    staleTime,
    enabled,
    retry: 2,
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    data: query.data,
    backend: query.data?.backend ?? 'fastembed',
    modelName: query.data?.model_name ?? '',
    apiProvider: query.data?.api_provider ?? '',
    apiKeySet: query.data?.api_key_set ?? false,
    availableBackends: query.data?.available_backends ?? [],
    apiProviders: query.data?.api_providers ?? [],
    litellmModels: query.data?.litellm_models,
    configSource: query.data?.config_source ?? 'default',
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

export interface UseUpdateRerankerConfigReturn {
  updateConfig: (request: RerankerConfigUpdateRequest) => Promise<RerankerConfigUpdateResponse>;
  isUpdating: boolean;
  error: Error | null;
}

/**
 * Hook for updating reranker configuration
 */
export function useUpdateRerankerConfig(): UseUpdateRerankerConfigReturn {
  const queryClient = useQueryClient();
  const formatMessage = useFormatMessage();
  const { success, error: errorToast } = useNotifications();

  const mutation = useMutation({
    mutationFn: (request: RerankerConfigUpdateRequest) => updateRerankerConfig(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: codexLensKeys.rerankerConfig() });
      queryClient.invalidateQueries({ queryKey: codexLensKeys.env() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'codexlens.reranker.saveSuccess' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'rerankerConfigUpdate');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
    },
  });

  return {
    updateConfig: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

// ========== CCW Tools Hook ==========

export interface UseCcwToolsListReturn {
  tools: CcwToolInfo[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for fetching all registered CCW tools
 * Uses LONG stale time since tool list rarely changes
 */
export function useCcwToolsList(): UseCcwToolsListReturn {
  const query = useQuery({
    queryKey: codexLensKeys.ccwTools(),
    queryFn: fetchCcwTools,
    staleTime: STALE_TIME_LONG,
    retry: 2,
  });

  return {
    tools: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
