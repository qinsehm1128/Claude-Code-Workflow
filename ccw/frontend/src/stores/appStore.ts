// ========================================
// App Store
// ========================================
// Manages UI state: theme, sidebar, view, loading, error

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type { AppStore, Theme, ColorScheme, GradientLevel, Locale, ViewMode, SessionFilter, LiteTaskType, DashboardLayouts, WidgetConfig, MotionPreference, StyleTier, ThemeSlot, ThemeSlotId, BackgroundConfig, BackgroundEffects, BackgroundMode, UnsplashAttribution } from '../types/store';
import { DEFAULT_DASHBOARD_LAYOUT } from '../components/dashboard/defaultLayouts';
import { getInitialLocale, updateIntl } from '../lib/i18n';
import { getThemeId, DEFAULT_SLOT, THEME_SLOT_LIMIT, DEFAULT_BACKGROUND_CONFIG } from '../lib/theme';
import { generateThemeFromHue, applyStyleTier } from '../lib/colorGenerator';
import { resolveMotionPreference, checkThemeContrast } from '../lib/accessibility';

// Helper to resolve system theme
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Helper to resolve theme based on preference
const resolveTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
};

/** Get the style tier from the active slot */
const getActiveStyleTier = (themeSlots: ThemeSlot[], activeSlotId: ThemeSlotId): StyleTier => {
  const slot = themeSlots.find(s => s.id === activeSlotId);
  return slot?.styleTier ?? 'standard';
};

/**
 * DOM Theme Application Helper
 *
 * ARCHITECTURAL NOTE: This function contains DOM manipulation logic that ideally
 * belongs in a React component/hook rather than a store. However, it's placed
 * here for pragmatic reasons:
 * - Immediate theme application without React render cycle
 * - SSR compatibility (checks for document/window)
 * - Backward compatibility with existing codebase
 *
 * FUTURE IMPROVEMENT: Move theme application to a ThemeProvider component using
 * useEffect to listen for store changes. This would properly separate concerns.
 */
