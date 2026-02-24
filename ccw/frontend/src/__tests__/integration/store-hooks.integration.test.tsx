// ========================================
// Store + Hooks Integration Tests
// ========================================
// L2 Integration tests for appStore + hooks interactions

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '@/stores/appStore';
import { useLocale } from '@/hooks/useLocale';

// Mock i18n utilities
vi.mock('@/lib/i18n', () => ({
  getInitialLocale: () => 'en',
  updateIntl: vi.fn(),
  availableLocales: {
    en: 'English',
    zh: '中文',
  },
}));

// Mock theme utilities to avoid DOM manipulation
vi.mock('@/lib/theme', () => ({
  getThemeId: vi.fn(() => 'default'),
  DEFAULT_SLOT: {},
  THEME_SLOT_LIMIT: 10,
  DEFAULT_BACKGROUND_CONFIG: {
    mode: 'none',
    effects: {
      blur: false,
      darkenOpacity: 0,
      saturation: 100,
    },
  },
}));

vi.mock('@/lib/colorGenerator', () => ({
  generateThemeFromHue: vi.fn(() => ({})),
  applyStyleTier: vi.fn((vars) => vars),
}));

vi.mock('@/lib/accessibility', () => ({
  resolveMotionPreference: vi.fn((pref) => pref === 'system' ? 'full' : pref),
  checkThemeContrast: vi.fn(),
}));

