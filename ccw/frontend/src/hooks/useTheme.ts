// ========================================
// useTheme Hook
// ========================================
// Convenient hook for theme management

import { useCallback } from 'react';
import { useAppStore, selectTheme, selectResolvedTheme } from '../stores/appStore';
import type { Theme } from '../types/store';

export interface UseThemeReturn {
  /** Current theme preference ('light', 'dark', 'system') */
  theme: Theme;
  /** Resolved theme based on preference and system settings */
  resolvedTheme: 'light' | 'dark';
  /** Whether the resolved theme is dark */
  isDark: boolean;
  /** Set theme preference */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark (ignores system) */
  toggleTheme: () => void;
}

/**
 * Hook for managing theme state
 * @returns Theme state and actions
 *
 * @example
 * ```tsx
 * const { theme, isDark, setTheme, toggleTheme } = useTheme();
 *
 * return (
 *   <button onClick={toggleTheme}>
 *     {isDark ? 'Switch to Light' : 'Switch to Dark'}
 *   </button>
 * );
 * ```
 */
export function useTheme(): UseThemeReturn {
  const theme = useAppStore(selectTheme);
  const resolvedTheme = useAppStore(selectResolvedTheme);
  const setThemeAction = useAppStore((state) => state.setTheme);
  const toggleThemeAction = useAppStore((state) => state.toggleTheme);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeAction(newTheme);
    },
    [setThemeAction]
  );

  const toggleTheme = useCallback(() => {
    toggleThemeAction();
  }, [toggleThemeAction]);

  return {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    setTheme,
    toggleTheme,
  };
}