const applyThemeToDocument = (
  resolvedTheme: 'light' | 'dark',
  colorScheme: ColorScheme,
  customHue: number | null,
  gradientLevel: GradientLevel = 'standard',
  enableHoverGlow: boolean = true,
  enableBackgroundAnimation: boolean = false,
  motionPreference: MotionPreference = 'system',
  styleTier: StyleTier = 'standard'
): void => {
  if (typeof document === 'undefined') return;

  // Define the actual DOM update logic
  const performThemeUpdate = () => {
    // Update document classes
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolvedTheme);

    // Clear custom CSS variables list (includes both new and legacy variables)
    const customVars = [
      // New theme system variables
      '--bg', '--bg-secondary', '--surface', '--surface-hover',
      '--border', '--border-hover', '--text', '--text-secondary',
      '--text-tertiary', '--text-disabled', '--accent', '--accent-hover',
      '--accent-active', '--accent-light', '--accent-lighter', '--primary',
      '--primary-hover', '--primary-light', '--primary-lighter', '--secondary',
      '--secondary-hover', '--secondary-light', '--muted', '--muted-hover',
      '--muted-text', '--success', '--success-light', '--success-text',
      '--warning', '--warning-light', '--warning-text', '--error',
      '--error-light', '--error-text', '--info', '--info-light',
      '--info-text', '--destructive', '--destructive-hover', '--destructive-light',
      '--hover', '--active', '--focus',
      // Legacy shadcn/ui compatibility variables
      '--background', '--foreground', '--card', '--card-foreground',
      '--primary-foreground', '--secondary-foreground', '--accent-foreground',
      '--destructive-foreground', '--muted-foreground', '--sidebar-background',
      '--sidebar-foreground', '--input', '--ring', '--indigo', '--indigo-light',
      '--orange', '--orange-light'
    ];

    // Apply custom theme or preset theme
    if (customHue !== null) {
      let cssVars = generateThemeFromHue(customHue, resolvedTheme);
      // Apply style tier post-processing
      if (styleTier !== 'standard') {
        cssVars = applyStyleTier(cssVars, styleTier, resolvedTheme);
      }
      Object.entries(cssVars).forEach(([varName, varValue]) => {
        document.documentElement.style.setProperty(varName, varValue);
      });
      document.documentElement.setAttribute('data-theme', `custom-${resolvedTheme}`);

      // Contrast validation for non-standard tiers
      if (styleTier !== 'standard') {
        const contrastResults = checkThemeContrast(cssVars);
        const failures = contrastResults.filter(r => !r.passed);
        if (failures.length > 0) {
          console.warn(
            '[Theme] Style tier "%s" caused %d WCAG AA contrast failures:',
            styleTier,
            failures.length,
            failures.map(f => `${f.fgVar}/${f.bgVar}: ${f.ratio}:1 (min ${f.required}:1)`)
          );
        }
      }
    } else {
      // Clear custom CSS variables
      customVars.forEach(varName => {
        document.documentElement.style.removeProperty(varName);
      });
      // Apply preset theme
      const themeId = getThemeId(colorScheme, resolvedTheme);
      document.documentElement.setAttribute('data-theme', themeId);

      // Apply style tier to preset theme (if not standard)
      if (styleTier !== 'standard') {
        const computed = getComputedStyle(document.documentElement);
        const presetVars: Record<string, string> = {};
        for (const varName of customVars) {
          const value = computed.getPropertyValue(varName).trim();
          if (value) {
            presetVars[varName] = value;
          }
        }
        const tieredVars = applyStyleTier(presetVars, styleTier, resolvedTheme);
        Object.entries(tieredVars).forEach(([varName, varValue]) => {
          document.documentElement.style.setProperty(varName, varValue);
        });

        // Contrast validation for preset themes with non-standard tiers
        const contrastResults = checkThemeContrast(tieredVars);
        const failures = contrastResults.filter(r => !r.passed);
        if (failures.length > 0) {
          console.warn(
            '[Theme] Style tier "%s" on preset "%s" caused %d WCAG AA contrast failures:',
            styleTier,
            colorScheme,
            failures.length,
            failures.map(f => `${f.fgVar}/${f.bgVar}: ${f.ratio}:1 (min ${f.required}:1)`)
          );
        }
      }
    }

    // Set color scheme attribute
    document.documentElement.setAttribute('data-color-scheme', colorScheme);

    // Apply gradient settings
    document.documentElement.setAttribute('data-gradient', gradientLevel);
    document.documentElement.setAttribute('data-hover-glow', String(enableHoverGlow));
    document.documentElement.setAttribute('data-bg-animation', String(enableBackgroundAnimation));

    // Apply reduced motion preference
    const reducedMotion = resolveMotionPreference(motionPreference);
    document.documentElement.setAttribute('data-reduced-motion', String(reducedMotion));

    // Set style tier data attribute
    document.documentElement.setAttribute('data-style-tier', styleTier);
  };

  // Use View Transition API for smooth transitions (progressive enhancement)
  // Skip view transition when reduced motion is active
  const reducedMotion = resolveMotionPreference(motionPreference);
  if (!reducedMotion && typeof document !== 'undefined' && 'startViewTransition' in document) {
    (document as unknown as { startViewTransition: (callback: () => void) => void }).startViewTransition(performThemeUpdate);
  } else {
    // Fallback: apply immediately without transition
    performThemeUpdate();
  }
};

/**
 * Apply background configuration to document data attributes.
 * Sets data-bg-* attributes on <html> that CSS rules respond to.
 */
