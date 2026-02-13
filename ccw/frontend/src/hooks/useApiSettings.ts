// ========================================
// useApiSettings Hook
// ========================================
// TanStack Query hooks for API Settings management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFormatMessage } from '../hooks/useLocale';
import { useNotifications } from '../hooks/useNotifications';
import { sanitizeErrorMessage } from '../utils/errorSanitizer';
import {
  fetchProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  testProvider,
  testProviderKey,
  getProviderHealthStatus,
  triggerProviderHealthCheck,
  fetchEndpoints,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  fetchCacheStats,
  clearCache,
  updateCacheSettings,
  fetchModelPools,
  fetchModelPool,
  createModelPool,
  updateModelPool,
  deleteModelPool,
  getAvailableModelsForPool,
  discoverModelsForPool,
  fetchApiConfig,
  syncApiConfig,
  previewYamlConfig,
  checkCcwLitellmStatus,
  installCcwLitellm,
  uninstallCcwLitellm,
  fetchCliSettings,
  createCliSettings,
  updateCliSettings,
  deleteCliSettings,
  toggleCliSettingsEnabled,
  type ProviderCredential,
  type CustomEndpoint,
  type CacheStats,
  type ModelPoolConfig,
  type ModelPoolType,
  type CliSettingsEndpoint,
  type SaveCliSettingsRequest,
} from '../lib/api';

// Query key factory
export const apiSettingsKeys = {
  all: ['apiSettings'] as const,
  providers: () => [...apiSettingsKeys.all, 'providers'] as const,
  provider: (id: string) => [...apiSettingsKeys.providers(), id] as const,
  endpoints: () => [...apiSettingsKeys.all, 'endpoints'] as const,
  endpoint: (id: string) => [...apiSettingsKeys.endpoints(), id] as const,
  cache: () => [...apiSettingsKeys.all, 'cache'] as const,
  modelPools: () => [...apiSettingsKeys.all, 'modelPools'] as const,
  modelPool: (id: string) => [...apiSettingsKeys.modelPools(), id] as const,
  ccwLitellm: () => [...apiSettingsKeys.all, 'ccwLitellm'] as const,
  cliSettings: () => [...apiSettingsKeys.all, 'cliSettings'] as const,
  cliSetting: (id: string) => [...apiSettingsKeys.cliSettings(), id] as const,
};

const STALE_TIME = 2 * 60 * 1000;

// ========================================
// Provider Hooks
// ========================================

export interface UseProvidersOptions {
  staleTime?: number;
  enabled?: boolean;
}

