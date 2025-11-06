---
name: workflow:ui-design:import-from-code
description: Import design system from code files (CSS/JS/HTML/SCSS) using parallel agent analysis with final synthesis
argument-hint: "[--base-path <path>] [--css \"<glob>\"] [--js \"<glob>\"] [--scss \"<glob>\"] [--html \"<glob>\"] [--style-files \"<glob>\"] [--session <id>]"
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
--base-path <path>      Base directory for analysis (default: current directory)
--css "<glob>"          CSS file glob pattern (e.g., "theme/*.css")
--scss "<glob>"         SCSS file glob pattern (e.g., "styles/*.scss")
--js "<glob>"           JavaScript file glob pattern (e.g., "theme/*.js")
--html "<glob>"         HTML file glob pattern (e.g., "pages/*.html")
--style-files "<glob>"  Universal style file glob (applies to CSS/SCSS/JS)
--session <id>          Session identifier for workflow tracking
```

### Usage Examples

```bash
# Basic usage - auto-discover all files
/workflow:ui-design:import-from-code --base-path ./

# Target specific directories
/workflow:ui-design:import-from-code --base-path ./src --css "theme/*.css" --js "theme/*.js"

# Tailwind config only
/workflow:ui-design:import-from-code --js "tailwind.config.js"

# CSS framework import
/workflow:ui-design:import-from-code --css "styles/**/*.scss" --html "components/**/*.html"

# Universal style files
/workflow:ui-design:import-from-code --style-files "**/theme.*"
```

---

## Execution Process

### Step 1: Setup & File Discovery

**Purpose**: Initialize session, discover and categorize code files

**Operations**:

```bash
# 1. Initialize directories
base_path="${base_path:-.}"
intermediates_dir="${base_path}/.intermediates/import-analysis"
mkdir -p "$intermediates_dir"

echo "[Phase 0] File Discovery Started"
```

<!-- TodoWrite: Initialize todo list -->

**TodoWrite**:
```json
[
  {"content": "Phase 0: 发现和分类代码文件", "status": "in_progress", "activeForm": "发现代码文件"},
  {"content": "Phase 1: 并行Agent分析并生成completeness-report.json", "status": "pending", "activeForm": "生成design system"}
]
```

**File Discovery Logic**:

```bash
# 2. Discover files by type
cd "$base_path" || exit 1

# CSS files
if [ -n "$css" ]; then
  find . -type f -name "*.css" | grep -E "$css" > "$intermediates_dir/css-files.txt"
elif [ -n "$style_files" ]; then
  find . -type f -name "*.css" | grep -E "$style_files" > "$intermediates_dir/css-files.txt"
else
  find . -type f -name "*.css" -not -path "*/node_modules/*" -not -path "*/dist/*" > "$intermediates_dir/css-files.txt"
fi

# SCSS files
if [ -n "$scss" ]; then
  find . -type f \( -name "*.scss" -o -name "*.sass" \) | grep -E "$scss" > "$intermediates_dir/scss-files.txt"
elif [ -n "$style_files" ]; then
  find . -type f \( -name "*.scss" -o -name "*.sass" \) | grep -E "$style_files" > "$intermediates_dir/scss-files.txt"
else
  find . -type f \( -name "*.scss" -o -name "*.sass" \) -not -path "*/node_modules/*" -not -path "*/dist/*" > "$intermediates_dir/scss-files.txt"
fi

# JavaScript files (theme/style related)
if [ -n "$js" ]; then
  find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) | grep -E "$js" > "$intermediates_dir/js-files.txt"
elif [ -n "$style_files" ]; then
  find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) | grep -E "$style_files" > "$intermediates_dir/js-files.txt"
else
  # Look for common theme/style file patterns
  find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) -not -path "*/node_modules/*" -not -path "*/dist/*" | \
    grep -iE "(theme|style|color|token|design)" > "$intermediates_dir/js-files.txt" || touch "$intermediates_dir/js-files.txt"
fi