const applyBackgroundToDocument = (config: BackgroundConfig): void => {
  if (typeof document === 'undefined') return;

  const el = document.documentElement;
  el.setAttribute('data-bg-mode', config.mode);
  el.setAttribute('data-bg-blur', String(config.effects.blur));
  el.setAttribute('data-bg-darken', String(config.effects.darkenOpacity));
  el.setAttribute('data-bg-saturation', String(config.effects.saturation));
  el.setAttribute('data-bg-frosted', String(config.effects.enableFrostedGlass));
  el.setAttribute('data-bg-grain', String(config.effects.enableGrain));
  el.setAttribute('data-bg-vignette', String(config.effects.enableVignette));
};

// Initial state
const initialState = {
  // Theme
  theme: 'system' as Theme,
  resolvedTheme: 'light' as 'light' | 'dark',
  colorScheme: 'blue' as ColorScheme, // New: default to blue scheme
  customHue: null as number | null,
  isCustomTheme: false,

  // Gradient settings
  gradientLevel: 'standard' as GradientLevel,
  enableHoverGlow: true,
  enableBackgroundAnimation: false,

  // Motion preference
  motionPreference: 'system' as MotionPreference,

  // Locale
  locale: getInitialLocale() as Locale,

  // Sidebar
  sidebarOpen: true,
  sidebarCollapsed: false,
  expandedNavGroups: ['overview', 'workflow', 'knowledge', 'issues', 'tools', 'configuration'] as string[],

  // View state
  currentView: 'sessions' as ViewMode,
  currentFilter: 'all' as SessionFilter,
  currentLiteType: null as LiteTaskType,
  currentSessionDetailKey: null as string | null,

  // Loading and error states
  isLoading: false,
  loadingMessage: null as string | null,
  error: null as string | null,

  // Dashboard layout
  dashboardLayout: null,

  // Theme slots
  themeSlots: [DEFAULT_SLOT] as ThemeSlot[],
  activeSlotId: 'default' as ThemeSlotId,
  deletedSlotBuffer: null as ThemeSlot | null,

  // Immersive fullscreen mode (hides app shell chrome)
  isImmersiveMode: false,
};

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ========== Theme Actions ==========

        setTheme: (theme: Theme) => {
          const resolved = resolveTheme(theme);
          set({ theme, resolvedTheme: resolved }, false, 'setTheme');

          // Apply theme using helper (encapsulates DOM manipulation)
          const state = get();
          const styleTier = getActiveStyleTier(state.themeSlots, state.activeSlotId);
          applyThemeToDocument(resolved, state.colorScheme, state.customHue, state.gradientLevel, state.enableHoverGlow, state.enableBackgroundAnimation, state.motionPreference, styleTier);
        },

        setColorScheme: (colorScheme: ColorScheme) => {
          set((state) => ({
            colorScheme,
            customHue: null,
            isCustomTheme: false,
            themeSlots: state.themeSlots.map(slot =>
              slot.id === state.activeSlotId
                ? { ...slot, colorScheme, customHue: null, isCustomTheme: false }
                : slot
            ),
          }), false, 'setColorScheme');

          // Apply color scheme using helper (encapsulates DOM manipulation)
          const state = get();
          const styleTier = getActiveStyleTier(state.themeSlots, state.activeSlotId);
          applyThemeToDocument(state.resolvedTheme, colorScheme, null, state.gradientLevel, state.enableHoverGlow, state.enableBackgroundAnimation, state.motionPreference, styleTier);
        },

        setCustomHue: (hue: number | null) => {
          if (hue === null) {
            // Reset to preset theme
            const state = get();
            const styleTier = getActiveStyleTier(state.themeSlots, state.activeSlotId);
            set((s) => ({
              customHue: null,
              isCustomTheme: false,
              themeSlots: s.themeSlots.map(slot =>
                slot.id === s.activeSlotId
                  ? { ...slot, customHue: null, isCustomTheme: false }
                  : slot
              ),
            }), false, 'setCustomHue');
            applyThemeToDocument(state.resolvedTheme, state.colorScheme, null, state.gradientLevel, state.enableHoverGlow, state.enableBackgroundAnimation, state.motionPreference, styleTier);
            return;
          }

          // Apply custom hue
          set((state) => ({
            customHue: hue,
            isCustomTheme: true,
            themeSlots: state.themeSlots.map(slot =>
              slot.id === state.activeSlotId
                ? { ...slot, customHue: hue, isCustomTheme: true }
                : slot
            ),
          }), false, 'setCustomHue');
          const state = get();
          const styleTier = getActiveStyleTier(state.themeSlots, state.activeSlotId);
          applyThemeToDocument(state.resolvedTheme, state.colorScheme, hue, state.gradientLevel, state.enableHoverGlow, state.enableBackgroundAnimation, state.motionPreference, styleTier);
        },

        toggleTheme: () => {
          const { theme } = get();
          const newTheme: Theme = theme === 'dark' ? 'light' : theme === 'light' ? 'dark' : 'dark';
          get().setTheme(newTheme);
        },

        // ========== Gradient Settings Actions ==========

        setGradientLevel: (level: GradientLevel) => {
          set((state) => ({
            gradientLevel: level,
            themeSlots: state.themeSlots.map(slot =>
              slot.id === state.activeSlotId
                ? { ...slot, gradientLevel: level }
                : slot
            ),
          }), false, 'setGradientLevel');
          const state = get();
          const styleTier = getActiveStyleTier(state.themeSlots, state.activeSlotId);
          applyThemeToDocument(state.resolvedTheme, state.colorScheme, state.customHue, level, state.enableHoverGlow, state.enableBackgroundAnimation, state.motionPreference, styleTier);
        },

        setEnableHoverGlow: (enabled: boolean) => {
          set((state) => ({
            enableHoverGlow: enabled,
            themeSlots: state.themeSlots.map(slot =>
              slot.id === state.activeSlotId
                ? { ...slot, enableHoverGlow: enabled }
                : slot
            ),
          }), false, 'setEnableHoverGlow');
          const state = get();
          const styleTier = getActiveStyleTier(state.themeSlots, state.activeSlotId);
          applyThemeToDocument(state.resolvedTheme, state.colorScheme, state.customHue, state.gradientLevel, enabled, state.enableBackgroundAnimation, state.motionPreference, styleTier);
        },

        setEnableBackgroundAnimation: (enabled: boolean) => {
          set((state) => ({
            enableBackgroundAnimation: enabled,
            themeSlots: state.themeSlots.map(slot =>
              slot.id === state.activeSlotId
                ? { ...slot, enableBackgroundAnimation: enabled }
                : slot
            ),
          }), false, 'setEnableBackgroundAnimation');
          const state = get();
          const styleTier = getActiveStyleTier(state.themeSlots, state.activeSlotId);
          applyThemeToDocument(state.resolvedTheme, state.colorScheme, state.customHue, state.gradientLevel, state.enableHoverGlow, enabled, state.motionPreference, styleTier);
        },

        setMotionPreference: (pref: MotionPreference) => {
          set({ motionPreference: pref }, false, 'setMotionPreference');
          const state = get();
          const styleTier = getActiveStyleTier(state.themeSlots, state.activeSlotId);
          applyThemeToDocument(state.resolvedTheme, state.colorScheme, state.customHue, state.gradientLevel, state.enableHoverGlow, state.enableBackgroundAnimation, pref, styleTier);
        },

        setStyleTier: (tier: StyleTier) => {
          set((state) => ({
            themeSlots: state.themeSlots.map(slot =>
              slot.id === state.activeSlotId
                ? { ...slot, styleTier: tier }
                : slot
            ),
          }), false, 'setStyleTier');
          const state = get();
          applyThemeToDocument(state.resolvedTheme, state.colorScheme, state.customHue, state.gradientLevel, state.enableHoverGlow, state.enableBackgroundAnimation, state.motionPreference, tier);
        },

        // ========== Locale Actions ==========

        setLocale: (locale: Locale) => {
          set({ locale }, false, 'setLocale');
          updateIntl(locale);
        },

        // ========== Sidebar Actions ==========

        setSidebarOpen: (open: boolean) => {
          set({ sidebarOpen: open }, false, 'setSidebarOpen');
        },

        toggleSidebar: () => {
          set((state) => ({ sidebarOpen: !state.sidebarOpen }), false, 'toggleSidebar');
        },

        setSidebarCollapsed: (collapsed: boolean) => {
          set({ sidebarCollapsed: collapsed }, false, 'setSidebarCollapsed');
        },

        setExpandedNavGroups: (groups: string[]) => {
          set({ expandedNavGroups: groups }, false, 'setExpandedNavGroups');
        },

        // ========== View Actions ==========

        setCurrentView: (view: ViewMode) => {
          set({ currentView: view }, false, 'setCurrentView');
        },

        setCurrentFilter: (filter: SessionFilter) => {
          set({ currentFilter: filter }, false, 'setCurrentFilter');
        },

        setCurrentLiteType: (type: LiteTaskType) => {
          set({ currentLiteType: type }, false, 'setCurrentLiteType');
        },

        setCurrentSessionDetailKey: (key: string | null) => {
          set({ currentSessionDetailKey: key }, false, 'setCurrentSessionDetailKey');
        },

        // ========== Loading/Error Actions ==========

        setLoading: (loading: boolean, message: string | null = null) => {
          set({ isLoading: loading, loadingMessage: message }, false, 'setLoading');
        },

        setError: (error: string | null) => {
          set({ error }, false, 'setError');
        },

        clearError: () => {
          set({ error: null }, false, 'clearError');
        },

        // ========== Dashboard Layout Actions ==========

        setDashboardLayouts: (layouts: DashboardLayouts) => {
          set(
            (state) => ({
              dashboardLayout: {
                widgets: state.dashboardLayout?.widgets || DEFAULT_DASHBOARD_LAYOUT.widgets,
                layouts,
              },
            }),
            false,
            'setDashboardLayouts'
          );
        },

        setDashboardWidgets: (widgets: WidgetConfig[]) => {
          set(
            (state) => ({
              dashboardLayout: {
                widgets,
                layouts: state.dashboardLayout?.layouts || DEFAULT_DASHBOARD_LAYOUT.layouts,
              },
            }),
            false,
            'setDashboardWidgets'
          );
        },

        resetDashboardLayout: () => {
          set({ dashboardLayout: DEFAULT_DASHBOARD_LAYOUT }, false, 'resetDashboardLayout');
        },

        // ========== Theme Slot Actions ==========

        setActiveSlot: (slotId: ThemeSlotId) => {
          const { themeSlots, motionPreference } = get();
          const slot = themeSlots.find(s => s.id === slotId);
          if (!slot) return;

          const resolved = resolveTheme(get().theme);
          set({
            activeSlotId: slotId,
            colorScheme: slot.colorScheme,
            customHue: slot.customHue,
            isCustomTheme: slot.isCustomTheme,
            gradientLevel: slot.gradientLevel,
            enableHoverGlow: slot.enableHoverGlow,
            enableBackgroundAnimation: slot.enableBackgroundAnimation,
          }, false, 'setActiveSlot');

          applyThemeToDocument(
            resolved,
            slot.colorScheme,
            slot.customHue,
            slot.gradientLevel,
            slot.enableHoverGlow,
            slot.enableBackgroundAnimation,
            motionPreference,
            slot.styleTier
          );
          applyBackgroundToDocument(slot.backgroundConfig ?? DEFAULT_BACKGROUND_CONFIG);
        },

        copySlot: () => {
          const state = get();
          if (state.themeSlots.length >= THEME_SLOT_LIMIT) return;

          // Determine next available slot id
          const usedIds = new Set(state.themeSlots.map(s => s.id));
          const candidateIds: ThemeSlotId[] = ['custom-1', 'custom-2'];
          const nextId = candidateIds.find(id => !usedIds.has(id));
          if (!nextId) return;

          const activeSlot = state.themeSlots.find(s => s.id === state.activeSlotId);
          if (!activeSlot) return;

          const newSlot: ThemeSlot = {
            id: nextId,
            name: `Copy of ${activeSlot.name}`,
            colorScheme: state.colorScheme,
            customHue: state.customHue,
            isCustomTheme: state.isCustomTheme,
            gradientLevel: state.gradientLevel,
            enableHoverGlow: state.enableHoverGlow,
            enableBackgroundAnimation: state.enableBackgroundAnimation,
            styleTier: activeSlot.styleTier,
            isDefault: false,
            backgroundConfig: activeSlot.backgroundConfig,
          };

          set({
            themeSlots: [...state.themeSlots, newSlot],
            activeSlotId: nextId,
          }, false, 'copySlot');
        },

        renameSlot: (slotId: ThemeSlotId, name: string) => {
          set((state) => ({
            themeSlots: state.themeSlots.map(slot =>
              slot.id === slotId ? { ...slot, name } : slot
            ),
          }), false, 'renameSlot');
        },

        deleteSlot: (slotId: ThemeSlotId) => {
          const state = get();
          const slot = state.themeSlots.find(s => s.id === slotId);
          if (!slot || slot.isDefault) return;

          set({
            themeSlots: state.themeSlots.filter(s => s.id !== slotId),
            deletedSlotBuffer: slot,
            activeSlotId: 'default',
          }, false, 'deleteSlot');

          // Load default slot values into active state
          const defaultSlot = state.themeSlots.find(s => s.id === 'default');
          if (defaultSlot) {
            const resolved = resolveTheme(state.theme);
            set({
              colorScheme: defaultSlot.colorScheme,
              customHue: defaultSlot.customHue,
              isCustomTheme: defaultSlot.isCustomTheme,
              gradientLevel: defaultSlot.gradientLevel,
              enableHoverGlow: defaultSlot.enableHoverGlow,
              enableBackgroundAnimation: defaultSlot.enableBackgroundAnimation,
            }, false, 'deleteSlot/applyDefault');

            applyThemeToDocument(
              resolved,
              defaultSlot.colorScheme,
              defaultSlot.customHue,
              defaultSlot.gradientLevel,
              defaultSlot.enableHoverGlow,
              defaultSlot.enableBackgroundAnimation,
              state.motionPreference,
              defaultSlot.styleTier
            );
            applyBackgroundToDocument(defaultSlot.backgroundConfig ?? DEFAULT_BACKGROUND_CONFIG);
          }

          // Clear buffer after 10 seconds
          setTimeout(() => {
            const current = useAppStore.getState();
            if (current.deletedSlotBuffer?.id === slotId) {
              useAppStore.setState({ deletedSlotBuffer: null }, false);
            }
          }, 10000);
        },

        undoDeleteSlot: () => {
          const state = get();
          const restored = state.deletedSlotBuffer;
          if (!restored) return;
          if (state.themeSlots.length >= THEME_SLOT_LIMIT) return;

          set({
            themeSlots: [...state.themeSlots, restored],
            deletedSlotBuffer: null,
            activeSlotId: restored.id,
          }, false, 'undoDeleteSlot');

          // Apply restored slot values
          const resolved = resolveTheme(state.theme);
          set({
            colorScheme: restored.colorScheme,
            customHue: restored.customHue,
            isCustomTheme: restored.isCustomTheme,
            gradientLevel: restored.gradientLevel,
            enableHoverGlow: restored.enableHoverGlow,
            enableBackgroundAnimation: restored.enableBackgroundAnimation,
          }, false, 'undoDeleteSlot/apply');

          applyThemeToDocument(
            resolved,
            restored.colorScheme,
            restored.customHue,
            restored.gradientLevel,
            restored.enableHoverGlow,
            restored.enableBackgroundAnimation,
            state.motionPreference,
            restored.styleTier
          );
          applyBackgroundToDocument(restored.backgroundConfig ?? DEFAULT_BACKGROUND_CONFIG);
        },

        // ========== Background Actions ==========

        setBackgroundConfig: (config: BackgroundConfig) => {
          set((state) => ({
            themeSlots: state.themeSlots.map(slot =>
              slot.id === state.activeSlotId
                ? { ...slot, backgroundConfig: config }
                : slot
            ),
          }), false, 'setBackgroundConfig');
          applyBackgroundToDocument(config);
        },

        updateBackgroundEffect: <K extends keyof BackgroundEffects>(key: K, value: BackgroundEffects[K]) => {
          const state = get();
          const activeSlot = state.themeSlots.find(s => s.id === state.activeSlotId);
          const current = activeSlot?.backgroundConfig ?? DEFAULT_BACKGROUND_CONFIG;
          const updated: BackgroundConfig = {
            ...current,
            effects: { ...current.effects, [key]: value },
          };
          get().setBackgroundConfig(updated);
        },

        setBackgroundMode: (mode: BackgroundMode) => {
          const state = get();
          const activeSlot = state.themeSlots.find(s => s.id === state.activeSlotId);
          const current = activeSlot?.backgroundConfig ?? DEFAULT_BACKGROUND_CONFIG;
          const updated: BackgroundConfig = { ...current, mode };
          get().setBackgroundConfig(updated);
        },

        setBackgroundImage: (url: string | null, attribution: UnsplashAttribution | null) => {
          const state = get();
          const activeSlot = state.themeSlots.find(s => s.id === state.activeSlotId);
          const current = activeSlot?.backgroundConfig ?? DEFAULT_BACKGROUND_CONFIG;
          const updated: BackgroundConfig = {
            ...current,
            imageUrl: url,
            attribution,
          };
          // Auto-switch mode if currently gradient-only and setting an image
          if (url && current.mode === 'gradient-only') {
            updated.mode = 'image-gradient';
          }
          // Auto-switch to gradient-only if removing image
          if (!url && current.mode !== 'gradient-only') {
            updated.mode = 'gradient-only';
          }
          get().setBackgroundConfig(updated);
        },

        // ========== Immersive Mode Actions ==========

        setImmersiveMode: (enabled: boolean) => {
          set({ isImmersiveMode: enabled }, false, 'setImmersiveMode');
        },

        toggleImmersiveMode: () => {
          set((state) => ({ isImmersiveMode: !state.isImmersiveMode }), false, 'toggleImmersiveMode');
        },
      }),
      {
        name: 'ccw-app-store',
        // Only persist theme, locale, and slot preferences
        partialize: (state) => ({
          theme: state.theme,
          colorScheme: state.colorScheme,
          customHue: state.customHue,
          gradientLevel: state.gradientLevel,
          enableHoverGlow: state.enableHoverGlow,
          enableBackgroundAnimation: state.enableBackgroundAnimation,
          motionPreference: state.motionPreference,
          locale: state.locale,
          sidebarCollapsed: state.sidebarCollapsed,
          expandedNavGroups: state.expandedNavGroups,
          dashboardLayout: state.dashboardLayout,
          themeSlots: state.themeSlots,
          activeSlotId: state.activeSlotId,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Migrate legacy schema: if no themeSlots, construct from flat fields
            if (!state.themeSlots || !Array.isArray(state.themeSlots) || state.themeSlots.length === 0) {
              const migratedSlot: ThemeSlot = {
                id: 'default',
                name: 'Default',
                colorScheme: state.colorScheme ?? 'blue',
                customHue: state.customHue ?? null,
                isCustomTheme: (state.customHue ?? null) !== null,
                gradientLevel: state.gradientLevel ?? 'standard',
                enableHoverGlow: state.enableHoverGlow ?? true,
                enableBackgroundAnimation: state.enableBackgroundAnimation ?? false,
                styleTier: 'standard',
                isDefault: true,
              };
              state.themeSlots = [migratedSlot];
              state.activeSlotId = 'default';
            }

            // Ensure activeSlotId is valid
            if (!state.activeSlotId || !state.themeSlots.find(s => s.id === state.activeSlotId)) {
              state.activeSlotId = 'default';
            }

            // Apply theme on rehydration
            const resolved = resolveTheme(state.theme);
            state.resolvedTheme = resolved;
            state.isCustomTheme = state.customHue !== null;
            // Apply theme using helper (encapsulates DOM manipulation)
            const rehydratedStyleTier = getActiveStyleTier(state.themeSlots, state.activeSlotId);
            applyThemeToDocument(
              resolved,
              state.colorScheme,
              state.customHue,
              state.gradientLevel ?? 'standard',
              state.enableHoverGlow ?? true,
              state.enableBackgroundAnimation ?? false,
              state.motionPreference ?? 'system',
              rehydratedStyleTier
            );

            // Apply background config on rehydration
            const activeSlot = state.themeSlots.find(s => s.id === state.activeSlotId);
            applyBackgroundToDocument(activeSlot?.backgroundConfig ?? DEFAULT_BACKGROUND_CONFIG);
          }
          // Apply locale on rehydration
          if (state) {
            updateIntl(state.locale);
          }
        },
      }
    ),
    { name: 'AppStore' }
  )
);

