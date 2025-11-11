---
name: workflow:ui-design:import-from-code
description: Import design system from code files (CSS/JS/HTML/SCSS) with automatic file discovery and parallel agent analysis
argument-hint: "[--design-id <id>] [--session <id>] [--source <path>]"
allowed-tools: Read,Write,Bash,Glob,Grep,Task,TodoWrite
auto-continue: true
---

# UI Design: Import from Code

## Overview

Extract design system tokens from source code files (CSS/SCSS/JS/TS/HTML) using parallel agent analysis. Each agent can reference any file type for cross-source token extraction, and directly generates completeness reports with findings and gaps.

**Key Characteristics**:
- Executes parallel agent analysis (3 agents: Style, Animation, Layout)
- Each agent can read ALL file types (CSS/SCSS/JS/TS/HTML) for cross-reference
- Direct completeness reporting without synthesis phase
- Graceful failure handling with detailed missing content analysis
- Returns concrete analysis results with recommendations

## Core Functionality

- **File Discovery**: Auto-discover or target specific CSS/SCSS/JS/HTML files
- **Parallel Analysis**: 3 agents extract tokens simultaneously with cross-file-type support
- **Completeness Reporting**: Each agent reports found tokens, missing content, and recommendations
- **Cross-Source Extraction**: Agents can reference any file type (e.g., Style agent can read JS theme configs)

## Usage

### Command Syntax

```bash
/workflow:ui-design:import-from-code [FLAGS]

# Flags
--design-id <id>        Design run ID to import into (must exist)
--session <id>          Session ID (uses latest design run in session)
--source <path>         Source code directory to analyze (required)
```

**Note**: All file discovery is automatic. The command will scan the source directory and find all relevant style files (CSS, SCSS, JS, HTML) automatically.

### Usage Examples

```bash
# Basic usage - auto-discover all style files
/workflow:ui-design:import-from-code --design-id design-run-20250109-12345 --source ./src

# With session ID (uses latest design run in session)
/workflow:ui-design:import-from-code --session WFS-20250109-12345 --source ./src

# Root directory analysis
/workflow:ui-design:import-from-code --design-id design-run-20250109-12345 --source ./
```

---

## Execution Process

### Step 1: Setup & File Discovery

**Purpose**: Initialize session, discover and categorize code files

**Operations**:

```bash
# 1. Determine base path with priority: --design-id > --session > error
if [ -n "$DESIGN_ID" ]; then
  # Exact match by design ID
  relative_path=$(find .workflow -name "${DESIGN_ID}" -type d -print -quit)
  if [ -z "$relative_path" ]; then
    echo "ERROR: Design run not found: $DESIGN_ID"
    echo "HINT: Run '/workflow:ui-design:list' to see available design runs"
    exit 1
  fi
elif [ -n "$SESSION_ID" ]; then
  # Latest in session
  relative_path=$(find .workflow/WFS-$SESSION_ID -name "design-run-*" -type d -printf "%T@ %p\n" 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2)
  if [ -z "$relative_path" ]; then
    echo "ERROR: No design run found in session: $SESSION_ID"
    echo "HINT: Create a design run first or provide --design-id"
    exit 1
  fi
else
  echo "ERROR: Must provide --design-id or --session parameter"
  exit 1
fi

base_path=$(cd "$relative_path" && pwd)
design_id=$(basename "$base_path")

# 2. Initialize directories
source="${source:-.}"
intermediates_dir="${base_path}/.intermediates/import-analysis"
mkdir -p "$intermediates_dir"

echo "[Phase 0] File Discovery Started"
echo "  Design ID: $design_id"
echo "  Source: $source"
echo "  Output: $base_path"
```

<!-- TodoWrite: Initialize todo list -->

**TodoWrite**:
```json
[
  {"content": "Phase 0: 发现和分类代码文件", "status": "in_progress", "activeForm": "发现代码文件"},
  {"content": "Phase 1: 并行Agent分析并生成completeness-report.json", "status": "pending", "activeForm": "生成design system"}
]
```

**File Discovery Behavior**:

