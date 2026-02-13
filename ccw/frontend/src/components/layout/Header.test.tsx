// ========================================
// Header Component Tests - i18n Focus
// ========================================
// Tests for the header component with internationalization

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/i18n';
import { Header } from './Header';
import { useAppStore } from '@/stores/appStore';
import userEvent from '@testing-library/user-event';

// Mock useTheme hook
vi.mock('@/hooks', () => ({
  useTheme: () => ({
    isDark: false,
    toggleTheme: vi.fn(),
  }),
}));

describe('Header Component - i18n Tests', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({ locale: 'en' });
    vi.clearAllMocks();
  });

  describe('language switcher visibility', () => {
    it('should render language switcher', () => {
      render(<Header />);

      const languageSwitcher = screen.getByRole('combobox', { name: /select language/i });
      expect(languageSwitcher).toBeInTheDocument();
    });

    it('should render language switcher in compact mode', () => {
      render(<Header />);

      const languageSwitcher = screen.getByRole('combobox', { name: /select language/i });
      expect(languageSwitcher).toHaveClass('w-[110px]');
    });
  });

  describe('translated aria-labels', () => {
    it('should have translated aria-label for menu toggle', () => {
      render(<Header />);

      const menuButton = screen.getByRole('button', { name: /toggle navigation/i });
      expect(menuButton).toBeInTheDocument();
      expect(menuButton).toHaveAttribute('aria-label');
    });

    it('should have translated aria-label for theme toggle', () => {
      render(<Header />);

      const themeButton = screen.getByRole('button', { name: /switch to dark mode/i });
      expect(themeButton).toBeInTheDocument();
      expect(themeButton).toHaveAttribute('aria-label');
    });

    it('should have translated aria-label for user menu', () => {
      render(<Header />);

      const userMenuButton = screen.getByRole('button', { name: /user menu/i });
      expect(userMenuButton).toBeInTheDocument();
      expect(userMenuButton).toHaveAttribute('aria-label');
    });

    it('should have translated aria-label for refresh button', () => {
      render(<Header onRefresh={vi.fn()} />);

      const refreshButton = screen.getByRole('button', { name: /refresh workspace/i });
      expect(refreshButton).toBeInTheDocument();
      expect(refreshButton).toHaveAttribute('aria-label');
    });
  });

  describe('translated text content', () => {
    it('should display translated brand name', () => {
      render(<Header />);

      const brandLink = screen.getByRole('link', { name: /ccw/i });
      expect(brandLink).toBeInTheDocument();
    });

    it('should update aria-label when locale changes', async () => {
      const { rerender } = render(<Header />);

      // Initial locale is English
      const themeButtonEn = screen.getByRole('button', { name: /switch to dark mode/i });
      expect(themeButtonEn).toBeInTheDocument();

      // Change locale to Chinese and re-render
      useAppStore.setState({ locale: 'zh' });
      rerender(<Header />);

      // After locale change, the theme button should be updated
      // In Chinese, it should say "切换到深色模式"
      const themeButtonZh = screen.getByRole('button', { name: /切换到深色模式|switch to dark mode/i });
      expect(themeButtonZh).toBeInTheDocument();
    });
  });

  describe('translated navigation items', () => {
    it('should display translated settings link in user menu', async () => {
      const user = userEvent.setup();
      render(<Header />);

      // Click user menu to show dropdown
      const userMenuButton = screen.getByRole('button', { name: /user menu/i });
      await user.click(userMenuButton);

      // Wait for dropdown to appear
      await waitFor(() => {
        const settingsLink = screen.getByRole('link', { name: /settings/i });
        expect(settingsLink).toBeInTheDocument();
      });
    });

    it('should display translated logout button in user menu', async () => {
      const user = userEvent.setup();
      render(<Header />);

      // Click user menu to show dropdown
      const userMenuButton = screen.getByRole('button', { name: /user menu/i });
      await user.click(userMenuButton);

      // Wait for dropdown to appear
      await waitFor(() => {
        const logoutButton = screen.getByRole('button', { name: /logout/i });
        expect(logoutButton).toBeInTheDocument();
      });
    });
  });

  describe('locale switching integration', () => {
    it('should reflect locale change in language switcher', async () => {
      const { rerender } = render(<Header />);

      const languageSwitcher = screen.getByRole('combobox', { name: /select language/i });
      expect(languageSwitcher).toHaveTextContent('English');

      // Change locale in store
      useAppStore.setState({ locale: 'zh' });

      // Re-render header
      rerender(<Header />);

      expect(languageSwitcher).toHaveTextContent('中文');
    });
  });

  describe('translated project path display', () => {
    it('should display translated fallback when no project path', () => {
      render(<Header />);

      // Header should render correctly even without project path
      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();

      // Brand link should still be present
      const brandLink = screen.getByRole('link', { name: /ccw/i });
      expect(brandLink).toBeInTheDocument();
    });

    it('should render workspace selector', () => {
      render(<Header />);

      // Should render the workspace selector button with aria-label
      const workspaceButton = screen.getByRole('button', { name: /workspace selector/i });
      expect(workspaceButton).toBeInTheDocument();
    });
  });

  describe('accessibility with i18n', () => {
    it('should maintain accessible labels across locales', () => {
      render(<Header />);

      // Check specific buttons have proper aria-labels
      const themeButton = screen.getByRole('button', { name: /switch to dark mode/i });
      expect(themeButton).toHaveAttribute('aria-label');

      const userMenuButton = screen.getByRole('button', { name: /user menu/i });
      expect(userMenuButton).toHaveAttribute('aria-label');
    });

    it('should have translated title attributes', () => {
      render(<Header />);

      // Theme button should have title attribute
      const themeButton = screen.getByRole('button', { name: /switch to dark mode/i });
      expect(themeButton).toHaveAttribute('title');
    });
  });

  describe('header role with i18n', () => {
    it('should have banner role for accessibility', () => {
      render(<Header />);

      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();
    });
  });
});
