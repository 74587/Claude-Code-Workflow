/**
 * Convert Tokens to CSS Tool
 * Transform design-tokens.json to CSS custom properties
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';

// Zod schema
const ParamsSchema = z.object({
  input: z.union([z.string(), z.record(z.string(), z.any())]),
});

type Params = z.infer<typeof ParamsSchema>;

interface DesignTokens {
  meta?: { name?: string };
  colors?: {
    brand?: Record<string, string>;
    surface?: Record<string, string>;
    semantic?: Record<string, string>;
    text?: Record<string, string>;
    border?: Record<string, string>;
  };
  typography?: {
    font_family?: Record<string, string>;
    font_size?: Record<string, string>;
    font_weight?: Record<string, string>;
    line_height?: Record<string, string>;
    letter_spacing?: Record<string, string>;
  };
  spacing?: Record<string, string>;
  border_radius?: Record<string, string>;
  shadows?: Record<string, string>;
  breakpoints?: Record<string, string>;
}

interface ConversionResult {
  style_name: string;
  lines_count: number;
  css: string;
}

/**
 * Generate Google Fonts import URL
 */
function generateFontImport(fonts: Record<string, string>): string {
  if (!fonts || typeof fonts !== 'object') return '';

  const fontParams: string[] = [];
  const processedFonts = new Set<string>();

  // Extract font families from typography.font_family
  Object.values(fonts).forEach((fontValue) => {
    if (typeof fontValue !== 'string') return;

    // Get the primary font (before comma)
    const primaryFont = fontValue.split(',')[0].trim().replace(/['"]/g, '');

    // Skip system fonts
    const systemFonts = ['system-ui', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'];
    if (systemFonts.includes(primaryFont.toLowerCase())) return;
    if (processedFonts.has(primaryFont)) return;

    processedFonts.add(primaryFont);

    // URL encode font name
    const encodedFont = primaryFont.replace(/ /g, '+');

    // Special handling for common fonts
    const specialFonts: Record<string, string> = {
      'Comic Neue': 'Comic+Neue:wght@300;400;700',
      'Patrick Hand': 'Patrick+Hand:wght@400;700',
      Caveat: 'Caveat:wght@400;700',
      'Dancing Script': 'Dancing+Script:wght@400;700',
    };

    if (specialFonts[primaryFont]) {
      fontParams.push(`family=${specialFonts[primaryFont]}`);
    } else {
      fontParams.push(`family=${encodedFont}:wght@400;500;600;700`);
    }
  });

  if (fontParams.length === 0) return '';

  return `@import url('https://fonts.googleapis.com/css2?${fontParams.join('&')}&display=swap');`;
}

/**
 * Generate CSS variables for a category
 */
function generateCssVars(prefix: string, obj: Record<string, string>, indent = '  '): string[] {
  if (!obj || typeof obj !== 'object') return [];

  const lines: string[] = [];
  Object.entries(obj).forEach(([key, value]) => {
    const varName = `--${prefix}-${key.replace(/_/g, '-')}`;
    lines.push(`${indent}${varName}: ${value};`);
  });
  return lines;
}

/**
 * Main execute function
 */
async function execute(params: Params): Promise<ConversionResult> {
  const { input } = params;

  if (!input) {
    throw new Error('Parameter "input" (design tokens JSON) is required');
  }

  // Parse input
  let tokens: DesignTokens;
  try {
    tokens = typeof input === 'string' ? JSON.parse(input) : input;
  } catch (e) {
    throw new Error(`Invalid JSON input: ${(e as Error).message}`);
  }

  const lines: string[] = [];

  // Header
  const styleName = tokens.meta?.name || 'Design Tokens';
  lines.push('/* ========================================');
  lines.push(`   Design Tokens: ${styleName}`);
  lines.push('   Auto-generated from design-tokens.json');
  lines.push('   ======================================== */');
  lines.push('');

  // Google Fonts import
  if (tokens.typography?.font_family) {
    const fontImport = generateFontImport(tokens.typography.font_family);
    if (fontImport) {
      lines.push('/* Import Web Fonts */');
      lines.push(fontImport);
      lines.push('');
    }
  }

  // CSS Custom Properties
  lines.push(':root {');

  // Colors
  if (tokens.colors) {
    if (tokens.colors.brand) {
      lines.push('  /* Colors - Brand */');
      lines.push(...generateCssVars('color-brand', tokens.colors.brand));
      lines.push('');
    }
    if (tokens.colors.surface) {
      lines.push('  /* Colors - Surface */');
      lines.push(...generateCssVars('color-surface', tokens.colors.surface));
      lines.push('');
    }
    if (tokens.colors.semantic) {
      lines.push('  /* Colors - Semantic */');
      lines.push(...generateCssVars('color-semantic', tokens.colors.semantic));
      lines.push('');
    }
    if (tokens.colors.text) {
      lines.push('  /* Colors - Text */');
      lines.push(...generateCssVars('color-text', tokens.colors.text));
      lines.push('');
    }
    if (tokens.colors.border) {
      lines.push('  /* Colors - Border */');
      lines.push(...generateCssVars('color-border', tokens.colors.border));
      lines.push('');
    }
  }

  // Typography
  if (tokens.typography) {
    if (tokens.typography.font_family) {
      lines.push('  /* Typography - Font Family */');
      lines.push(...generateCssVars('font-family', tokens.typography.font_family));
      lines.push('');
    }
    if (tokens.typography.font_size) {
      lines.push('  /* Typography - Font Size */');
      lines.push(...generateCssVars('font-size', tokens.typography.font_size));
      lines.push('');
    }
    if (tokens.typography.font_weight) {
      lines.push('  /* Typography - Font Weight */');
      lines.push(...generateCssVars('font-weight', tokens.typography.font_weight));
      lines.push('');
    }
    if (tokens.typography.line_height) {
      lines.push('  /* Typography - Line Height */');
      lines.push(...generateCssVars('line-height', tokens.typography.line_height));
      lines.push('');
    }
    if (tokens.typography.letter_spacing) {
      lines.push('  /* Typography - Letter Spacing */');
      lines.push(...generateCssVars('letter-spacing', tokens.typography.letter_spacing));
      lines.push('');
    }
  }

  // Spacing
  if (tokens.spacing) {
    lines.push('  /* Spacing */');
    lines.push(...generateCssVars('spacing', tokens.spacing));
    lines.push('');
  }

  // Border Radius
  if (tokens.border_radius) {
    lines.push('  /* Border Radius */');
    lines.push(...generateCssVars('border-radius', tokens.border_radius));
    lines.push('');
  }

  // Shadows
  if (tokens.shadows) {
    lines.push('  /* Shadows */');
    lines.push(...generateCssVars('shadow', tokens.shadows));
    lines.push('');
  }

  // Breakpoints
  if (tokens.breakpoints) {
    lines.push('  /* Breakpoints */');
    lines.push(...generateCssVars('breakpoint', tokens.breakpoints));
    lines.push('');
  }

  lines.push('}');
  lines.push('');

  // Global Font Application
  lines.push('/* ========================================');
  lines.push('   Global Font Application');
  lines.push('   ======================================== */');
  lines.push('');
  lines.push('body {');
  lines.push('  font-family: var(--font-family-body);');
  lines.push('  font-size: var(--font-size-base);');
  lines.push('  line-height: var(--line-height-normal);');
  lines.push('  color: var(--color-text-primary);');
  lines.push('  background-color: var(--color-surface-background);');
  lines.push('}');
  lines.push('');
  lines.push('h1, h2, h3, h4, h5, h6, legend {');
  lines.push('  font-family: var(--font-family-heading);');
  lines.push('}');
  lines.push('');
  lines.push('/* Reset default margins for better control */');
  lines.push('* {');
  lines.push('  margin: 0;');
  lines.push('  padding: 0;');
  lines.push('  box-sizing: border-box;');
  lines.push('}');

  const css = lines.join('\n');

  return {
    style_name: styleName,
    lines_count: lines.length,
    css,
  };
}

// Tool schema for MCP
export const schema: ToolSchema = {
  name: 'convert_tokens_to_css',
  description: `Transform design-tokens.json to CSS custom properties.
Generates:
- Google Fonts @import URL
- CSS custom properties for colors, typography, spacing, etc.
- Global font application rules`,
  inputSchema: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Design tokens JSON string or object',
      },
    },
    required: ['input'],
  },
};

// Handler function
export async function handler(params: Record<string, unknown>): Promise<ToolResult<ConversionResult>> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid params: ${parsed.error.message}` };
  }

  try {
    const result = await execute(parsed.data);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
