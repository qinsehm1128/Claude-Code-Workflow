import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { useTheme } from '@/hooks/useTheme';
import { useNotifications } from '@/hooks/useNotifications';
import { COLOR_SCHEMES, THEME_MODES, getThemeName, THEME_SLOT_LIMIT, DEFAULT_BACKGROUND_CONFIG } from '@/lib/theme';
import type { ColorScheme, ThemeMode } from '@/lib/theme';
import type { ThemeSlotId, StyleTier } from '@/types/store';
import { generateThemeFromHue, applyStyleTier } from '@/lib/colorGenerator';
import { checkThemeContrast, generateContrastFix } from '@/lib/accessibility';
import type { ContrastResult, FixSuggestion } from '@/lib/accessibility';
import type { ThemeSharePayload } from '@/lib/themeShare';
import { BackgroundImagePicker } from './BackgroundImagePicker';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/AlertDialog';

/**
 * Theme Selector Component
 * Allows users to select from 4 color schemes (blue/green/orange/purple)
 * and 2 theme modes (light/dark), plus custom hue customization
 *
 * Features:
 * - 8 preset theme combinations + custom hue support
 * - Keyboard navigation support (Arrow keys)
 * - ARIA labels for accessibility
 * - Visual feedback for selected theme
 * - System dark mode detection
 * - Custom hue slider (0-360) with real-time preview
 */
