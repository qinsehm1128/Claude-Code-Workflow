// ========================================
// CodexLens Manager Page Tests
// ========================================
// Integration tests for CodexLens manager page with tabs

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/i18n';
import userEvent from '@testing-library/user-event';
import { CodexLensManagerPage } from './CodexLensManagerPage';

// Mock api module
vi.mock('@/lib/api', () => ({
  fetchCodexLensDashboardInit: vi.fn(),
  bootstrapCodexLens: vi.fn(),
  uninstallCodexLens: vi.fn(),
}));

// Mock hooks
vi.mock('@/hooks/useCodexLens', () => ({
  useCodexLensDashboard: vi.fn(),
}));

vi.mock('@/hooks/useCodexLens', () => ({
  useCodexLensDashboard: vi.fn(),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: vi.fn(() => ({
    success: vi.fn(),
    error: vi.fn(),
    toasts: [],
    wsStatus: 'disconnected' as const,
    wsLastMessage: null,
    isWsConnected: false,
    addToast: vi.fn(),
    removeToast: vi.fn(),
    clearAllToasts: vi.fn(),
    connectWebSocket: vi.fn(),
    disconnectWebSocket: vi.fn(),
  })),
}));

// Mock the mutations hook separately
vi.mock('@/hooks/useCodexLens', async () => {
  return {
    useCodexLensDashboard: (await import('@/hooks/useCodexLens')).useCodexLensDashboard,
    useCodexLensMutations: vi.fn(),
  };
});

// Mock window.confirm
global.confirm = vi.fn(() => true);

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

const mockMutations = {
  bootstrap: vi.fn().mockResolvedValue({ success: true }),
  uninstall: vi.fn().mockResolvedValue({ success: true }),
  isBootstrapping: false,
  isUninstalling: false,
};

import { useCodexLensDashboard, useCodexLensMutations } from '@/hooks';

