---
name: design-tokens-schema
description: Design tokens JSON schema specification for UI design workflow
type: specification
---

# Design Tokens Schema Specification

## Overview
Standardized JSON schema for design tokens used in `/workflow:design/*` commands. Ensures consistency across style extraction, consolidation, and UI generation phases.

## Core Principles

1. **OKLCH Color Format**: All colors use OKLCH color space for perceptual uniformity
2. **Semantic Naming**: User-centric token names (brand-primary, surface-elevated, not color-1, bg-2)
3. **rem-Based Sizing**: All spacing and typography use rem units for scalability
4. **Comprehensive Coverage**: Complete token set for production-ready design systems
5. **Accessibility First**: WCAG AA compliance validated and documented

## Full Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Design Tokens",
  "description": "Design token definitions for UI design workflow",
  "type": "object",
  "required": ["colors", "typography", "spacing", "border_radius", "shadow"],
  "properties": {
    "meta": {
      "type": "object",
      "properties": {
        "version": {"type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$"},
        "generated_at": {"type": "string", "format": "date-time"},
        "session_id": {"type": "string", "pattern": "^WFS-"},
        "description": {"type": "string"}
      }
    },
    "colors": {
      "type": "object",
      "required": ["brand", "surface", "semantic", "text"],
      "properties": {
        "brand": {
          "type": "object",
          "description": "Brand identity colors",
          "required": ["primary", "secondary"],
          "properties": {
            "primary": {"$ref": "#/definitions/color"},
            "secondary": {"$ref": "#/definitions/color"},
            "accent": {"$ref": "#/definitions/color"}
          }
        },
        "surface": {
          "type": "object",
          "description": "Surface and background colors",
          "required": ["background", "elevated"],
          "properties": {
            "background": {"$ref": "#/definitions/color"},
            "elevated": {"$ref": "#/definitions/color"},
            "sunken": {"$ref": "#/definitions/color"},
            "overlay": {"$ref": "#/definitions/color"}
          }
        },
        "semantic": {
          "type": "object",
          "description": "Semantic state colors",
          "required": ["success", "warning", "error", "info"],
          "properties": {
            "success": {"$ref": "#/definitions/color"},
            "warning": {"$ref": "#/definitions/color"},
            "error": {"$ref": "#/definitions/color"},
            "info": {"$ref": "#/definitions/color"}
          }
        },
        "text": {
          "type": "object",
          "description": "Text colors with WCAG AA validated contrast",
          "required": ["primary", "secondary"],
          "properties": {
            "primary": {"$ref": "#/definitions/color"},
            "secondary": {"$ref": "#/definitions/color"},
            "tertiary": {"$ref": "#/definitions/color"},
            "inverse": {"$ref": "#/definitions/color"},
            "disabled": {"$ref": "#/definitions/color"}
          }
        },
        "border": {
          "type": "object",
          "description": "Border and divider colors",
          "properties": {
            "subtle": {"$ref": "#/definitions/color"},
            "default": {"$ref": "#/definitions/color"},
            "strong": {"$ref": "#/definitions/color"}
          }
        }
      }
    },
    "typography": {
      "type": "object",
      "required": ["font_family", "font_size", "line_height", "font_weight"],
      "properties": {
        "font_family": {
          "type": "object",
          "required": ["heading", "body"],
          "properties": {
            "heading": {"type": "string"},
            "body": {"type": "string"},
            "mono": {"type": "string"}
          }
        },
        "font_size": {
          "type": "object",
          "required": ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"],
          "properties": {
            "xs": {"$ref": "#/definitions/size_rem"},
            "sm": {"$ref": "#/definitions/size_rem"},
            "base": {"$ref": "#/definitions/size_rem"},
            "lg": {"$ref": "#/definitions/size_rem"},
            "xl": {"$ref": "#/definitions/size_rem"},
            "2xl": {"$ref": "#/definitions/size_rem"},
            "3xl": {"$ref": "#/definitions/size_rem"},
            "4xl": {"$ref": "#/definitions/size_rem"},
            "5xl": {"$ref": "#/definitions/size_rem"}
          }
        },
        "line_height": {
          "type": "object",
          "required": ["tight", "normal", "relaxed"],
          "properties": {
            "tight": {"type": "string", "pattern": "^\\d+(\\.\\d+)?$"},
            "normal": {"type": "string", "pattern": "^\\d+(\\.\\d+)?$"},
            "relaxed": {"type": "string", "pattern": "^\\d+(\\.\\d+)?$"}
          }
        },
        "font_weight": {
          "type": "object",
          "properties": {
            "light": {"type": "integer", "enum": [300]},
            "normal": {"type": "integer", "enum": [400]},
            "medium": {"type": "integer", "enum": [500]},
            "semibold": {"type": "integer", "enum": [600]},
            "bold": {"type": "integer", "enum": [700]}
          }
        }
      }
    },
    "spacing": {
      "type": "object",
      "description": "Spacing scale (rem-based)",
      "required": ["0", "1", "2", "3", "4", "6", "8"],
      "patternProperties": {
        "^\\d+$": {"$ref": "#/definitions/size_rem"}
      }
    },
    "border_radius": {
      "type": "object",
      "required": ["none", "sm", "md", "lg", "full"],
      "properties": {
        "none": {"type": "string", "const": "0"},
        "sm": {"$ref": "#/definitions/size_rem"},
        "md": {"$ref": "#/definitions/size_rem"},
        "lg": {"$ref": "#/definitions/size_rem"},
        "xl": {"$ref": "#/definitions/size_rem"},
        "2xl": {"$ref": "#/definitions/size_rem"},
        "full": {"type": "string", "const": "9999px"}
      }
    },
    "shadow": {
      "type": "object",
      "required": ["sm", "md", "lg"],
      "properties": {
        "none": {"type": "string", "const": "none"},
        "sm": {"type": "string"},
        "md": {"type": "string"},
        "lg": {"type": "string"},
        "xl": {"type": "string"},
        "2xl": {"type": "string"}
      }
    },
    "breakpoint": {
      "type": "object",
      "description": "Responsive breakpoints",
      "properties": {
        "sm": {"type": "string", "pattern": "^\\d+px$"},
        "md": {"type": "string", "pattern": "^\\d+px$"},
        "lg": {"type": "string", "pattern": "^\\d+px$"},
        "xl": {"type": "string", "pattern": "^\\d+px$"},
        "2xl": {"type": "string", "pattern": "^\\d+px$"}
      }
    },
    "accessibility": {
      "type": "object",
      "description": "WCAG AA compliance data",
      "properties": {
        "contrast_ratios": {
          "type": "object",
          "patternProperties": {
            ".*": {
              "type": "object",
              "properties": {
                "background": {"type": "string"},
                "foreground": {"type": "string"},
                "ratio": {"type": "number"},
                "wcag_aa_pass": {"type": "boolean"},
                "wcag_aaa_pass": {"type": "boolean"}
              }
            }
          }
        }
      }
    }
  },
  "definitions": {
    "color": {
      "type": "string",
      "pattern": "^oklch\\(\\s*\\d+(\\.\\d+)?\\s+\\d+(\\.\\d+)?\\s+\\d+(\\.\\d+)?\\s*(\\/\\s*\\d+(\\.\\d+)?)?\\s*\\)$",
      "description": "OKLCH color format: oklch(L C H / A)"
    },
    "size_rem": {
      "type": "string",
      "pattern": "^\\d+(\\.\\d+)?rem$",
      "description": "rem-based size value"
    }
  }
}
```

## Example: Complete Design Tokens

```json
{
  "meta": {
    "version": "1.0.0",
    "generated_at": "2025-10-05T15:30:00Z",
    "session_id": "WFS-auth-dashboard",
    "description": "Modern minimalist design system with high contrast"
  },
  "colors": {
    "brand": {
      "primary": "oklch(0.45 0.20 270 / 1)",
      "secondary": "oklch(0.60 0.15 200 / 1)",
      "accent": "oklch(0.65 0.18 30 / 1)"
    },
    "surface": {
      "background": "oklch(0.98 0.01 270 / 1)",
      "elevated": "oklch(1.00 0.00 0 / 1)",
      "sunken": "oklch(0.95 0.02 270 / 1)",
      "overlay": "oklch(0.00 0.00 0 / 0.5)"
    },
    "semantic": {
      "success": "oklch(0.55 0.15 150 / 1)",
      "warning": "oklch(0.70 0.18 60 / 1)",
      "error": "oklch(0.50 0.20 20 / 1)",
      "info": "oklch(0.60 0.15 240 / 1)"
    },
    "text": {
      "primary": "oklch(0.20 0.02 270 / 1)",
      "secondary": "oklch(0.45 0.02 270 / 1)",
      "tertiary": "oklch(0.60 0.02 270 / 1)",
      "inverse": "oklch(0.98 0.01 270 / 1)",
      "disabled": "oklch(0.70 0.01 270 / 0.5)"
    },
    "border": {
      "subtle": "oklch(0.90 0.01 270 / 1)",
      "default": "oklch(0.80 0.02 270 / 1)",
      "strong": "oklch(0.60 0.05 270 / 1)"
    }
  },
  "typography": {
    "font_family": {
      "heading": "Inter, system-ui, -apple-system, sans-serif",
      "body": "Inter, system-ui, -apple-system, sans-serif",
      "mono": "Fira Code, Consolas, monospace"
    },
    "font_size": {
      "xs": "0.75rem",
      "sm": "0.875rem",
      "base": "1rem",
      "lg": "1.125rem",
      "xl": "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
      "5xl": "3rem"
    },
    "line_height": {
      "tight": "1.25",
      "normal": "1.5",
      "relaxed": "1.75"
    },
    "font_weight": {
      "light": 300,
      "normal": 400,
      "medium": 500,
      "semibold": 600,
      "bold": 700
    }
  },
  "spacing": {
    "0": "0",
    "1": "0.25rem",
    "2": "0.5rem",
    "3": "0.75rem",
    "4": "1rem",
    "5": "1.25rem",
    "6": "1.5rem",
    "8": "2rem",
    "10": "2.5rem",
    "12": "3rem",
    "16": "4rem",
    "20": "5rem",
    "24": "6rem"
  },
  "border_radius": {
    "none": "0",
    "sm": "0.25rem",
    "md": "0.5rem",
    "lg": "0.75rem",
    "xl": "1rem",
    "2xl": "1.5rem",
    "full": "9999px"
  },
  "shadow": {
    "none": "none",
    "sm": "0 1px 2px oklch(0.00 0.00 0 / 0.05)",
    "md": "0 4px 6px oklch(0.00 0.00 0 / 0.07), 0 2px 4px oklch(0.00 0.00 0 / 0.06)",
    "lg": "0 10px 15px oklch(0.00 0.00 0 / 0.1), 0 4px 6px oklch(0.00 0.00 0 / 0.05)",
    "xl": "0 20px 25px oklch(0.00 0.00 0 / 0.15), 0 10px 10px oklch(0.00 0.00 0 / 0.04)",
    "2xl": "0 25px 50px oklch(0.00 0.00 0 / 0.25)"
  },
  "breakpoint": {
    "sm": "640px",
    "md": "768px",
    "lg": "1024px",
    "xl": "1280px",
    "2xl": "1536px"
  },
  "accessibility": {
    "contrast_ratios": {
      "text_primary_on_background": {
        "background": "oklch(0.98 0.01 270 / 1)",
        "foreground": "oklch(0.20 0.02 270 / 1)",
        "ratio": 14.2,
        "wcag_aa_pass": true,
        "wcag_aaa_pass": true
      },
      "brand_primary_on_background": {
        "background": "oklch(0.98 0.01 270 / 1)",
        "foreground": "oklch(0.45 0.20 270 / 1)",
        "ratio": 6.8,
        "wcag_aa_pass": true,
        "wcag_aaa_pass": false
      }
    }
  }
}
```

## CSS Custom Properties Generation

Design tokens should be converted to CSS custom properties for use in generated UI:

```css
:root {
  /* Brand Colors */
  --color-brand-primary: oklch(0.45 0.20 270 / 1);
  --color-brand-secondary: oklch(0.60 0.15 200 / 1);
  --color-brand-accent: oklch(0.65 0.18 30 / 1);

  /* Surface Colors */
  --color-surface-background: oklch(0.98 0.01 270 / 1);
  --color-surface-elevated: oklch(1.00 0.00 0 / 1);
  --color-surface-sunken: oklch(0.95 0.02 270 / 1);

  /* Semantic Colors */
  --color-semantic-success: oklch(0.55 0.15 150 / 1);
  --color-semantic-warning: oklch(0.70 0.18 60 / 1);
  --color-semantic-error: oklch(0.50 0.20 20 / 1);
  --color-semantic-info: oklch(0.60 0.15 240 / 1);

  /* Text Colors */
  --color-text-primary: oklch(0.20 0.02 270 / 1);
  --color-text-secondary: oklch(0.45 0.02 270 / 1);
  --color-text-tertiary: oklch(0.60 0.02 270 / 1);

  /* Typography */
  --font-family-heading: Inter, system-ui, sans-serif;
  --font-family-body: Inter, system-ui, sans-serif;
  --font-family-mono: Fira Code, Consolas, monospace;

  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;
  --font-size-4xl: 2.25rem;

  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;

  /* Spacing */
  --spacing-0: 0;
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;
  --spacing-12: 3rem;
  --spacing-16: 4rem;

  /* Border Radius */
  --border-radius-none: 0;
  --border-radius-sm: 0.25rem;
  --border-radius-md: 0.5rem;
  --border-radius-lg: 0.75rem;
  --border-radius-xl: 1rem;
  --border-radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px oklch(0.00 0.00 0 / 0.05);
  --shadow-md: 0 4px 6px oklch(0.00 0.00 0 / 0.07), 0 2px 4px oklch(0.00 0.00 0 / 0.06);
  --shadow-lg: 0 10px 15px oklch(0.00 0.00 0 / 0.1), 0 4px 6px oklch(0.00 0.00 0 / 0.05);
}
```

## Tailwind Configuration Generation

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'oklch(0.45 0.20 270 / <alpha-value>)',
          secondary: 'oklch(0.60 0.15 200 / <alpha-value>)',
          accent: 'oklch(0.65 0.18 30 / <alpha-value>)'
        },
        surface: {
          background: 'oklch(0.98 0.01 270 / <alpha-value>)',
          elevated: 'oklch(1.00 0.00 0 / <alpha-value>)',
          sunken: 'oklch(0.95 0.02 270 / <alpha-value>)'
        },
        semantic: {
          success: 'oklch(0.55 0.15 150 / <alpha-value>)',
          warning: 'oklch(0.70 0.18 60 / <alpha-value>)',
          error: 'oklch(0.50 0.20 20 / <alpha-value>)',
          info: 'oklch(0.60 0.15 240 / <alpha-value>)'
        }
      },
      fontFamily: {
        heading: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'Consolas', 'monospace']
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem'
      },
      spacing: {
        '1': '0.25rem',
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
        '6': '1.5rem',
        '8': '2rem',
        '12': '3rem',
        '16': '4rem'
      },
      borderRadius: {
        'sm': '0.25rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.5rem'
      },
      boxShadow: {
        'sm': '0 1px 2px oklch(0.00 0.00 0 / 0.05)',
        'md': '0 4px 6px oklch(0.00 0.00 0 / 0.07), 0 2px 4px oklch(0.00 0.00 0 / 0.06)',
        'lg': '0 10px 15px oklch(0.00 0.00 0 / 0.1), 0 4px 6px oklch(0.00 0.00 0 / 0.05)'
      }
    }
  }
}
```

## Validation Requirements

### Color Validation
- All colors MUST use OKLCH format
- Alpha channel optional (defaults to 1)
- Lightness: 0-1 (0% to 100%)
- Chroma: 0-0.4 (typical range, can exceed for vibrant colors)
- Hue: 0-360 (degrees)

### Accessibility Validation
- Text on background: minimum 4.5:1 contrast (WCAG AA)
- Large text (18pt+ or 14pt+ bold): minimum 3:1 contrast
- UI components: minimum 3:1 contrast
- Non-text focus indicators: minimum 3:1 contrast

### Consistency Validation
- Spacing scale maintains consistent ratio (e.g., 1.5x or 2x progression)
- Typography scale follows modular scale principles
- Border radius values progress logically
- Shadow layers increase in offset and blur systematically

## Usage in Commands

### style-extract Output
Generates initial `design-tokens.json` from visual analysis

### style-consolidate Output
Finalizes validated `design-tokens.json` with accessibility data

### ui-generate Input
Reads `design-tokens.json` to generate CSS custom properties

### design-update Integration
References `design-tokens.json` path in synthesis-specification.md

## Version History

- **1.0.0**: Initial schema with OKLCH colors, semantic naming, WCAG AA validation
