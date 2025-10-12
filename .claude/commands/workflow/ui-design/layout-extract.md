---
name: layout-extract
description: Extract structural layout information from reference images, URLs, or text prompts
argument-hint: [--base-path <path>] [--session <id>] [--images "<glob>"] [--urls "<list>"] [--prompt "<desc>"] [--targets "<list>"] [--mode <imitate|explore>] [--variants <count>] [--device-type <desktop|mobile|tablet|responsive>]
allowed-tools: TodoWrite(*), Read(*), Write(*), Glob(*), Bash(*), Task(ui-design-agent), mcp__exa__web_search_exa(*)
---

# Layout Extraction Command

## Overview
Extract structural layout information from reference images, URLs, or text prompts using AI analysis. This command separates the "scaffolding" (HTML structure and CSS layout) from the "paint" (visual tokens handled by `style-extract`).

**Strategy**: AI-Driven Structural Analysis
- **Agent-Powered**: Uses `ui-design-agent` for deep structural analysis
- **Dual-Mode**:
  - `imitate`: High-fidelity replication of single layout structure
  - `explore`: Multiple structurally distinct layout variations
- **Single Output**: `layout-templates.json` with DOM structure, component hierarchy, and CSS layout rules
- **Device-Aware**: Optimized for specific device types (desktop, mobile, tablet, responsive)
- **Token-Based**: CSS uses `var()` placeholders for spacing and breakpoints

## Phase 0: Setup & Input Validation

### Step 1: Detect Input, Mode & Targets
```bash
# Detect input source
# Priority: --urls + --images → hybrid | --urls → url | --images → image | --prompt → text

# Determine extraction mode
extraction_mode = --mode OR "imitate"  # "imitate" or "explore"

# Set variants count based on mode
IF extraction_mode == "imitate":
    variants_count = 1  # Force single variant (ignore --variants)
ELSE IF extraction_mode == "explore":
    variants_count = --variants OR 3  # Default to 3
    VALIDATE: 1 <= variants_count <= 5

# Resolve targets
# Priority: --targets → prompt analysis → default ["page"]
targets = --targets OR extract_from_prompt(--prompt) OR ["page"]

# Resolve device type
device_type = --device-type OR "responsive"  # desktop|mobile|tablet|responsive

# Determine base path
bash(find .workflow -type d -name "design-*" | head -1)  # Auto-detect
# OR use --base-path / --session parameters
```

### Step 2: Load Inputs & Create Directories
```bash
# For image mode
bash(ls {images_pattern})  # Expand glob pattern
Read({image_path})  # Load each image

# For URL mode
# Parse URL list format: "target:url,target:url"
# Validate URLs are accessible

# For text mode
# Validate --prompt is non-empty

# Create output directory
bash(mkdir -p {base_path}/layout-extraction)
```

### Step 3: Memory Check (Skip if Already Done)
```bash
# Check if layouts already extracted
bash(test -f {base_path}/layout-extraction/layout-templates.json && echo "exists")
```

**If exists**: Skip to completion message

**Output**: `input_mode`, `base_path`, `extraction_mode`, `variants_count`, `targets[]`, `device_type`, loaded inputs

## Phase 1: Layout Research (Explore Mode Only)

### Step 1: Check Extraction Mode
```bash
# extraction_mode == "imitate" → skip this phase
# extraction_mode == "explore" → execute this phase
```

**If imitate mode**: Skip to Phase 2

### Step 2: Gather Layout Inspiration (Explore Mode)
```bash
bash(mkdir -p {base_path}/layout-extraction/_inspirations)

# For each target: Research via MCP
# mcp__exa__web_search_exa(query="{target} layout patterns {device_type}", numResults=5)

# Write inspiration file
Write({base_path}/layout-extraction/_inspirations/{target}-layout-ideas.txt, inspiration_content)
```

**Output**: Inspiration text files for each target (explore mode only)

## Phase 2: Layout Analysis & Synthesis (Agent)

**Executor**: `Task(ui-design-agent)`