// Setup system theme listener
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const state = useAppStore.getState();
    if (state.theme === 'system') {
      const resolved = getSystemTheme();
      useAppStore.setState({ resolvedTheme: resolved });
      // Apply theme using helper (encapsulates DOM manipulation)
      const styleTier = getActiveStyleTier(state.themeSlots, state.activeSlotId);
      applyThemeToDocument(
        resolved,
        state.colorScheme,
        state.customHue,
        state.gradientLevel,
        state.enableHoverGlow,
        state.enableBackgroundAnimation,
        state.motionPreference,
        styleTier
      );
    }
  });

  // Apply initial theme immediately (before localStorage rehydration)
  // This ensures gradient attributes are set from the start
  const state = useAppStore.getState();
  const initialStyleTier = getActiveStyleTier(state.themeSlots, state.activeSlotId);
  applyThemeToDocument(
    state.resolvedTheme,
    state.colorScheme,
    state.customHue,
    state.gradientLevel,
    state.enableHoverGlow,
    state.enableBackgroundAnimation,
    state.motionPreference,
    initialStyleTier
  );

  // Apply initial background config
  const initialActiveSlot = state.themeSlots.find(s => s.id === state.activeSlotId);
  applyBackgroundToDocument(initialActiveSlot?.backgroundConfig ?? DEFAULT_BACKGROUND_CONFIG);
}

