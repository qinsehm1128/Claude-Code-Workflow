// ========================================
// DialogStyleContext Tests
// ========================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { DialogStyleProvider, useDialogStyleContext, useDialogStyle } from '../DialogStyleContext';
import type { A2UIPreferences } from '@/types/store';

// Create mock functions
const mockSetA2uiPreferences = vi.fn();

const defaultPreferences: A2UIPreferences = {
  dialogStyle: 'modal',
  smartModeEnabled: true,
  autoSelectionDuration: 30,
  autoSelectionSoundEnabled: false,
  pauseOnInteraction: true,
  showA2UIButtonInToolbar: true,
  drawerSide: 'right',
  drawerSize: 'md',
};

let currentPreferences: A2UIPreferences = { ...defaultPreferences };

vi.mock('@/stores/configStore', () => ({
  useConfigStore: vi.fn((selector: (state: object) => unknown) => {
    return selector({
      a2uiPreferences: currentPreferences,
      setA2uiPreferences: mockSetA2uiPreferences,
    });
  }),
}));

describe('DialogStyleContext', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DialogStyleProvider>{children}</DialogStyleProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    currentPreferences = { ...defaultPreferences };
  });

  describe('useDialogStyleContext', () => {
    it('should provide default preferences', () => {
      const { result } = renderHook(() => useDialogStyleContext(), { wrapper });

      expect(result.current.preferences.dialogStyle).toBe('modal');
      expect(result.current.preferences.smartModeEnabled).toBe(true);
    });

    it('should call setA2uiPreferences when updating preference', () => {
      const { result } = renderHook(() => useDialogStyleContext(), { wrapper });

      act(() => {
        result.current.updatePreference('dialogStyle', 'drawer');
      });

      expect(mockSetA2uiPreferences).toHaveBeenCalled();
    });

    it('should get recommended style based on question type', () => {
      const { result } = renderHook(() => useDialogStyleContext(), { wrapper });

      expect(result.current.getRecommendedStyle('confirm')).toBe('modal');
      expect(result.current.getRecommendedStyle('multi-select')).toBe('drawer');
      expect(result.current.getRecommendedStyle('multi-question')).toBe('drawer');
    });

    it('should return default style when smart mode is disabled', () => {
      currentPreferences.smartModeEnabled = false;
      currentPreferences.dialogStyle = 'fullscreen';

      const { result } = renderHook(() => useDialogStyleContext(), { wrapper });

      expect(result.current.getRecommendedStyle('confirm')).toBe('fullscreen');
    });

    it('should reset preferences', () => {
      const { result } = renderHook(() => useDialogStyleContext(), { wrapper });

      act(() => {
        result.current.resetPreferences();
      });

      expect(mockSetA2uiPreferences).toHaveBeenCalled();
    });
  });

  describe('useDialogStyle', () => {
    it('should return current style and preferences', () => {
      const { result } = renderHook(() => useDialogStyle(), { wrapper });

      expect(result.current.style).toBe('modal');
      expect(result.current.preferences).toBeDefined();
      expect(result.current.getRecommendedStyle).toBeInstanceOf(Function);
    });
  });
});
