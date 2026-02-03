// ========================================
// useLocale Hook
// ========================================
// Convenient hook for locale management

import { useCallback, useMemo } from 'react';
import { useAppStore, selectLocale } from '../stores/appStore';
import type { Locale } from '../types/store';
import { availableLocales, formatMessage } from '../lib/i18n';

export interface UseLocaleReturn {
  /** Current locale ('en' or 'zh') */
  locale: Locale;
  /** Set locale preference */
  setLocale: (locale: Locale) => void;
  /** Available locales with display names */
  availableLocales: Record<Locale, string>;
}

/**
 * Hook for managing locale state
 * @returns Locale state and actions
 *
 * @example
 * ```tsx
 * const { locale, setLocale, availableLocales } = useLocale();
 *
 * return (
 *   <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
 *     {Object.entries(availableLocales).map(([key, label]) => (
 *       <option key={key} value={key}>{label}</option>
 *     ))}
 *   </select>
 * );
 * ```
 */
export function useLocale(): UseLocaleReturn {
  const locale = useAppStore(selectLocale);
  const setLocaleAction = useAppStore((state) => state.setLocale);

  const setLocale = useCallback(
    (newLocale: Locale) => {
      setLocaleAction(newLocale);
    },
    [setLocaleAction]
  );

  return {
    locale,
    setLocale,
    availableLocales,
  };
}

/**
 * Hook to format i18n messages with the current locale
 * @returns A formatMessage function for translating message IDs
 *
 * @example
 * ```tsx
 * const formatMessage = useFormatMessage();
 * return <h1>{formatMessage('home.title')}</h1>;
 * ```
 */
export function useFormatMessage(): (
  id: string,
  values?: Record<string, string | number | boolean | Date | null | undefined>
) => string {
  // Use useMemo to avoid recreating the function on each render
  return useMemo(() => {
    return (id: string, values?: Record<string, string | number | boolean | Date | null | undefined>) => {
      return formatMessage(id, values);
    };
  }, []);
}