- **Automatic discovery**: Intelligently scans source directory for all style-related files
- **Supported file types**: CSS, SCSS, JavaScript, TypeScript, HTML
- **Smart filtering**: Finds theme-related JS/TS files (e.g., tailwind.config.js, theme.js, styled-components)
- **Exclusions**: Automatically excludes `node_modules/`, `dist/`, `.git/`, and build directories
- **Output**: Categorized file lists saved to `.intermediates/import-analysis/`
  - `css-files.txt` - CSS and SCSS files
  - `js-files.txt` - JavaScript and TypeScript files with theme/style content
  - `html-files.txt` - HTML files

<!-- TodoWrite: Mark Phase 0 complete, start Phase 1 -->

**TodoWrite**:
```json
[
  {"content": "Phase 0: 发现和分类代码文件", "status": "completed", "activeForm": "发现代码文件"},
  {"content": "Phase 1: 并行Agent分析并生成completeness-report.json", "status": "in_progress", "activeForm": "生成design system"}
]
```

---

### Step 2: Parallel Agent Analysis

**Purpose**: Three agents analyze all file types in parallel, each producing completeness-report.json

**Operations**:
- **Style Agent**: Extracts visual tokens (colors, typography, spacing) from ALL files (CSS/SCSS/JS/HTML)
- **Animation Agent**: Extracts animations/transitions from ALL files
- **Layout Agent**: Extracts layout patterns/component structures from ALL files

**Validation**:
- Each agent can reference any file type (not restricted to single type)
- Direct output: Each agent generates completeness-report.json with findings + missing content
- No synthesis needed: Agents produce final output directly

```bash
echo "[Phase 1] Starting parallel agent analysis (3 agents)"
```

#### Style Agent Task (style-completeness-report.json)

**Agent Task**:

