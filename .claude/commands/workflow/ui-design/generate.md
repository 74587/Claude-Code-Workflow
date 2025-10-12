---
name: generate
description: Assemble UI prototypes by combining layout templates with design tokens (pure assembler)
argument-hint: [--base-path <path>] [--session <id>] [--style-variants <count>] [--layout-variants <count>]
allowed-tools: TodoWrite(*), Read(*), Write(*), Task(ui-design-agent), Bash(*)
---

# Generate UI Prototypes (/workflow:ui-design:generate)

## Overview
Pure assembler that combines pre-extracted layout templates with design tokens to generate UI prototypes (`style × layout × targets`). No layout design logic - purely combines existing components.

**Strategy**: Pure Assembly
- **Input**: `layout-templates.json` + `design-tokens.json` (+ reference images if available)
- **Process**: Combine structure (DOM) with style (tokens)
- **Output**: Complete HTML/CSS prototypes
- **No Design Logic**: All layout and style decisions already made
- **Automatic Image Reference**: If source images exist in layout templates, they're automatically used for visual context

**Prerequisite Commands**:
- `/workflow:ui-design:style-extract` → Style tokens
- `/workflow:ui-design:consolidate` → Final design tokens
- `/workflow:ui-design:layout-extract` → Layout structure

## Phase 1: Setup & Validation

### Step 1: Resolve Base Path & Parse Configuration
```bash
# Determine working directory
bash(find .workflow -type d -name "design-*" | head -1)  # Auto-detect

# Get style count
bash(ls {base_path}/style-consolidation/style-* -d | wc -l)

# Image reference auto-detected from layout template source_image_path
```

### Step 2: Load Layout Templates
```bash
# Check layout templates exist
bash(test -f {base_path}/layout-extraction/layout-templates.json && echo "exists")

# Load layout templates
Read({base_path}/layout-extraction/layout-templates.json)
# Extract: targets, layout_variants count, device_type, template structures
```

**Output**: `base_path`, `style_variants`, `layout_templates[]`, `targets[]`, `device_type`

### Step 3: Validate Design Tokens
```bash
# Check design tokens exist for all styles
bash(test -f {base_path}/style-consolidation/style-1/design-tokens.json && echo "valid")

# For each style variant: Load design tokens
Read({base_path}/style-consolidation/style-{id}/design-tokens.json)
```

**Output**: `design_tokens[]` for all style variants

## Phase 2: Assembly (Agent)

**Executor**: `Task(ui-design-agent)` × `T × S × L` tasks (can be batched)

### Step 1: Launch Assembly Tasks
```bash
bash(mkdir -p {base_path}/prototypes)
```

For each `target × style_id × layout_id`:
```javascript
Task(ui-design-agent): `
  [LAYOUT_STYLE_ASSEMBLY]
  🎯 Assembly task: {target} × Style-{style_id} × Layout-{layout_id}
  Combine: Pre-extracted layout structure + design tokens → Final HTML/CSS

  TARGET: {target} | STYLE: {style_id} | LAYOUT: {layout_id}
  BASE_PATH: {base_path}

  ## Inputs (READ ONLY - NO DESIGN DECISIONS)
  1. Layout Template:
     Read("{base_path}/layout-extraction/layout-templates.json")
     Find template where: target={target} AND variant_id="layout-{layout_id}"
     Extract: dom_structure, css_layout_rules, device_type, source_image_path

  2. Design Tokens:
     Read("{base_path}/style-consolidation/style-{style_id}/design-tokens.json")
     Extract: ALL token values (colors, typography, spacing, borders, shadows, breakpoints)

  3. Reference Image (AUTO-DETECTED):
     IF template.source_image_path exists:
       Read(template.source_image_path)
       Purpose: Additional visual context for better placeholder content generation
       Note: This is for reference only - layout and style decisions already made
     ELSE:
       Use generic placeholder content

  ## Assembly Process
  1. Build HTML: {base_path}/prototypes/{target}-style-{style_id}-layout-{layout_id}.html
     - Recursively build from template.dom_structure
     - Add: <!DOCTYPE html>, <head>, <meta viewport>
     - CSS link: <link href="{target}-style-{style_id}-layout-{layout_id}.css">
     - Inject placeholder content:
       * Default: Use Lorem ipsum, generic sample data
       * If reference image available: Generate more contextually appropriate placeholders
         (e.g., realistic headings, meaningful text snippets that match the visual context)
     - Preserve all attributes from dom_structure

  2. Build CSS: {base_path}/prototypes/{target}-style-{style_id}-layout-{layout_id}.css
     - Start with template.css_layout_rules
     - Replace ALL var(--*) with actual token values from design-tokens.json
       Example: var(--spacing-4) → 1rem (from tokens.spacing.4)
       Example: var(--breakpoint-md) → 768px (from tokens.breakpoints.md)
     - Add visual styling using design tokens:
       * Colors: tokens.colors.*
       * Typography: tokens.typography.*
       * Shadows: tokens.shadows.*
       * Border radius: tokens.border_radius.*
     - Device-optimized for template.device_type

  ## Assembly Rules
  - ✅ Pure assembly: Combine existing structure + existing style
  - ❌ NO layout design decisions (structure pre-defined)
  - ❌ NO style design decisions (tokens pre-defined)
  - ✅ Replace var() with actual values
  - ✅ Add placeholder content only
  - Write files IMMEDIATELY
  - CSS filename MUST match HTML <link href="...">
`
```

