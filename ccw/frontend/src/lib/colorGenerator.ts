/**
 * Color Generator Module
 * Generates complete CSS variable sets from a single Hue value
 *
 * Algorithm based on HSL color space with mode-specific saturation/lightness rules:
 * - Light mode: Low saturation backgrounds (5-20%), high lightness (85-98%)
 * - Dark mode: Medium saturation backgrounds (15-30%), low lightness (10-22%)
 * - Accents: High saturation (60-90%), medium lightness (55-65%) for both modes
 *
 * @module colorGenerator
 */

/**
 * Generate a complete theme from a single hue value
 *
 * @param hue - Hue value from 0 to 360 degrees
 * @param mode - Theme mode ('light' or 'dark')
 * @returns Record of CSS variable names to HSL values in 'H S% L%' format
 *
 * @example
 * ```typescript
 * const theme = generateThemeFromHue(180, 'light');
 * // Returns: { '--bg': '180 5% 98%', '--accent': '180 70% 60%', ... }
 * ```
 */
export function generateThemeFromHue(
  hue: number,
  mode: 'light' | 'dark'
): Record<string, string> {
  // Normalize hue to 0-360 range
  const normalizedHue = ((hue % 360) + 360) % 360;

  const vars: Record<string, string> = {};

  if (mode === 'light') {
    // Light mode: Low saturation, high lightness backgrounds
    vars['--bg'] = `${normalizedHue} 5% 98%`;
    vars['--bg-secondary'] = `${normalizedHue} 8% 96%`;
    vars['--surface'] = `${normalizedHue} 10% 99%`;
    vars['--surface-hover'] = `${normalizedHue} 12% 97%`;
    vars['--border'] = `${normalizedHue} 15% 88%`;
    vars['--border-hover'] = `${normalizedHue} 18% 82%`;

    // Text colors: Low saturation, very low lightness
    vars['--text'] = `${normalizedHue} 20% 15%`;
    vars['--text-secondary'] = `${normalizedHue} 10% 45%`;
    vars['--text-tertiary'] = `${normalizedHue} 8% 60%`;
    vars['--text-disabled'] = `${normalizedHue} 5% 70%`;

    // Accent colors: High saturation, medium lightness
    vars['--accent'] = `${normalizedHue} 70% 60%`;
    vars['--accent-hover'] = `${normalizedHue} 75% 55%`;
    vars['--accent-active'] = `${normalizedHue} 80% 50%`;
    vars['--accent-light'] = `${normalizedHue} 65% 90%`;
    vars['--accent-lighter'] = `${normalizedHue} 60% 95%`;

    // Primary colors
    vars['--primary'] = `${normalizedHue} 70% 60%`;
    vars['--primary-hover'] = `${normalizedHue} 75% 55%`;
    vars['--primary-light'] = `${normalizedHue} 65% 90%`;
    vars['--primary-lighter'] = `${normalizedHue} 60% 95%`;

    // Secondary colors (complementary hue)
    const secondaryHue = (normalizedHue + 180) % 360;
    vars['--secondary'] = `${secondaryHue} 60% 65%`;
    vars['--secondary-hover'] = `${secondaryHue} 65% 60%`;
    vars['--secondary-light'] = `${secondaryHue} 55% 90%`;

    // Muted colors
    vars['--muted'] = `${normalizedHue} 12% 92%`;
    vars['--muted-hover'] = `${normalizedHue} 15% 88%`;
    vars['--muted-text'] = `${normalizedHue} 10% 45%`;

    // Semantic colors (success, warning, error, info)
    vars['--success'] = `120 60% 50%`;
    vars['--success-light'] = `120 55% 92%`;
    vars['--success-text'] = `120 70% 35%`;

    vars['--warning'] = `38 90% 55%`;
    vars['--warning-light'] = `38 85% 92%`;
    vars['--warning-text'] = `38 95% 40%`;

    vars['--error'] = `0 70% 55%`;
    vars['--error-light'] = `0 65% 92%`;
    vars['--error-text'] = `0 75% 40%`;

    vars['--info'] = `200 70% 55%`;
    vars['--info-light'] = `200 65% 92%`;
    vars['--info-text'] = `200 75% 40%`;

    // Destructive (danger)
    vars['--destructive'] = `0 70% 55%`;
    vars['--destructive-hover'] = `0 75% 50%`;
    vars['--destructive-light'] = `0 65% 92%`;

    // Interactive states
    vars['--hover'] = `${normalizedHue} 12% 94%`;
    vars['--active'] = `${normalizedHue} 15% 90%`;
    vars['--focus'] = `${normalizedHue} 70% 60%`;

    // Legacy variables for shadcn/ui compatibility
    vars['--background'] = vars['--bg'];
    vars['--foreground'] = vars['--text'];
    vars['--card'] = vars['--surface'];
    vars['--card-foreground'] = vars['--text'];
    vars['--primary-foreground'] = `0 0% 100%`;
    vars['--secondary-foreground'] = `0 0% 100%`;
    vars['--accent-foreground'] = `0 0% 100%`;
    vars['--destructive-foreground'] = `0 0% 100%`;
    vars['--muted-foreground'] = vars['--text-secondary'];
    vars['--sidebar-background'] = `${normalizedHue} 30% 97%`;
    vars['--sidebar-foreground'] = vars['--text'];
    vars['--input'] = vars['--border'];
    vars['--ring'] = vars['--accent'];
    vars['--indigo'] = `239 65% 60%`;
    vars['--indigo-light'] = `239 65% 92%`;
    vars['--orange'] = `25 90% 55%`;
    vars['--orange-light'] = `25 90% 92%`;

  } else {
    // Dark mode: Medium saturation, low lightness backgrounds
    vars['--bg'] = `${normalizedHue} 20% 10%`;
    vars['--bg-secondary'] = `${normalizedHue} 18% 12%`;
    vars['--surface'] = `${normalizedHue} 15% 14%`;
    vars['--surface-hover'] = `${normalizedHue} 18% 16%`;
    vars['--border'] = `${normalizedHue} 10% 22%`;
    vars['--border-hover'] = `${normalizedHue} 12% 28%`;

    // Text colors: Low saturation, very high lightness
    vars['--text'] = `${normalizedHue} 10% 90%`;
    vars['--text-secondary'] = `${normalizedHue} 8% 65%`;
    vars['--text-tertiary'] = `${normalizedHue} 6% 50%`;
    vars['--text-disabled'] = `${normalizedHue} 5% 40%`;

    // Accent colors: High saturation, medium lightness
    vars['--accent'] = `${normalizedHue} 70% 60%`;
    vars['--accent-hover'] = `${normalizedHue} 75% 65%`;
    vars['--accent-active'] = `${normalizedHue} 80% 70%`;
    vars['--accent-light'] = `${normalizedHue} 60% 25%`;
    vars['--accent-lighter'] = `${normalizedHue} 55% 20%`;

    // Primary colors
    vars['--primary'] = `${normalizedHue} 70% 60%`;
    vars['--primary-hover'] = `${normalizedHue} 75% 65%`;
    vars['--primary-light'] = `${normalizedHue} 60% 25%`;
    vars['--primary-lighter'] = `${normalizedHue} 55% 20%`;

    // Secondary colors (complementary hue)
    const secondaryHue = (normalizedHue + 180) % 360;
    vars['--secondary'] = `${secondaryHue} 60% 65%`;
    vars['--secondary-hover'] = `${secondaryHue} 65% 70%`;
    vars['--secondary-light'] = `${secondaryHue} 55% 25%`;

    // Muted colors
    vars['--muted'] = `${normalizedHue} 15% 18%`;
    vars['--muted-hover'] = `${normalizedHue} 18% 22%`;
    vars['--muted-text'] = `${normalizedHue} 8% 65%`;

    // Semantic colors (success, warning, error, info)
    vars['--success'] = `120 60% 55%`;
    vars['--success-light'] = `120 50% 20%`;
    vars['--success-text'] = `120 65% 65%`;

    vars['--warning'] = `38 90% 60%`;
    vars['--warning-light'] = `38 80% 22%`;
    vars['--warning-text'] = `38 95% 70%`;

    vars['--error'] = `0 70% 60%`;
    vars['--error-light'] = `0 60% 20%`;
    vars['--error-text'] = `0 75% 70%`;

    vars['--info'] = `200 70% 60%`;
    vars['--info-light'] = `200 60% 20%`;
    vars['--info-text'] = `200 75% 70%`;

    // Destructive (danger)
    vars['--destructive'] = `0 70% 60%`;
    vars['--destructive-hover'] = `0 75% 65%`;
    vars['--destructive-light'] = `0 60% 20%`;

    // Interactive states
    vars['--hover'] = `${normalizedHue} 18% 16%`;
    vars['--active'] = `${normalizedHue} 20% 20%`;
    vars['--focus'] = `${normalizedHue} 70% 60%`;

    // Legacy variables for shadcn/ui compatibility
    vars['--background'] = vars['--bg'];
    vars['--foreground'] = vars['--text'];
    vars['--card'] = vars['--surface'];
    vars['--card-foreground'] = vars['--text'];
    vars['--primary-foreground'] = `${normalizedHue} 30% 10%`;
    vars['--secondary-foreground'] = `0 0% 100%`;
    vars['--accent-foreground'] = `${normalizedHue} 30% 10%`;
    vars['--destructive-foreground'] = `0 0% 100%`;
    vars['--muted-foreground'] = vars['--text-secondary'];
    vars['--sidebar-background'] = `${normalizedHue} 25% 12%`;
    vars['--sidebar-foreground'] = vars['--text'];
    vars['--input'] = vars['--border'];
    vars['--ring'] = vars['--accent'];
    vars['--indigo'] = `239 60% 55%`;
    vars['--indigo-light'] = `239 40% 20%`;
    vars['--orange'] = `25 85% 50%`;
    vars['--orange-light'] = `25 50% 20%`;
  }

  return vars;
}

/**
 * Get the total count of CSS variables generated
 * @returns Number of variables in the generated theme
 */
export function getVariableCount(): number {
  // Generate a sample theme to count variables
  const sample = generateThemeFromHue(0, 'light');
  return Object.keys(sample).length;
}

/**
 * Validate hue value is within acceptable range
 * @param hue - Hue value to validate
 * @returns true if valid, false otherwise
 */
export function isValidHue(hue: number): boolean {
  return typeof hue === 'number' && !isNaN(hue) && isFinite(hue);
}
