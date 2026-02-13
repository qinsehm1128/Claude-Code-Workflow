// ========================================
// Settings Tab Component Tests
// ========================================
// Tests for CodexLens Settings Tab component with schema-driven form

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/i18n';
import userEvent from '@testing-library/user-event';
import { SettingsTab } from './SettingsTab';
import type { CodexLensConfig } from '@/lib/api';

// Mock hooks - use importOriginal to preserve all exports
vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useCodexLensConfig: vi.fn(),
    useCodexLensEnv: vi.fn(),
    useUpdateCodexLensEnv: vi.fn(),
    useCodexLensModels: vi.fn(),
    useCodexLensRerankerConfig: vi.fn(),
    useUpdateRerankerConfig: vi.fn(),
    useNotifications: vi.fn(() => ({
      toasts: [],
      wsStatus: 'disconnected' as const,
      wsLastMessage: null,
      isWsConnected: false,
      isPanelVisible: false,
      persistentNotifications: [],
      addToast: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      removeToast: vi.fn(),
      clearAllToasts: vi.fn(),
      setWsStatus: vi.fn(),
      setWsLastMessage: vi.fn(),
      togglePanel: vi.fn(),
      setPanelVisible: vi.fn(),
      addPersistentNotification: vi.fn(),
      removePersistentNotification: vi.fn(),
      clearPersistentNotifications: vi.fn(),
    })),
  };
});

import {
  useCodexLensConfig,
  useCodexLensEnv,
  useUpdateCodexLensEnv,
  useCodexLensModels,
  useCodexLensRerankerConfig,
  useUpdateRerankerConfig,
  useNotifications,
} from '@/hooks';

const mockConfig: CodexLensConfig = {
  index_dir: '~/.codexlens/indexes',
  index_count: 100,
  api_max_workers: 4,
  api_batch_size: 8,
};

const mockEnv: Record<string, string> = {
  CODEXLENS_EMBEDDING_BACKEND: 'local',
  CODEXLENS_EMBEDDING_MODEL: 'fast',
  CODEXLENS_USE_GPU: 'true',
  CODEXLENS_RERANKER_ENABLED: 'true',
  CODEXLENS_RERANKER_BACKEND: 'local',
  CODEXLENS_API_MAX_WORKERS: '4',
  CODEXLENS_API_BATCH_SIZE: '8',
  CODEXLENS_CASCADE_STRATEGY: 'dense_rerank',
};