### Step 2: Verify Generated Files
```bash
# Count expected vs found
bash(ls {base_path}/prototypes/{target}-style-*-layout-*.html | wc -l)

# Validate samples
Read({base_path}/prototypes/{target}-style-{style_id}-layout-{layout_id}.html)
# Check: <!DOCTYPE html>, correct CSS href, sufficient CSS length
```

**Output**: `S × L × T × 2` files verified

## Phase 3: Generate Preview Files

### Step 1: Run Preview Generation Script
```bash
bash(~/.claude/scripts/ui-generate-preview.sh "{base_path}/prototypes")
```

**Script generates**:
- `compare.html` (interactive matrix)
- `index.html` (navigation)
- `PREVIEW.md` (instructions)

### Step 2: Verify Preview Files
```bash
bash(ls {base_path}/prototypes/compare.html {base_path}/prototypes/index.html {base_path}/prototypes/PREVIEW.md)
```

**Output**: 3 preview files

## Completion

### Todo Update
```javascript
TodoWrite({todos: [
  {content: "Setup and validation", status: "completed", activeForm: "Loading design systems"},
  {content: "Load layout templates", status: "completed", activeForm: "Reading layout templates"},
  {content: "Assembly (agent)", status: "completed", activeForm: "Assembling prototypes"},
  {content: "Verify files", status: "completed", activeForm: "Validating output"},
  {content: "Generate previews", status: "completed", activeForm: "Creating preview files"}
]});
```

### Output Message
```
✅ UI prototype assembly complete!

Configuration:
- Style Variants: {style_variants}
- Layout Variants: {layout_variants} (from layout-templates.json)
- Device Type: {device_type}
- Targets: {targets}
- Total Prototypes: {S × L × T}
- Image Reference: Auto-detected (uses source images when available in layout templates)

Assembly Process:
- Pure assembly: Combined pre-extracted layouts + design tokens
- No design decisions: All structure and style pre-defined
- Assembly tasks: T×S×L = {T}×{S}×{L} = {T×S×L} combinations

Quality:
- Structure: From layout-extract (DOM, CSS layout rules)
- Style: From consolidate (design tokens)
- CSS: Token values directly applied (var() replaced)
- Device-optimized: Layouts match device_type from templates

Generated Files:
{base_path}/prototypes/
├── _templates/
│   └── layout-templates.json (input, pre-extracted)
├── {target}-style-{s}-layout-{l}.html ({S×L×T} prototypes)
├── {target}-style-{s}-layout-{l}.css
├── compare.html (interactive matrix)
├── index.html (navigation)
└── PREVIEW.md (instructions)

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
```

### Validation Commands
```bash
# Check layout templates exist
bash(test -f {base_path}/layout-extraction/layout-templates.json && echo "exists")

# Check design tokens exist
bash(test -f {base_path}/style-consolidation/style-1/design-tokens.json && echo "valid")

# Count generated files
bash(ls {base_path}/prototypes/{target}-style-*-layout-*.html | wc -l)

# Verify preview
bash(test -f {base_path}/prototypes/compare.html && echo "exists")
```

### File Operations
```bash
# Create directories
bash(mkdir -p {base_path}/prototypes)

# Run preview script
bash(~/.claude/scripts/ui-generate-preview.sh "{base_path}/prototypes")
```

## Output Structure

```
{base_path}/
├── layout-extraction/
│   └── layout-templates.json      # Input (from layout-extract)
├── style-consolidation/
│   └── style-{s}/
│       ├── design-tokens.json     # Input (from consolidate)
│       └── style-guide.md
└── prototypes/
    ├── {target}-style-{s}-layout-{l}.html  # Assembled prototypes
    ├── {target}-style-{s}-layout-{l}.css
    ├── compare.html
    ├── index.html
    └── PREVIEW.md
```

## Error Handling

### Common Errors
```
ERROR: Layout templates not found
→ Run /workflow:ui-design:layout-extract first

ERROR: Design tokens not found
→ Run /workflow:ui-design:consolidate first

ERROR: Agent assembly failed
→ Check inputs exist, validate JSON structure

ERROR: Script permission denied
→ chmod +x ~/.claude/scripts/ui-generate-preview.sh
```

### Recovery Strategies
- **Partial success**: Keep successful assembly combinations
- **Invalid template structure**: Validate layout-templates.json
- **Invalid tokens**: Validate design-tokens.json structure

## Quality Checklist

- [ ] CSS uses direct token values (var() replaced)
- [ ] HTML structure matches layout template exactly
- [ ] Semantic HTML5 structure preserved
- [ ] ARIA attributes from template present
- [ ] Device-specific optimizations applied
- [ ] All token references resolved
- [ ] compare.html works

## Key Features

- **Pure Assembly**: No design decisions, only combination
- **Separation of Concerns**: Layout (structure) + Style (tokens) kept separate until final assembly
- **Token Resolution**: var() placeholders replaced with actual values
- **Pre-validated**: Inputs already validated by extract/consolidate
- **Efficient**: Simple assembly vs complex generation
- **Production-Ready**: Semantic, accessible, token-driven

## Integration

**Prerequisites**:
- `/workflow:ui-design:style-extract` → `style-cards.json`
- `/workflow:ui-design:consolidate` → `design-tokens.json`
- `/workflow:ui-design:layout-extract` → `layout-templates.json`

**Input**: `layout-templates.json` + `design-tokens.json`
**Output**: S×L×T prototypes for `/workflow:ui-design:update`
**Called by**: `/workflow:ui-design:explore-auto`, `/workflow:ui-design:imitate-auto`
