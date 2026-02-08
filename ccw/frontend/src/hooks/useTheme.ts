// ========================================
// useTheme Hook
// ========================================
// Convenient hook for theme management with multi-color scheme support

import { useCallback, useMemo } from 'react';
import {
  useAppStore,
  selectTheme,
  selectResolvedTheme,
  selectCustomHue,
  selectIsCustomTheme,
  selectGradientLevel,
  selectEnableHoverGlow,
  selectEnableBackgroundAnimation,
  selectMotionPreference,
  selectThemeSlots,
  selectActiveSlotId,
  selectDeletedSlotBuffer,
} from '../stores/appStore';
import type { Theme, ColorScheme, GradientLevel, MotionPreference, StyleTier, ThemeSlot, ThemeSlotId, BackgroundConfig, BackgroundEffects, BackgroundMode, UnsplashAttribution } from '../types/store';
import { resolveMotionPreference } from '../lib/accessibility';
import { THEME_SLOT_LIMIT, DEFAULT_BACKGROUND_CONFIG } from '../lib/theme';
import { encodeTheme, decodeTheme } from '../lib/themeShare';
import type { ImportResult } from '../lib/themeShare';

export interface UseThemeReturn {
  /** Current theme preference ('light', 'dark', 'system') */
  theme: Theme;
  /** Resolved theme based on preference and system settings */
  resolvedTheme: 'light' | 'dark';
  /** Whether the resolved theme is dark */
  isDark: boolean;
  /** Current color scheme ('blue', 'green', 'orange', 'purple') */
  colorScheme: ColorScheme;
  /** Custom hue value (0-360) for theme customization, null when using preset themes */
  customHue: number | null;
  /** Whether the current theme is a custom theme */
  isCustomTheme: boolean;
  /** Gradient level: 'off', 'standard', or 'enhanced' */
  gradientLevel: GradientLevel;
  /** Whether hover glow effects are enabled */
  enableHoverGlow: boolean;
  /** Whether background gradient animation is enabled */
  enableBackgroundAnimation: boolean;
  /** User's motion preference setting */
  motionPreference: MotionPreference;
  /** Resolved motion preference (true = reduce motion) */
  resolvedMotion: boolean;
  /** Set theme preference */
  setTheme: (theme: Theme) => void;
  /** Set color scheme */
  setColorScheme: (scheme: ColorScheme) => void;
  /** Set custom hue value (0-360) or null to reset to preset theme */
  setCustomHue: (hue: number | null) => void;
  /** Toggle between light and dark (ignores system) */
  toggleTheme: () => void;
  /** Set gradient level */
  setGradientLevel: (level: GradientLevel) => void;
  /** Set hover glow enabled */
  setEnableHoverGlow: (enabled: boolean) => void;
  /** Set background animation enabled */
  setEnableBackgroundAnimation: (enabled: boolean) => void;
  /** Set motion preference */
  setMotionPreference: (pref: MotionPreference) => void;
  /** Current style tier ('soft', 'standard', 'high-contrast') */
  styleTier: StyleTier;
  /** Set style tier */
  setStyleTier: (tier: StyleTier) => void;
  /** All theme slots */
  themeSlots: ThemeSlot[];
  /** Currently active slot ID */
  activeSlotId: ThemeSlotId;
  /** Currently active slot object */
  activeSlot: ThemeSlot | undefined;
  /** Buffer holding recently deleted slot for undo */
  deletedSlotBuffer: ThemeSlot | null;
  /** Whether user can add more slots (below THEME_SLOT_LIMIT) */
  canAddSlot: boolean;
  /** Switch to a different theme slot */
  setActiveSlot: (slotId: ThemeSlotId) => void;
  /** Copy current slot to a new slot */
  copySlot: () => void;
  /** Rename a slot */
  renameSlot: (slotId: ThemeSlotId, name: string) => void;
  /** Delete a slot (moves to deletedSlotBuffer for undo) */
  deleteSlot: (slotId: ThemeSlotId) => void;
  /** Undo the last slot deletion */
  undoDeleteSlot: () => void;
  /** Export current active slot as a shareable theme code string */
  exportThemeCode: () => string;
  /** Decode and validate an imported theme code string */
  importThemeCode: (code: string) => ImportResult;
  /** Current background configuration for the active slot */
  backgroundConfig: BackgroundConfig;
  /** Set full background config */
  setBackgroundConfig: (config: BackgroundConfig) => void;
  /** Update a single background effect property */
  updateBackgroundEffect: <K extends keyof BackgroundEffects>(key: K, value: BackgroundEffects[K]) => void;
  /** Set background mode */
  setBackgroundMode: (mode: BackgroundMode) => void;
  /** Set background image URL and attribution */
  setBackgroundImage: (url: string | null, attribution: UnsplashAttribution | null) => void;
}

