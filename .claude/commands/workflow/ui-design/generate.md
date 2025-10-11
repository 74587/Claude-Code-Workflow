---
name: generate
description: Generate UI prototypes using target-style-centric batch generation
usage: /workflow:ui-design:generate [--targets "<list>"] [--target-type "page|component"] [--device-type "desktop|mobile|tablet|responsive"] [--base-path <path>] [--session <id>] [--style-variants <count>] [--layout-variants <count>]
examples:
  - /workflow:ui-design:generate --session WFS-auth --targets "dashboard,settings"
  - /workflow:ui-design:generate --targets "home,pricing" --style-variants 2 --layout-variants 2
  - /workflow:ui-design:generate --targets "app" --device-type mobile
  - /workflow:ui-design:generate --targets "dashboard" --device-type desktop
allowed-tools: TodoWrite(*), Read(*), Write(*), Task(ui-design-agent), Bash(*)
---

# Generate UI Prototypes (/workflow:ui-design:generate)

## Overview
Generate matrix of UI prototypes (`style × layout × targets`) using **target-style-centric batch generation**. Each agent handles all layouts for one target × style combination.

**Strategy**: Target-Style-Centric
- **Agent scope**: Each of `T × S` agents generates `L` layouts
- **Component isolation**: Complete task independence
- **Style-aware**: HTML adapts to design_attributes
- **Self-contained CSS**: Direct token values (no var() refs)

**Supports**: Pages (full layouts) and components (isolated elements)

## Phase 1: Setup & Validation

### Step 1: Resolve Base Path & Parse Configuration
```bash
# Determine working directory
bash(find .workflow -type d -name "design-*" | head -1)  # Auto-detect

# Get counts (defaults: style=auto, layout=3)
bash(ls {base_path}/style-consolidation/style-* -d | wc -l)

# Parse targets (Priority: --targets → --pages → synthesis-specification.md → default ["home"])
# Target type: "page" (default) or "component"

# Parse device type
device_type = --device-type OR "responsive"  # Default: responsive

# Try to load from .run-metadata.json if exists
IF exists({base_path}/.run-metadata.json):
    metadata = Read({base_path}/.run-metadata.json)
    IF metadata.parameters.device_type:
        device_type = metadata.parameters.device_type
```

### Step 2: Validate Inputs
```bash
# Check design systems exist
bash(test -f {base_path}/style-consolidation/style-1/design-tokens.json && echo "valid")

# Validate target names (lowercase, alphanumeric, hyphens only)
# Load design-space-analysis.json (optional, for style-aware generation)
```

**Output**: `base_path`, `style_variants`, `layout_variants`, `target_list[]`, `target_type`, `design_space_analysis` (optional), `device_type`

### Step 3: Detect Token Sources
```bash
# Priority 1: consolidated tokens (production-ready from /workflow:ui-design:consolidate)
# Priority 2: proposed tokens from style-cards.json (fast-track from /workflow:ui-design:extract)

bash(test -f {base_path}/style-consolidation/style-1/design-tokens.json && echo "consolidated")
# OR
bash(test -f {base_path}/style-extraction/style-cards.json && echo "proposed")

# If proposed: Create temp consolidation dir + write proposed tokens
bash(mkdir -p {base_path}/style-consolidation/style-{id})
Write({base_path}/style-consolidation/style-{id}/design-tokens.json, proposed_tokens)
```

**Output**: `token_sources{}`, `consolidated_count`, `proposed_count`

### Step 4: Gather Layout Inspiration
```bash
bash(mkdir -p {base_path}/prototypes/_inspirations)

# For each target: Research via MCP
# mcp__exa__web_search_exa(query="{target} {target_type} layout patterns", numResults=5)

# Write simple inspiration file
Write({base_path}/prototypes/_inspirations/{target}-layout-ideas.txt, inspiration_content)
```

**Output**: `L` inspiration text files

## Phase 2: Target-Style-Centric Generation (Agent)

**Executor**: `Task(ui-design-agent)` × `T × S` tasks in parallel

### Step 1: Launch Agent Tasks
```bash
bash(mkdir -p {base_path}/prototypes)
```

