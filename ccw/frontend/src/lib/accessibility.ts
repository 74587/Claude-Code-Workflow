// ========================================
// Accessibility Utilities
// ========================================
// WCAG 2.1 contrast checking and motion preference management
// for the theme system. Operates on HSL 'H S% L%' format strings.

// ========== Types ==========

/** User preference for animation behavior */
export type MotionPreference = 'system' | 'reduce' | 'enable';

/** Result of evaluating one critical color pair against WCAG thresholds */
export interface ContrastResult {
  /** Foreground CSS variable name (e.g. '--text') */
  fgVar: string;
  /** Background CSS variable name (e.g. '--bg') */
  bgVar: string;
  /** Computed contrast ratio (e.g. 4.52) */
  ratio: number;
  /** Required minimum contrast ratio for this pair */
  required: number;
  /** Whether the pair passes WCAG AA */
  passed: boolean;
}

/** A single suggested fix to improve contrast, with visual distance metric */
export interface FixSuggestion {
  /** Which variable to adjust ('fg' or 'bg') */
  target: 'fg' | 'bg';
  /** Original HSL value */
  original: string;
  /** Suggested replacement HSL value */
  suggested: string;
  /** Resulting contrast ratio after applying the fix */
  resultRatio: number;
  /** Visual distance from original (lower = less visible change) */
  distance: number;
}

// ========== Critical Color Pairs ==========

/**
 * Whitelist of critical UI color pairs to check for WCAG AA compliance.
 * Each entry: [foreground variable, background variable, required ratio]
 *
 * - 4.5:1 for normal text (WCAG AA)
 * - 3.0:1 for large text / UI components (WCAG AA)
 */
export const CRITICAL_COLOR_PAIRS: ReadonlyArray<[string, string, number]> = [
  // Text on backgrounds (4.5:1 - normal text)
  ['--text', '--bg', 4.5],
  ['--text', '--surface', 4.5],
  ['--text-secondary', '--bg', 4.5],
  ['--text-secondary', '--surface', 4.5],
  ['--muted-text', '--muted', 4.5],
  ['--muted-text', '--bg', 4.5],

  // Tertiary/disabled text (3:1 - large text threshold)
  ['--text-tertiary', '--bg', 3.0],
  ['--text-disabled', '--bg', 3.0],

  // Accent/interactive on backgrounds (3:1 - UI component threshold)
  ['--accent', '--bg', 3.0],
  ['--accent', '--surface', 3.0],

  // Semantic text on semantic light backgrounds (4.5:1)
  ['--success-text', '--success-light', 4.5],
  ['--warning-text', '--warning-light', 4.5],
  ['--error-text', '--error-light', 4.5],
  ['--info-text', '--info-light', 4.5],

  // Foreground on primary/destructive buttons (4.5:1)
  ['--primary-foreground', '--primary', 4.5],
  ['--destructive-foreground', '--destructive', 4.5],

  // Text on muted surface (4.5:1)
  ['--text', '--muted', 4.5],
];

// ========== HSL Parsing and Color Conversion ==========

/**
 * Parse 'H S% L%' format HSL string into numeric [h, s, l] values.
 * h in degrees (0-360), s and l as fractions (0-1).
 */