### Step 1: Launch Agent Task
```javascript
Task(ui-design-agent): `
  [LAYOUT_EXTRACTION_TASK]
  Analyze references and extract structural layout templates.
  Focus ONLY on structure and layout. DO NOT concern with visual style (colors, fonts, etc.).

  REFERENCES:
  - Input: {reference_material}  // Images, URLs, or prompt
  - Mode: {extraction_mode}  // 'imitate' or 'explore'
  - Targets: {targets}  // List of page/component names
  - Variants per Target: {variants_count}
  - Device Type: {device_type}
  ${exploration_mode ? "- Layout Inspiration: Read('" + base_path + "/layout-extraction/_inspirations/{target}-layout-ideas.txt')" : ""}

  ## Analysis & Generation
  For EACH target in {targets}:
    For EACH variant (1 to {variants_count}):
      1. **Analyze Structure**: Deconstruct reference to understand layout, hierarchy, responsiveness
      2. **Define Philosophy**: Short description (e.g., "Asymmetrical grid with overlapping content areas")
      3. **Generate DOM Structure**: JSON object representing semantic HTML5 structure
         - Semantic tags: <header>, <nav>, <main>, <aside>, <section>, <footer>
         - ARIA roles and accessibility attributes
         - Device-specific structure:
           * mobile: Single column, stacked sections, touch targets ≥44px
           * desktop: Multi-column grids, hover states, larger hit areas
           * tablet: Hybrid layouts, flexible columns
           * responsive: Breakpoint-driven adaptive layouts (mobile-first)
         - In 'explore' mode: Each variant structurally DISTINCT
      4. **Define Component Hierarchy**: High-level array of main layout regions
         Example: ["header", "main-content", "sidebar", "footer"]
      5. **Generate CSS Layout Rules**:
         - Focus ONLY on layout (Grid, Flexbox, position, alignment, gap, etc.)
         - Use CSS Custom Properties for spacing/breakpoints: var(--spacing-4), var(--breakpoint-md)
         - Device-specific styles (mobile-first @media for responsive)
         - NO colors, NO fonts, NO shadows - layout structure only

  ## Output Format
  Return JSON object with layout_templates array.
  Each template must include:
  - target (string)
  - variant_id (string, e.g., "layout-1")
  - source_image_path (string, REQUIRED): Path to the primary reference image used for this layout analysis
    * For image input: Use the actual image file path from {images_pattern}
    * For URL input: Use the screenshot path if available, or empty string
    * For text/prompt input: Use empty string
    * Example: "{base_path}/screenshots/home.png"
  - device_type (string)
  - design_philosophy (string)
  - dom_structure (JSON object)
  - component_hierarchy (array of strings)
  - css_layout_rules (string)

  ## Notes
  - Structure only, no visual styling
  - Use var() for all spacing/sizing
  - Layouts must be structurally distinct in explore mode
  - Write complete layout-templates.json
`
```

**Output**: Agent returns JSON with `layout_templates` array

### Step 2: Write Output File
```bash
# Take JSON output from agent
bash(echo '{agent_json_output}' > {base_path}/layout-extraction/layout-templates.json)

# Verify output
bash(test -f {base_path}/layout-extraction/layout-templates.json && echo "exists")
bash(cat {base_path}/layout-extraction/layout-templates.json | grep -q "layout_templates" && echo "valid")
```

**Output**: `layout-templates.json` created and verified

## Completion

### Todo Update
```javascript
TodoWrite({todos: [
  {content: "Setup and input validation", status: "completed", activeForm: "Validating inputs"},
  {content: "Layout research (explore mode)", status: "completed", activeForm: "Researching layout patterns"},
  {content: "Layout analysis and synthesis (agent)", status: "completed", activeForm: "Generating layout templates"},
  {content: "Write layout-templates.json", status: "completed", activeForm: "Saving templates"}
]});
```

### Output Message
```
✅ Layout extraction complete!

Configuration:
- Session: {session_id}
- Extraction Mode: {extraction_mode} (imitate/explore)
- Device Type: {device_type}
- Targets: {targets}
- Variants per Target: {variants_count}
- Total Templates: {targets.length × variants_count}

{IF extraction_mode == "explore":
Layout Research:
- {targets.length} inspiration files generated
- Pattern search focused on {device_type} layouts
}

Generated Templates:
{FOR each template: - Target: {template.target} | Variant: {template.variant_id} | Philosophy: {template.design_philosophy}}

Output File:
- {base_path}/layout-extraction/layout-templates.json

Next: /workflow:ui-design:generate will combine these structural templates with style systems to produce final prototypes.
```

## Simple Bash Commands

### Path Operations
```bash
# Find design directory
bash(find .workflow -type d -name "design-*" | head -1)

# Create output directories
bash(mkdir -p {base_path}/layout-extraction)
bash(mkdir -p {base_path}/layout-extraction/_inspirations)  # explore mode only
```

### Validation Commands
```bash
# Check if already extracted
bash(test -f {base_path}/layout-extraction/layout-templates.json && echo "exists")

# Validate JSON structure
bash(cat layout-templates.json | grep -q "layout_templates" && echo "valid")

# Count templates
bash(cat layout-templates.json | grep -c "\"target\":")
```

