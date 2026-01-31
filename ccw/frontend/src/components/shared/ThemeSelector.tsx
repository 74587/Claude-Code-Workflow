import React from 'react';
import { useIntl } from 'react-intl';
import { useTheme } from '@/hooks/useTheme';
import { COLOR_SCHEMES, THEME_MODES, getThemeName } from '@/lib/theme';
import type { ColorScheme, ThemeMode } from '@/lib/theme';

/**
 * Theme Selector Component
 * Allows users to select from 4 color schemes (blue/green/orange/purple)
 * and 2 theme modes (light/dark)
 *
 * Features:
 * - 8 total theme combinations
 * - Keyboard navigation support (Arrow keys)
 * - ARIA labels for accessibility
 * - Visual feedback for selected theme
 * - System dark mode detection
 */
export function ThemeSelector() {
  const { formatMessage } = useIntl();
  const { colorScheme, resolvedTheme, setColorScheme, setTheme } = useTheme();

  // Resolved mode is either 'light' or 'dark'
  const mode: ThemeMode = resolvedTheme;

  const handleSchemeSelect = (scheme: ColorScheme) => {
    setColorScheme(scheme);
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

  return (
    <div className="space-y-6">
      {/* Color Scheme Selection */}
      <div>
        <h3 className="text-sm font-medium text-text mb-3">
          {formatMessage({ id: 'theme.title.colorScheme' })}
        </h3>
        <div
          className="grid grid-cols-4 gap-3"
          role="group"
          aria-label="Color scheme selection"
          onKeyDown={handleKeyDown}
        >
          {COLOR_SCHEMES.map((scheme) => (
            <button
              key={scheme.id}
              onClick={() => handleSchemeSelect(scheme.id)}
              aria-label={formatMessage({ id: 'theme.select.colorScheme' }, { name: formatMessage({ id: `theme.colorScheme.${scheme.id}` }) })}
              aria-selected={colorScheme === scheme.id}
              role="radio"
              className={`
                flex flex-col items-center gap-2 p-3 rounded-lg
                transition-all duration-200 border-2
                ${colorScheme === scheme.id
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
        </div>
      </div>

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
    </div>
  );
}
