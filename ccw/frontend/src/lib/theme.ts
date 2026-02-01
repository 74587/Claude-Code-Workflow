/**
 * Theme System Configuration
 * Defines available color schemes and theme modes for the CCW application
 */

export type ColorScheme = 'blue' | 'green' | 'orange' | 'purple';
export type ThemeMode = 'light' | 'dark';
export type ThemeId = `${ThemeMode}-${ColorScheme}`;

export interface ThemeOption {
  id: ColorScheme;
  name: string;
  accentColor: string; // Display color for theme selector UI
  description: string;
}

export interface Theme {
  id: ThemeId;
  scheme: ColorScheme;
  mode: ThemeMode;
  name: string;
}

/**
 * Available color schemes with display metadata
 */
export const COLOR_SCHEMES: ThemeOption[] = [
  {
    id: 'blue',
    name: '经典蓝',
    accentColor: '#5b8fc4', // blue-gray tone
    description: 'Classic professional blue tone'
  },
  {
    id: 'green',
    name: '深邃绿',
    accentColor: '#10b981', // emerald-500
    description: 'Deep natural green tone'
  },
  {
    id: 'orange',
    name: '活力橙',
    accentColor: '#f97316', // orange-500
    description: 'Vibrant energetic orange tone'
  },
  {
    id: 'purple',
    name: '优雅紫',
    accentColor: '#a855f7', // purple-500
    description: 'Elegant creative purple tone'
  }
];

/**
 * Theme mode options
 */
export const THEME_MODES: Array<{id: ThemeMode; name: string}> = [
  { id: 'light', name: '浅色' },
  { id: 'dark', name: '深色' }
];

/**
 * Generate full theme ID from scheme and mode
 */
export function getThemeId(scheme: ColorScheme, mode: ThemeMode): ThemeId {
  return `${mode}-${scheme}`;
}

/**
 * Parse theme ID into scheme and mode components
 */
export function parseThemeId(themeId: string): { scheme: ColorScheme; mode: ThemeMode } | null {
  const match = themeId.match(/^(light|dark)-(blue|green|orange|purple)$/);
  if (!match) return null;

  return {
    mode: match[1] as ThemeMode,
    scheme: match[2] as ColorScheme
  };
}

/**
 * Get display name for a theme
 */
export function getThemeName(scheme: ColorScheme, mode: ThemeMode): string {
  const schemeOption = COLOR_SCHEMES.find(s => s.id === scheme);
  const modeOption = THEME_MODES.find(m => m.id === mode);

  if (!schemeOption || !modeOption) return 'Unknown Theme';

  return `${schemeOption.name} · ${modeOption.name}`;
}

/**
 * All available theme combinations (8 total)
 */
export const ALL_THEMES: Theme[] = COLOR_SCHEMES.flatMap(scheme =>
  THEME_MODES.map(mode => ({
    id: getThemeId(scheme.id, mode.id),
    scheme: scheme.id,
    mode: mode.id,
    name: getThemeName(scheme.id, mode.id)
  }))
);

/**
 * Default theme configuration
 */
export const DEFAULT_THEME: Theme = {
  id: 'light-blue',
  scheme: 'blue',
  mode: 'light',
  name: '经典蓝 · 浅色'
};
