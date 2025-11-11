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

# 3. Discover files using script
discovery_file="${intermediates_dir}/discovered-files.json"
Bash(~/.claude/scripts/discover-design-files.sh "$source" "$discovery_file")

echo "  Output: $discovery_file"
```

<!-- TodoWrite: Initialize todo list -->

**TodoWrite**:
```json
[
  {"content": "Phase 0: 发现和分类代码文件", "status": "in_progress", "activeForm": "发现代码文件"},
  {"content": "Phase 1.1: Style Agent - 提取视觉token及代码片段 (design-tokens.json + code_snippets)", "status": "pending", "activeForm": "提取视觉token"},
  {"content": "Phase 1.2: Animation Agent - 提取动画token及代码片段 (animation-tokens.json + code_snippets)", "status": "pending", "activeForm": "提取动画token"},
  {"content": "Phase 1.3: Layout Agent - 提取布局模式及代码片段 (layout-templates.json + code_snippets)", "status": "pending", "activeForm": "提取布局模式"}
]
```

**File Discovery Behavior**:

- **Automatic discovery**: Intelligently scans source directory for all style-related files
- **Supported file types**: CSS, SCSS, JavaScript, TypeScript, HTML
- **Smart filtering**: Finds theme-related JS/TS files (e.g., tailwind.config.js, theme.js, styled-components)
- **Exclusions**: Automatically excludes `node_modules/`, `dist/`, `.git/`, and build directories
- **Output**: Single JSON file `discovered-files.json` in `.intermediates/import-analysis/`
  - Structure: `{ "css": [...], "js": [...], "html": [...], "counts": {...}, "discovery_time": "..." }`
  - Generated via bash commands using `find` + JSON formatting

<!-- TodoWrite: Update Phase 0 → completed, Phase 1.1-1.3 → in_progress (all 3 agents in parallel) -->

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

#### Style Agent Task (design-tokens.json, style-guide.md)

**Agent Task**:

```javascript
Task(ui-design-agent): `
  [STYLE_TOKENS_EXTRACTION]
  Extract visual design tokens from code files using code import extraction pattern.

  MODE: style-extraction | SOURCE: ${source} | BASE_PATH: ${base_path}

  ## Input Files

  **Discovered Files**: ${intermediates_dir}/discovered-files.json
  $(cat "${intermediates_dir}/discovered-files.json" 2>/dev/null | grep -E '(count|files)' | head -30)

  ## Code Import Extraction Strategy

  **Step 1: Load file list**
  - Read(${intermediates_dir}/discovered-files.json)
  - Extract: file_types.css.files, file_types.js.files, file_types.html.files

  **Step 2: Cross-source token extraction**
  - CSS/SCSS: Colors, typography, spacing, shadows, borders
  - JavaScript/TypeScript: Theme configs (Tailwind, styled-components, CSS-in-JS)
  - HTML: Inline styles, usage patterns

  **Step 3: Smart inference for gaps**
  - Infer missing tokens from existing patterns
  - Normalize inconsistent values into systematic scales
  - Fill missing categories from cross-file references

  ## Output Files

  **Target Directory**: ${base_path}/style-extraction/style-1/

  **Files to Generate**:
  1. **design-tokens.json**
     - Follow [DESIGN_SYSTEM_GENERATION_TASK] standard token structure
     - Add "_metadata.extraction_source": "code_import"
     - Add "_metadata.files_analyzed": {css, js, html file lists}
     - Add "_metadata.completeness": {status, missing_categories, recommendations}
     - Add "_metadata.code_snippets": Map of code snippets (see below)
     - Include "source" field for each token (e.g., "file.css:23")

  **Code Snippet Recording**:
  - For each extracted token, record the actual code snippet in `_metadata.code_snippets`
  - Structure:
    ```json
    "code_snippets": {
      "file.css:23": {
        "lines": "23-27",
        "snippet": ":root {\n  --color-primary: oklch(0.5555 0.15 270);\n  /* Primary brand color */\n  --color-primary-hover: oklch(0.6 0.15 270);\n}",
        "context": "css-variable"
      }
    }
    ```
  - Context types: "css-variable" | "css-class" | "js-object" | "js-theme-config" | "inline-style"
  - Record complete code blocks with all dependencies and relevant comments
  - Typical ranges: Simple declarations (1-5 lines), Utility classes (5-15 lines), Complete configs (15-50 lines)
  - Preserve original formatting and indentation

  ## Code Import Specific Requirements
  - ✅ Read discovered-files.json FIRST to get file paths
  - ✅ Track extraction source for each token (file:line)
  - ✅ Record complete code snippets in _metadata.code_snippets (complete blocks with dependencies/comments)
  - ✅ Include completeness assessment in _metadata
  - ✅ Normalize inconsistent values into systematic scales
  - ❌ NO external research or web searches (code-only extraction)
`
```

#### Animation Agent Task (animation-tokens.json, animation-guide.md)

**Agent Task**:

```javascript
Task(ui-design-agent): `
  [ANIMATION_TOKEN_GENERATION_TASK]
  Extract animation tokens from code files using code import extraction pattern.

  MODE: animation-extraction | SOURCE: ${source} | BASE_PATH: ${base_path}

  ## Input Files

  **Discovered Files**: ${intermediates_dir}/discovered-files.json
  $(cat "${intermediates_dir}/discovered-files.json" 2>/dev/null | grep -E '(count|files)' | head -30)

  ## Code Import Extraction Strategy

  **Step 1: Load file list**
  - Read(${intermediates_dir}/discovered-files.json)
  - Extract: file_types.css.files, file_types.js.files, file_types.html.files

  **Step 2: Cross-source animation extraction**
  - CSS/SCSS: @keyframes, transitions, animation properties
  - JavaScript/TypeScript: Animation frameworks (Framer Motion, GSAP), CSS-in-JS
  - HTML: Inline styles, data-animation attributes

  **Step 3: Framework detection & normalization**
  - Detect animation frameworks used (css-animations | framer-motion | gsap | none)
  - Normalize into semantic token system
  - Cross-reference CSS animations with JS configs

  ## Output Files

  **Target Directory**: ${base_path}/animation-extraction/

  **Files to Generate**:
  1. **animation-tokens.json**
     - Follow [ANIMATION_TOKEN_GENERATION_TASK] standard structure
     - Add "_metadata.framework_detected"
     - Add "_metadata.files_analyzed"
     - Add "_metadata.completeness"
     - Add "_metadata.code_snippets": Map of code snippets (same format as Style Agent)
     - Include "source" field for each token

  **Code Snippet Recording**:
  - Record actual animation/transition code in `_metadata.code_snippets`
  - Context types: "css-keyframes" | "css-transition" | "js-animation" | "framer-motion" | "gsap"
  - Record complete blocks: @keyframes animations (10-30 lines), transition configs (5-15 lines), JS animation objects (15-50 lines)
  - Include all animation steps, timing functions, and related comments
  - Preserve original formatting and framework-specific syntax

  ## Code Import Specific Requirements
  - ✅ Read discovered-files.json FIRST to get file paths
  - ✅ Detect animation framework if present
  - ✅ Track extraction source for each token (file:line)
  - ✅ Record complete code snippets in _metadata.code_snippets (complete animation blocks with all steps/timing)
  - ✅ Normalize framework-specific syntax into standard tokens
  - ❌ NO external research or web searches (code-only extraction)
`
```

#### Layout Agent Task (layout-templates.json, layout-guide.md)

**Agent Task**:

```javascript
Task(ui-design-agent): `
  [LAYOUT_TEMPLATE_GENERATION_TASK]
  Extract layout patterns from code files using code import extraction pattern.

  MODE: layout-extraction | SOURCE: ${source} | BASE_PATH: ${base_path}

  ## Input Files

  **Discovered Files**: ${intermediates_dir}/discovered-files.json
  $(cat "${intermediates_dir}/discovered-files.json" 2>/dev/null | grep -E '(count|files)' | head -30)

  ## Code Import Extraction Strategy

  **Step 1: Load file list**
  - Read(${intermediates_dir}/discovered-files.json)
  - Extract: file_types.css.files, file_types.js.files, file_types.html.files

  **Step 2: Cross-source layout extraction**
  - CSS/SCSS: Grid systems, flexbox utilities, layout classes, media queries
  - JavaScript/TypeScript: Layout components (React/Vue), grid configs
  - HTML: Semantic structure, component hierarchies

  **Step 3: System identification**
  - Detect naming convention (BEM | SMACSS | utility-first | css-modules)
  - Identify layout system (12-column | flexbox | css-grid | custom)
  - Extract responsive strategy and breakpoints

  ## Output Files

  **Target Directory**: ${base_path}/layout-extraction/

  **Files to Generate**:

  1. **layout-templates.json**
     - Follow [LAYOUT_TEMPLATE_GENERATION_TASK] standard structure
     - Add "extraction_metadata" section:
       * extraction_source: "code_import"
       * naming_convention: detected convention
       * layout_system: {type, confidence, source_files}
       * responsive: {breakpoints, mobile_first, source}
       * completeness: {status, missing_items, recommendations}
       * code_snippets: Map of code snippets (same format as Style Agent)
     - For each component in "layout_templates":
       * Include "source" field (file:line)
       * dom_structure with semantic HTML5
       * css_layout_rules using var() placeholders

  **Code Snippet Recording**:
  - Record actual layout/component code in `extraction_metadata.code_snippets`
  - Context types: "css-grid" | "css-flexbox" | "css-utility" | "html-structure" | "react-component"
  - Record complete blocks: Utility classes (5-15 lines), HTML structures (10-30 lines), React components (20-100 lines)
  - For components: include HTML structure + associated CSS rules + component logic
  - Preserve original formatting and framework-specific syntax

  ## Code Import Specific Requirements
  - ✅ Read discovered-files.json FIRST to get file paths
  - ✅ Detect and document naming conventions
  - ✅ Identify layout system with confidence level
  - ✅ Extract component variants and states from usage patterns
  - ✅ Record complete code snippets in extraction_metadata.code_snippets (complete components/structures)
  - ❌ NO external research or web searches (code-only extraction)
`
```

**Wait for All Agents**:

```bash
# Note: Agents run in parallel and write separate completeness reports
# Each agent generates its own completeness-report.json directly
# No synthesis phase needed
echo "[Phase 1] Parallel agent analysis complete"
```

<!-- TodoWrite: Update Phase 1.1-1.3 → completed (all 3 agents complete together) -->

---

## Output Files

### Generated Files

**Location**: `${base_path}/`

**Directory Structure**:
```
${base_path}/
├── style-extraction/
│   └── style-1/
│       └── design-tokens.json       # Production-ready design tokens with code snippets
├── animation-extraction/
│   └── animation-tokens.json        # Animation/transition tokens with code snippets
├── layout-extraction/
│   └── layout-templates.json        # Layout patterns with code snippets
└── .intermediates/
    └── import-analysis/
        └── discovered-files.json    # All discovered files (JSON format)