```javascript
Task(ui-design-agent): `
  [STYLE_TOKENS_EXTRACTION]
  Extract visual design tokens (colors, typography, spacing, shadows, borders) from ALL file types

  MODE: style-extraction | SOURCE: ${source} | BASE_PATH: ${base_path}

  ## Input Files (Can reference ANY file type)

  **CSS/SCSS files (${css_count})**:
  $(cat "${intermediates_dir}/css-files.txt" 2>/dev/null | head -20)

  **JavaScript/TypeScript files (${js_count})**:
  $(cat "${intermediates_dir}/js-files.txt" 2>/dev/null | head -20)

  **HTML files (${html_count})**:
  $(cat "${intermediates_dir}/html-files.txt" 2>/dev/null | head -20)

  ## Extraction Strategy

  **You can read ALL file types** - Cross-reference for better extraction:
  1. **CSS/SCSS**: Primary source for colors, typography, spacing, shadows, borders
  2. **JavaScript/TypeScript**: Theme objects (styled-components, Tailwind config, CSS-in-JS tokens)
  3. **HTML**: Inline styles, class usage patterns, component examples

  **Smart inference** - Fill gaps using cross-source data:
  - Missing CSS colors? Check JS theme objects
  - Missing spacing scale? Infer from existing values in any file type
  - Missing typography? Check font-family usage in CSS + HTML + JS configs

  ## Output Requirements

  Generate 2 files in ${base_path}/style-extraction/style-1/:
  1. design-tokens.json (production-ready design tokens)
  2. style-guide.md (design philosophy and usage guide)

  ### design-tokens.json Structure:
  {
    "colors": {
      "brand": {
        "primary": {"value": "#0066cc", "source": "file.css:23"},
        "secondary": {"value": "#6c757d", "source": "file.css:24"}
      },
      "surface": {
        "background": {"value": "#ffffff", "source": "file.css:10"},
        "card": {"value": "#f8f9fa", "source": "file.css:11"}
      },
      "semantic": {
        "success": {"value": "#28a745", "source": "file.css:30"},
        "warning": {"value": "#ffc107", "source": "file.css:31"},
        "error": {"value": "#dc3545", "source": "file.css:32"}
      },
      "text": {
        "primary": {"value": "#212529", "source": "file.css:15"},
        "secondary": {"value": "#6c757d", "source": "file.css:16"}
      },
      "border": {
        "default": {"value": "#dee2e6", "source": "file.css:20"}
      }
    },
    "typography": {
      "font_family": {
        "base": {"value": "system-ui, sans-serif", "source": "theme.js:12"},
        "heading": {"value": "Georgia, serif", "source": "theme.js:13"}
      },
      "font_size": {
        "xs": {"value": "0.75rem", "source": "styles.css:5"},
        "sm": {"value": "0.875rem", "source": "styles.css:6"},
        "base": {"value": "1rem", "source": "styles.css:7"},
        "lg": {"value": "1.125rem", "source": "styles.css:8"},
        "xl": {"value": "1.25rem", "source": "styles.css:9"}
      },
      "font_weight": {
        "normal": {"value": "400", "source": "styles.css:12"},
        "medium": {"value": "500", "source": "styles.css:13"},
        "bold": {"value": "700", "source": "styles.css:14"}
      },
      "line_height": {
        "tight": {"value": "1.25", "source": "styles.css:18"},
        "normal": {"value": "1.5", "source": "styles.css:19"},
        "relaxed": {"value": "1.75", "source": "styles.css:20"}
      },
      "letter_spacing": {
        "tight": {"value": "-0.025em", "source": "styles.css:24"},
        "normal": {"value": "0", "source": "styles.css:25"},
        "wide": {"value": "0.025em", "source": "styles.css:26"}
      }
    },
    "spacing": {
      "0": {"value": "0", "source": "styles.css:30"},
      "1": {"value": "0.25rem", "source": "styles.css:31"},
      "2": {"value": "0.5rem", "source": "styles.css:32"},
      "3": {"value": "0.75rem", "source": "styles.css:33"},
      "4": {"value": "1rem", "source": "styles.css:34"},
      "6": {"value": "1.5rem", "source": "styles.css:35"},
      "8": {"value": "2rem", "source": "styles.css:36"},
      "12": {"value": "3rem", "source": "styles.css:37"}
    },
    "opacity": {
      "0": {"value": "0", "source": "styles.css:40"},
      "50": {"value": "0.5", "source": "styles.css:41"},
      "100": {"value": "1", "source": "styles.css:42"}
    },
    "border_radius": {
      "none": {"value": "0", "source": "styles.css:45"},
      "sm": {"value": "0.125rem", "source": "styles.css:46"},
      "base": {"value": "0.25rem", "source": "styles.css:47"},
      "lg": {"value": "0.5rem", "source": "styles.css:48"},
      "full": {"value": "9999px", "source": "styles.css:49"}
    },
    "shadows": {
      "sm": {"value": "0 1px 2px rgba(0,0,0,0.05)", "source": "theme.css:45"},
      "base": {"value": "0 1px 3px rgba(0,0,0,0.1)", "source": "theme.css:46"},
      "md": {"value": "0 4px 6px rgba(0,0,0,0.1)", "source": "theme.css:47"},
      "lg": {"value": "0 10px 15px rgba(0,0,0,0.1)", "source": "theme.css:48"}
    },
    "breakpoints": {
      "sm": {"value": "640px", "source": "media.scss:3"},
      "md": {"value": "768px", "source": "media.scss:4"},
      "lg": {"value": "1024px", "source": "media.scss:5"},
      "xl": {"value": "1280px", "source": "media.scss:6"}
    },
    "_metadata": {
      "extraction_source": "code_import",
      "files_analyzed": {
        "css": ["list of CSS/SCSS files read"],
        "js": ["list of JS/TS files read"],
        "html": ["list of HTML files read"]
      },
      "completeness": {
        "colors": "complete | partial | minimal",
        "typography": "complete | partial | minimal",
        "spacing": "complete | partial | minimal",
        "missing_categories": ["accent", "warning"],
        "recommendations": [
          "Define accent color for interactive elements",
          "Add semantic colors (warning, error, success)"
        ]
      }
    }
  }

  ### style-guide.md Structure:
 
  # Design System Style Guide

  ## Overview
  Extracted from code files: [list of source files]

  ## Colors
  - **Brand**: Primary, Secondary
  - **Surface**: Background, Card
  - **Semantic**: Success, Warning, Error
  - **Text**: Primary, Secondary
  - **Border**: Default

  ## Typography
  - **Font Families**: Base (system-ui), Heading (Georgia)
  - **Font Sizes**: xs to xl (0.75rem - 1.25rem)
  - **Font Weights**: Normal (400), Medium (500), Bold (700)

  ## Spacing
  System: 8px-grid (0, 0.25rem, 0.5rem, ..., 3rem)

  ## Missing Elements
  - Accent colors for interactive elements
  - Extended shadow scale

  ## Usage
  All tokens are production-ready and can be used with CSS variables.
  

  ## Completeness Criteria
  - **colors**: ≥5 categories (brand, semantic, surface, text, border), ≥10 tokens
  - **typography**: ≥3 font families, ≥8 sizes, ≥5 weights
  - **spacing**: ≥8 values in consistent system
  - **shadows**: ≥3 elevation levels
  - **borders**: ≥3 radius values, ≥2 widths

  ## Critical Requirements
  - ✅ Can read ANY file type (CSS/SCSS/JS/TS/HTML) - not restricted to CSS only
  - ✅ Use Read() tool for each file you want to analyze (files are in SOURCE: ${source})
  - ✅ Cross-reference between file types for better extraction
  - ✅ Extract all visual token types systematically
  - ✅ Create style-extraction/style-1/ directory first: Bash(mkdir -p "${base_path}/style-extraction/style-1")
  - ✅ Use Write() to save both files:
    - ${base_path}/style-extraction/style-1/design-tokens.json
    - ${base_path}/style-extraction/style-1/style-guide.md
  - ✅ Include _metadata.completeness field to track missing content
  - ❌ NO external research or MCP calls
