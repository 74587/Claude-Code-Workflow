---
name: generate
description: Generate UI prototypes in matrix mode (style × layout combinations) for pages or components
usage: /workflow:ui-design:generate [--targets "<list>"] [--target-type "page|component"] [--base-path <path>] [--session <id>] [--style-variants <count>] [--layout-variants <count>]
examples:
  - /workflow:ui-design:generate --base-path ".workflow/WFS-auth/design-run-20250109-143022" --targets "dashboard,settings"
  - /workflow:ui-design:generate --session WFS-auth --targets "home,pricing" --style-variants 2 --layout-variants 2
  - /workflow:ui-design:generate --targets "navbar,hero,card" --target-type "component"
allowed-tools: TodoWrite(*), Read(*), Write(*), Task(ui-design-agent), Bash(*)
---

# Generate UI Prototypes (/workflow:ui-design:generate)

## Overview
Generate matrix of UI prototypes (`style × layout × targets`) with production-ready HTML/CSS. Optimized template-based architecture: **`S` times faster** than direct generation.

**Strategy**: Two-layer generation
- **Layer 1**: Generate `L × T` reusable templates (agent)
- **Layer 2**: Instantiate `S × L × T` final prototypes (script)

**Supports**: Pages (full layouts) and components (isolated elements)

## Phase 1: Setup & Validation

### Step 1: Resolve Base Path
```bash
# Determine working directory
bash(find .workflow -type d -name "design-*" | head -1)  # Auto-detect
# OR use --base-path / --session parameters
```

### Step 2: Parse Configuration
```bash
# Get style variant count (default: 3)
bash(ls {base_path}/style-consolidation/style-* -d | wc -l)

# Get layout variant count (default: 3, configurable via --layout-variants)

# Parse targets (pages/components)
# Priority: --targets → --pages (legacy) → synthesis-specification.md → default ["home"]
```

### Step 3: Validate Inputs
```bash
# Check design systems exist
bash(test -f {base_path}/style-consolidation/style-1/design-tokens.json && echo "valid")

# Validate target names (lowercase, alphanumeric, hyphens only)
# Target type: "page" (default) or "component"
```

**Output**: `base_path`, `style_variants`, `layout_variants`, `target_list[]`, `target_type`

### Step 4: Check Existing Output
```bash
# Skip if already generated
bash(test -f {base_path}/prototypes/compare.html && echo "exists")
```

**If exists**: Skip to completion message

## Phase 2: Layout Planning

### Step 1: Research Layout Patterns (Agent)
```bash
bash(mkdir -p {base_path}/prototypes/_templates)
```

For each `target × layout_id`:
```javascript
Task(ui-design-agent): `
  [TARGET_LAYOUT_PLANNING]
  TARGET: {target} | TYPE: {target_type} | LAYOUT: {layout_id}/{layout_variants}
  BASE_PATH: {base_path}
  ${--session ? "REQUIREMENTS: .workflow/WFS-{session}/.brainstorming/synthesis-specification.md" : ""}

  ## 参考
  - Research via: mcp__exa__web_search_exa(query="{target} {target_type} layout patterns 2024", numResults=5)
  - Layout differentiation: Layout 1=common, Layout 2=alternative, Layout 3=innovative

  ## 生成
  Write("{base_path}/prototypes/_templates/{target}-layout-{layout_id}.json")

  JSON schema:
  {
    "id": "layout-{layout_id}",
    "target": "{target}",
    "target_type": "{target_type}",
    "name": "2-4 words",
    "description": "2-3 sentences",
    "structure": {
      // Page: type, regions, grid, sidebar, responsive{mobile/tablet/desktop}
      // Component: arrangement, alignment, spacing, element_order, variants
    },
    "semantic_hints": ["<nav>", "<main role='main'>", ...],
    "accessibility_features": ["skip-link", "landmarks", ...],
    "research_references": ["source URLs/insights"]
  }

  ## 注意
  - Layout #{layout_id} must be STRUCTURALLY DIFFERENT from other IDs
  - Structure section must match target_type (page vs component)
  - Write file directly, no text output
`
```

### Step 2: Verify Layout Plans
```bash
# Verify files created
bash(ls {base_path}/prototypes/_templates/*.json | wc -l)  # Should equal L×T

# Validate JSON structure
Read({base_path}/prototypes/_templates/{target}-layout-{layout_id}.json)
```

**Output**: `L × T` layout plan JSON files