### File Operations
```bash
# Load image references
bash(ls {images_pattern})
Read({image_path})

# Write inspiration files (explore mode)
Write({base_path}/layout-extraction/_inspirations/{target}-layout-ideas.txt, content)

# Write layout templates
bash(echo '{json}' > {base_path}/layout-extraction/layout-templates.json)
```

## Output Structure

```
{base_path}/
└── layout-extraction/
    ├── layout-templates.json         # Structural layout templates
    ├── layout-space-analysis.json    # Layout directions (explore mode only)
    └── _inspirations/                 # Explore mode only
        └── {target}-layout-ideas.txt  # Layout inspiration research
```

## layout-templates.json Format

```json
{
  "extraction_metadata": {
    "session_id": "...",
    "input_mode": "image|url|prompt|hybrid",
    "extraction_mode": "imitate|explore",
    "device_type": "desktop|mobile|tablet|responsive",
    "timestamp": "...",
    "variants_count": 3,
    "targets": ["home", "dashboard"]
  },
  "layout_templates": [
    {
      "target": "home",
      "variant_id": "layout-1",
      "source_image_path": "{base_path}/screenshots/home.png",
      "device_type": "responsive",
      "design_philosophy": "Responsive 3-column holy grail layout with fixed header and footer",
      "dom_structure": {
        "tag": "body",
        "children": [
          {
            "tag": "header",
            "attributes": {"class": "layout-header"},
            "children": [{"tag": "nav"}]
          },
          {
            "tag": "div",
            "attributes": {"class": "layout-main-wrapper"},
            "children": [
              {"tag": "main", "attributes": {"class": "layout-main-content"}},
              {"tag": "aside", "attributes": {"class": "layout-sidebar-left"}},
              {"tag": "aside", "attributes": {"class": "layout-sidebar-right"}}
            ]
          },
          {"tag": "footer", "attributes": {"class": "layout-footer"}}
        ]
      },
      "component_hierarchy": [
        "header",
        "main-content",
        "sidebar-left",
        "sidebar-right",
        "footer"
      ],
      "css_layout_rules": ".layout-main-wrapper { display: grid; grid-template-columns: 1fr 3fr 1fr; gap: var(--spacing-6); } @media (max-width: var(--breakpoint-md)) { .layout-main-wrapper { grid-template-columns: 1fr; } }"
    }
  ]
}
```

**Requirements**: Token-based CSS (var()), semantic HTML5, device-specific structure, accessibility attributes

## Error Handling

### Common Errors
```
ERROR: No inputs provided
→ Provide --images, --urls, or --prompt

ERROR: Invalid target name
→ Use lowercase, alphanumeric, hyphens only

ERROR: Agent task failed
→ Check agent output, retry with simplified prompt

ERROR: MCP search failed (explore mode)
→ Check network, retry
```

### Recovery Strategies
- **Partial success**: Keep successfully extracted templates
- **Invalid JSON**: Retry with stricter format requirements
- **Missing inspiration**: Works without (less informed exploration)

## Key Features

- **Separation of Concerns** - Decouples layout (structure) from style (visuals)
- **Structural Exploration** - Explore mode enables A/B testing of different layouts
- **Token-Based Layout** - CSS uses `var()` placeholders for instant design system adaptation
- **Device-Specific** - Tailored structures for different screen sizes
- **Foundation for Assembly** - Provides structural blueprint for refactored `generate` command
- **Agent-Powered** - Deep structural analysis with AI

## Integration

**Workflow Position**: Between style extraction and prototype generation

**New Workflow**:
1. `/workflow:ui-design:style-extract` → `style-cards.json` (Visual tokens)
2. `/workflow:ui-design:consolidate` → `design-tokens.json` (Final visual system)
3. `/workflow:ui-design:layout-extract` → `layout-templates.json` (Structural templates)
4. `/workflow:ui-design:generate` (Refactored as assembler):
   - **Reads**: `design-tokens.json` + `layout-templates.json`
   - **Action**: For each style × layout combination:
     1. Build HTML from `dom_structure`
     2. Create layout CSS from `css_layout_rules`
     3. Link design tokens CSS
     4. Inject placeholder content
   - **Output**: Complete token-driven HTML/CSS prototypes

**Input**: Reference images, URLs, or text prompts
**Output**: `layout-templates.json` for `/workflow:ui-design:generate`
**Next**: `/workflow:ui-design:generate --session {session_id}`
