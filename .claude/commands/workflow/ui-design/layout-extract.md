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

# Parse URLs if provided (format: "target:url,target:url,...")
IF --urls:
    url_list = []
    FOR pair IN split(--urls, ","):
        IF ":" IN pair:
            target, url = pair.split(":", 1)
            url_list.append({target: target.strip(), url: url.strip()})
        ELSE:
            # Single URL without target
            url_list.append({target: "page", url: pair.strip()})

    has_urls = true
ELSE:
    has_urls = false
    url_list = []

# Determine extraction mode
extraction_mode = --mode OR "imitate"  # "imitate" or "explore"

# Set variants count based on mode
IF extraction_mode == "imitate":
    variants_count = 1  # Force single variant (ignore --variants)
ELSE IF extraction_mode == "explore":
    variants_count = --variants OR 3  # Default to 3
    VALIDATE: 1 <= variants_count <= 5

# Resolve targets
# Priority: --targets → url_list targets → prompt analysis → default ["page"]
IF --targets:
    targets = split(--targets, ",")
ELSE IF has_urls:
    targets = [url_info.target for url_info in url_list]
ELSE IF --prompt:
    targets = extract_from_prompt(--prompt)
ELSE:
    targets = ["page"]

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

### Step 2.5: Extract DOM Structure (URL Mode - Auto-Trigger)
```bash
# AUTO-TRIGGER: If URLs are available (from --urls parameter), automatically extract real DOM structure
# This provides accurate layout data to supplement visual analysis

# Check if URLs provided via --urls parameter
IF --urls AND url_list:
    REPORT: "🔍 Auto-triggering URL mode: Extracting DOM structure"

    bash(mkdir -p {base_path}/.intermediates/layout-analysis)

    # For each URL in url_list:
    FOR url_info IN url_list:
        target = url_info.target
        url = url_info.url

        IF mcp_chrome_devtools_available:
            REPORT: "   Processing: {target} ({url})"

            # Read extraction script
            script_content = Read(~/.claude/scripts/extract-layout-structure.js)

            # Open page in Chrome DevTools
            mcp__chrome-devtools__navigate_page(url=url)

            # Execute layout extraction script
            result = mcp__chrome-devtools__evaluate_script(function=script_content)

            # Save DOM structure for this target (intermediate file)
            Write({base_path}/.intermediates/layout-analysis/dom-structure-{target}.json, result)

            REPORT: "   ✅ DOM structure extracted for '{target}'"
        ELSE:
            REPORT: "   ⚠️ Chrome DevTools MCP not available, falling back to visual analysis"
            BREAK

    dom_structure_available = mcp_chrome_devtools_available
ELSE:
    dom_structure_available = false
```

**Extraction Script Reference**: `~/.claude/scripts/extract-layout-structure.js`

**Usage**: Read the script file and use content directly in `mcp__chrome-devtools__evaluate_script()`

**Script returns**:
- `metadata`: Extraction timestamp, URL, method, version
- `patterns`: Layout pattern statistics (flexColumn, flexRow, grid counts)
- `structure`: Hierarchical DOM tree with layout properties
- `exploration`: (Optional) Progressive exploration results when standard selectors fail

**Benefits**:
- ✅ Real flex/grid configuration (justifyContent, alignItems, gap, etc.)
- ✅ Accurate element bounds (x, y, width, height)
- ✅ Structural hierarchy with depth control
- ✅ Layout pattern identification (flex-row, flex-column, grid-NCol)
- ✅ Progressive exploration: Auto-discovers missing selectors

**Progressive Exploration Strategy** (v2.2.0+):

When script finds <3 main containers, it automatically:
1. **Scans** all large visible containers (≥500×300px)
2. **Extracts** class patterns matching: `main|content|wrapper|container|page|layout|app`
3. **Suggests** new selectors to add to script
4. **Returns** exploration data in `result.exploration`:
   ```json
   {
     "triggered": true,
     "discoveredCandidates": [{classes, bounds, display}],
     "suggestedSelectors": [".wrapper", ".page-index"],
     "recommendation": ".wrapper, .page-index, .app-container"
   }
   ```

**Using Exploration Results**:
```javascript
// After extraction, check for suggestions
IF result.exploration?.triggered:
    REPORT: result.exploration.warning
    REPORT: "Suggested selectors: " + result.exploration.recommendation

    // Update script by adding to commonClassSelectors array
    // Then re-run extraction for better coverage
```

**Selector Update Workflow**:
1. Run extraction on unfamiliar site
2. Check `result.exploration.suggestedSelectors`
3. Add relevant selectors to script's `commonClassSelectors`
4. Re-run extraction → improved container detection

### Step 3: Memory Check
```bash
# 1. Check if inputs cached in session memory
IF session_has_inputs: SKIP Step 2 file reading

# 2. Check if output already exists
bash(test -f {base_path}/layout-extraction/layout-templates.json && echo "exists")
IF exists: SKIP to completion
```

---

**Phase 0 Output**: `input_mode`, `base_path`, `extraction_mode`, `variants_count`, `targets[]`, `device_type`, loaded inputs

## Phase 1: Layout Research (Explore Mode Only)

### Step 1: Check Extraction Mode
```bash
# extraction_mode == "imitate" → skip this phase
# extraction_mode == "explore" → execute this phase
```

**If imitate mode**: Skip to Phase 2