export interface UseProvidersReturn {
  providers: ProviderCredential[];
  totalCount: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

export function useProviders(options: UseProvidersOptions = {}): UseProvidersReturn {
  const { staleTime = STALE_TIME, enabled = true } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: apiSettingsKeys.providers(),
    queryFn: fetchProviders,
    staleTime,
    enabled,
    retry: 2,
  });

  const providers = query.data?.providers ?? [];

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: apiSettingsKeys.providers() });
  };

  return {
    providers,
    totalCount: providers.length,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

export function useCreateProvider() {
  const queryClient = useQueryClient();
  const formatMessage = useFormatMessage();
  const { success, info, error: errorToast } = useNotifications();

  const mutation = useMutation({
    mutationFn: (provider: Omit<ProviderCredential, 'id' | 'createdAt' | 'updatedAt'>) =>
      createProvider(provider),
    onMutate: () => {
      info(
        formatMessage({ id: 'status.creating' }),
        formatMessage({ id: 'common.feedback.providerCreate.success' })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.providers() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'common.feedback.providerCreate.success' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'providerCreate');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
    },
  });

  return {
    createProvider: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}

export function useUpdateProvider() {
  const queryClient = useQueryClient();
  const formatMessage = useFormatMessage();
  const { success, info, error: errorToast } = useNotifications();

  const mutation = useMutation({
    mutationFn: ({ providerId, updates }: { providerId: string; updates: Partial<Omit<ProviderCredential, 'id' | 'createdAt' | 'updatedAt'>> }) =>
      updateProvider(providerId, updates),
    onMutate: () => {
      info(
        formatMessage({ id: 'status.inProgress' }),
        formatMessage({ id: 'common.feedback.providerUpdate.success' })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.providers() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'common.feedback.providerUpdate.success' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'providerUpdate');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
    },
  });

  return {
    updateProvider: (providerId: string, updates: Partial<Omit<ProviderCredential, 'id' | 'createdAt' | 'updatedAt'>>) =>
      mutation.mutateAsync({ providerId, updates }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

export function useDeleteProvider() {
  const queryClient = useQueryClient();
  const formatMessage = useFormatMessage();
  const { success, info, error: errorToast } = useNotifications();

  const mutation = useMutation({
    mutationFn: (providerId: string) => deleteProvider(providerId),
    onMutate: () => {
      info(
        formatMessage({ id: 'status.deleting' }),
        formatMessage({ id: 'common.feedback.providerDelete.success' })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.providers() });
      success(
        formatMessage({ id: 'common.success' }),
        formatMessage({ id: 'common.feedback.providerDelete.success' })
      );
    },
    onError: (err) => {
      const sanitized = sanitizeErrorMessage(err, 'providerDelete');
      const message = formatMessage({ id: sanitized.messageKey });
      const title = formatMessage({ id: 'common.error' });
      errorToast(title, message);
    },
  });

  return {
    deleteProvider: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

export function useTestProvider() {
  const mutation = useMutation({
    mutationFn: (providerId: string) => testProvider(providerId),
  });

  return {
    testProvider: mutation.mutateAsync,
    isTesting: mutation.isPending,
    error: mutation.error,
  };
}

export function useTestProviderKey() {
  const mutation = useMutation({
    mutationFn: ({ providerId, keyId }: { providerId: string; keyId: string }) =>
      testProviderKey(providerId, keyId),
  });

  return {
    testProviderKey: mutation.mutateAsync,
    isTesting: mutation.isPending,
    error: mutation.error,
  };
}

export function useProviderHealthStatus(providerId: string) {
  return useQuery({
    queryKey: [...apiSettingsKeys.provider(providerId), 'health'],
    queryFn: () => getProviderHealthStatus(providerId),
    enabled: !!providerId,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useTriggerProviderHealthCheck() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (providerId: string) => triggerProviderHealthCheck(providerId),
    onSuccess: (_, providerId) => {
      queryClient.invalidateQueries({ queryKey: [...apiSettingsKeys.provider(providerId), 'health'] });
    },
  });

  return {
    triggerHealthCheck: mutation.mutateAsync,
    isChecking: mutation.isPending,
    error: mutation.error,
  };
}

// ========================================
// Endpoint Hooks
// ========================================

export interface UseEndpointsOptions {
  staleTime?: number;
  enabled?: boolean;
}

export interface UseEndpointsReturn {
  endpoints: CustomEndpoint[];
  totalCount: number;
  cachedCount: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

export function useEndpoints(options: UseEndpointsOptions = {}): UseEndpointsReturn {
  const { staleTime = STALE_TIME, enabled = true } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: apiSettingsKeys.endpoints(),
    queryFn: fetchEndpoints,
    staleTime,
    enabled,
    retry: 2,
  });

  const endpoints = query.data?.endpoints ?? [];
  const cachedEndpoints = endpoints.filter((e) => e.cacheStrategy.enabled);

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: apiSettingsKeys.endpoints() });
  };

  return {
    endpoints,
    totalCount: endpoints.length,
    cachedCount: cachedEndpoints.length,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

export function useCreateEndpoint() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (endpoint: Omit<CustomEndpoint, 'createdAt' | 'updatedAt'>) =>
      createEndpoint(endpoint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.endpoints() });
    },
  });

  return {
    createEndpoint: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}