function setupDefaultMocks() {
  vi.mocked(useCodexLensConfig).mockReturnValue({
    config: mockConfig,
    indexDir: mockConfig.index_dir,
    indexCount: 100,
    apiMaxWorkers: 4,
    apiBatchSize: 8,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
  vi.mocked(useCodexLensEnv).mockReturnValue({
    data: { success: true, env: mockEnv, settings: {}, path: '~/.codexlens/.env' },
    env: mockEnv,
    settings: {},
    raw: '',
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
  vi.mocked(useUpdateCodexLensEnv).mockReturnValue({
    updateEnv: vi.fn().mockResolvedValue({ success: true, message: 'Saved' }),
    isUpdating: false,
    error: null,
  });
  vi.mocked(useCodexLensModels).mockReturnValue({
    models: [],
    embeddingModels: [],
    rerankerModels: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
  vi.mocked(useCodexLensRerankerConfig).mockReturnValue({
    data: undefined,
    backend: 'fastembed',
    modelName: '',
    apiProvider: '',
    apiKeySet: false,
    availableBackends: ['onnx', 'api', 'litellm', 'legacy'],
    apiProviders: ['siliconflow', 'cohere', 'jina'],
    litellmModels: undefined,
    configSource: 'default',
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
  vi.mocked(useUpdateRerankerConfig).mockReturnValue({
    updateConfig: vi.fn().mockResolvedValue({ success: true, message: 'Saved' }),
    isUpdating: false,
    error: null,
  });
}

describe('SettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when enabled and config loaded', () => {
    beforeEach(() => {
      setupDefaultMocks();
    });

    it('should render current info card', () => {
      render(<SettingsTab enabled={true} />);

      expect(screen.getByText(/Current Index Count/i)).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText(/Current Workers/i)).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText(/Current Batch Size/i)).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('should render configuration form with index directory', () => {
      render(<SettingsTab enabled={true} />);

      expect(screen.getByText(/Basic Configuration/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Index Directory/i)).toBeInTheDocument();
    });

    it('should render env var group sections', () => {
      render(<SettingsTab enabled={true} />);

      // Schema groups should be rendered (labels come from i18n, check for group icons/sections)
      expect(screen.getByText(/Embedding/i)).toBeInTheDocument();
      expect(screen.getByText(/Reranker/i)).toBeInTheDocument();
      expect(screen.getByText(/Concurrency/i)).toBeInTheDocument();
      expect(screen.getByText(/Cascade/i)).toBeInTheDocument();
      expect(screen.getByText(/Chunking/i)).toBeInTheDocument();
    });

    it('should initialize index dir from config', () => {
      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i) as HTMLInputElement;
      expect(indexDirInput.value).toBe('~/.codexlens/indexes');
    });

    it('should show save button enabled when changes are made', async () => {
      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i);
      await user.clear(indexDirInput);
      await user.type(indexDirInput, '/new/index/path');

      const saveButton = screen.getByText(/Save/i);
      expect(saveButton).toBeEnabled();
    });

    it('should disable save and reset buttons when no changes', () => {
      render(<SettingsTab enabled={true} />);

      const saveButton = screen.getByText(/Save/i);
      const resetButton = screen.getByText(/Reset/i);

      expect(saveButton).toBeDisabled();
      expect(resetButton).toBeDisabled();
    });

    it('should call updateEnv on save', async () => {
      const updateEnv = vi.fn().mockResolvedValue({ success: true, message: 'Saved' });
      vi.mocked(useUpdateCodexLensEnv).mockReturnValue({
        updateEnv,
        isUpdating: false,
        error: null,
      });

      const success = vi.fn();
      vi.mocked(useNotifications).mockReturnValue({
        toasts: [],
        wsStatus: 'disconnected' as const,
        wsLastMessage: null,
        isWsConnected: false,
        isPanelVisible: false,
        persistentNotifications: [],
        addToast: vi.fn(),
        info: vi.fn(),
        success,
        warning: vi.fn(),
        error: vi.fn(),
        removeToast: vi.fn(),
        clearAllToasts: vi.fn(),
        setWsStatus: vi.fn(),
        setWsLastMessage: vi.fn(),
        togglePanel: vi.fn(),
        setPanelVisible: vi.fn(),
        addPersistentNotification: vi.fn(),
        removePersistentNotification: vi.fn(),
        clearPersistentNotifications: vi.fn(),
      });

      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i);
      await user.clear(indexDirInput);
      await user.type(indexDirInput, '/new/index/path');

      const saveButton = screen.getByText(/Save/i);
      await user.click(saveButton);

      await waitFor(() => {
        expect(updateEnv).toHaveBeenCalledWith({
          env: expect.objectContaining({
            CODEXLENS_EMBEDDING_BACKEND: 'local',
            CODEXLENS_EMBEDDING_MODEL: 'fast',
          }),
        });
      });
    });

    it('should reset form on reset button click', async () => {
      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i) as HTMLInputElement;
      await user.clear(indexDirInput);
      await user.type(indexDirInput, '/new/index/path');

      expect(indexDirInput.value).toBe('/new/index/path');

      const resetButton = screen.getByText(/Reset/i);
      await user.click(resetButton);

      expect(indexDirInput.value).toBe('~/.codexlens/indexes');
    });
  });

  describe('form validation', () => {
    beforeEach(() => {
      setupDefaultMocks();
    });

    it('should validate index dir is required', async () => {
      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i);
      await user.clear(indexDirInput);

      const saveButton = screen.getByText(/Save/i);
      await user.click(saveButton);

      expect(screen.getByText(/Index directory is required/i)).toBeInTheDocument();
    });

    it('should clear error when user fixes invalid input', async () => {
      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i);
      await user.clear(indexDirInput);

      const saveButton = screen.getByText(/Save/i);
      await user.click(saveButton);

      expect(screen.getByText(/Index directory is required/i)).toBeInTheDocument();

      await user.type(indexDirInput, '/valid/path');

      expect(screen.queryByText(/Index directory is required/i)).not.toBeInTheDocument();
    });
  });

  describe('when disabled', () => {
    beforeEach(() => {
      setupDefaultMocks();
    });

    it('should not render when enabled is false', () => {
      render(<SettingsTab enabled={false} />);

      // When not enabled, hooks are disabled so no config/env data
      expect(screen.queryByText(/Basic Configuration/i)).not.toBeInTheDocument();
    });
  });

  describe('loading states', () => {
    it('should disable inputs when loading config', () => {
      vi.mocked(useCodexLensConfig).mockReturnValue({
        config: mockConfig,
        indexDir: mockConfig.index_dir,
        indexCount: 100,
        apiMaxWorkers: 4,
        apiBatchSize: 8,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useCodexLensEnv).mockReturnValue({
        data: { success: true, env: mockEnv, settings: {}, path: '' },
        env: mockEnv,
        settings: {},
        raw: '',
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useUpdateCodexLensEnv).mockReturnValue({
        updateEnv: vi.fn().mockResolvedValue({ success: true }),
        isUpdating: false,
        error: null,
      });
      vi.mocked(useCodexLensModels).mockReturnValue({
        models: [],
        embeddingModels: [],
        rerankerModels: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useCodexLensRerankerConfig).mockReturnValue({
        data: undefined,
        backend: 'fastembed',
        modelName: '',
        apiProvider: '',
        apiKeySet: false,
        availableBackends: [],
        apiProviders: [],
        litellmModels: undefined,
        configSource: 'default',
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
      vi.mocked(useUpdateRerankerConfig).mockReturnValue({
        updateConfig: vi.fn().mockResolvedValue({ success: true }),
        isUpdating: false,
        error: null,
      });

      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i);
      expect(indexDirInput).toBeDisabled();
    });

    it('should show saving state when updating', async () => {
      setupDefaultMocks();
      vi.mocked(useUpdateCodexLensEnv).mockReturnValue({
        updateEnv: vi.fn().mockResolvedValue({ success: true }),
        isUpdating: true,
        error: null,
      });

      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i);
      await user.clear(indexDirInput);
      await user.type(indexDirInput, '/new/path');

      const saveButton = screen.getByText(/Saving/i);
      expect(saveButton).toBeInTheDocument();
    });
  });

  describe('i18n - Chinese locale', () => {
    beforeEach(() => {
      setupDefaultMocks();
    });

    it('should display translated labels', () => {
      render(<SettingsTab enabled={true} />, { locale: 'zh' });

      expect(screen.getByText(/当前索引数量/i)).toBeInTheDocument();
      expect(screen.getByText(/当前工作线程/i)).toBeInTheDocument();
      expect(screen.getByText(/当前批次大小/i)).toBeInTheDocument();
      expect(screen.getByText(/基本配置/i)).toBeInTheDocument();
      expect(screen.getByText(/索引目录/i)).toBeInTheDocument();
      expect(screen.getByText(/保存/i)).toBeInTheDocument();
      expect(screen.getByText(/重置/i)).toBeInTheDocument();
    });

    it('should display translated validation errors', async () => {
      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />, { locale: 'zh' });

      const indexDirInput = screen.getByLabelText(/索引目录/i);
      await user.clear(indexDirInput);

      const saveButton = screen.getByText(/保存/i);
      await user.click(saveButton);

      expect(screen.getByText(/索引目录不能为空/i)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should show error notification on save failure', async () => {
      setupDefaultMocks();
      const error = vi.fn();
      vi.mocked(useNotifications).mockReturnValue({
        toasts: [],
        wsStatus: 'disconnected' as const,
        wsLastMessage: null,
        isWsConnected: false,
        isPanelVisible: false,
        persistentNotifications: [],
        addToast: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        error,
        removeToast: vi.fn(),
        clearAllToasts: vi.fn(),
        setWsStatus: vi.fn(),
        setWsLastMessage: vi.fn(),
        togglePanel: vi.fn(),
        setPanelVisible: vi.fn(),
        addPersistentNotification: vi.fn(),
        removePersistentNotification: vi.fn(),
        clearPersistentNotifications: vi.fn(),
      });
      vi.mocked(useUpdateCodexLensEnv).mockReturnValue({
        updateEnv: vi.fn().mockResolvedValue({ success: false, message: 'Save failed' }),
        isUpdating: false,
        error: null,
      });

      const user = userEvent.setup();
      render(<SettingsTab enabled={true} />);

      const indexDirInput = screen.getByLabelText(/Index Directory/i);
      await user.clear(indexDirInput);
      await user.type(indexDirInput, '/new/path');

      const saveButton = screen.getByText(/Save/i);
      await user.click(saveButton);

      await waitFor(() => {
        expect(error).toHaveBeenCalledWith(
          expect.stringContaining('Save failed'),
          expect.any(String)
        );
      });
    });
  });
});
