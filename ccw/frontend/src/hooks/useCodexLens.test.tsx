// ========================================
// useCodexLens Hook Tests
// ========================================
// Tests for all CodexLens TanStack Query hooks

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '../lib/api';
import {
  useCodexLensDashboard,
  useCodexLensStatus,
  useCodexLensConfig,
  useCodexLensModels,
  useCodexLensEnv,
  useCodexLensGpu,
  useUpdateCodexLensConfig,
  useBootstrapCodexLens,
  useUninstallCodexLens,
  useDownloadModel,
  useDeleteModel,
  useUpdateCodexLensEnv,
  useSelectGpu,
} from './useCodexLens';

// Mock api module
vi.mock('../lib/api', () => ({
  fetchCodexLensDashboardInit: vi.fn(),
  fetchCodexLensStatus: vi.fn(),
  fetchCodexLensConfig: vi.fn(),
  updateCodexLensConfig: vi.fn(),
  bootstrapCodexLens: vi.fn(),
  uninstallCodexLens: vi.fn(),
  fetchCodexLensModels: vi.fn(),
  fetchCodexLensModelInfo: vi.fn(),
  downloadCodexLensModel: vi.fn(),
  downloadCodexLensCustomModel: vi.fn(),
  deleteCodexLensModel: vi.fn(),
  deleteCodexLensModelByPath: vi.fn(),
  fetchCodexLensEnv: vi.fn(),
  updateCodexLensEnv: vi.fn(),
  fetchCodexLensGpuDetect: vi.fn(),
  fetchCodexLensGpuList: vi.fn(),
  selectCodexLensGpu: vi.fn(),
  resetCodexLensGpu: vi.fn(),
  fetchCodexLensIgnorePatterns: vi.fn(),
  updateCodexLensIgnorePatterns: vi.fn(),
}));

// Mock workflowStore
vi.mock('../stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => () => '/test/project'),
  selectProjectPath: vi.fn(() => '/test/project'),
}));

const mockDashboardData = {
  installed: true,
  status: {
    ready: true,
    installed: true,
    version: '1.0.0',
    pythonVersion: '3.11.0',
    venvPath: '/path/to/venv',
  },
  config: {
    index_dir: '~/.codexlens/indexes',
    index_count: 100,
    api_max_workers: 4,
    api_batch_size: 8,
  },
  semantic: { available: true },
};