export function useUpdateEndpoint() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ endpointId, updates }: { endpointId: string; updates: Partial<Omit<CustomEndpoint, 'id' | 'createdAt' | 'updatedAt'>> }) =>
      updateEndpoint(endpointId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.endpoints() });
    },
  });

  return {
    updateEndpoint: (endpointId: string, updates: Partial<Omit<CustomEndpoint, 'id' | 'createdAt' | 'updatedAt'>>) =>
      mutation.mutateAsync({ endpointId, updates }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

export function useDeleteEndpoint() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (endpointId: string) => deleteEndpoint(endpointId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.endpoints() });
    },
  });

  return {
    deleteEndpoint: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

// ========================================
// Cache Hooks
// ========================================

export interface UseCacheStatsOptions {
  staleTime?: number;
  enabled?: boolean;
}

export interface UseCacheStatsReturn {
  stats: CacheStats | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCacheStats(options: UseCacheStatsOptions = {}): UseCacheStatsReturn {
  const { staleTime = 30000, enabled = true } = options; // 30 seconds stale time for cache stats

  const query = useQuery({
    queryKey: apiSettingsKeys.cache(),
    queryFn: fetchCacheStats,
    staleTime,
    enabled,
    retry: 2,
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    stats: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
  };
}

export function useClearCache() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => clearCache(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.cache() });
    },
  });

  return {
    clearCache: mutation.mutateAsync,
    isClearing: mutation.isPending,
    error: mutation.error,
  };
}

export function useUpdateCacheSettings() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (settings: Partial<{ enabled: boolean; cacheDir: string; maxTotalSizeMB: number }>) =>
      updateCacheSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.cache() });
    },
  });

  return {
    updateCacheSettings: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

// ========================================
// Model Pool Hooks
// ========================================

export interface UseModelPoolsOptions {
  staleTime?: number;
  enabled?: boolean;
}

export interface UseModelPoolsReturn {
  pools: ModelPoolConfig[];
  totalCount: number;
  enabledCount: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

export function useModelPools(options: UseModelPoolsOptions = {}): UseModelPoolsReturn {
  const { staleTime = STALE_TIME, enabled = true } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: apiSettingsKeys.modelPools(),
    queryFn: fetchModelPools,
    staleTime,
    enabled,
    retry: 2,
  });

  const pools = query.data?.pools ?? [];
  const enabledPools = pools.filter((p) => p.enabled);

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: apiSettingsKeys.modelPools() });
  };

  return {
    pools,
    totalCount: pools.length,
    enabledCount: enabledPools.length,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

export function useModelPool(poolId: string) {
  return useQuery({
    queryKey: apiSettingsKeys.modelPool(poolId),
    queryFn: () => fetchModelPool(poolId),
    enabled: !!poolId,
    staleTime: STALE_TIME,
    retry: 2,
  });
}

export function useCreateModelPool() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (pool: Omit<ModelPoolConfig, 'id'>) => createModelPool(pool),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.modelPools() });
    },
  });

  return {
    createModelPool: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}

export function useUpdateModelPool() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ poolId, updates }: { poolId: string; updates: Partial<ModelPoolConfig> }) =>
      updateModelPool(poolId, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.modelPools() });
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.modelPool(variables.poolId) });
    },
  });

  return {
    updateModelPool: (poolId: string, updates: Partial<ModelPoolConfig>) =>
      mutation.mutateAsync({ poolId, updates }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

export function useDeleteModelPool() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (poolId: string) => deleteModelPool(poolId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.modelPools() });
    },
  });

  return {
    deleteModelPool: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

export function useAvailableModelsForPool(modelType: ModelPoolType) {
  return useQuery({
    queryKey: [...apiSettingsKeys.modelPools(), 'available', modelType],
    queryFn: () => getAvailableModelsForPool(modelType),
    enabled: !!modelType,
    staleTime: STALE_TIME,
  });
}

export function useDiscoverModelsForPool() {
  const mutation = useMutation({
    mutationFn: ({ modelType, targetModel }: { modelType: ModelPoolType; targetModel: string }) =>
      discoverModelsForPool(modelType, targetModel),
  });

  return {
    discoverModels: (modelType: ModelPoolType, targetModel: string) =>
      mutation.mutateAsync({ modelType, targetModel }),
    isDiscovering: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
}

// ========================================
// Config Hooks
// ========================================

export function useApiConfig() {
  return useQuery({
    queryKey: [...apiSettingsKeys.all, 'config'],
    queryFn: fetchApiConfig,
    staleTime: STALE_TIME,
  });
}

export function useSyncApiConfig() {
  return useMutation({
    mutationFn: () => syncApiConfig(),
  });
}

export function usePreviewYamlConfig() {
  return useMutation({
    mutationFn: () => previewYamlConfig(),
  });
}

// ========================================
// CCW-LiteLLM Package Hooks
// ========================================

export interface UseCcwLitellmStatusOptions {
  staleTime?: number;
  enabled?: boolean;
  refresh?: boolean;
}

export function useCcwLitellmStatus(options: UseCcwLitellmStatusOptions = {}) {
  const { staleTime = 5 * 60 * 1000, enabled = true, refresh = false } = options;

  return useQuery({
    queryKey: [...apiSettingsKeys.ccwLitellm(), 'status', refresh],
    queryFn: () => checkCcwLitellmStatus(refresh),
    staleTime,
    enabled,
  });
}

export function useInstallCcwLitellm() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => installCcwLitellm(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.ccwLitellm() });
    },
  });

  return {
    install: mutation.mutateAsync,
    isInstalling: mutation.isPending,
    error: mutation.error,
  };
}