For each `target × style_id`:
```javascript
Task(ui-design-agent): `
  [TARGET_STYLE_UI_GENERATION]
  🎯 ONE component: {target} × Style-{style_id} ({philosophy_name})
  Generate: {layout_variants} × 2 files (HTML + CSS per layout)

  TARGET: {target} | TYPE: {target_type} | STYLE: {style_id}/{style_variants}
  BASE_PATH: {base_path}
  DEVICE: {device_type}
  ${design_attributes ? "DESIGN_ATTRIBUTES: " + JSON.stringify(design_attributes) : ""}

  ## Reference
  - Layout inspiration: Read("{base_path}/prototypes/_inspirations/{target}-layout-ideas.txt")
  - Design tokens: Read("{base_path}/style-consolidation/style-{style_id}/design-tokens.json")
    Parse ALL token values (colors, typography, spacing, borders, shadows, breakpoints)
  ${design_attributes ? "- Adapt DOM structure to: density, visual_weight, formality, organic_vs_geometric" : ""}

  ## Generation
  For EACH layout (1 to {layout_variants}):

  1. HTML: {base_path}/prototypes/{target}-style-{style_id}-layout-N.html
     - Complete HTML5: <!DOCTYPE>, <head>, <body>
     - CSS ref: <link href="{target}-style-{style_id}-layout-N.css">
     - Semantic: <header>, <nav>, <main>, <footer>
     - A11y: ARIA labels, landmarks, responsive meta
     - Viewport meta: <meta name="viewport" content="width=device-width, initial-scale=1.0">
     ${design_attributes ? `
     - DOM adaptation:
       * density='spacious' → flatter hierarchy
       * density='compact' → deeper nesting
       * visual_weight='heavy' → extra wrappers
       * visual_weight='minimal' → direct structure` : ""}
     - Device-specific structure:
       * mobile (375×812px): Single column, stacked sections, touch targets ≥44px
       * desktop (1920×1080px): Multi-column grids, hover states, larger hit areas
       * tablet (768×1024px): Hybrid layouts, flexible columns
       * responsive: Breakpoint-driven adaptive layouts (mobile-first)

  2. CSS: {base_path}/prototypes/{target}-style-{style_id}-layout-N.css
     - Self-contained: Direct token VALUES (no var())
     - Use tokens: colors, fonts, spacing, borders, shadows
     - Device-optimized styles for {device_type}
     ${device_type === 'responsive' ? '- Responsive: Mobile-first @media(breakpoints)' : '- Fixed device: Optimize for ' + device_type}
     ${design_attributes ? `
     - Token selection:
       * density → spacing scale
       * visual_weight → shadow strength
       * organic_vs_geometric → border-radius` : ""}
     - Device-specific CSS:
       * mobile: Compact spacing, touch-friendly
       * desktop: Generous whitespace, hover effects
       * tablet: Medium spacing, flexible grids
       * responsive: Fluid typography, breakpoints

  ## Notes
  - ✅ Use token VALUES directly from design-tokens.json
  - ✅ Optimize for {device_type} device
  - ❌ NO var() references, NO external dependencies
  - Layouts structurally DISTINCT (different grids/regions)
  - Write files IMMEDIATELY (per layout, no accumulation)
  - CSS filename MUST match HTML <link href="...">
  - No text output, write to filesystem only
  - Device-first approach: Design specifically for {device_type} user experience
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
  {content: "Gather layout inspiration", status: "completed", activeForm: "Researching layouts"},
  {content: "Target-style generation (agent)", status: "completed", activeForm: "Generating prototypes"},
  {content: "Verify files", status: "completed", activeForm: "Validating output"},
  {content: "Generate previews", status: "completed", activeForm: "Creating preview files"}
]});
```

### Output Message
```
✅ Target-Style-Centric UI generation complete!

Configuration:
- Style Variants: {style_variants}
- Layout Variants: {layout_variants} (inspiration-based)
- Target Type: {target_type}
- Device Type: {device_type}
- Targets: {target_list}
- Total Prototypes: {S × L × T}

Agent Execution:
- Target-style agents: T×S = {T}×{S} = {T×S} agents
- Each agent scope: {L} layouts for one component
- Component isolation: Complete task independence
- Device-specific: All layouts optimized for {device_type}

Quality:
- Style-aware: {design_space_analysis ? 'HTML adapts to design_attributes' : 'Standard structure'}
- CSS: Self-contained (direct token values, no var())
- Device-optimized: {device_type} layouts
- Tokens: {consolidated_count} consolidated, {proposed_count} proposed
{IF proposed_count > 0: '  💡 For production: /workflow:ui-design:consolidate'}

Generated Files:
{base_path}/prototypes/
├── _inspirations/ ({T} text files)
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

# Check token sources
bash(test -f {base_path}/style-consolidation/style-1/design-tokens.json && echo "consolidated")
bash(test -f {base_path}/style-extraction/style-cards.json && echo "proposed")
```

### Validation Commands
```bash
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
bash(mkdir -p {base_path}/prototypes/_inspirations)

# Run preview script
bash(~/.claude/scripts/ui-generate-preview.sh "{base_path}/prototypes")
```

## Output Structure

```
{base_path}/
├── prototypes/
│   ├── _inspirations/
│   │   └── {target}-layout-ideas.txt  # Layout inspiration
│   ├── {target}-style-{s}-layout-{l}.html  # Final prototypes
│   ├── {target}-style-{s}-layout-{l}.css
│   ├── compare.html
│   ├── index.html
│   └── PREVIEW.md
└── style-consolidation/
    └── style-{s}/
        ├── design-tokens.json
        └── style-guide.md
```

## Error Handling

### Common Errors
```
ERROR: No token sources found
→ Run /workflow:ui-design:extract or /workflow:ui-design:consolidate

ERROR: MCP search failed
→ Check network, retry

ERROR: Agent task failed
→ Check agent output, retry specific target×style

ERROR: Script permission denied
→ chmod +x ~/.claude/scripts/ui-generate-preview.sh
```

### Recovery Strategies
- **Partial success**: Keep successful target×style combinations
- **Missing design_attributes**: Works without (less style-aware)
- **Invalid tokens**: Validate design-tokens.json structure

## Quality Checklist

- [ ] CSS uses direct token values (no var())
- [ ] HTML structure adapts to design_attributes (if available)
- [ ] Semantic HTML5 structure
- [ ] ARIA attributes present
- [ ] Mobile-first responsive
- [ ] Layouts structurally distinct
- [ ] compare.html works

## Key Features

- **Target-Style-Centric**: `T×S` agents, each handles `L` layouts
- **Component Isolation**: Complete task independence
- **Style-Aware**: HTML adapts to design_attributes
- **Self-Contained CSS**: Direct token values (no var())
- **Inspiration-Based**: Simple text research vs complex JSON
- **Production-Ready**: Semantic, accessible, responsive

## Integration

**Input**: design-tokens.json, design-space-analysis.json (optional), targets
**Output**: S×L×T prototypes for `/workflow:ui-design:update`
**Called by**: `/workflow:ui-design:explore-auto`, `/workflow:ui-design:imitate-auto`