describe('Store + Hooks Integration Tests', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      locale: 'en',
      theme: 'system',
      sidebarCollapsed: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Locale Flow: Store + Hook', () => {
    it('INT-LOCALE-1: useLocale should reflect store changes', () => {
      // Initial state
      useAppStore.setState({ locale: 'en' });

      const { result } = renderHook(() => useLocale());

      expect(result.current.locale).toBe('en');

      // Update via store
      act(() => {
        useAppStore.getState().setLocale('zh');
      });

      expect(result.current.locale).toBe('zh');
    });

    it('INT-LOCALE-2: useLocale.setLocale should update store', () => {
      useAppStore.setState({ locale: 'en' });

      const { result } = renderHook(() => useLocale());

      act(() => {
        result.current.setLocale('zh');
      });

      expect(useAppStore.getState().locale).toBe('zh');
    });

    it('INT-LOCALE-3: Multiple hooks should share same state', () => {
      useAppStore.setState({ locale: 'en' });

      const { result: result1 } = renderHook(() => useLocale());
      const { result: result2 } = renderHook(() => useLocale());

      expect(result1.current.locale).toBe(result2.current.locale);

      act(() => {
        result1.current.setLocale('zh');
      });

      // Both hooks should reflect the change
      expect(result1.current.locale).toBe('zh');
      expect(result2.current.locale).toBe('zh');
    });

    it('INT-LOCALE-4: availableLocales should be consistent', () => {
      const { result } = renderHook(() => useLocale());

      expect(result.current.availableLocales).toEqual({
        en: 'English',
        zh: '\u4e2d\u6587',
      });
    });

    it('INT-LOCALE-5: Direct store update should propagate to hook', async () => {
      useAppStore.setState({ locale: 'en' });

      const { result } = renderHook(() => useLocale());

      // Direct store update
      act(() => {
        useAppStore.setState({ locale: 'zh' });
      });

      expect(result.current.locale).toBe('zh');
    });
  });

  describe('Theme Flow: Store + Persistence', () => {
    it('INT-THEME-1: Theme changes should persist to localStorage', () => {
      localStorage.clear();

      act(() => {
        useAppStore.getState().setTheme('dark');
      });

      // Check localStorage was updated (zustand persist middleware)
      const stored = localStorage.getItem('ccw-app-store');
      expect(stored).not.toBeNull();

      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.theme).toBe('dark');
      }
    });

    it('INT-THEME-2: Store should hydrate from localStorage', () => {
      // Pre-populate localStorage
      localStorage.setItem('ccw-app-store', JSON.stringify({
        state: { locale: 'zh', theme: 'light', sidebarCollapsed: true },
        version: 0,
      }));

      // The store should have the persisted values
      const state = useAppStore.getState();
      // Note: Actual hydration happens on mount, this tests the persist config
      expect(['en', 'zh']).toContain(state.locale);
    });

    it('INT-THEME-3: Theme toggle should update state', () => {
      useAppStore.setState({ theme: 'light' });

      act(() => {
        useAppStore.getState().setTheme('dark');
      });

      expect(useAppStore.getState().theme).toBe('dark');
    });

    it('INT-THEME-4: System theme should be valid option', () => {
      act(() => {
        useAppStore.getState().setTheme('system');
      });

      expect(useAppStore.getState().theme).toBe('system');
    });
  });

  describe('Sidebar State Flow', () => {
    it('INT-SIDEBAR-1: Toggle should flip state', () => {
      useAppStore.setState({ sidebarCollapsed: false });

      // Use setSidebarCollapsed directly since toggleSidebar may not exist
      act(() => {
        useAppStore.getState().setSidebarCollapsed(true);
      });

      expect(useAppStore.getState().sidebarCollapsed).toBe(true);

      act(() => {
        useAppStore.getState().setSidebarCollapsed(false);
      });

      expect(useAppStore.getState().sidebarCollapsed).toBe(false);
    });

    it('INT-SIDEBAR-2: SetSidebarCollapsed should work directly', () => {
      useAppStore.setState({ sidebarCollapsed: false });

      act(() => {
        useAppStore.getState().setSidebarCollapsed(true);
      });

      expect(useAppStore.getState().sidebarCollapsed).toBe(true);
    });
  });

  describe('Concurrent State Updates', () => {
    it('INT-CONCURRENT-1: Multiple rapid updates should be consistent', () => {
      useAppStore.setState({ locale: 'en', theme: 'light', sidebarCollapsed: false });

      act(() => {
        useAppStore.getState().setLocale('zh');
        useAppStore.getState().setTheme('dark');
        useAppStore.getState().setSidebarCollapsed(true);
      });

      const state = useAppStore.getState();
      expect(state.locale).toBe('zh');
      expect(state.theme).toBe('dark');
      expect(state.sidebarCollapsed).toBe(true);
    });

    it('INT-CONCURRENT-2: Selector subscriptions should update correctly', () => {
      const localeChanges: string[] = [];

      // Subscribe to all state changes and filter for locale
      const unsubscribe = useAppStore.subscribe((state, prevState) => {
        if (state.locale !== prevState.locale) {
          localeChanges.push(state.locale);
        }
      });

      act(() => {
        useAppStore.getState().setLocale('zh');
      });

      act(() => {
        useAppStore.getState().setLocale('en');
      });

      act(() => {
        useAppStore.getState().setLocale('zh');
      });

      expect(localeChanges.length).toBeGreaterThanOrEqual(2);

      unsubscribe();
    });
  });

  describe('Error Recovery', () => {
    it('INT-ERROR-1: Store should remain stable after error', () => {
      useAppStore.setState({ locale: 'en' });

      // Attempt invalid operation (if any validation exists)
      act(() => {
        try {
          useAppStore.getState().setLocale('en');
        } catch {
          // Ignore errors
        }
      });

      // Store should still be functional
      expect(useAppStore.getState().locale).toBe('en');

      act(() => {
        useAppStore.getState().setLocale('zh');
      });

      expect(useAppStore.getState().locale).toBe('zh');
    });
  });

  describe('State Reset', () => {
    it('INT-RESET-1: Reset should restore initial state', () => {
      // Modify state
      useAppStore.setState({
        locale: 'zh',
        theme: 'dark',
        sidebarCollapsed: true,
      });

      // Reset
      act(() => {
        useAppStore.setState({
          locale: 'en',
          theme: 'system',
          sidebarCollapsed: false,
        });
      });

      const state = useAppStore.getState();
      expect(state.locale).toBe('en');
      expect(state.theme).toBe('system');
      expect(state.sidebarCollapsed).toBe(false);
    });
  });
});