### Step 2: Gather Layout Inspiration (Explore Mode)
```bash
bash(mkdir -p {base_path}/.intermediates/layout-analysis/inspirations)

# For each target: Research via MCP
# mcp__exa__web_search_exa(query="{target} layout patterns {device_type}", numResults=5)

# Write inspiration file
Write({base_path}/.intermediates/layout-analysis/inspirations/{target}-layout-ideas.txt, inspiration_content)
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
  ${exploration_mode ? "- Layout Inspiration: Read('" + base_path + "/.intermediates/layout-analysis/inspirations/{target}-layout-ideas.txt')" : ""}
  ${dom_structure_available ? "- DOM Structure Data: Read('" + base_path + "/.intermediates/layout-analysis/dom-structure-{target}.json') - USE THIS for accurate layout properties" : ""}

  ## Analysis & Generation
  ${dom_structure_available ? "IMPORTANT: You have access to real DOM structure data with accurate flex/grid properties, bounds, and hierarchy. Use this data as ground truth for layout analysis." : ""}
  For EACH target in {targets}:
    For EACH variant (1 to {variants_count}):
      1. **Analyze Structure**:
         ${dom_structure_available ?
           "- Use DOM structure data as primary source for layout properties" +
           "- Extract real flex/grid configurations (display, flexDirection, justifyContent, alignItems, gap)" +
           "- Use actual element bounds for responsive breakpoint decisions" +
           "- Preserve identified patterns (flex-row, flex-column, grid-NCol)" +
           "- Reference screenshots for visual context only" :
           "- Deconstruct reference images/URLs to understand layout, hierarchy, responsiveness"}
      2. **Define Philosophy**: Short description (e.g., "Asymmetrical grid with overlapping content areas")
      3. **Generate DOM Structure**:
         ${dom_structure_available ?
           "- Base structure on extracted DOM tree from .intermediates" +
           "- Preserve semantic tags and hierarchy from dom-structure-{target}.json" +
           "- Maintain layout patterns identified in patterns field" :
           "- JSON object representing semantic HTML5 structure"}
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
         ${dom_structure_available ?
           "- Use real layout properties from DOM structure data" +
           "- Convert extracted flex/grid values to CSS rules" +
           "- Preserve actual gap, justifyContent, alignItems values" +
           "- Use element bounds to inform responsive breakpoints" :
           "- Focus ONLY on layout (Grid, Flexbox, position, alignment, gap, etc.)"}
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
{IF has_urls AND dom_structure_available:
- 🔍 URL Mode: DOM structure extracted from {len(url_list)} URL(s)
- Accuracy: Real flex/grid properties from live pages
}
{IF has_urls AND NOT dom_structure_available:
- ⚠️ URL Mode: Chrome DevTools unavailable, used visual analysis fallback
}

{IF extraction_mode == "explore":
Layout Research:
- {targets.length} inspiration files generated
- Pattern search focused on {device_type} layouts
}

Generated Templates:
{FOR each template: - Target: {template.target} | Variant: {template.variant_id} | Philosophy: {template.design_philosophy}}

Output File:
- {base_path}/layout-extraction/layout-templates.json
{IF dom_structure_available:
- {base_path}/.intermediates/layout-analysis/dom-structure-*.json ({len(url_list)} files)
}

Next: /workflow:ui-design:generate will combine these structural templates with style systems to produce final prototypes.
```

## Simple Bash Commands

### Path Operations
```bash
# Find design directory
bash(find .workflow -type d -name "design-*" | head -1)

# Create output directories
bash(mkdir -p {base_path}/layout-extraction)
bash(mkdir -p {base_path}/.intermediates/layout-analysis/inspirations)  # explore mode only
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
Write({base_path}/.intermediates/layout-analysis/inspirations/{target}-layout-ideas.txt, content)

# Write layout templates
bash(echo '{json}' > {base_path}/layout-extraction/layout-templates.json)
```

## Output Structure

```
{base_path}/
├── .intermediates/                    # Intermediate analysis files
│   └── layout-analysis/
│       ├── dom-structure-{target}.json   # Extracted DOM structure (URL mode only)
│       └── inspirations/                 # Explore mode only
│           └── {target}-layout-ideas.txt # Layout inspiration research
└── layout-extraction/                 # Final layout templates
    ├── layout-templates.json          # Structural layout templates
    └── layout-space-analysis.json     # Layout directions (explore mode only)
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

- **Auto-Trigger URL Mode** - Automatically extracts DOM structure when --urls provided (no manual flag needed)
- **Hybrid Extraction Strategy** - Combines real DOM structure data with AI visual analysis
- **Accurate Layout Properties** - Chrome DevTools extracts real flex/grid configurations, bounds, and hierarchy
- **Separation of Concerns** - Decouples layout (structure) from style (visuals)
- **Structural Exploration** - Explore mode enables A/B testing of different layouts
- **Token-Based Layout** - CSS uses `var()` placeholders for instant design system adaptation
- **Device-Specific** - Tailored structures for different screen sizes
- **Graceful Fallback** - Falls back to visual analysis if Chrome DevTools unavailable
- **Foundation for Assembly** - Provides structural blueprint for refactored `generate` command
- **Agent-Powered** - Deep structural analysis with AI

## Integration

**Workflow Position**: Between style extraction and prototype generation

**New Workflow**:
1. `/workflow:ui-design:style-extract` → `design-tokens.json` + `style-guide.md` (Complete design systems)
2. `/workflow:ui-design:layout-extract` → `layout-templates.json` (Structural templates)
3. `/workflow:ui-design:generate` (Pure assembler):
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