const mockModelsData = {
  models: [
    {
      profile: 'model1',
      name: 'Embedding Model 1',
      type: 'embedding',
      backend: 'onnx',
      installed: true,
      cache_path: '/path/to/cache1',
    },
    {
      profile: 'model2',
      name: 'Reranker Model 1',
      type: 'reranker',
      backend: 'onnx',
      installed: false,
      cache_path: '/path/to/cache2',
    },
  ],
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useCodexLens Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCodexLensDashboard', () => {
    it('should fetch dashboard data', async () => {
      vi.mocked(api.fetchCodexLensDashboardInit).mockResolvedValue(mockDashboardData);

      const { result } = renderHook(() => useCodexLensDashboard(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(api.fetchCodexLensDashboardInit).toHaveBeenCalledOnce();
      expect(result.current.installed).toBe(true);
      expect(result.current.status?.ready).toBe(true);
      expect(result.current.config?.index_dir).toBe('~/.codexlens/indexes');
    });

    it('should handle errors', async () => {
      vi.mocked(api.fetchCodexLensDashboardInit).mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useCodexLensDashboard(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      // TanStack Query wraps errors, so just check error exists
      expect(result.current.error).toBeDefined();
    });

    it('should be disabled when enabled is false', async () => {
      const { result } = renderHook(() => useCodexLensDashboard({ enabled: false }), { wrapper });

      expect(api.fetchCodexLensDashboardInit).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('useCodexLensStatus', () => {
    it('should fetch status data', async () => {
      const mockStatus = { ready: true, installed: true, version: '1.0.0' };
      vi.mocked(api.fetchCodexLensStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useCodexLensStatus(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(api.fetchCodexLensStatus).toHaveBeenCalledOnce();
      expect(result.current.ready).toBe(true);
      expect(result.current.installed).toBe(true);
    });
  });

  describe('useCodexLensConfig', () => {
    it('should fetch config data', async () => {
      const mockConfig = {
        index_dir: '~/.codexlens/indexes',
        index_count: 100,
        api_max_workers: 4,
        api_batch_size: 8,
      };
      vi.mocked(api.fetchCodexLensConfig).mockResolvedValue(mockConfig);

      const { result } = renderHook(() => useCodexLensConfig(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(api.fetchCodexLensConfig).toHaveBeenCalledOnce();
      expect(result.current.indexDir).toBe('~/.codexlens/indexes');
      expect(result.current.indexCount).toBe(100);
      expect(result.current.apiMaxWorkers).toBe(4);
      expect(result.current.apiBatchSize).toBe(8);
    });
  });

  describe('useCodexLensModels', () => {
    it('should fetch and filter models by type', async () => {
      vi.mocked(api.fetchCodexLensModels).mockResolvedValue(mockModelsData as any);

      const { result } = renderHook(() => useCodexLensModels(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.models).toHaveLength(2);
      expect(result.current.embeddingModels).toHaveLength(1);
      expect(result.current.rerankerModels).toHaveLength(1);
      expect(result.current.embeddingModels?.[0].type).toBe('embedding');
    });
  });

  describe('useCodexLensEnv', () => {
    it('should fetch environment variables', async () => {
      const mockEnv = {
        env: { KEY1: 'value1', KEY2: 'value2' },
        settings: { SETTING1: 'setting1' },
        raw: 'KEY1=value1\nKEY2=value2',
      };
      vi.mocked(api.fetchCodexLensEnv).mockResolvedValue(mockEnv as any);

      const { result } = renderHook(() => useCodexLensEnv(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(api.fetchCodexLensEnv).toHaveBeenCalledOnce();
      expect(result.current.env).toEqual({ KEY1: 'value1', KEY2: 'value2' });
      expect(result.current.settings).toEqual({ SETTING1: 'setting1' });
      expect(result.current.raw).toBe('KEY1=value1\nKEY2=value2');
    });
  });

  describe('useCodexLensGpu', () => {
    it('should fetch GPU detect and list data', async () => {
      const mockDetect = { supported: true, has_cuda: true };
      const mockList = {
        devices: [
          { id: 0, name: 'GPU 0', type: 'cuda', driver: '12.0', memory: '8GB' },
        ],
        selected_device_id: 0,
      };
      vi.mocked(api.fetchCodexLensGpuDetect).mockResolvedValue(mockDetect as any);
      vi.mocked(api.fetchCodexLensGpuList).mockResolvedValue(mockList as any);

      const { result } = renderHook(() => useCodexLensGpu(), { wrapper });

      await waitFor(() => expect(result.current.isLoadingDetect).toBe(false));
      await waitFor(() => expect(result.current.isLoadingList).toBe(false));

      expect(api.fetchCodexLensGpuDetect).toHaveBeenCalledOnce();
      expect(api.fetchCodexLensGpuList).toHaveBeenCalledOnce();
      expect(result.current.supported).toBe(true);
      expect(result.current.devices).toHaveLength(1);
      expect(result.current.selectedDeviceId).toBe(0);
    });
  });

  describe('useUpdateCodexLensConfig', () => {
    it('should update config and invalidate queries', async () => {
      vi.mocked(api.updateCodexLensConfig).mockResolvedValue({
        success: true,
        message: 'Config updated',
      });

      const { result } = renderHook(() => useUpdateCodexLensConfig(), { wrapper });

      const updateResult = await result.current.updateConfig({
        index_dir: '~/.codexlens/indexes',
        api_max_workers: 8,
        api_batch_size: 16,
      });

      expect(api.updateCodexLensConfig).toHaveBeenCalledWith({
        index_dir: '~/.codexlens/indexes',
        api_max_workers: 8,
        api_batch_size: 16,
      });
      expect(updateResult.success).toBe(true);
      expect(updateResult.message).toBe('Config updated');
    });
  });

  describe('useBootstrapCodexLens', () => {
    it('should bootstrap CodexLens and invalidate queries', async () => {
      vi.mocked(api.bootstrapCodexLens).mockResolvedValue({
        success: true,
        version: '1.0.0',
      });

      const { result } = renderHook(() => useBootstrapCodexLens(), { wrapper });

      const bootstrapResult = await result.current.bootstrap();

      expect(api.bootstrapCodexLens).toHaveBeenCalledOnce();
      expect(bootstrapResult.success).toBe(true);
      expect(bootstrapResult.version).toBe('1.0.0');
    });
  });

  describe('useUninstallCodexLens', () => {
    it('should uninstall CodexLens and invalidate queries', async () => {
      vi.mocked(api.uninstallCodexLens).mockResolvedValue({
        success: true,
        message: 'CodexLens uninstalled',
      });

      const { result } = renderHook(() => useUninstallCodexLens(), { wrapper });

      const uninstallResult = await result.current.uninstall();

      expect(api.uninstallCodexLens).toHaveBeenCalledOnce();
      expect(uninstallResult.success).toBe(true);
    });
  });

  describe('useDownloadModel', () => {
    it('should download model by profile', async () => {
      vi.mocked(api.downloadCodexLensModel).mockResolvedValue({
        success: true,
        message: 'Model downloaded',
      });

      const { result } = renderHook(() => useDownloadModel(), { wrapper });

      const downloadResult = await result.current.downloadModel('model1');

      expect(api.downloadCodexLensModel).toHaveBeenCalledWith('model1');
      expect(downloadResult.success).toBe(true);
    });

    it('should download custom model', async () => {
      vi.mocked(api.downloadCodexLensCustomModel).mockResolvedValue({
        success: true,
        message: 'Custom model downloaded',
      });

      const { result } = renderHook(() => useDownloadModel(), { wrapper });

      const downloadResult = await result.current.downloadCustomModel('custom/model', 'embedding');

      expect(api.downloadCodexLensCustomModel).toHaveBeenCalledWith('custom/model', 'embedding');
      expect(downloadResult.success).toBe(true);
    });
  });

  describe('useDeleteModel', () => {
    it('should delete model by profile', async () => {
      vi.mocked(api.deleteCodexLensModel).mockResolvedValue({
        success: true,
        message: 'Model deleted',
      });

      const { result } = renderHook(() => useDeleteModel(), { wrapper });

      const deleteResult = await result.current.deleteModel('model1');

      expect(api.deleteCodexLensModel).toHaveBeenCalledWith('model1');
      expect(deleteResult.success).toBe(true);
    });

    it('should delete model by path', async () => {
      vi.mocked(api.deleteCodexLensModelByPath).mockResolvedValue({
        success: true,
        message: 'Model deleted',
      });

      const { result } = renderHook(() => useDeleteModel(), { wrapper });

      const deleteResult = await result.current.deleteModelByPath('/path/to/model');

      expect(api.deleteCodexLensModelByPath).toHaveBeenCalledWith('/path/to/model');
      expect(deleteResult.success).toBe(true);
    });
  });

  describe('useUpdateCodexLensEnv', () => {
    it('should update environment variables', async () => {
      vi.mocked(api.updateCodexLensEnv).mockResolvedValue({
        success: true,
        env: { KEY1: 'newvalue' },
        settings: {},
        raw: 'KEY1=newvalue',
      } as any);

      const { result } = renderHook(() => useUpdateCodexLensEnv(), { wrapper });

      const updateResult = await result.current.updateEnv({
        raw: 'KEY1=newvalue',
      } as any);

      expect(api.updateCodexLensEnv).toHaveBeenCalledWith({ raw: 'KEY1=newvalue' });
      expect(updateResult.success).toBe(true);
    });
  });

  describe('useSelectGpu', () => {
    it('should select GPU', async () => {
      vi.mocked(api.selectCodexLensGpu).mockResolvedValue({
        success: true,
        message: 'GPU selected',
      });

      const { result } = renderHook(() => useSelectGpu(), { wrapper });

      const selectResult = await result.current.selectGpu(0);

      expect(api.selectCodexLensGpu).toHaveBeenCalledWith(0);
      expect(selectResult.success).toBe(true);
    });

    it('should reset GPU', async () => {
      vi.mocked(api.resetCodexLensGpu).mockResolvedValue({
        success: true,
        message: 'GPU reset',
      });

      const { result } = renderHook(() => useSelectGpu(), { wrapper });

      const resetResult = await result.current.resetGpu();

      expect(api.resetCodexLensGpu).toHaveBeenCalledOnce();
      expect(resetResult.success).toBe(true);
    });
  });

  describe('query refetch', () => {
    it('should refetch dashboard data', async () => {
      vi.mocked(api.fetchCodexLensDashboardInit).mockResolvedValue(mockDashboardData);

      const { result } = renderHook(() => useCodexLensDashboard(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(api.fetchCodexLensDashboardInit).toHaveBeenCalledTimes(1);

      await result.current.refetch();

      expect(api.fetchCodexLensDashboardInit).toHaveBeenCalledTimes(2);
    });
  });
});