## Phase 3: Token Conversion

### Step 1: Convert JSON to CSS Variables
```bash
# Check jq dependency
bash(command -v jq >/dev/null 2>&1 || echo "ERROR: jq not found")

# Convert each style's design-tokens.json to tokens.css
bash(cat {base_path}/style-consolidation/style-1/design-tokens.json | ~/.claude/scripts/convert_tokens_to_css.sh > tokens.css)
```

### Step 2: Extract Variable Names
```bash
# Read generated tokens.css
Read({base_path}/style-consolidation/style-1/tokens.css)

# Extract CSS variable names (pattern: --variable-name:)
# Categorize: colors, typography, spacing, radius, shadows
```

**Output**: `S × tokens.css` files + extracted variable list

## Phase 4: Template Generation (Agent)

**Executor**: `Task(ui-design-agent)` × `L × T` tasks in parallel

### Step 1: Launch Agent Tasks
For each `layout_id × target`:
```javascript
Task(ui-design-agent): `
  [UI_LAYOUT_TEMPLATE_GENERATION]
  🚨 ONE target only: '{target}' (standalone, reusable)

  LAYOUT: {layout_id} | TARGET: {target} | TYPE: {target_type}
  BASE_PATH: {base_path}
  ${--session ? "REQUIREMENTS: .workflow/WFS-{session}/.brainstorming/synthesis-specification.md" : ""}

  ## 参考
  - Layout plan: Read("{base_path}/prototypes/_templates/{target}-layout-{layout_id}.json")
  - Design tokens: Read("{base_path}/style-consolidation/style-1/tokens.css")
    Extract variables: --color-*, --font-*, --spacing-*, --border-radius-*, --shadow-*

  ## 生成
  1. HTML: {base_path}/prototypes/_templates/{target}-layout-{layout_id}.html
     - Complete HTML5 doc with <link href="{{STRUCTURAL_CSS}}"> and <link href="{{TOKEN_CSS}}">
     - Body: Full structure (page) OR isolated element (component)
     - Semantic: <header>, <nav>, <main>, <footer>, proper heading hierarchy
     - A11y: ARIA landmarks, skip-link, alt/labels, focus styles

  2. CSS: {base_path}/prototypes/_templates/{target}-layout-{layout_id}.css
     - Structure: Flexbox/Grid, positioning, dimensions, responsive
     - Mobile-first: base → @media(768px) → @media(1024px)
     - Optional: {target}-layout-{layout_id}-tokens.css for --layout-* vars

  ## 注意
  - ✅ ONLY var(--token-name) from tokens.css
  - ❌ NO hardcoded: colors (#333, rgb), spacing (16px), fonts ("Arial")
  - ❌ NO invented variable names
  - Body content matches target_type (page=full, component=isolated)
  - Write files directly, no text output
`
```

### Step 2: Verify Templates Created
```bash
# Check file count
bash(ls {base_path}/prototypes/_templates/{target}-layout-*.html | wc -l)

# Validate structure
Read({base_path}/prototypes/_templates/{target}-layout-{layout_id}.html)
# Check: <!DOCTYPE html>, var(--, placeholders
```

**Output**: `L × T` template pairs (HTML + CSS)

## Phase 5: Prototype Instantiation (Script)

### Step 1: Execute Instantiation Script
```bash
# Verify tokens.css files exist
bash(ls {base_path}/style-consolidation/style-*/tokens.css | wc -l)

# Run instantiation script
bash(~/.claude/scripts/ui-instantiate-prototypes.sh "{base_path}/prototypes" --session-id "{session_id}" --mode "{target_type}")
```

**Script generates**:
- `S × L × T` HTML prototypes with CSS links
- Implementation notes for each prototype
- `compare.html` (interactive matrix)
- `index.html` (navigation)
- `PREVIEW.md` (documentation)

### Step 2: Verify Output Files
```bash
# Check preview files
bash(ls {base_path}/prototypes/compare.html {base_path}/prototypes/index.html {base_path}/prototypes/PREVIEW.md)

# Count final prototypes
bash(ls {base_path}/prototypes/{target}-style-*-layout-*.html | wc -l)
```

**Output**: `S × L × T` final prototypes + preview files



## Completion

### Todo Update
```javascript
TodoWrite({todos: [
  {content: "Setup and validation", status: "completed", activeForm: "Loading design systems"},
  {content: "Layout planning (agent)", status: "completed", activeForm: "Planning layouts"},
  {content: "Token conversion", status: "completed", activeForm: "Converting tokens"},
  {content: "Template generation (agent)", status: "completed", activeForm: "Generating templates"},
  {content: "Prototype instantiation (script)", status: "completed", activeForm: "Running script"},
  {content: "Verify output", status: "completed", activeForm: "Verifying files"}
]});
```

### Output Message
```
✅ Matrix UI generation complete!

Configuration:
- Style Variants: {style_variants}
- Layout Variants: {layout_variants}
- Target Type: {target_type}
- Targets: {target_list}
- Total Prototypes: {S × L × T}

Performance:
- Templates: {L × T} (agent)
- Prototypes: {S × L × T} (script)
- Speed: {S}× faster
- Script: ui-instantiate-prototypes.sh v3.0

Generated Files:
{base_path}/prototypes/
├── _templates/ ({T×L} JSON + HTML + CSS)
├── {target}-style-{s}-layout-{l}.html ({S×L×T} prototypes)
├── compare.html (interactive matrix)
├── index.html (navigation)
└── PREVIEW.md (documentation)

Preview:
1. Open compare.html (recommended)
2. Open index.html
3. Read PREVIEW.md

Next: /workflow:ui-design:update
```

## Simple Bash Commands

### Path Operations
```bash
# Find design directory
bash(find .workflow -type d -name "design-*" | head -1)

# Count style variants
bash(ls {base_path}/style-consolidation/style-* -d | wc -l)

# List targets from templates
bash(ls {base_path}/prototypes/_templates/*-layout-1.json | sed 's/-layout-1.json//')
```

### Validation Commands
```bash
# Check design tokens exist
bash(test -f {base_path}/style-consolidation/style-1/design-tokens.json && echo "valid")

# Count template files
bash(ls {base_path}/prototypes/_templates/*.html | wc -l)

# Verify output complete
bash(test -f {base_path}/prototypes/compare.html && echo "exists")
```

### File Operations
```bash
# Create directories
bash(mkdir -p {base_path}/prototypes/_templates)

# Convert tokens to CSS
bash(cat design-tokens.json | ~/.claude/scripts/convert_tokens_to_css.sh > tokens.css)

# Run instantiation script
bash(~/.claude/scripts/ui-instantiate-prototypes.sh "{base_path}/prototypes" --mode "page")
```

## Output Structure

```
{base_path}/
├── prototypes/
│   ├── _templates/
│   │   ├── {target}-layout-{l}.json  # Layout plans
│   │   ├── {target}-layout-{l}.html  # HTML templates
│   │   └── {target}-layout-{l}.css   # CSS templates
│   ├── {target}-style-{s}-layout-{l}.html  # Final prototypes
│   ├── {target}-style-{s}-layout-{l}-notes.md
│   ├── compare.html
│   ├── index.html
│   └── PREVIEW.md
└── style-consolidation/
    └── style-{s}/
        ├── design-tokens.json
        ├── tokens.css
        └── style-guide.md
```

## Error Handling

### Common Errors
```
ERROR: No design systems found
→ Run /workflow:ui-design:consolidate first

ERROR: jq not found
→ Install jq: brew install jq

ERROR: Agent task failed
→ Check agent output, retry phase

ERROR: Script permission denied
→ chmod +x ~/.claude/scripts/ui-instantiate-prototypes.sh
```

### Recovery Strategies
- **Partial failure**: Check script logs for counts
- **Missing templates**: Regenerate Phase 4
- **Invalid tokens**: Validate design-tokens.json

## Quality Checklist

- [ ] CSS uses var(--token-name) only
- [ ] No hardcoded colors/spacing
- [ ] Semantic HTML5 structure
- [ ] ARIA attributes present
- [ ] Mobile-first responsive
- [ ] Naming: `{target}-style-{s}-layout-{l}`
- [ ] compare.html works

## Key Features

- **Template-Based**: `S` times faster generation
- **Target Types**: Pages and components
- **Agent-Driven**: Parallel task execution
- **Token-Driven**: No hardcoded values
- **Production-Ready**: Semantic, accessible, responsive
- **Interactive Preview**: Matrix comparison view

## Integration

**Input**: design-tokens.json from `/workflow:ui-design:consolidate`
**Output**: Prototypes for `/workflow:ui-design:update`
**Called by**: `/workflow:ui-design:explore-auto`, `/workflow:ui-design:imitate-auto`