`
```

#### Animation Agent Task

**Agent Task**:

```javascript
Task(ui-design-agent): `
  [ANIMATION_TOKENS_EXTRACTION]
  Extract animation/transition tokens from ALL file types

  MODE: animation-extraction | SOURCE: ${source} | BASE_PATH: ${base_path}

  ## Input Files (Can reference ANY file type)

  **CSS/SCSS files (${css_count})**:
  $(cat "${intermediates_dir}/css-files.txt" 2>/dev/null | head -20)

  **JavaScript/TypeScript files (${js_count})**:
  $(cat "${intermediates_dir}/js-files.txt" 2>/dev/null | head -20)

  **HTML files (${html_count})**:
  $(cat "${intermediates_dir}/html-files.txt" 2>/dev/null | head -20)

  ## Extraction Strategy

  **You can read ALL file types** - Find animations anywhere:
  1. **CSS/SCSS**: @keyframes, transition properties, animation properties
  2. **JavaScript/TypeScript**: Animation configs (Framer Motion, GSAP, CSS-in-JS animations)
  3. **HTML**: Inline animation styles, data-animation attributes

  **Cross-reference**:
  - CSS animations referenced in JS configs
  - JS animation libraries with CSS class triggers
  - HTML elements with animation classes/attributes

  ## Output Requirements

  Generate 2 files in ${base_path}/animation-extraction/:
  1. animation-tokens.json (production-ready animation tokens)
  2. animation-guide.md (animation usage guide)

  ### animation-tokens.json Structure:
  {
    "duration": {
      "instant": {"value": "0ms", "source": "animations.css:10"},
      "fast": {"value": "150ms", "source": "animations.css:12"},
      "base": {"value": "250ms", "source": "animations.css:13"},
      "slow": {"value": "500ms", "source": "animations.css:14"}
    },
    "easing": {
      "linear": {"value": "linear", "source": "animations.css:20"},
      "ease-in": {"value": "cubic-bezier(0.4, 0, 1, 1)", "source": "theme.js:45"},
      "ease-out": {"value": "cubic-bezier(0, 0, 0.2, 1)", "source": "theme.js:46"},
      "ease-in-out": {"value": "cubic-bezier(0.4, 0, 0.2, 1)", "source": "theme.js:47"}
    },
    "transitions": {
      "color": {
        "property": "color",
        "duration": "var(--duration-fast)",
        "easing": "var(--ease-out)",
        "source": "transitions.css:30"
      },
      "transform": {
        "property": "transform",
        "duration": "var(--duration-base)",
        "easing": "var(--ease-in-out)",
        "source": "transitions.css:35"
      },
      "opacity": {
        "property": "opacity",
        "duration": "var(--duration-fast)",
        "easing": "var(--ease-out)",
        "source": "transitions.css:40"
      }
    },
    "keyframes": {
      "fadeIn": {
        "name": "fadeIn",
        "keyframes": {
          "0%": {"opacity": "0"},
          "100%": {"opacity": "1"}
        },
        "source": "styles.css:67"
      },
      "slideInUp": {
        "name": "slideInUp",
        "keyframes": {
          "0%": {"transform": "translateY(20px)", "opacity": "0"},
          "100%": {"transform": "translateY(0)", "opacity": "1"}
        },
        "source": "styles.css:75"
      }
    },
    "interactions": {
      "button-hover": {
        "trigger": "hover",
        "properties": ["background-color", "transform"],
        "duration": "var(--duration-fast)",
        "easing": "var(--ease-out)",
        "source": "button.css:45"
      }
    },
    "_metadata": {
      "extraction_source": "code_import",
      "framework_detected": "css-animations | framer-motion | gsap | none",
      "files_analyzed": {
        "css": ["list of CSS/SCSS files read"],
        "js": ["list of JS/TS files read"],
        "html": ["list of HTML files read"]
      },
      "completeness": {
        "durations": "complete | partial | minimal",
        "easing": "complete | partial | minimal",
        "keyframes": "complete | partial | minimal",
        "missing_items": ["bounce easing", "slide animations"],
        "recommendations": [
          "Add slow duration for complex animations",
          "Define spring/bounce easing for interactive feedback"
        ]
      }
    }
  }

  ### animation-guide.md Structure:
  
  # Animation System Guide

  ## Overview
  Extracted from code files: [list of source files]
  Framework detected: [css-animations | framer-motion | gsap | none]

  ## Durations
  - **Instant**: 0ms
  - **Fast**: 150ms (UI feedback)
  - **Base**: 250ms (standard transitions)
  - **Slow**: 500ms (complex animations)

  ## Easing Functions
  - **Linear**: Constant speed
  - **Ease-out**: Fast start, slow end (entering elements)
  - **Ease-in-out**: Smooth acceleration and deceleration

  ## Keyframe Animations
  - **fadeIn**: Opacity 0 → 1
  - **slideInUp**: Slide from bottom with fade

  ## Missing Elements
  - Bounce/spring easing for playful interactions
  - Slide-out animations

  ## Usage
  All animation tokens use CSS variables and can be referenced in transitions.


  ## Completeness Criteria
  - **durations**: ≥3 (fast, medium, slow)
  - **easing**: ≥3 functions (ease-in, ease-out, ease-in-out)
  - **keyframes**: ≥3 animation types (fade, scale, slide)
  - **transitions**: ≥5 properties defined

  ## Critical Requirements
  - ✅ Can read ANY file type (CSS/SCSS/JS/TS/HTML)
  - ✅ Use Read() tool for each file you want to analyze (files are in SOURCE: ${source})
  - ✅ Detect animation framework if used
  - ✅ Extract all animation-related tokens
  - ✅ Create animation-extraction/ directory first: Bash(mkdir -p "${base_path}/animation-extraction")
  - ✅ Use Write() to save both files:
    - ${base_path}/animation-extraction/animation-tokens.json
    - ${base_path}/animation-extraction/animation-guide.md
  - ✅ Include _metadata.completeness field to track missing content
  - ❌ NO external research or MCP calls
