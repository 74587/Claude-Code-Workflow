// ========================================
// useTheme Hook
// ========================================
// Convenient hook for theme management with multi-color scheme support

import { useCallback } from 'react';
import { useAppStore, selectTheme, selectResolvedTheme } from '../stores/appStore';
import type { Theme, ColorScheme } from '../types/store';

export interface UseThemeReturn {
  /** Current theme preference ('light', 'dark', 'system') */
  theme: Theme;
  /** Resolved theme based on preference and system settings */
  resolvedTheme: 'light' | 'dark';
  /** Whether the resolved theme is dark */
  isDark: boolean;
  /** Current color scheme ('blue', 'green', 'orange', 'purple') */
  colorScheme: ColorScheme;
  /** Set theme preference */
  setTheme: (theme: Theme) => void;
  /** Set color scheme */
  setColorScheme: (scheme: ColorScheme) => void;
  /** Toggle between light and dark (ignores system) */
  toggleTheme: () => void;
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
  const setThemeAction = useAppStore((state) => state.setTheme);
  const setColorSchemeAction = useAppStore((state) => state.setColorScheme);
  const toggleThemeAction = useAppStore((state) => state.toggleTheme);

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

  const toggleTheme = useCallback(() => {
    toggleThemeAction();
  }, [toggleThemeAction]);

  return {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    colorScheme,
    setTheme,
    setColorScheme,
    toggleTheme,
  };
}
