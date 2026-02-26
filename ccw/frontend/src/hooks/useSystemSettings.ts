// ========================================
// useSystemSettings Hook
// ========================================
// TanStack Query hooks for system settings (language, install status, tool status)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchChineseResponseStatus,
  toggleChineseResponse,
  fetchWindowsPlatformStatus,
  toggleWindowsPlatform,
  fetchCodexCliEnhancementStatus,
  toggleCodexCliEnhancement,
  refreshCodexCliEnhancement,
  fetchAggregatedStatus,
  fetchCliToolStatus,
  fetchCcwInstallations,
  upgradeCcwInstallation,
  exportSettings,
  importSettings,
  type ChineseResponseStatus,
  type WindowsPlatformStatus,
  type CodexCliEnhancementStatus,
  type CcwInstallStatus,
  type CcwInstallationManifest,
  type ExportedSettings,
  type ImportOptions,
} from '../lib/api';

// Query key factory
export const systemSettingsKeys = {
  all: ['systemSettings'] as const,
  chineseResponse: () => [...systemSettingsKeys.all, 'chineseResponse'] as const,
  windowsPlatform: () => [...systemSettingsKeys.all, 'windowsPlatform'] as const,
  codexCliEnhancement: () => [...systemSettingsKeys.all, 'codexCliEnhancement'] as const,
  aggregatedStatus: () => [...systemSettingsKeys.all, 'aggregatedStatus'] as const,
  cliToolStatus: () => [...systemSettingsKeys.all, 'cliToolStatus'] as const,
  ccwInstallations: () => [...systemSettingsKeys.all, 'ccwInstallations'] as const,
  exportSettings: () => [...systemSettingsKeys.all, 'exportSettings'] as const,
};

const STALE_TIME = 60 * 1000; // 1 minute

// ========================================
// Chinese Response Hooks
// ========================================

export interface UseChineseResponseStatusReturn {
  data: ChineseResponseStatus | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useChineseResponseStatus(): UseChineseResponseStatusReturn {
  const query = useQuery({
    queryKey: systemSettingsKeys.chineseResponse(),
    queryFn: fetchChineseResponseStatus,
    staleTime: STALE_TIME,
    retry: 1,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => { query.refetch(); },
  };
}

export function useToggleChineseResponse() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ enabled, target }: { enabled: boolean; target: 'claude' | 'codex' }) =>
      toggleChineseResponse(enabled, target),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: systemSettingsKeys.chineseResponse() });
    },
  });

  return {
    toggle: (enabled: boolean, target: 'claude' | 'codex') =>
      mutation.mutateAsync({ enabled, target }),
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

// ========================================
// Windows Platform Hooks
// ========================================

export interface UseWindowsPlatformStatusReturn {
  data: WindowsPlatformStatus | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useWindowsPlatformStatus(): UseWindowsPlatformStatusReturn {
  const query = useQuery({
    queryKey: systemSettingsKeys.windowsPlatform(),
    queryFn: fetchWindowsPlatformStatus,
    staleTime: STALE_TIME,
    retry: 1,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => { query.refetch(); },
  };
}

export function useToggleWindowsPlatform() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => toggleWindowsPlatform(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: systemSettingsKeys.windowsPlatform() });
    },
  });

  return {
    toggle: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

// ========================================
// Codex CLI Enhancement Hooks
// ========================================

export interface UseCodexCliEnhancementStatusReturn {
  data: CodexCliEnhancementStatus | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCodexCliEnhancementStatus(): UseCodexCliEnhancementStatusReturn {
  const query = useQuery({
    queryKey: systemSettingsKeys.codexCliEnhancement(),
    queryFn: fetchCodexCliEnhancementStatus,
    staleTime: STALE_TIME,
    retry: 1,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => { query.refetch(); },
  };
}

export function useToggleCodexCliEnhancement() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => toggleCodexCliEnhancement(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: systemSettingsKeys.codexCliEnhancement() });
    },
  });

  return {
    toggle: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

export function useRefreshCodexCliEnhancement() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => refreshCodexCliEnhancement(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: systemSettingsKeys.codexCliEnhancement() });
    },
  });

  return {
    refresh: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

// ========================================
// Aggregated Status / CCW Install Hooks
// ========================================

export interface UseCcwInstallStatusReturn {
  data: CcwInstallStatus | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCcwInstallStatus(): UseCcwInstallStatusReturn {
  const query = useQuery({
    queryKey: systemSettingsKeys.aggregatedStatus(),
    queryFn: fetchAggregatedStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  return {
    data: query.data?.ccwInstall,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => { query.refetch(); },
  };
}

// ========================================
// CLI Tool Status Hooks
// ========================================

export interface UseCliToolStatusReturn {
  data: Record<string, { available: boolean; path?: string; version?: string }> | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCliToolStatus(): UseCliToolStatusReturn {
  const query = useQuery({
    queryKey: systemSettingsKeys.cliToolStatus(),
    queryFn: fetchCliToolStatus,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => { query.refetch(); },
  };
}

// ========================================
// CCW Installations Hooks
// ========================================

export interface UseCcwInstallationsReturn {
  installations: CcwInstallationManifest[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCcwInstallations(): UseCcwInstallationsReturn {
  const query = useQuery({
    queryKey: systemSettingsKeys.ccwInstallations(),
    queryFn: fetchCcwInstallations,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  return {
    installations: query.data?.installations ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => { query.refetch(); },
  };
}

export function useUpgradeCcwInstallation() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (path?: string) => upgradeCcwInstallation(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: systemSettingsKeys.ccwInstallations() });
      queryClient.invalidateQueries({ queryKey: systemSettingsKeys.aggregatedStatus() });
    },
  });

  return {
    upgrade: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

// ========================================
// Settings Export/Import Hooks
// ========================================

export function useExportSettings() {
  const mutation = useMutation({
    mutationFn: exportSettings,
  });

  return {
    exportSettings: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

export function useImportSettings() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ data, options }: { data: ExportedSettings; options?: ImportOptions }) =>
      importSettings(data, options),
    onSuccess: () => {
      // Invalidate all system settings queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: systemSettingsKeys.all });
    },
  });

  return {
    importSettings: (data: ExportedSettings, options?: ImportOptions) =>
      mutation.mutateAsync({ data, options }),
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
