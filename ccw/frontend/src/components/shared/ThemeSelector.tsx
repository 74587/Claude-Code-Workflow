import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useTheme } from '@/hooks/useTheme';
import { COLOR_SCHEMES, THEME_MODES, getThemeName } from '@/lib/theme';
import type { ColorScheme, ThemeMode } from '@/lib/theme';
import { generateThemeFromHue } from '@/lib/colorGenerator';

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
  const { colorScheme, resolvedTheme, customHue, isCustomTheme, setColorScheme, setTheme, setCustomHue } = useTheme();

  // Local state for preview hue (uncommitted changes)
  const [previewHue, setPreviewHue] = useState<number | null>(customHue);

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

  return (
    <div className="space-y-6">
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
            <div className="flex gap-2 items-center">
              <span className="text-xs text-text-secondary mr-2">
                {formatMessage({ id: 'theme.preview' })}:
              </span>
              <div
                className="w-10 h-10 rounded border-2 border-border shadow-sm"
                style={{ backgroundColor: getPreviewColor('--bg') }}
                title="Background"
              />
              <div
                className="w-10 h-10 rounded border-2 border-border shadow-sm"
                style={{ backgroundColor: getPreviewColor('--surface') }}
                title="Surface"
              />
              <div
                className="w-10 h-10 rounded border-2 border-border shadow-sm"
                style={{ backgroundColor: getPreviewColor('--accent') }}
                title="Accent"
              />
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