`
```

#### Layout Agent Task

**Agent Task**:

```javascript
Task(ui-design-agent): `
  [LAYOUT_PATTERNS_EXTRACTION]
  Extract layout patterns and component structures from ALL file types

  MODE: layout-extraction | SOURCE: ${source} | BASE_PATH: ${base_path}

  ## Input Files (Can reference ANY file type)

  **CSS/SCSS files (${css_count})**:
  $(cat "${intermediates_dir}/css-files.txt" 2>/dev/null | head -20)

  **JavaScript/TypeScript files (${js_count})**:
  $(cat "${intermediates_dir}/js-files.txt" 2>/dev/null | head -20)

  **HTML files (${html_count})**:
  $(cat "${intermediates_dir}/html-files.txt" 2>/dev/null | head -20)

  ## Extraction Strategy

  **You can read ALL file types** - Find layout patterns anywhere:
  1. **CSS/SCSS**: Grid systems, flexbox utilities, layout classes, media queries
  2. **JavaScript/TypeScript**: Layout components (React/Vue), grid configurations, responsive logic
  3. **HTML**: Layout structures, semantic patterns, component hierarchies

  **Cross-reference**:
  - HTML structure + CSS classes → layout system
  - JS components + CSS styles → component patterns
  - Responsive classes across all file types

  ## Output Requirements

  Generate 1 file: ${base_path}/layout-extraction/layout-templates.json

  ### layout-templates.json Structure:
  {
    "extraction_metadata": {
      "extraction_source": "code_import",
      "analysis_time": "ISO8601 timestamp",
      "files_analyzed": {
        "css": ["list of CSS/SCSS files read"],
        "js": ["list of JS/TS files read"],
        "html": ["list of HTML files read"]
      },
      "naming_convention": "BEM | SMACSS | utility-first | css-modules | custom",
      "layout_system": {
        "type": "12-column | flexbox | css-grid | custom",
        "confidence": "high | medium | low",
        "container_classes": ["container", "wrapper"],
        "row_classes": ["row"],
        "column_classes": ["col-1", "col-md-6"],
        "source_files": ["grid.css", "Layout.jsx"]
      },
      "responsive": {
        "breakpoint_prefixes": ["sm:", "md:", "lg:", "xl:"],
        "mobile_first": true,
        "breakpoints": {
          "sm": "640px",
          "md": "768px",
          "lg": "1024px",
          "xl": "1280px"
        },
        "source": "responsive.scss:5"
      },
      "completeness": {
        "layout_system": "complete | partial | minimal",
        "components": "complete | partial | minimal",
        "responsive": "complete | partial | minimal",
        "missing_items": ["gap utilities", "modal", "dropdown"],
        "recommendations": [
          "Add gap utilities for consistent spacing in grid layouts",
          "Define modal/dropdown/tabs component patterns"
        ]
      }
    },
    "layout_templates": [
      {
        "target": "button",
        "variant_id": "layout-1",
        "device_type": "responsive",
        "component_type": "component",
        "dom_structure": {
          "tag": "button",
          "classes": ["btn", "btn-primary"],
          "children": [
            {"tag": "span", "classes": ["btn-text"], "content": "{{text}}"}
          ],
          "variants": {
            "primary": {"classes": ["btn", "btn-primary"]},
            "secondary": {"classes": ["btn", "btn-secondary"]}
          },
          "sizes": {
            "sm": {"classes": ["btn-sm"]},
            "base": {"classes": []},
            "lg": {"classes": ["btn-lg"]}
          },
          "states": ["hover", "active", "disabled"]
        },
        "css_layout_rules": "display: inline-flex; align-items: center; justify-content: center; padding: var(--spacing-2) var(--spacing-4); border-radius: var(--radius-base);",
        "source": "button.css:12"
      },
      {
        "target": "card",
        "variant_id": "layout-1",
        "device_type": "responsive",
        "component_type": "component",
        "dom_structure": {
          "tag": "div",
          "classes": ["card"],
          "children": [
            {"tag": "div", "classes": ["card-header"], "content": "{{title}}"},
            {"tag": "div", "classes": ["card-body"], "content": "{{content}}"},
            {"tag": "div", "classes": ["card-footer"], "content": "{{footer}}"}
          ]
        },
        "css_layout_rules": "display: flex; flex-direction: column; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--spacing-4); background: var(--color-surface-card);",
        "source": "card.css:25"
      }
    ]
  }

  ## Completeness Criteria
  - **layout_system**: Clear grid/flexbox system identified
  - **components**: ≥5 component patterns (button, card, input, modal, dropdown)
  - **responsive**: ≥3 breakpoints, clear mobile-first strategy
  - **naming_convention**: Consistent pattern identified

  ## Critical Requirements
  - ✅ Can read ANY file type (CSS/SCSS/JS/TS/HTML)
  - ✅ Use Read() tool for each file you want to analyze (files are in SOURCE: ${source})
  - ✅ Identify naming conventions and layout systems
  - ✅ Extract component patterns with variants and states
  - ✅ Create layout-extraction/ directory first: Bash(mkdir -p "${base_path}/layout-extraction")
  - ✅ Use Write() to save: ${base_path}/layout-extraction/layout-templates.json
  - ✅ Include extraction_metadata.completeness field to track missing content
  - ❌ NO external research or MCP calls