function parseHSL(hslString: string): [number, number, number] | null {
  const trimmed = hslString.trim();
  // Match patterns: "220 60% 65%" or "220 60% 65"
  const match = trimmed.match(/^([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?$/);
  if (!match) return null;
  const h = parseFloat(match[1]);
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;
  if (isNaN(h) || isNaN(s) || isNaN(l)) return null;
  return [h, s, l];
}

/**
 * Convert HSL values to linear sRGB [R, G, B] in 0-1 range.
 * Then apply sRGB linearization per WCAG 2.1 spec.
 */
function hslToLinearRGB(h: number, s: number, l: number): [number, number, number] {
  // HSL to sRGB conversion
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hPrime = h / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  const m = l - c / 2;

  let r1: number, g1: number, b1: number;
  if (hPrime < 1) { r1 = c; g1 = x; b1 = 0; }
  else if (hPrime < 2) { r1 = x; g1 = c; b1 = 0; }
  else if (hPrime < 3) { r1 = 0; g1 = c; b1 = x; }
  else if (hPrime < 4) { r1 = 0; g1 = x; b1 = c; }
  else if (hPrime < 5) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }

  const rSRGB = r1 + m;
  const gSRGB = g1 + m;
  const bSRGB = b1 + m;

  // sRGB linearization per WCAG 2.1
  const linearize = (v: number): number => {
    if (v <= 0.04045) return v / 12.92;
    return Math.pow((v + 0.055) / 1.055, 2.4);
  };

  return [linearize(rSRGB), linearize(gSRGB), linearize(bSRGB)];
}

/**
 * Parse 'H S% L%' format HSL string, convert to sRGB,
 * compute WCAG 2.1 relative luminance.
 *
 * Formula: L = 0.2126*R + 0.7152*G + 0.0722*B
 * with sRGB linearization applied.
 *
 * @param hslString - HSL string in 'H S% L%' format (e.g. '220 60% 65%')
 * @returns Relative luminance (0-1), or -1 if parsing fails
 */
export function hslToRelativeLuminance(hslString: string): number {
  const parsed = parseHSL(hslString);
  if (!parsed) return -1;
  const [h, s, l] = parsed;
  const [rLin, gLin, bLin] = hslToLinearRGB(h, s, l);
  // Round to 4-decimal precision to avoid floating-point edge cases
  return Math.round((0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin) * 10000) / 10000;
}

/**
 * Compute WCAG contrast ratio from two relative luminance values.
 * Returns ratio in format X:1 (just the X number).
 *
 * @param l1 - Relative luminance of first color
 * @param l2 - Relative luminance of second color
 * @returns Contrast ratio (always >= 1)
 */
export function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

// ========== Theme Contrast Checking ==========

/**
 * Evaluate all critical color pairs in a generated theme against WCAG AA thresholds.
 * Only checks pairs where both variables exist in the provided vars map.
 *
 * @param vars - Record of CSS variable names to HSL values (e.g. from generateThemeFromHue)
 * @returns Array of ContrastResult for each evaluated pair
 */
export function checkThemeContrast(vars: Record<string, string>): ContrastResult[] {
  const results: ContrastResult[] = [];

  for (const [fgVar, bgVar, required] of CRITICAL_COLOR_PAIRS) {
    const fgValue = vars[fgVar];
    const bgValue = vars[bgVar];
    if (!fgValue || !bgValue) continue;

    const fgLum = hslToRelativeLuminance(fgValue);
    const bgLum = hslToRelativeLuminance(bgValue);
    if (fgLum < 0 || bgLum < 0) continue;

    const ratio = getContrastRatio(fgLum, bgLum);
    // Use 0.01 tolerance buffer for borderline cases
    const passed = ratio >= (required - 0.01);

    results.push({ fgVar, bgVar, ratio, required, passed });
  }

  return results;
}

// ========== Contrast Fix Generation ==========

/**
 * Reconstruct 'H S% L%' string from components.
 */
function toHSLString(h: number, s: number, l: number): string {
  const clampedL = Math.max(0, Math.min(100, Math.round(l * 10) / 10));
  const clampedS = Math.max(0, Math.min(100, Math.round(s * 10) / 10));
  return `${Math.round(h)} ${clampedS}% ${clampedL}%`;
}

/**
 * Generate 2-3 lightness-adjusted alternatives that achieve target contrast ratio.
 * Preserves hue and saturation, only adjusts lightness.
 * Sorted by minimal visual change (distance).
 *
 * @param fgVar - Foreground CSS variable name
 * @param bgVar - Background CSS variable name
 * @param currentVars - Current theme variable values
 * @param targetRatio - Target contrast ratio to achieve
 * @returns Array of 2-3 FixSuggestion sorted by distance (ascending)
 */
export function generateContrastFix(
  fgVar: string,
  bgVar: string,
  currentVars: Record<string, string>,
  targetRatio: number
): FixSuggestion[] {
  const fgValue = currentVars[fgVar];
  const bgValue = currentVars[bgVar];
  if (!fgValue || !bgValue) return [];

  const fgParsed = parseHSL(fgValue);
  const bgParsed = parseHSL(bgValue);
  if (!fgParsed || !bgParsed) return [];

  const suggestions: FixSuggestion[] = [];

  // Strategy 1: Adjust foreground lightness (darken or lighten)
  const bgLum = hslToRelativeLuminance(bgValue);
  const fgSuggestions = findLightnessForContrast(
    fgParsed[0], fgParsed[1], fgParsed[2], bgLum, targetRatio
  );
  for (const newL of fgSuggestions) {
    const suggested = toHSLString(fgParsed[0], fgParsed[1] * 100, newL * 100);
    const newFgLum = hslToRelativeLuminance(suggested);
    if (newFgLum < 0) continue;
    const resultRatio = getContrastRatio(newFgLum, bgLum);
    if (resultRatio >= targetRatio - 0.01) {
      suggestions.push({
        target: 'fg',
        original: fgValue,
        suggested,
        resultRatio,
        distance: Math.abs(newL - fgParsed[2]),
      });
    }
  }

  // Strategy 2: Adjust background lightness
  const fgLum = hslToRelativeLuminance(fgValue);
  const bgSuggestions = findLightnessForContrast(
    bgParsed[0], bgParsed[1], bgParsed[2], fgLum, targetRatio
  );
  for (const newL of bgSuggestions) {
    const suggested = toHSLString(bgParsed[0], bgParsed[1] * 100, newL * 100);
    const newBgLum = hslToRelativeLuminance(suggested);
    if (newBgLum < 0) continue;
    const resultRatio = getContrastRatio(fgLum, newBgLum);
    if (resultRatio >= targetRatio - 0.01) {
      suggestions.push({
        target: 'bg',
        original: bgValue,
        suggested,
        resultRatio,
        distance: Math.abs(newL - bgParsed[2]),
      });
    }
  }

  // Sort by distance (minimal visual change first) and take up to 3
  suggestions.sort((a, b) => a.distance - b.distance);
  return suggestions.slice(0, 3);
}

/**
 * Find lightness values that achieve target contrast against a reference luminance.
 * Searches in both lighter and darker directions from current lightness.
 * Returns up to 2 candidates (one lighter, one darker if found).
 */
function findLightnessForContrast(
  h: number,
  s: number,
  currentL: number,
  refLum: number,
  targetRatio: number
): number[] {
  const candidates: number[] = [];
  const step = 0.01;

  // Search darker direction (decreasing lightness)
  for (let l = currentL - step; l >= 0; l -= step) {
    const hsl = toHSLString(h, s * 100, l * 100);
    const lum = hslToRelativeLuminance(hsl);
    if (lum < 0) continue;
    const ratio = getContrastRatio(lum, refLum);
    if (ratio >= targetRatio) {
      candidates.push(l);
      break;
    }
  }

  // Search lighter direction (increasing lightness)
  for (let l = currentL + step; l <= 1; l += step) {
    const hsl = toHSLString(h, s * 100, l * 100);
    const lum = hslToRelativeLuminance(hsl);
    if (lum < 0) continue;
    const ratio = getContrastRatio(lum, refLum);
    if (ratio >= targetRatio) {
      candidates.push(l);
      break;
    }
  }

  return candidates;
}

// ========== Motion Preference ==========

/**
 * Resolve user preference to actual reduced-motion boolean.
 * 'system' checks matchMedia, 'reduce' returns true, 'enable' returns false.
 *
 * @param pref - User's motion preference setting
 * @returns true if motion should be reduced, false otherwise
 */
export function resolveMotionPreference(pref: MotionPreference): boolean {
  if (pref === 'reduce') return true;
  if (pref === 'enable') return false;
  // 'system' - check OS preference
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