export function ThemeSelector() {
  const { formatMessage } = useIntl();
  const {
    colorScheme,
    resolvedTheme,
    customHue,
    isCustomTheme,
    gradientLevel,
    enableHoverGlow,
    enableBackgroundAnimation,
    motionPreference,
    setColorScheme,
    setTheme,
    setCustomHue,
    setGradientLevel,
    setEnableHoverGlow,
    setEnableBackgroundAnimation,
    setMotionPreference,
    styleTier,
    setStyleTier,
    themeSlots,
    activeSlotId,
    canAddSlot,
    setActiveSlot,
    copySlot,
    renameSlot,
    deleteSlot,
    undoDeleteSlot,
    exportThemeCode,
    importThemeCode,
    setBackgroundConfig,
  } = useTheme();
  const { addToast, removeToast } = useNotifications();

  // Local state for preview hue (uncommitted changes)
  const [previewHue, setPreviewHue] = useState<number | null>(customHue);

  // Contrast warning state (non-blocking)
  const [contrastWarnings, setContrastWarnings] = useState<ContrastResult[]>([]);
  const [contrastFixes, setContrastFixes] = useState<Record<string, FixSuggestion[]>>({});
  const [showContrastWarning, setShowContrastWarning] = useState(false);

  // Slot management state
  const [renamingSlotId, setRenamingSlotId] = useState<ThemeSlotId | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingDeleteSlot, setPendingDeleteSlot] = useState<ThemeSlotId | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const undoToastIdRef = useRef<string | null>(null);

  // Share/import state (local to component, not in store)
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importPreview, setImportPreview] = useState<ThemeSharePayload | null>(null);
  const [importWarning, setImportWarning] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Sync preview with customHue from store
  useEffect(() => {
    setPreviewHue(customHue);
  }, [customHue]);

  // Resolved mode is either 'light' or 'dark'
  const mode: ThemeMode = resolvedTheme;

  // Get preview colors for the custom theme swatches
  const getPreviewColor = (variable: string) => {
    const hue = previewHue ?? 180; // Default to cyan if null
    const colors = generateThemeFromHue(hue, mode);
    const hslValue = colors[variable];
    return hslValue ? `hsl(${hslValue})` : '#888';
  };

  // Style tier definitions for the selector UI
  const STYLE_TIERS: Array<{ id: StyleTier; nameKey: string; descKey: string }> = [
    { id: 'soft', nameKey: 'theme.styleTier.soft', descKey: 'theme.styleTier.softDesc' },
    { id: 'standard', nameKey: 'theme.styleTier.standard', descKey: 'theme.styleTier.standardDesc' },
    { id: 'high-contrast', nameKey: 'theme.styleTier.highContrast', descKey: 'theme.styleTier.highContrastDesc' },
  ];

  // Get tier preview swatch colors (bg, surface, accent for a sample tier)
  const getTierPreviewColors = (tier: StyleTier): { bg: string; surface: string; accent: string } => {
    const sampleHue = customHue ?? 220; // Use current hue or default blue
    const baseVars = generateThemeFromHue(sampleHue, mode);
    const tieredVars = tier === 'standard' ? baseVars : applyStyleTier(baseVars, tier, mode);
    return {
      bg: tieredVars['--bg'] ? `hsl(${tieredVars['--bg']})` : '#888',
      surface: tieredVars['--surface'] ? `hsl(${tieredVars['--surface']})` : '#888',
      accent: tieredVars['--accent'] ? `hsl(${tieredVars['--accent']})` : '#888',
    };
  };

  const handleSchemeSelect = (scheme: ColorScheme) => {
    // When selecting a preset scheme, reset custom hue
    if (isCustomTheme) {
      setCustomHue(null);
    }
    setColorScheme(scheme);
  };

  const handleCustomSelect = () => {
    // Set custom hue to a default value if null
    if (customHue === null) {
      setCustomHue(180); // Default cyan
    }
  };

  const handleHueSave = () => {
    if (previewHue !== null) {
      setCustomHue(previewHue);

      // Run contrast check on the new custom theme
      const mode: ThemeMode = resolvedTheme;
      const vars = generateThemeFromHue(previewHue, mode);
      const results = checkThemeContrast(vars);
      const failures = results.filter(r => !r.passed);

      if (failures.length > 0) {
        setContrastWarnings(failures);
        // Generate fixes for each failing pair
        const fixes: Record<string, FixSuggestion[]> = {};
        for (const failure of failures) {
          const key = `${failure.fgVar}|${failure.bgVar}`;
          fixes[key] = generateContrastFix(failure.fgVar, failure.bgVar, vars, failure.required);
        }
        setContrastFixes(fixes);
        setShowContrastWarning(true);
      } else {
        setContrastWarnings([]);
        setContrastFixes({});
        setShowContrastWarning(false);
      }
    }
  };

  const handleHueReset = () => {
    setCustomHue(null);
    setPreviewHue(null);
  };

  const handleModeSelect = (newMode: ThemeMode) => {
    setTheme(newMode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const currentIndex = COLOR_SCHEMES.findIndex(s => s.id === colorScheme);
      const nextIndex = (currentIndex + 1) % COLOR_SCHEMES.length;
      handleSchemeSelect(COLOR_SCHEMES[nextIndex].id);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIndex = COLOR_SCHEMES.findIndex(s => s.id === colorScheme);
      const nextIndex = (currentIndex - 1 + COLOR_SCHEMES.length) % COLOR_SCHEMES.length;
      handleSchemeSelect(COLOR_SCHEMES[nextIndex].id);
    }
  };

  // ========== Slot Management Handlers ==========

  const handleSlotSelect = useCallback((slotId: ThemeSlotId) => {
    if (slotId !== activeSlotId) {
      setActiveSlot(slotId);
    }
  }, [activeSlotId, setActiveSlot]);

  const handleCopySlot = useCallback(() => {
    if (!canAddSlot) return;
    copySlot();
  }, [canAddSlot, copySlot]);

  const handleStartRename = useCallback((slotId: ThemeSlotId, currentName: string) => {
    setRenamingSlotId(slotId);
    setRenameValue(currentName);
    // Focus input after render
    setTimeout(() => renameInputRef.current?.focus(), 0);
  }, []);

  const handleConfirmRename = useCallback(() => {
    if (renamingSlotId && renameValue.trim()) {
      renameSlot(renamingSlotId, renameValue.trim());
    }
    setRenamingSlotId(null);
    setRenameValue('');
  }, [renamingSlotId, renameValue, renameSlot]);

  const handleCancelRename = useCallback(() => {
    setRenamingSlotId(null);
    setRenameValue('');
  }, []);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelRename();
    }
  }, [handleConfirmRename, handleCancelRename]);

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDeleteSlot) return;

    deleteSlot(pendingDeleteSlot);
    setPendingDeleteSlot(null);

    // Remove previous undo toast if exists
    if (undoToastIdRef.current) {
      removeToast(undoToastIdRef.current);
    }

    // Show undo toast with 10-second duration
    const toastId = addToast('info',
      formatMessage({ id: 'theme.slot.undoDelete' }),
      undefined,
      {
        duration: 10000,
        dismissible: true,
        action: {
          label: formatMessage({ id: 'theme.slot.undo' }),
          onClick: () => {
            undoDeleteSlot();
            removeToast(toastId);
            undoToastIdRef.current = null;
          },
        },
      }
    );
    undoToastIdRef.current = toastId;
  }, [pendingDeleteSlot, deleteSlot, addToast, removeToast, undoDeleteSlot, formatMessage]);

  const handleCancelDelete = useCallback(() => {
    setPendingDeleteSlot(null);
  }, []);

  // ========== Share/Import Handlers ==========

  const handleCopyThemeCode = useCallback(async () => {
    try {
      const code = exportThemeCode();
      await navigator.clipboard.writeText(code);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // Clipboard API may not be available
      addToast('error', 'Failed to copy to clipboard');
    }
  }, [exportThemeCode, addToast]);

  const handleOpenImport = useCallback(() => {
    setShowImportPanel(true);
    setImportCode('');
    setImportPreview(null);
    setImportWarning(null);
    setImportError(null);
  }, []);

  const handleCloseImport = useCallback(() => {
    setShowImportPanel(false);
    setImportCode('');
    setImportPreview(null);
    setImportWarning(null);
    setImportError(null);
  }, []);

  const handleImportCodeChange = useCallback((value: string) => {
    setImportCode(value);
    setImportError(null);
    setImportWarning(null);
    setImportPreview(null);

    if (!value.trim()) return;

    const result = importThemeCode(value);
    if (result.ok) {
      setImportPreview(result.payload);
      if (result.warning) {
        setImportWarning(result.warning);
      }
    } else {
      setImportError(result.error);
    }
  }, [importThemeCode]);

  const handleApplyImport = useCallback(() => {
    if (!importPreview) return;

    // Check if we can add a slot or overwrite current
    if (!canAddSlot && activeSlotId === 'default') {
      // Apply to the default slot directly via individual setters
      if (importPreview.customHue !== null) {
        setCustomHue(importPreview.customHue);
      } else {
        setCustomHue(null);
        setColorScheme(importPreview.colorScheme);
      }
      setGradientLevel(importPreview.gradientLevel);
      setEnableHoverGlow(importPreview.enableHoverGlow);
      setEnableBackgroundAnimation(importPreview.enableBackgroundAnimation);
      setStyleTier(importPreview.styleTier);
    } else if (canAddSlot) {
      // Create a new slot via copySlot then apply settings
      copySlot();
      // After copySlot, the new slot is active. Apply imported settings.
      if (importPreview.customHue !== null) {
        setCustomHue(importPreview.customHue);
      } else {
        setCustomHue(null);
        setColorScheme(importPreview.colorScheme);
      }
      setGradientLevel(importPreview.gradientLevel);
      setEnableHoverGlow(importPreview.enableHoverGlow);
      setEnableBackgroundAnimation(importPreview.enableBackgroundAnimation);
      setStyleTier(importPreview.styleTier);
    } else {
      // Apply to current active slot via individual setters
      if (importPreview.customHue !== null) {
        setCustomHue(importPreview.customHue);
      } else {
        setCustomHue(null);
        setColorScheme(importPreview.colorScheme);
      }
      setGradientLevel(importPreview.gradientLevel);
      setEnableHoverGlow(importPreview.enableHoverGlow);
      setEnableBackgroundAnimation(importPreview.enableBackgroundAnimation);
      setStyleTier(importPreview.styleTier);
    }

    // Apply background config from import (v2+ feature)
    setBackgroundConfig(importPreview.backgroundConfig ?? DEFAULT_BACKGROUND_CONFIG);

    addToast('success', formatMessage({ id: 'theme.share.importSuccess' }));
    handleCloseImport();
  }, [
    importPreview, canAddSlot, activeSlotId, copySlot,
    setCustomHue, setColorScheme, setGradientLevel,
    setEnableHoverGlow, setEnableBackgroundAnimation, setStyleTier,
    setBackgroundConfig,
    addToast, formatMessage, handleCloseImport,
  ]);

  /** Generate preview swatch colors from an import payload */
  const getImportPreviewColors = useCallback((payload: ThemeSharePayload) => {
    const hue = payload.customHue ?? 220;
    const baseVars = generateThemeFromHue(hue, mode);
    const tieredVars = payload.styleTier === 'standard'
      ? baseVars
      : applyStyleTier(baseVars, payload.styleTier, mode);
    return {
      bg: tieredVars['--bg'] ? `hsl(${tieredVars['--bg']})` : '#888',
      surface: tieredVars['--surface'] ? `hsl(${tieredVars['--surface']})` : '#888',
      accent: tieredVars['--accent'] ? `hsl(${tieredVars['--accent']})` : '#888',
      text: tieredVars['--text'] ? `hsl(${tieredVars['--text']})` : '#888',
    };
  }, [mode]);

  /** Map error keys to i18n message IDs */
  const getShareErrorMessageId = (errorKey: string): string => {
    switch (errorKey) {
      case 'incompatible_version':
        return 'theme.share.incompatibleVersion';
      default:
        return 'theme.share.invalidCode';
    }
  };

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renamingSlotId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingSlotId]);

  return (
    <div className="space-y-6">
      {/* Theme Slot Switcher */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-text">
            {formatMessage({ id: 'theme.slot.title' })}
          </h3>
          <button
            onClick={handleCopySlot}
            disabled={!canAddSlot}
            title={
              canAddSlot
                ? formatMessage({ id: 'theme.slot.copy' })
                : formatMessage({ id: 'theme.slot.limitReached' }, { limit: THEME_SLOT_LIMIT })
            }
            className={`
              px-2 py-1 rounded text-xs font-medium
              transition-all duration-200
              ${canAddSlot
                ? 'bg-accent text-white hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-1'
                : 'bg-muted text-muted-text cursor-not-allowed'
              }
              focus:outline-none
            `}
          >
            + {formatMessage({ id: 'theme.slot.copy' })}
          </button>
        </div>

        <div className="flex gap-2" role="tablist" aria-label={formatMessage({ id: 'theme.slot.title' })}>
          {themeSlots.map((slot) => {
            const isActive = slot.id === activeSlotId;
            const isRenaming = slot.id === renamingSlotId;

            return (
              <div
                key={slot.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => handleSlotSelect(slot.id)}
                className={`
                  relative flex-1 min-w-0 p-2.5 rounded-lg cursor-pointer
                  transition-all duration-200 border-2 group
                  ${isActive
                    ? 'border-accent bg-surface shadow-md'
                    : 'border-border bg-bg hover:bg-surface'
                  }
                  focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1
                `}
              >
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent border-2 border-bg" />
                )}

                {/* Slot name - inline rename or display */}
                <div className="flex items-center gap-1 min-w-0">
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      onBlur={handleConfirmRename}
                      onClick={(e) => e.stopPropagation()}
                      className="
                        w-full px-1 py-0.5 text-xs font-medium text-text
                        bg-bg border border-accent rounded
                        focus:outline-none focus:ring-1 focus:ring-accent
                      "
                      maxLength={20}
                    />
                  ) : (
                    <span
                      className="text-xs font-medium text-text truncate"
                      title={slot.name}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (!slot.isDefault) {
                          handleStartRename(slot.id, slot.name);
                        }
                      }}
                    >
                      {slot.name}
                    </span>
                  )}
                </div>

                {/* Active label */}
                {isActive && !isRenaming && (
                  <span className="text-[10px] text-accent font-medium mt-0.5 block">
                    {formatMessage({ id: 'theme.slot.active' })}
                  </span>
                )}

                {/* Action buttons - show on hover for non-default slots */}
                {!slot.isDefault && !isRenaming && (
                  <div className="
                    absolute top-1 right-1 flex gap-0.5
                    opacity-0 group-hover:opacity-100 transition-opacity duration-150
                  ">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(slot.id, slot.name);
                      }}
                      title={formatMessage({ id: 'theme.slot.rename' })}
                      className="
                        p-0.5 rounded text-text-tertiary hover:text-text hover:bg-surface-hover
                        transition-colors duration-150 focus:outline-none
                      "
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDeleteSlot(slot.id);
                      }}
                      title={formatMessage({ id: 'theme.slot.delete' })}
                      className="
                        p-0.5 rounded text-text-tertiary hover:text-error hover:bg-error-light
                        transition-colors duration-150 focus:outline-none
                      "
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                )}

                {/* Default slot: show disabled delete tooltip */}
                {slot.isDefault && (
                  <div className="
                    absolute top-1 right-1 flex gap-0.5
                    opacity-0 group-hover:opacity-100 transition-opacity duration-150
                  ">
                    <button
                      disabled
                      title={formatMessage({ id: 'theme.slot.cannotDeleteDefault' })}
                      className="p-0.5 rounded text-muted-text cursor-not-allowed"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Color Scheme Selection */}
      <div>
        <h3 className="text-sm font-medium text-text mb-3">
          {formatMessage({ id: 'theme.title.colorScheme' })}
        </h3>
        <div
          className="grid grid-cols-5 gap-3"
          role="group"
          aria-label="Color scheme selection"
          onKeyDown={handleKeyDown}
        >
          {COLOR_SCHEMES.map((scheme) => (
            <button
              key={scheme.id}
              onClick={() => handleSchemeSelect(scheme.id)}
              aria-label={formatMessage({ id: 'theme.select.colorScheme' }, { name: formatMessage({ id: `theme.colorScheme.${scheme.id}` }) })}
              aria-selected={colorScheme === scheme.id && !isCustomTheme}
              role="radio"
              className={`
                flex flex-col items-center gap-2 p-3 rounded-lg
                transition-all duration-200 border-2
                ${colorScheme === scheme.id && !isCustomTheme
                  ? 'border-accent bg-surface shadow-md'
                  : 'border-border bg-bg hover:bg-surface'
                }
                focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2
              `}
            >
              {/* Color swatch */}
              <div
                className="w-8 h-8 rounded-full border-2 border-border shadow-sm"
                style={{ backgroundColor: scheme.accentColor }}
                aria-hidden="true"
              />
              {/* Label */}
              <span className="text-xs font-medium text-text text-center">
                {formatMessage({ id: `theme.colorScheme.${scheme.id}` })}
              </span>
            </button>
          ))}

          {/* Custom Color Option */}
          <button
            onClick={handleCustomSelect}
            aria-label={formatMessage({ id: 'theme.select.colorScheme' }, { name: formatMessage({ id: 'theme.colorScheme.custom' }) })}
            aria-selected={isCustomTheme}
            role="radio"
            className={`
              flex flex-col items-center gap-2 p-3 rounded-lg
              transition-all duration-200 border-2
              ${isCustomTheme
                ? 'border-accent bg-surface shadow-md'
                : 'border-border bg-bg hover:bg-surface'
              }
              focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2
            `}
          >
            {/* Gradient swatch showing current custom hue */}
            <div
              className="w-8 h-8 rounded-full border-2 border-border shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${getPreviewColor('--accent')}, ${getPreviewColor('--primary')})`
              }}
              aria-hidden="true"
            />
            {/* Label */}
            <span className="text-xs font-medium text-text text-center">
              {formatMessage({ id: 'theme.colorScheme.custom' })}
            </span>
          </button>
        </div>
      </div>

      {/* Custom Hue Selection - Only shown when custom theme is active */}
      {isCustomTheme && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text mb-3">
            {formatMessage({ id: 'theme.title.customHue' })}
          </h3>

          {/* Hue Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="hue-slider" className="text-xs text-text-secondary">
                {formatMessage({ id: 'theme.hueValue' }, { value: previewHue ?? 180 })}
              </label>
            </div>
            <input
              id="hue-slider"
              type="range"
              min="0"
              max="360"
              step="1"
              value={previewHue ?? 180}
              onChange={(e) => setPreviewHue(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right,
                  hsl(0, 70%, 60%), hsl(60, 70%, 60%), hsl(120, 70%, 60%),
                  hsl(180, 70%, 60%), hsl(240, 70%, 60%), hsl(300, 70%, 60%), hsl(360, 70%, 60%))`
              }}
              aria-label={formatMessage({ id: 'theme.title.customHue' })}
            />

            {/* Preview Swatches */}
            <div className="flex gap-3 items-end">
              <span className="text-xs text-text-secondary pb-1">
                {formatMessage({ id: 'theme.preview' })}:
              </span>
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-10 h-10 rounded border-2 border-border shadow-sm"
                  style={{ backgroundColor: getPreviewColor('--bg') }}
                />
                <span className="text-[10px] text-text-tertiary">{formatMessage({ id: 'theme.preview.background' })}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-10 h-10 rounded border-2 border-border shadow-sm"
                  style={{ backgroundColor: getPreviewColor('--surface') }}
                />
                <span className="text-[10px] text-text-tertiary">{formatMessage({ id: 'theme.preview.surface' })}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-10 h-10 rounded border-2 border-border shadow-sm"
                  style={{ backgroundColor: getPreviewColor('--accent') }}
                />
                <span className="text-[10px] text-text-tertiary">{formatMessage({ id: 'theme.preview.accent' })}</span>
              </div>
            </div>

            {/* Save and Reset Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleHueSave}
                disabled={previewHue === customHue}
                className={`
                  flex-1 px-4 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${previewHue === customHue
                    ? 'bg-muted text-muted-text cursor-not-allowed'
                    : 'bg-accent text-white hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2'
                  }
                `}
              >
                {formatMessage({ id: 'theme.save' })}
              </button>
              <button
                onClick={handleHueReset}
                className="
                  px-4 py-2 rounded-lg text-sm font-medium
                  border-2 border-border bg-bg text-text
                  hover:bg-surface transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2
                "
              >
                {formatMessage({ id: 'theme.reset' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Style Tier Selection */}
      <div>
        <h3 className="text-sm font-medium text-text mb-3">
          {formatMessage({ id: 'theme.styleTier.label' })}
        </h3>
        <div
          className="grid grid-cols-3 gap-3"
          role="radiogroup"
          aria-label={formatMessage({ id: 'theme.styleTier.label' })}
        >
          {STYLE_TIERS.map((tier) => {
            const preview = getTierPreviewColors(tier.id);
            const isSelected = styleTier === tier.id;
            return (
              <button
                key={tier.id}
                onClick={() => setStyleTier(tier.id)}
                role="radio"
                aria-checked={isSelected}
                className={`
                  flex flex-col items-center gap-2 p-3 rounded-lg
                  transition-all duration-200 border-2
                  ${isSelected
                    ? 'border-accent bg-surface shadow-md'
                    : 'border-border bg-bg hover:bg-surface'
                  }
                  focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2
                `}
              >
                {/* Preview swatches */}
                <div className="flex gap-1" aria-hidden="true">
                  <div
                    className="w-5 h-5 rounded-sm border border-border"
                    style={{ backgroundColor: preview.bg }}
                  />
                  <div
                    className="w-5 h-5 rounded-sm border border-border"
                    style={{ backgroundColor: preview.surface }}
                  />
                  <div
                    className="w-5 h-5 rounded-sm border border-border"
                    style={{ backgroundColor: preview.accent }}
                  />
                </div>
                {/* Tier name */}
                <span className="text-xs font-medium text-text text-center">
                  {formatMessage({ id: tier.nameKey })}
                </span>
                {/* Description */}
                <span className="text-[10px] text-text-tertiary text-center leading-tight">
                  {formatMessage({ id: tier.descKey })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Gradient Effects Settings */}
      <div>
        <h3 className="text-sm font-medium text-text mb-3">
          {formatMessage({ id: 'theme.gradient.title' })}
        </h3>

        {/* Gradient Level Selection */}
        <div className="space-y-4">
          <div
            className="flex gap-2"
            role="radiogroup"
            aria-label={formatMessage({ id: 'theme.gradient.title' })}
          >
            {(['off', 'standard', 'enhanced'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setGradientLevel(level)}
                role="radio"
                aria-checked={gradientLevel === level}
                className={`
                  flex-1 px-3 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200 border-2
                  ${gradientLevel === level
                    ? 'border-accent bg-surface shadow-md'
                    : 'border-border bg-bg hover:bg-surface'
                  }
                  focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2
                `}
              >
                {formatMessage({ id: `theme.gradient.${level}` })}
              </button>
            ))}
          </div>

          {/* Hover Glow Checkbox */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enableHoverGlow}
              onChange={(e) => setEnableHoverGlow(e.target.checked)}
              className="
                w-4 h-4 rounded border-border text-accent
                focus:ring-2 focus:ring-accent focus:ring-offset-2
              "
            />
            <span className="text-sm text-text">
              {formatMessage({ id: 'theme.gradient.hoverGlow' })}
            </span>
          </label>

          {/* Background Animation Checkbox */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enableBackgroundAnimation}
              onChange={(e) => setEnableBackgroundAnimation(e.target.checked)}
              className="
                w-4 h-4 rounded border-border text-accent
                focus:ring-2 focus:ring-accent focus:ring-offset-2
              "
            />
            <span className="text-sm text-text">
              {formatMessage({ id: 'theme.gradient.bgAnimation' })}
            </span>
          </label>
        </div>
      </div>

      {/* Background Image */}
      <BackgroundImagePicker />

      {/* Motion Preference */}
      <div>
        <h3 className="text-sm font-medium text-text mb-3">
          {formatMessage({ id: 'theme.motion.label' })}
        </h3>
        <div
          className="flex gap-2"
          role="radiogroup"
          aria-label={formatMessage({ id: 'theme.motion.label' })}
        >
          {(['system', 'reduce', 'enable'] as const).map((pref) => (
            <button
              key={pref}
              onClick={() => setMotionPreference(pref)}
              role="radio"
              aria-checked={motionPreference === pref}
              className={`
                flex-1 px-3 py-2 rounded-lg text-sm font-medium
                transition-all duration-200 border-2
                ${motionPreference === pref
                  ? 'border-accent bg-surface shadow-md'
                  : 'border-border bg-bg hover:bg-surface'
                }
                focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2
              `}
            >
              {formatMessage({ id: `theme.motion.${pref}` })}
            </button>
          ))}
        </div>
      </div>

      {/* Contrast Warning Banner (non-blocking) */}
      {showContrastWarning && contrastWarnings.length > 0 && (
        <div className="p-3 rounded-lg bg-warning-light border border-warning text-warning-text space-y-2">
          <p className="text-xs font-medium">
            {formatMessage({ id: 'theme.accessibility.contrastWarning' })}
          </p>
          <ul className="text-xs space-y-1">
            {contrastWarnings.map((w) => {
              const key = `${w.fgVar}|${w.bgVar}`;
              const fixes = contrastFixes[key] || [];
              return (
                <li key={key} className="space-y-1">
                  <span>
                    {w.fgVar} / {w.bgVar}: {w.ratio}:1 (min {w.required}:1)
                  </span>
                  {fixes.length > 0 && (
                    <div className="ml-2 text-[10px]">
                      {fixes.slice(0, 1).map((fix, i) => (
                        <span key={i} className="block">
                          {formatMessage(
                            { id: 'theme.accessibility.fixSuggestion' },
                            {
                              target: fix.target === 'fg' ? w.fgVar : w.bgVar,
                              original: fix.original,
                              suggested: fix.suggested,
                              ratio: fix.resultRatio,
                            }
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            onClick={() => setShowContrastWarning(false)}
            className="text-xs font-medium underline"
          >
            {formatMessage({ id: 'theme.accessibility.dismiss' })}
          </button>
        </div>
      )}

      {/* Theme Mode Selection */}
      <div>
        <h3 className="text-sm font-medium text-text mb-3">
          {formatMessage({ id: 'theme.title.themeMode' })}
        </h3>
        <div
          className="grid grid-cols-2 gap-3"
          role="group"
          aria-label="Theme mode selection"
        >
          {THEME_MODES.map((modeOption) => (
            <button
              key={modeOption.id}
              onClick={() => handleModeSelect(modeOption.id)}
              aria-label={formatMessage({ id: 'theme.select.themeMode' }, { name: formatMessage({ id: `theme.themeMode.${modeOption.id}` }) })}
              aria-selected={mode === modeOption.id}
              role="radio"
              className={`
                flex items-center justify-center gap-2 p-3 rounded-lg
                transition-all duration-200 border-2
                ${mode === modeOption.id
                  ? 'border-accent bg-surface shadow-md'
                  : 'border-border bg-bg hover:bg-surface'
                }
                focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2
              `}
            >
              {/* Icon */}
              <span className="text-lg" aria-hidden="true">
                {modeOption.id === 'light' ? '☀️' : '🌙'}
              </span>
              {/* Label */}
              <span className="text-sm font-medium text-text">
                {formatMessage({ id: `theme.themeMode.${modeOption.id}` })}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Current Theme Display */}
      <div className="p-3 rounded-lg bg-surface border border-border">
        <p className="text-xs text-text-secondary">
          {formatMessage({ id: 'theme.current' }, { name: getThemeName(colorScheme, mode) })}
        </p>
      </div>

      {/* Theme Sharing Section */}
      <div>
        <h3 className="text-sm font-medium text-text mb-3">
          {formatMessage({ id: 'theme.share.label' })}
        </h3>

        <div className="flex gap-2">
          {/* Copy Theme Code button */}
          <button
            onClick={handleCopyThemeCode}
            className="
              flex-1 px-3 py-2 rounded-lg text-sm font-medium
              border-2 border-border bg-bg text-text
              hover:bg-surface transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2
            "
          >
            {copyFeedback
              ? formatMessage({ id: 'theme.share.copied' })
              : formatMessage({ id: 'theme.share.copyCode' })
            }
          </button>

          {/* Import Theme button */}
          <button
            onClick={showImportPanel ? handleCloseImport : handleOpenImport}
            className={`
              flex-1 px-3 py-2 rounded-lg text-sm font-medium
              transition-all duration-200 border-2
              ${showImportPanel
                ? 'border-accent bg-surface shadow-md'
                : 'border-border bg-bg text-text hover:bg-surface'
              }
              focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2
            `}
          >
            {formatMessage({ id: 'theme.share.import' })}
          </button>
        </div>

        {/* Import Panel */}
        {showImportPanel && (
          <div className="mt-3 space-y-3">
            {/* Paste textarea */}
            <textarea
              value={importCode}
              onChange={(e) => handleImportCodeChange(e.target.value)}
              placeholder={formatMessage({ id: 'theme.share.paste' })}
              rows={3}
              className="
                w-full px-3 py-2 rounded-lg text-sm font-mono
                bg-bg border-2 border-border text-text
                placeholder-text-tertiary resize-none
                focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
              "
            />

            {/* Error message */}
            {importError && (
              <div className="p-2 rounded-lg bg-error-light border border-error text-error-text text-xs">
                {formatMessage({ id: getShareErrorMessageId(importError) })}
              </div>
            )}

            {/* Version warning */}
            {importWarning && !importError && (
              <div className="p-2 rounded-lg bg-warning-light border border-warning text-warning-text text-xs">
                {formatMessage({ id: 'theme.share.versionWarning' })}
              </div>
            )}

            {/* Import Preview Card */}
            {importPreview && !importError && (
              <div className="p-3 rounded-lg bg-surface border border-border space-y-3">
                <p className="text-xs font-medium text-text">
                  {formatMessage({ id: 'theme.share.preview' })}
                </p>

                {/* Preview swatches */}
                <div className="flex gap-3 items-end">
                  {(() => {
                    const previewColors = getImportPreviewColors(importPreview);
                    return (
                      <>
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className="w-10 h-10 rounded border-2 border-border shadow-sm"
                            style={{ backgroundColor: previewColors.bg }}
                          />
                          <span className="text-[10px] text-text-tertiary">
                            {formatMessage({ id: 'theme.preview.background' })}
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className="w-10 h-10 rounded border-2 border-border shadow-sm"
                            style={{ backgroundColor: previewColors.surface }}
                          />
                          <span className="text-[10px] text-text-tertiary">
                            {formatMessage({ id: 'theme.preview.surface' })}
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className="w-10 h-10 rounded border-2 border-border shadow-sm"
                            style={{ backgroundColor: previewColors.accent }}
                          />
                          <span className="text-[10px] text-text-tertiary">
                            {formatMessage({ id: 'theme.preview.accent' })}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Settings summary */}
                <div className="text-xs text-text-secondary space-y-1">
                  <p>
                    {formatMessage({ id: 'theme.styleTier.label' })}: {formatMessage({ id: `theme.styleTier.${importPreview.styleTier === 'high-contrast' ? 'highContrast' : importPreview.styleTier}` })}
                  </p>
                  <p>
                    {formatMessage({ id: 'theme.gradient.title' })}: {formatMessage({ id: `theme.gradient.${importPreview.gradientLevel}` })}
                  </p>
                  {importPreview.customHue !== null && (
                    <p>
                      {formatMessage({ id: 'theme.hueValue' }, { value: importPreview.customHue })}
                    </p>
                  )}
                  {importPreview.customHue === null && (
                    <p>
                      {formatMessage({ id: 'theme.title.colorScheme' })}: {formatMessage({ id: `theme.colorScheme.${importPreview.colorScheme}` })}
                    </p>
                  )}
                </div>

                {/* Apply / Cancel buttons */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleApplyImport}
                    className="
                      flex-1 px-4 py-2 rounded-lg text-sm font-medium
                      bg-accent text-white hover:bg-accent-hover
                      transition-all duration-200
                      focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2
                    "
                  >
                    {formatMessage({ id: 'theme.share.apply' })}
                  </button>
                  <button
                    onClick={handleCloseImport}
                    className="
                      px-4 py-2 rounded-lg text-sm font-medium
                      border-2 border-border bg-bg text-text
                      hover:bg-surface transition-all duration-200
                      focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2
                    "
                  >
                    {formatMessage({ id: 'theme.share.cancel' })}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={pendingDeleteSlot !== null} onOpenChange={handleCancelDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Theme Slot?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The theme slot will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