/**
 * Hook for managing theme state with multi-color scheme support
 * @returns Theme state and actions
 *
 * @example
 * ```tsx
 * const { theme, colorScheme, isDark, setTheme, setColorScheme, toggleTheme } = useTheme();
 *
 * return (
 *   <div>
 *     <button onClick={() => setColorScheme('blue')}>Blue Theme</button>
 *     <button onClick={toggleTheme}>
 *       {isDark ? 'Switch to Light' : 'Switch to Dark'}
 *     </button>
 *   </div>
 * );
 * ```
 */
export function useTheme(): UseThemeReturn {
  const theme = useAppStore(selectTheme);
  const resolvedTheme = useAppStore(selectResolvedTheme);
  const colorScheme = useAppStore((state) => state.colorScheme);
  const customHue = useAppStore(selectCustomHue);
  const isCustomTheme = useAppStore(selectIsCustomTheme);
  const gradientLevel = useAppStore(selectGradientLevel);
  const enableHoverGlow = useAppStore(selectEnableHoverGlow);
  const enableBackgroundAnimation = useAppStore(selectEnableBackgroundAnimation);
  const motionPreference = useAppStore(selectMotionPreference);
  const setThemeAction = useAppStore((state) => state.setTheme);
  const setColorSchemeAction = useAppStore((state) => state.setColorScheme);
  const setCustomHueAction = useAppStore((state) => state.setCustomHue);
  const toggleThemeAction = useAppStore((state) => state.toggleTheme);
  const setGradientLevelAction = useAppStore((state) => state.setGradientLevel);
  const setEnableHoverGlowAction = useAppStore((state) => state.setEnableHoverGlow);
  const setEnableBackgroundAnimationAction = useAppStore((state) => state.setEnableBackgroundAnimation);
  const setMotionPreferenceAction = useAppStore((state) => state.setMotionPreference);
  const setStyleTierAction = useAppStore((state) => state.setStyleTier);

  // Slot state
  const themeSlots = useAppStore(selectThemeSlots);
  const activeSlotId = useAppStore(selectActiveSlotId);
  const deletedSlotBuffer = useAppStore(selectDeletedSlotBuffer);

  // Background actions
  const setBackgroundConfigAction = useAppStore((state) => state.setBackgroundConfig);
  const updateBackgroundEffectAction = useAppStore((state) => state.updateBackgroundEffect);
  const setBackgroundModeAction = useAppStore((state) => state.setBackgroundMode);
  const setBackgroundImageAction = useAppStore((state) => state.setBackgroundImage);

  // Slot actions
  const setActiveSlotAction = useAppStore((state) => state.setActiveSlot);
  const copySlotAction = useAppStore((state) => state.copySlot);
  const renameSlotAction = useAppStore((state) => state.renameSlot);
  const deleteSlotAction = useAppStore((state) => state.deleteSlot);
  const undoDeleteSlotAction = useAppStore((state) => state.undoDeleteSlot);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeAction(newTheme);
    },
    [setThemeAction]
  );

  const setColorScheme = useCallback(
    (newColorScheme: ColorScheme) => {
      setColorSchemeAction(newColorScheme);
    },
    [setColorSchemeAction]
  );

  const setCustomHue = useCallback(
    (hue: number | null) => {
      setCustomHueAction(hue);
    },
    [setCustomHueAction]
  );

  const toggleTheme = useCallback(() => {
    toggleThemeAction();
  }, [toggleThemeAction]);

  const setGradientLevel = useCallback(
    (level: GradientLevel) => {
      setGradientLevelAction(level);
    },
    [setGradientLevelAction]
  );

  const setEnableHoverGlow = useCallback(
    (enabled: boolean) => {
      setEnableHoverGlowAction(enabled);
    },
    [setEnableHoverGlowAction]
  );

  const setEnableBackgroundAnimation = useCallback(
    (enabled: boolean) => {
      setEnableBackgroundAnimationAction(enabled);
    },
    [setEnableBackgroundAnimationAction]
  );

  const setMotionPreference = useCallback(
    (pref: MotionPreference) => {
      setMotionPreferenceAction(pref);
    },
    [setMotionPreferenceAction]
  );

  const setStyleTier = useCallback(
    (tier: StyleTier) => {
      setStyleTierAction(tier);
    },
    [setStyleTierAction]
  );

  const resolvedMotion = resolveMotionPreference(motionPreference);

  // Slot computed values
  const activeSlot = useMemo(
    () => themeSlots.find(s => s.id === activeSlotId),
    [themeSlots, activeSlotId]
  );
  const canAddSlot = themeSlots.length < THEME_SLOT_LIMIT;
  const styleTier = activeSlot?.styleTier ?? 'standard';
  const backgroundConfig = activeSlot?.backgroundConfig ?? DEFAULT_BACKGROUND_CONFIG;

  // Slot callbacks
  const setActiveSlot = useCallback(
    (slotId: ThemeSlotId) => {
      setActiveSlotAction(slotId);
    },
    [setActiveSlotAction]
  );

  const copySlot = useCallback(() => {
    copySlotAction();
  }, [copySlotAction]);

  const renameSlot = useCallback(
    (slotId: ThemeSlotId, name: string) => {
      renameSlotAction(slotId, name);
    },
    [renameSlotAction]
  );

  const deleteSlot = useCallback(
    (slotId: ThemeSlotId) => {
      deleteSlotAction(slotId);
    },
    [deleteSlotAction]
  );

  const undoDeleteSlot = useCallback(() => {
    undoDeleteSlotAction();
  }, [undoDeleteSlotAction]);

  const exportThemeCode = useCallback((): string => {
    if (!activeSlot) {
      // Fallback: build a minimal slot from current state
      const fallbackSlot: ThemeSlot = {
        id: activeSlotId,
        name: '',
        colorScheme,
        customHue,
        isCustomTheme,
        gradientLevel,
        enableHoverGlow,
        enableBackgroundAnimation,
        styleTier,
        isDefault: false,
      };
      return encodeTheme(fallbackSlot);
    }
    return encodeTheme(activeSlot);
  }, [activeSlot, activeSlotId, colorScheme, customHue, isCustomTheme, gradientLevel, enableHoverGlow, enableBackgroundAnimation, styleTier]);

  const importThemeCode = useCallback((code: string): ImportResult => {
    return decodeTheme(code);
  }, []);

  return {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    colorScheme,
    customHue,
    isCustomTheme,
    gradientLevel,
    enableHoverGlow,
    enableBackgroundAnimation,
    motionPreference,
    resolvedMotion,
    setTheme,
    setColorScheme,
    setCustomHue,
    toggleTheme,
    setGradientLevel,
    setEnableHoverGlow,
    setEnableBackgroundAnimation,
    setMotionPreference,
    styleTier,
    setStyleTier,
    themeSlots,
    activeSlotId,
    activeSlot,
    deletedSlotBuffer,
    canAddSlot,
    setActiveSlot,
    copySlot,
    renameSlot,
    deleteSlot,
    undoDeleteSlot,
    exportThemeCode,
    importThemeCode,
    backgroundConfig,
    setBackgroundConfig: setBackgroundConfigAction,
    updateBackgroundEffect: updateBackgroundEffectAction,
    setBackgroundMode: setBackgroundModeAction,
    setBackgroundImage: setBackgroundImageAction,
  };
}
