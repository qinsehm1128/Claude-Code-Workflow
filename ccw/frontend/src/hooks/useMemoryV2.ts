// ========================================
// useMemoryV2 Hook
// ========================================
// TanStack Query hooks for Memory V2 pipeline

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  triggerExtraction,
  getExtractionStatus,
  triggerConsolidation,
  getConsolidationStatus,
  getV2Jobs,
  previewExtractionQueue,
  triggerSelectiveExtraction,
  type ExtractionStatus,
  type ConsolidationStatus,
  type V2JobsResponse,
  type ExtractionPreviewResponse,
  type SelectiveExtractionResponse,
} from '../lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

// Query keys
export const memoryV2Keys = {
  all: ['memoryV2'] as const,
  extractionStatus: (path?: string) => [...memoryV2Keys.all, 'extraction', path] as const,
  consolidationStatus: (path?: string) => [...memoryV2Keys.all, 'consolidation', path] as const,
  jobs: (path?: string, filters?: { kind?: string; status_filter?: string }) =>
    [...memoryV2Keys.all, 'jobs', path, filters] as const,
  preview: (path?: string, includeNative?: boolean) =>
    [...memoryV2Keys.all, 'preview', path, includeNative] as const,
};

// Default stale time: 30 seconds (V2 status changes frequently)
const STALE_TIME = 30 * 1000;

// Hook: 提取状态
export function useExtractionStatus() {
  const projectPath = useWorkflowStore(selectProjectPath);

  return useQuery({
    queryKey: memoryV2Keys.extractionStatus(projectPath),
    queryFn: () => getExtractionStatus(projectPath),
    enabled: !!projectPath,
    staleTime: STALE_TIME,
    refetchInterval: 5000, // 每 5 秒刷新
  });
}

// Hook: 合并状态
export function useConsolidationStatus() {
  const projectPath = useWorkflowStore(selectProjectPath);

  return useQuery({
    queryKey: memoryV2Keys.consolidationStatus(projectPath),
    queryFn: () => getConsolidationStatus(projectPath),
    enabled: !!projectPath,
    staleTime: STALE_TIME,
    refetchInterval: 5000,
  });
}

// Hook: V2 作业列表
export function useV2Jobs(filters?: { kind?: string; status_filter?: string }) {
  const projectPath = useWorkflowStore(selectProjectPath);

  return useQuery({
    queryKey: memoryV2Keys.jobs(projectPath, filters),
    queryFn: () => getV2Jobs(filters, projectPath),
    enabled: !!projectPath,
    staleTime: STALE_TIME,
    refetchInterval: 10000, // 每 10 秒刷新
  });
}

// Hook: 触发提取
export function useTriggerExtraction() {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  return useMutation({
    mutationFn: (maxSessions?: number) => triggerExtraction(maxSessions, projectPath),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: memoryV2Keys.extractionStatus(projectPath) });
      queryClient.invalidateQueries({ queryKey: memoryV2Keys.jobs(projectPath) });
    },
  });
}

// Hook: 触发合并
export function useTriggerConsolidation() {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  return useMutation({
    mutationFn: () => triggerConsolidation(projectPath),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: memoryV2Keys.consolidationStatus(projectPath) });
      queryClient.invalidateQueries({ queryKey: memoryV2Keys.jobs(projectPath) });
    },
  });
}

// Hook: Preview sessions for extraction
export function usePreviewSessions(includeNative: boolean = false) {
  const projectPath = useWorkflowStore(selectProjectPath);

  return useQuery({
    queryKey: memoryV2Keys.preview(projectPath, includeNative),
    queryFn: () => previewExtractionQueue(includeNative, undefined, projectPath),
    enabled: !!projectPath,
    staleTime: 10 * 1000, // 10 seconds
  });
}

// Hook: Trigger selective extraction
export function useTriggerSelectiveExtraction() {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);

  return useMutation({
    mutationFn: (params: { sessionIds: string[]; includeNative?: boolean }) =>
      triggerSelectiveExtraction({
        sessionIds: params.sessionIds,
        includeNative: params.includeNative,
        path: projectPath,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoryV2Keys.all });
    },
  });
}

// Export types
export type { ExtractionStatus, ConsolidationStatus, V2JobsResponse, ExtractionPreviewResponse, SelectiveExtractionResponse };