describe('CodexLensManagerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  describe('when installed', () => {
    beforeEach(() => {
      (vi.mocked(useCodexLensDashboard) as any).mockReturnValue({
        installed: true,
        status: mockDashboardData.status,
        config: mockDashboardData.config,
        semantic: mockDashboardData.semantic,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      });
      (vi.mocked(useCodexLensMutations) as any).mockReturnValue(mockMutations);
    });

    it('should render page title and description', () => {
      render(<CodexLensManagerPage />);

      expect(screen.getByText(/CodexLens/i)).toBeInTheDocument();
      expect(screen.getByText(/Semantic code search engine/i)).toBeInTheDocument();
    });

    it('should render all tabs', () => {
      render(<CodexLensManagerPage />);

      expect(screen.getByText(/Overview/i)).toBeInTheDocument();
      expect(screen.getByText(/Settings/i)).toBeInTheDocument();
      expect(screen.getByText(/Models/i)).toBeInTheDocument();
      expect(screen.getByText(/Advanced/i)).toBeInTheDocument();
    });

    it('should show uninstall button when installed', () => {
      render(<CodexLensManagerPage />);

      expect(screen.getByText(/Uninstall/i)).toBeInTheDocument();
    });

    it('should switch between tabs', async () => {
      const user = userEvent.setup();
      render(<CodexLensManagerPage />);

      const settingsTab = screen.getByText(/Settings/i);
      await user.click(settingsTab);

      expect(settingsTab).toHaveAttribute('data-state', 'active');
    });

    it('should call refresh on button click', async () => {
      const refetch = vi.fn();
      (vi.mocked(useCodexLensDashboard) as any).mockReturnValue({
        installed: true,
        status: mockDashboardData.status,
        config: mockDashboardData.config,
        semantic: mockDashboardData.semantic,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch,
      });

      const user = userEvent.setup();
      render(<CodexLensManagerPage />);

      const refreshButton = screen.getByText(/Refresh/i);
      await user.click(refreshButton);

      expect(refetch).toHaveBeenCalledOnce();
    });
  });

  describe('when not installed', () => {
    beforeEach(() => {
      (vi.mocked(useCodexLensDashboard) as any).mockReturnValue({
        installed: false,
        status: undefined,
        config: undefined,
        semantic: undefined,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      });
      (vi.mocked(useCodexLensMutations) as any).mockReturnValue(mockMutations);
    });

    it('should show bootstrap button', () => {
      render(<CodexLensManagerPage />);

      expect(screen.getByText(/Bootstrap/i)).toBeInTheDocument();
    });

    it('should show not installed alert', () => {
      render(<CodexLensManagerPage />);

      expect(screen.getByText(/CodexLens is not installed/i)).toBeInTheDocument();
    });

    it('should call bootstrap on button click', async () => {
      const bootstrap = vi.fn().mockResolvedValue({ success: true });
      (vi.mocked(useCodexLensMutations) as any).mockReturnValue({
        ...mockMutations,
        bootstrap,
      });

      const user = userEvent.setup();
      render(<CodexLensManagerPage />);

      const bootstrapButton = screen.getByText(/Bootstrap/i);
      await user.click(bootstrapButton);

      await waitFor(() => {
        expect(bootstrap).toHaveBeenCalledOnce();
      });
    });
  });

  describe('uninstall flow', () => {
    beforeEach(() => {
      (vi.mocked(useCodexLensDashboard) as any).mockReturnValue({
        installed: true,
        status: mockDashboardData.status,
        config: mockDashboardData.config,
        semantic: mockDashboardData.semantic,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      });
    });

    it('should show confirmation dialog on uninstall', async () => {
      const uninstall = vi.fn().mockResolvedValue({ success: true });
      (vi.mocked(useCodexLensMutations) as any).mockReturnValue({
        ...mockMutations,
        uninstall,
      });

      const user = userEvent.setup();
      render(<CodexLensManagerPage />);

      const uninstallButton = screen.getByText(/Uninstall/i);
      await user.click(uninstallButton);

      expect(global.confirm).toHaveBeenCalledWith(expect.stringContaining('uninstall'));
    });

    it('should call uninstall when confirmed', async () => {
      const uninstall = vi.fn().mockResolvedValue({ success: true });
      (vi.mocked(useCodexLensMutations) as any).mockReturnValue({
        ...mockMutations,
        uninstall,
      });

      const user = userEvent.setup();
      render(<CodexLensManagerPage />);

      const uninstallButton = screen.getByText(/Uninstall/i);
      await user.click(uninstallButton);

      await waitFor(() => {
        expect(uninstall).toHaveBeenCalledOnce();
      });
    });

    it('should not call uninstall when cancelled', async () => {
      (global.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const uninstall = vi.fn().mockResolvedValue({ success: true });
      (vi.mocked(useCodexLensMutations) as any).mockReturnValue({
        ...mockMutations,
        uninstall,
      });

      const user = userEvent.setup();
      render(<CodexLensManagerPage />);

      const uninstallButton = screen.getByText(/Uninstall/i);
      await user.click(uninstallButton);

      expect(uninstall).not.toHaveBeenCalled();
    });
  });

  describe('loading states', () => {
    it('should show loading skeleton when loading', () => {
      (vi.mocked(useCodexLensDashboard) as any).mockReturnValue({
        installed: false,
        status: undefined,
        config: undefined,
        semantic: undefined,
        isLoading: true,
        isFetching: true,
        error: null,
        refetch: vi.fn(),
      });
      (vi.mocked(useCodexLensMutations) as any).mockReturnValue(mockMutations);

      render(<CodexLensManagerPage />);

      // Check for skeleton or loading indicator
      const refreshButton = screen.getByText(/Refresh/i);
      expect(refreshButton).toBeDisabled();
    });

    it('should disable refresh button when fetching', () => {
      (vi.mocked(useCodexLensDashboard) as any).mockReturnValue({
        installed: true,
        status: mockDashboardData.status,
        config: mockDashboardData.config,
        semantic: mockDashboardData.semantic,
        isLoading: false,
        isFetching: true,
        error: null,
        refetch: vi.fn(),
      });
      (vi.mocked(useCodexLensMutations) as any).mockReturnValue(mockMutations);

      render(<CodexLensManagerPage />);

      const refreshButton = screen.getByText(/Refresh/i);
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('i18n - Chinese locale', () => {
    beforeEach(() => {
      (vi.mocked(useCodexLensDashboard) as any).mockReturnValue({
        installed: true,
        status: mockDashboardData.status,
        config: mockDashboardData.config,
        semantic: mockDashboardData.semantic,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      });
      (vi.mocked(useCodexLensMutations) as any).mockReturnValue(mockMutations);
    });

    it('should display translated text in Chinese', () => {
      render(<CodexLensManagerPage />, { locale: 'zh' });

      expect(screen.getByText(/CodexLens/i)).toBeInTheDocument();
      expect(screen.getByText(/语义代码搜索引擎/i)).toBeInTheDocument();
      expect(screen.getByText(/概览/i)).toBeInTheDocument();
      expect(screen.getByText(/设置/i)).toBeInTheDocument();
      expect(screen.getByText(/模型/i)).toBeInTheDocument();
      expect(screen.getByText(/高级/i)).toBeInTheDocument();
    });

    it('should display translated uninstall button', () => {
      render(<CodexLensManagerPage />, { locale: 'zh' });

      expect(screen.getByText(/卸载/i)).toBeInTheDocument();
    });
  });

  describe('error states', () => {
    it('should handle API errors gracefully', () => {
      (vi.mocked(useCodexLensDashboard) as any).mockReturnValue({
        installed: false,
        status: undefined,
        config: undefined,
        semantic: undefined,
        isLoading: false,
        isFetching: false,
        error: new Error('API Error'),
        refetch: vi.fn(),
      });
      (vi.mocked(useCodexLensMutations) as any).mockReturnValue(mockMutations);

      render(<CodexLensManagerPage />);

      // Page should still render even with error
      expect(screen.getByText(/CodexLens/i)).toBeInTheDocument();
    });
  });
});