// Selectors for common access patterns
export const selectTheme = (state: AppStore) => state.theme;
export const selectResolvedTheme = (state: AppStore) => state.resolvedTheme;
export const selectColorScheme = (state: AppStore) => state.colorScheme;
export const selectCustomHue = (state: AppStore) => state.customHue;
export const selectIsCustomTheme = (state: AppStore) => state.isCustomTheme;
export const selectGradientLevel = (state: AppStore) => state.gradientLevel;
export const selectEnableHoverGlow = (state: AppStore) => state.enableHoverGlow;
export const selectEnableBackgroundAnimation = (state: AppStore) => state.enableBackgroundAnimation;
export const selectMotionPreference = (state: AppStore) => state.motionPreference;
export const selectLocale = (state: AppStore) => state.locale;
export const selectSidebarOpen = (state: AppStore) => state.sidebarOpen;
export const selectCurrentView = (state: AppStore) => state.currentView;
export const selectIsLoading = (state: AppStore) => state.isLoading;
export const selectError = (state: AppStore) => state.error;
export const selectThemeSlots = (state: AppStore) => state.themeSlots;
export const selectActiveSlotId = (state: AppStore) => state.activeSlotId;
export const selectDeletedSlotBuffer = (state: AppStore) => state.deletedSlotBuffer;
export const selectIsImmersiveMode = (state: AppStore) => state.isImmersiveMode;