`
```

**Wait for All Agents**:

```bash
# Note: Agents run in parallel and write separate completeness reports
# Each agent generates its own completeness-report.json directly
# No synthesis phase needed
echo "[Phase 1] Parallel agent analysis complete"
```

<!-- TodoWrite: Mark all complete -->

**TodoWrite**:
```json
[
  {"content": "Phase 0: 发现和分类代码文件", "status": "completed", "activeForm": "发现代码文件"},
  {"content": "Phase 1: 并行Agent分析并生成completeness-report.json", "status": "completed", "activeForm": "生成design system"}
]
```

---

## Output Files

### Generated Files

**Location**: `${base_path}/`

**Directory Structure**:
```
${base_path}/
├── style-extraction/
│   └── style-1/
│       ├── design-tokens.json       # Production-ready design tokens
│       └── style-guide.md           # Design philosophy and usage
├── animation-extraction/
│   ├── animation-tokens.json        # Animation/transition tokens
│   └── animation-guide.md           # Animation usage guide
├── layout-extraction/
│   └── layout-templates.json        # Layout patterns and component structures
└── .intermediates/
    └── import-analysis/
        ├── css-files.txt            # Discovered CSS/SCSS files
        ├── js-files.txt             # Discovered JS/TS files
        └── html-files.txt           # Discovered HTML files
```