```

**Files**:
1. **style-extraction/style-1/design-tokens.json**
   - Production-ready design tokens
   - Categories: colors, typography, spacing, opacity, border_radius, shadows, breakpoints
   - Metadata: extraction_source, files_analyzed, completeness assessment, **code_snippets**
   - **Code snippets**: Complete code blocks from source files (CSS variables, theme configs, inline styles)

2. **animation-extraction/animation-tokens.json**
   - Animation tokens: duration, easing, transitions, keyframes, interactions
   - Framework detection: css-animations, framer-motion, gsap, etc.
   - Metadata: extraction_source, completeness assessment, **code_snippets**
   - **Code snippets**: Complete animation blocks (@keyframes, transition configs, JS animations)

3. **layout-extraction/layout-templates.json**
   - Layout templates for each discovered component
   - Extraction metadata: naming_convention, layout_system, responsive strategy, **code_snippets**
   - Component patterns with DOM structure and CSS rules
   - **Code snippets**: Complete component/structure code (HTML, CSS utilities, React components)

**Intermediate Files**: `.intermediates/import-analysis/`
- `discovered-files.json` - All discovered files in JSON format with counts and metadata

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
6. **Verify file discovery**: Check `${base_path}/.intermediates/import-analysis/discovered-files.json` if agents report no data
