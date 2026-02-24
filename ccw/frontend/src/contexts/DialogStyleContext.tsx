// ========================================
// DialogStyleContext
// ========================================
// Context provider for A2UI dialog style preferences
// Supports modal, drawer, sheet, and fullscreen modes

import { createContext, useContext, useCallback, useMemo } from 'react';
import { useConfigStore } from '@/stores/configStore';

// ========== Types ==========

export type DialogStyle = 'modal' | 'drawer' | 'sheet' | 'fullscreen';

export interface A2UIPreferences {
  /** Default dialog style */
  dialogStyle: DialogStyle;
  /** Enable smart mode - auto-select style based on question type */
  smartModeEnabled: boolean;
  /** Auto-selection countdown duration in seconds */
  autoSelectionDuration: number;
  /** Enable sound notification before auto-submit */
  autoSelectionSoundEnabled: boolean;
  /** Pause countdown on user interaction */
  pauseOnInteraction: boolean;
  /** Show A2UI quick action button in toolbar */
  showA2UIButtonInToolbar: boolean;
  /** Drawer side preference */
  drawerSide: 'left' | 'right';
  /** Drawer size preference */
  drawerSize: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export interface DialogStyleContextValue {
  /** Current preferences */
  preferences: A2UIPreferences;
  /** Update a preference */
  updatePreference: <K extends keyof A2UIPreferences>(
    key: K,
    value: A2UIPreferences[K]
  ) => void;
  /** Reset to defaults */
  resetPreferences: () => void;
  /** Get recommended style for a question type */
  getRecommendedStyle: (questionType: string) => DialogStyle;
}

// ========== Constants ==========

export const DEFAULT_A2UI_PREFERENCES: A2UIPreferences = {
  dialogStyle: 'modal',
  smartModeEnabled: true,
  autoSelectionDuration: 30,
  autoSelectionSoundEnabled: false,
  pauseOnInteraction: true,
  showA2UIButtonInToolbar: true,
  drawerSide: 'right',
  drawerSize: 'md',
};

/** Style recommendations based on question type */
const STYLE_RECOMMENDATIONS: Record<string, DialogStyle> = {
  confirm: 'modal',
  select: 'modal',
  'multi-select': 'modal',
  input: 'modal',
  'multi-question': 'drawer',
  form: 'drawer',
  wizard: 'fullscreen',
  complex: 'drawer',
};

// ========== Context ==========

const DialogStyleContext = createContext<DialogStyleContextValue | null>(null);

// ========== Provider ==========

interface DialogStyleProviderProps {
  children: React.ReactNode;
}

export function DialogStyleProvider({ children }: DialogStyleProviderProps) {
  // Get preferences from config store
  const a2uiPreferences = useConfigStore((state) => state.a2uiPreferences);
  const setA2uiPreferences = useConfigStore((state) => state.setA2uiPreferences);

  // Ensure we have default values
  const preferences: A2UIPreferences = useMemo(
    () => ({
      ...DEFAULT_A2UI_PREFERENCES,
      ...a2uiPreferences,
    }),
    [a2uiPreferences]
  );

  // Update a single preference
  const updatePreference = useCallback(
    <K extends keyof A2UIPreferences>(key: K, value: A2UIPreferences[K]) => {
      setA2uiPreferences({
        ...preferences,
        [key]: value,
      });
    },
    [preferences, setA2uiPreferences]
  );

  // Reset to defaults
  const resetPreferences = useCallback(() => {
    setA2uiPreferences(DEFAULT_A2UI_PREFERENCES);
  }, [setA2uiPreferences]);

  // Get recommended style based on question type
  const getRecommendedStyle = useCallback(
    (questionType: string): DialogStyle => {
      if (!preferences.smartModeEnabled) {
        return preferences.dialogStyle;
      }
      return STYLE_RECOMMENDATIONS[questionType] || preferences.dialogStyle;
    },
    [preferences]
  );

  const value = useMemo(
    () => ({
      preferences,
      updatePreference,
      resetPreferences,
      getRecommendedStyle,
    }),
    [preferences, updatePreference, resetPreferences, getRecommendedStyle]
  );

  return (
    <DialogStyleContext.Provider value={value}>
      {children}
    </DialogStyleContext.Provider>
  );
}

// ========== Hook ==========

export function useDialogStyleContext(): DialogStyleContextValue {
  const context = useContext(DialogStyleContext);
  if (!context) {
    throw new Error('useDialogStyleContext must be used within a DialogStyleProvider');
  }
  return context;
}

// Convenience hook for just getting the current style
export function useDialogStyle(): {
  style: DialogStyle;
  preferences: A2UIPreferences;
  getRecommendedStyle: (questionType: string) => DialogStyle;
} {
  const { preferences, getRecommendedStyle } = useDialogStyleContext();
  return {
    style: preferences.dialogStyle,
    preferences,
    getRecommendedStyle,
  };
}

// ========== Exports ==========

export { DialogStyleContext };