**Files**:
1. **style-extraction/style-1/design-tokens.json**
   - Production-ready design tokens
   - Categories: colors, typography, spacing, opacity, border_radius, shadows, breakpoints
   - Metadata: extraction_source, files_analyzed, completeness assessment

2. **style-extraction/style-1/style-guide.md**
   - Design system overview
   - Token categories and usage
   - Missing elements and recommendations

3. **animation-extraction/animation-tokens.json**
   - Animation tokens: duration, easing, transitions, keyframes, interactions
   - Framework detection: css-animations, framer-motion, gsap, etc.
   - Metadata: extraction_source, completeness assessment

4. **animation-extraction/animation-guide.md**
   - Animation system overview
   - Usage guidelines and examples

5. **layout-extraction/layout-templates.json**
   - Layout templates for each discovered component
   - Extraction metadata: naming_convention, layout_system, responsive strategy
   - Component patterns with DOM structure and CSS rules

**Intermediate Files**: `.intermediates/import-analysis/`
- `css-files.txt` - Discovered CSS/SCSS files
- `js-files.txt` - Discovered JS/TS files
- `html-files.txt` - Discovered HTML files

---

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| No files discovered | Wrong --source path or no style files in directory | Verify --source parameter points to correct directory with style files |
| Agent reports "failed" status | No tokens found in any file | Review file content, check if files contain design tokens |
| Empty completeness reports | Files exist but contain no extractable tokens | Manually verify token definitions in source files |
| Missing file type | File extensions not recognized | Check that files use standard extensions (.css, .scss, .js, .ts, .html) |

---

## Best Practices

1. **Point to the right directory**: Use `--source` to specify the directory containing your style files (e.g., `./src`, `./app`, `./styles`)
2. **Let automatic discovery work**: The command will find all relevant files - no need to specify patterns
3. **Specify target design run**: Use `--design-id` for existing design run or `--session` to use session's latest design run (one of these is required)
4. **Cross-reference agent reports**: Compare all three completeness reports (style, animation, layout) to identify gaps
5. **Review missing content**: Check `_metadata.completeness` field in reports for actionable improvements
6. **Verify file discovery**: Check `${base_path}/.intermediates/import-analysis/*-files.txt` if agents report no data