export function useUninstallCcwLitellm() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => uninstallCcwLitellm(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.ccwLitellm() });
    },
  });

  return {
    uninstall: mutation.mutateAsync,
    isUninstalling: mutation.isPending,
    error: mutation.error,
  };
}

// ========================================
// CLI Settings Hooks
// ========================================

export interface UseCliSettingsOptions {
  staleTime?: number;
  enabled?: boolean;
}

export interface UseCliSettingsReturn {
  cliSettings: CliSettingsEndpoint[];
  totalCount: number;
  enabledCount: number;
  providerBasedCount: number;
  directCount: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

export function useCliSettings(options: UseCliSettingsOptions = {}): UseCliSettingsReturn {
  const { staleTime = STALE_TIME, enabled = true } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: apiSettingsKeys.cliSettings(),
    queryFn: fetchCliSettings,
    staleTime,
    enabled,
    retry: 2,
  });

  const cliSettings = query.data?.endpoints ?? [];
  const enabledCliSettings = cliSettings.filter((s) => s.enabled);

  // Determine mode based on whether settings have providerId in description or env vars
  const providerBasedCount = cliSettings.filter((s) => {
    // Provider-based: has ANTHROPIC_BASE_URL set to provider's apiBase
    return s.settings.env.ANTHROPIC_BASE_URL && !s.settings.env.ANTHROPIC_BASE_URL.includes('api.anthropic.com');
  }).length;

  const directCount = cliSettings.length - providerBasedCount;

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: apiSettingsKeys.cliSettings() });
  };

  return {
    cliSettings,
    totalCount: cliSettings.length,
    enabledCount: enabledCliSettings.length,
    providerBasedCount,
    directCount,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
    invalidate,
  };
}

export function useCreateCliSettings() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (request: SaveCliSettingsRequest) => createCliSettings(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.cliSettings() });
    },
  });

  return {
    createCliSettings: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}

export function useUpdateCliSettings() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ endpointId, request }: { endpointId: string; request: Partial<SaveCliSettingsRequest> }) =>
      updateCliSettings(endpointId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.cliSettings() });
    },
  });

  return {
    updateCliSettings: (endpointId: string, request: Partial<SaveCliSettingsRequest>) =>
      mutation.mutateAsync({ endpointId, request }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

export function useDeleteCliSettings() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (endpointId: string) => deleteCliSettings(endpointId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.cliSettings() });
    },
  });

  return {
    deleteCliSettings: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}

export function useToggleCliSettings() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ endpointId, enabled }: { endpointId: string; enabled: boolean }) =>
      toggleCliSettingsEnabled(endpointId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiSettingsKeys.cliSettings() });
    },
  });

  return {
    toggleCliSettings: (endpointId: string, enabled: boolean) =>
      mutation.mutateAsync({ endpointId, enabled }),
    isToggling: mutation.isPending,
    error: mutation.error,
  };
}
