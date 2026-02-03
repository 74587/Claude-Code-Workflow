// ========================================
// Chart Theme Configuration
// ========================================
// Extracts Tailwind CSS custom properties for Recharts color palette

/**
 * Chart color palette extracted from CSS custom properties
 */
export interface ChartColors {
  primary: string;
  success: string;
  warning: string;
  info: string;
  destructive: string;
  indigo: string;
  orange: string;
  muted: string;
}

/**
 * Converts HSL CSS variable to hex color for Recharts
 * @param hslString - HSL string in format "h s% l%"
 * @returns Hex color string
 */
function hslToHex(hslString: string): string {
  const [h, s, l] = hslString.split(' ').map((v) => parseFloat(v));
  const hue = h / 360;
  const saturation = s / 100;
  const lightness = l / 100;

  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;

  const r = Math.round(hueToRgb(p, q, hue + 1 / 3) * 255);
  const g = Math.round(hueToRgb(p, q, hue) * 255);
  const b = Math.round(hueToRgb(p, q, hue - 1 / 3) * 255);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Get chart colors from CSS custom properties
 * @returns Chart color palette object
 */
export function getChartColors(): ChartColors {
  const root = document.documentElement;
  const style = getComputedStyle(root);

  const getColor = (varName: string): string => {
    const hsl = style.getPropertyValue(varName).trim();
    if (!hsl) {
      // Fallback colors if CSS variables are not available
      const fallbacks: Record<string, string> = {
        '--primary': '220 60% 65%',
        '--success': '142 71% 45%',
        '--warning': '38 92% 50%',
        '--info': '220 60% 60%',
        '--destructive': '8 75% 55%',
        '--indigo': '239 65% 60%',
        '--orange': '25 90% 55%',
        '--muted': '220 20% 96%',
      };
      return hslToHex(fallbacks[varName] || '220 60% 65%');
    }
    return hslToHex(hsl);
  };

  return {
    primary: getColor('--primary'),
    success: getColor('--success'),
    warning: getColor('--warning'),
    info: getColor('--info'),
    destructive: getColor('--destructive'),
    indigo: getColor('--indigo'),
    orange: getColor('--orange'),
    muted: getColor('--muted'),
  };
}

/**
 * Status color mapping for workflow status pie chart
 */
export const STATUS_COLORS: Record<string, keyof ChartColors> = {
  planning: 'info',
  in_progress: 'primary',
  completed: 'success',
  paused: 'warning',
  archived: 'muted',
};

/**
 * Task type color mapping for task type bar chart
 */
export const TASK_TYPE_COLORS: Record<string, keyof ChartColors> = {
  implementation: 'primary',
  bugfix: 'destructive',
  refactor: 'indigo',
  documentation: 'info',
  testing: 'success',
  other: 'muted',
};