# HTML files
if [ -n "$html" ]; then
  find . -type f \( -name "*.html" -o -name "*.htm" \) | grep -E "$html" > "$intermediates_dir/html-files.txt"
else
  find . -type f \( -name "*.html" -o -name "*.htm" \) -not -path "*/node_modules/*" -not -path "*/dist/*" > "$intermediates_dir/html-files.txt"
fi

# 3. Count discovered files
css_count=$(wc -l < "$intermediates_dir/css-files.txt" 2>/dev/null || echo 0)
scss_count=$(wc -l < "$intermediates_dir/scss-files.txt" 2>/dev/null || echo 0)
js_count=$(wc -l < "$intermediates_dir/js-files.txt" 2>/dev/null || echo 0)
html_count=$(wc -l < "$intermediates_dir/html-files.txt" 2>/dev/null || echo 0)

echo "[Phase 0] Discovered: CSS=$css_count, SCSS=$scss_count, JS=$js_count, HTML=$html_count"
```

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

  MODE: style-extraction | BASE_PATH: ${base_path}

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

  Generate 1 file: ${base_path}/style-completeness-report.json

  ### Structure:
  {
    "agent": "style-agent",
    "status": "complete" | "partial" | "failed",
    "analysis_time": "ISO8601 timestamp",
    "files_analyzed": {
      "css": ["list of CSS/SCSS files read"],
      "js": ["list of JS/TS files read"],
      "html": ["list of HTML files read"]
    },
    "found": {
      "colors": {
        "count": 12,
        "tokens": [
          {"value": "#0066cc", "variable": "--color-primary", "source": "file.css:23", "type": "brand"}
        ],
        "categories": {
          "brand": 3,
          "semantic": 4,
          "surface": 2,
          "text": 2,
          "border": 1
        }
      },
      "typography": {
        "count": 8,
        "font_families": [
          {"value": "system-ui, sans-serif", "variable": "--font-base", "source": "theme.js:12"}
        ],
        "font_sizes": [...],
        "font_weights": [...],
        "line_heights": [...],
        "letter_spacing": [...]
      },
      "spacing": {
        "count": 12,
        "tokens": [
          {"value": "0.25rem", "variable": "--spacing-1", "source": "styles.css:5"}
        ],
        "system_type": "8px-grid | 4px-grid | custom | none"
      },
      "shadows": {
        "count": 4,
        "tokens": [
          {"value": "0 1px 2px rgba(0,0,0,0.05)", "variable": "--shadow-sm", "source": "theme.css:45"}
        ]
      },
      "borders": {
        "radius": [...],
        "width": [...],
        "colors": [...]
      },
      "breakpoints": {
        "count": 5,
        "tokens": [
          {"value": "640px", "variable": "$breakpoint-sm", "source": "media.scss:3"}
        ]
      }
    },
    "missing": {
      "colors": {
        "categories": ["accent", "warning"],
        "reason": "No accent or warning colors found in any file type"
      },
      "typography": {
        "items": ["letter-spacing scale"],
        "reason": "No letter-spacing tokens found"
      },
      "spacing": {
        "items": ["negative spacing"],
        "reason": "No negative spacing tokens found"
      }
    },
    "recommendations": [
      "Define accent color for interactive elements",
      "Add semantic colors (warning, error, success)",
      "Complete letter-spacing scale for typography system"
    ]
  }

  ## Completeness Criteria
  - **colors**: ≥5 categories (brand, semantic, surface, text, border), ≥10 tokens
  - **typography**: ≥3 font families, ≥8 sizes, ≥5 weights
  - **spacing**: ≥8 values in consistent system
  - **shadows**: ≥3 elevation levels
  - **borders**: ≥3 radius values, ≥2 widths

  ## Critical Requirements
  - ✅ Can read ANY file type (CSS/SCSS/JS/TS/HTML) - not restricted to CSS only
  - ✅ Use Read() tool for each file you want to analyze
  - ✅ Cross-reference between file types for better extraction
  - ✅ Extract all visual token types systematically
  - ✅ Report MISSING content with specific reasons
  - ✅ Use Write() immediately to save: ${base_path}/style-completeness-report.json
  - ✅ If no data found, report as "failed" with detailed missing analysis
  - ❌ NO external research or MCP calls
`
```

#### Animation Agent Task (animation-completeness-report.json)

**Agent Task**:

```javascript
Task(ui-design-agent): `
  [ANIMATION_TOKENS_EXTRACTION]
  Extract animation/transition tokens from ALL file types

  MODE: animation-extraction | BASE_PATH: ${base_path}

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

  Generate 1 file: ${base_path}/animation-completeness-report.json

  ### Structure:
  {
    "agent": "animation-agent",
    "status": "complete" | "partial" | "failed",
    "analysis_time": "ISO8601 timestamp",
    "files_analyzed": {
      "css": ["list of CSS/SCSS files read"],
      "js": ["list of JS/TS files read"],
      "html": ["list of HTML files read"]
    },
    "framework_detected": "framer-motion | gsap | css-animations | react-spring | none",
    "found": {
      "durations": {
        "count": 3,
        "tokens": [
          {"value": "150ms", "variable": "--duration-fast", "source": "animations.css:12"}
        ]
      },
      "easing": {
        "count": 4,
        "tokens": [
          {"value": "cubic-bezier(0.4, 0, 0.2, 1)", "variable": "--ease-in-out", "source": "theme.js:45"}
        ]
      },
      "keyframes": {
        "count": 5,
        "animations": [
          {"name": "fadeIn", "keyframes": {...}, "source": "styles.css:67"}
        ]
      },
      "transitions": {
        "count": 8,
        "properties": ["opacity", "transform", "background-color"]
      }
    },
    "missing": {
      "durations": {
        "items": ["slow duration (>500ms)"],
        "reason": "No slow animation durations found"
      },
      "easing": {
        "items": ["bounce easing"],
        "reason": "No bounce or spring easing functions"
      },
      "keyframes": {
        "items": ["slide animations"],
        "reason": "No slide-in/slide-out keyframes found"
      }
    },
    "recommendations": [
      "Add slow duration for complex animations",
      "Define spring/bounce easing for interactive feedback",
      "Create slide animations for drawer/modal transitions"
    ]
  }

  ## Completeness Criteria
  - **durations**: ≥3 (fast, medium, slow)
  - **easing**: ≥3 functions (ease-in, ease-out, ease-in-out)
  - **keyframes**: ≥3 animation types (fade, scale, slide)
  - **transitions**: ≥5 properties defined

  ## Critical Requirements
  - ✅ Can read ANY file type (CSS/SCSS/JS/TS/HTML)
  - ✅ Use Read() tool for each file you want to analyze
  - ✅ Detect animation framework if used
  - ✅ Extract all animation-related tokens
  - ✅ Report MISSING content with specific reasons
  - ✅ Use Write() immediately to save: ${base_path}/animation-completeness-report.json
  - ✅ If no data found, report as "failed" with detailed missing analysis
  - ❌ NO external research or MCP calls
`
```

#### Layout Agent Task (layout-completeness-report.json)

**Agent Task**:

```javascript
Task(ui-design-agent): `
  [LAYOUT_PATTERNS_EXTRACTION]
  Extract layout patterns and component structures from ALL file types

  MODE: layout-extraction | BASE_PATH: ${base_path}

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

  Generate 1 file: ${base_path}/layout-completeness-report.json

  ### Structure:
  {
    "agent": "layout-agent",
    "status": "complete" | "partial" | "failed",
    "analysis_time": "ISO8601 timestamp",
    "files_analyzed": {
      "css": ["list of CSS/SCSS files read"],
      "js": ["list of JS/TS files read"],
      "html": ["list of HTML files read"]
    },
    "naming_convention": "BEM | SMACSS | utility-first | css-modules | custom",
    "found": {
      "layout_system": {
        "type": "12-column | flexbox | css-grid | custom",
        "confidence": "high | medium | low",
        "container_classes": ["container", "wrapper"],
        "row_classes": ["row"],
        "column_classes": ["col-1", "col-md-6"],
        "source_files": ["grid.css", "Layout.jsx"]
      },
      "components": {
        "count": 5,
        "patterns": {
          "button": {
            "base_class": "btn",
            "variants": ["btn-primary", "btn-secondary"],
            "sizes": ["btn-sm", "btn-lg"],
            "states": ["hover", "active", "disabled"],
            "source": "button.css:12"
          },
          "card": {...},
          "input": {...}
        }
      },
      "responsive": {
        "breakpoint_prefixes": ["sm:", "md:", "lg:", "xl:"],
        "mobile_first": true,
        "source": "responsive.scss:5"
      }
    },
    "missing": {
      "layout_system": {
        "items": ["gap utilities"],
        "reason": "No gap/gutter utilities found in grid system"
      },
      "components": {
        "items": ["modal", "dropdown", "tabs"],
        "reason": "Common interactive components not found"
      },
      "responsive": {
        "items": ["container queries"],
        "reason": "Only media queries found, no container queries"
      }
    },
    "recommendations": [
      "Add gap utilities for consistent spacing in grid layouts",
      "Define modal/dropdown/tabs component patterns",
      "Consider container queries for component-level responsiveness"
    ]
  }

  ## Completeness Criteria
  - **layout_system**: Clear grid/flexbox system identified
  - **components**: ≥5 component patterns (button, card, input, modal, dropdown)
  - **responsive**: ≥3 breakpoints, clear mobile-first strategy
  - **naming_convention**: Consistent pattern identified

  ## Critical Requirements
  - ✅ Can read ANY file type (CSS/SCSS/JS/TS/HTML)
  - ✅ Use Read() tool for each file you want to analyze
  - ✅ Identify naming conventions and layout systems
  - ✅ Extract component patterns with variants and states
  - ✅ Report MISSING content with specific reasons
  - ✅ Use Write() immediately to save: ${base_path}/layout-completeness-report.json
  - ✅ If no data found, report as "failed" with detailed missing analysis
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

**Files**:
1. **style-completeness-report.json**
   - Style agent analysis results
   - Found tokens: colors, typography, spacing, shadows, borders
   - Missing content: specific gaps with reasons
   - Recommendations: actionable improvement suggestions

2. **animation-completeness-report.json**
   - Animation agent analysis results
   - Found tokens: durations, easing, keyframes, transitions
   - Framework detection: framer-motion, gsap, css-animations, etc.
   - Missing content: animation gaps with reasons

3. **layout-completeness-report.json**
   - Layout agent analysis results
   - Found patterns: layout system, components, responsive design
   - Naming convention: BEM, SMACSS, utility-first, etc.
   - Missing content: layout/component gaps with reasons

**Intermediate Files**: `.intermediates/import-analysis/`
- `css-files.txt` - Discovered CSS/SCSS files
- `js-files.txt` - Discovered JS/TS files
- `html-files.txt` - Discovered HTML files

---

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| No files discovered | Glob patterns too restrictive or wrong base-path | Check glob patterns and base-path, verify file locations |
| Agent reports "failed" status | No tokens found in any file | Review file content, check if files contain design tokens |
| Empty completeness reports | Files exist but contain no extractable tokens | Manually verify token definitions in source files |
| Missing file type | Specific file type not discovered | Use explicit glob flags (--css, --js, --html, --scss) |

---

## Best Practices

1. **Use auto-discovery for full projects**: Omit glob flags to discover all files automatically
2. **Target specific directories for speed**: Use `--base-path` + specific globs for focused analysis
3. **Cross-reference agent reports**: Compare all three completeness reports to identify gaps
4. **Review missing content**: Check `missing` field in reports for actionable improvements
5. **Verify file discovery**: Check `.intermediates/import-analysis/*-files.txt` if agents report no data
