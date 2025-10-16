---
name: style-extract
description: Extract design style from reference images or text prompts using Claude's analysis
argument-hint: "[--base-path <path>] [--session <id>] [--images "<glob>"] [--prompt "<desc>"] [--mode <imitate|explore>] [--variants <count>]"
allowed-tools: TodoWrite(*), Read(*), Write(*), Glob(*)
---

# Style Extraction Command

## Overview
Extract design style from reference images or text prompts using Claude's built-in analysis. Directly generates production-ready design systems with complete `design-tokens.json` and `style-guide.md` for each variant.

**Strategy**: AI-Driven Design Space Exploration
- **Claude-Native**: 100% Claude analysis, no external tools
- **Direct Output**: Complete design systems (design-tokens.json + style-guide.md)
- **Flexible Input**: Images, text prompts, or both (hybrid mode)
- **Maximum Contrast**: AI generates maximally divergent design directions
- **Production-Ready**: WCAG AA compliant, OKLCH colors, semantic naming

## Phase 0: Setup & Input Validation

### Step 1: Detect Input Mode, Extraction Mode & Base Path
```bash
# Detect input source
# Priority: --images + --prompt → hybrid | --images → image | --prompt → text

# Determine extraction mode
# Priority: --mode parameter → default "imitate"
extraction_mode = --mode OR "imitate"  # "imitate" or "explore"

# Set variants count based on mode
IF extraction_mode == "imitate":
    variants_count = 1  # Force single variant for imitate mode (ignore --variants)
ELSE IF extraction_mode == "explore":
    variants_count = --variants OR 3  # Default to 3 for explore mode
    VALIDATE: 1 <= variants_count <= 5

# Determine base path
bash(find .workflow -type d -name "design-*" | head -1)  # Auto-detect
# OR use --base-path / --session parameters
```

### Step 2: Extract Computed Styles (URL Mode - Optional Enhancement)
```bash
# If URL is available from capture metadata, extract real CSS values
# This provides accurate design tokens to supplement visual analysis

# Check for URL metadata from capture phase
Read({base_path}/.metadata/capture-urls.json)  # If exists

# For each URL in capture metadata:
IF url_available AND mcp_chrome_devtools_available:
    # Read extraction script
    Read(~/.claude/scripts/extract-computed-styles.js)

    # Open page in Chrome DevTools
    mcp__chrome-devtools__navigate_page(url="{target_url}")

    # Execute extraction script directly
    result = mcp__chrome-devtools__evaluate_script(function="[SCRIPT_CONTENT]")

    # Save computed styles to intermediates directory
    bash(mkdir -p {base_path}/.intermediates/style-analysis)
    Write({base_path}/.intermediates/style-analysis/computed-styles.json, result)

    computed_styles_available = true
ELSE:
    computed_styles_available = false
```

**Extraction Script Reference**: `~/.claude/scripts/extract-computed-styles.js`

**Usage**: Read the script file and use content directly in `mcp__chrome-devtools__evaluate_script()`

**Script returns**:
- `metadata`: Extraction timestamp, URL, method
- `tokens`: Organized design tokens (colors, borderRadii, shadows, fontSizes, fontWeights, spacing)

**Benefits**:
- ✅ Pixel-perfect accuracy for border-radius, box-shadow, padding, etc.
- ✅ Eliminates guessing from visual analysis
- ✅ Provides ground truth for design tokens

### Step 3: Load Inputs
```bash
# For image mode
bash(ls {images_pattern})  # Expand glob pattern
Read({image_path})  # Load each image

# For text mode
# Validate --prompt is non-empty

# Create output directory
bash(mkdir -p {base_path}/style-extraction/)
```

### Step 3: Memory Check
```bash
# 1. Check if inputs cached in session memory
IF session_has_inputs: SKIP Step 2 file reading

# 2. Check if output already exists
bash(test -f {base_path}/style-extraction/style-1/design-tokens.json && echo "exists")
IF exists: SKIP to completion
```

---

**Phase 0 Output**: `input_mode`, `base_path`, `extraction_mode`, `variants_count`, `loaded_images[]` or `prompt_guidance`

## Phase 1: Design Space Analysis (Explore Mode Only)

### Step 1: Check Extraction Mode
```bash
# Check extraction mode
# extraction_mode == "imitate" → skip this phase
# extraction_mode == "explore" → execute this phase
```

**If imitate mode**: Skip to Phase 2

### Step 2: Load Project Context (Explore Mode)
```bash
# Load brainstorming context if available
bash(test -f {base_path}/.brainstorming/synthesis-specification.md && cat it)
```

### Step 3: Generate Divergent Directions (Claude Native)
AI analyzes requirements and generates `variants_count` maximally contrasting design directions:

**Input**: User prompt + project context + image count
**Analysis**: 6D attribute space (color saturation, visual weight, formality, organic/geometric, innovation, density)
**Output**: JSON with divergent_directions, each having:
- philosophy_name (2-3 words)
- design_attributes (specific scores)
- search_keywords (3-5 keywords)
- anti_keywords (2-3 keywords)
- rationale (contrast explanation)

### Step 4: Write Design Space Analysis
```bash
bash(mkdir -p {base_path}/.intermediates/style-analysis)
bash(echo '{design_space_analysis}' > {base_path}/.intermediates/style-analysis/design-space-analysis.json)

# Verify output
bash(test -f {base_path}/.intermediates/style-analysis/design-space-analysis.json && echo "saved")
```

**Output**: `design-space-analysis.json` (intermediate analysis file)

## Phase 2: Design System Generation (Agent)

**Executor**: `Task(ui-design-agent)` for all variants

### Step 1: Create Output Directories
```bash
bash(mkdir -p {base_path}/style-extraction/style-{{1..{variants_count}}})
```

### Step 2: Launch Agent Task
For all variants (1 to {variants_count}):
```javascript
Task(ui-design-agent): `
  [DESIGN_SYSTEM_GENERATION_TASK]
  Generate {variants_count} independent production-ready design systems

  SESSION: {session_id} | MODE: {extraction_mode} | BASE_PATH: {base_path}

  CRITICAL PATH: Use loop index (N) for directories: style-1/, style-2/, ..., style-N/

  VARIANT DATA:
  {FOR each variant with index N:
    VARIANT INDEX: {N}
    {IF extraction_mode == "explore":
      Design Philosophy: {divergent_direction[N].philosophy_name}
      Design Attributes: {divergent_direction[N].design_attributes}
      Search Keywords: {divergent_direction[N].search_keywords}
      Anti-keywords: {divergent_direction[N].anti_keywords}
    }
  }

  ## Input Analysis
  - Input mode: {input_mode} (image/text/hybrid)
  - Visual references: {loaded_images OR prompt_guidance}
  - Computed styles: {computed_styles if available}
  - Design space analysis: {design_space_analysis if explore mode}

  ## Analysis Rules
  - **Explore mode**: Each variant follows pre-defined philosophy and attributes
  - **Imitate mode**: High-fidelity replication of reference design
    - If computed_styles available: Use as ground truth for border-radius, shadows, spacing, typography, colors
    - Otherwise: Visual inference
  - OKLCH color format (convert RGB from computed styles)
  - WCAG AA compliance: 4.5:1 text, 3:1 UI

  ## Generate (For EACH variant, use loop index N for paths)
  1. {base_path}/style-extraction/style-{N}/design-tokens.json
     - Complete token structure: colors, typography, spacing, border_radius, shadows, breakpoints
     - All colors in OKLCH format
     - {IF explore mode: Apply design_attributes to token values (saturation→chroma, density→spacing, etc.)}

  2. {base_path}/style-extraction/style-{N}/style-guide.md
     - Expanded design philosophy
     - Complete color system with accessibility notes
     - Typography documentation
     - Usage guidelines

  ## Critical Requirements
  - ✅ Use Write() tool immediately for each file
  - ✅ Use loop index N for directory names: style-1/, style-2/, etc.
  - ❌ NO external research or MCP calls (pure AI generation)
  - {IF explore mode: Apply philosophy-driven refinement using design_attributes}
  - {IF explore mode: Maintain divergence using anti_keywords}
  - Complete each variant's files before moving to next variant
`
```

**Output**: Agent generates `variants_count × 2` files

## Phase 3: Verify Output

### Step 1: Check Files Created
```bash
# Verify all design systems created
bash(ls {base_path}/style-extraction/style-*/design-tokens.json | wc -l)

# Validate structure
bash(cat {base_path}/style-extraction/style-1/design-tokens.json | grep -q "colors" && echo "valid")
```

### Step 2: Verify File Sizes
```bash
bash(ls -lh {base_path}/style-extraction/style-1/)
```

**Output**: `variants_count × 2` files verified

## Completion

### Todo Update
```javascript
TodoWrite({todos: [
  {content: "Setup and input validation", status: "completed", activeForm: "Validating inputs"},
  {content: "Design space analysis (explore mode)", status: "completed", activeForm: "Analyzing design space"},
  {content: "Design system generation (agent)", status: "completed", activeForm: "Generating design systems"},
  {content: "Verify output files", status: "completed", activeForm: "Verifying files"}
]});
```

### Output Message
```
✅ Style extraction complete!

Configuration:
- Session: {session_id}
- Extraction Mode: {extraction_mode} (imitate/explore)
- Input Mode: {input_mode} (image/text/hybrid)
- Variants: {variants_count}
- Production-Ready: Complete design systems generated

{IF extraction_mode == "explore":
Design Space Analysis:
- {variants_count} maximally contrasting design directions
- Min contrast distance: {design_space_analysis.contrast_verification.min_pairwise_distance}
}

Generated Files:
{base_path}/style-extraction/
├── style-1/ (design-tokens.json, style-guide.md)
├── style-2/ (same structure)
└── style-{variants_count}/ (same structure)

{IF extraction_mode == "explore":
Intermediate Analysis:
{base_path}/.intermediates/style-analysis/design-space-analysis.json
}

Next: /workflow:ui-design:layout-extract --session {session_id} --targets "..."
  OR: /workflow:ui-design:generate --session {session_id}
```

## Simple Bash Commands

### Path Operations
```bash
# Find design directory
bash(find .workflow -type d -name "design-*" | head -1)

# Expand image pattern
bash(ls {images_pattern})

# Create output directory
bash(mkdir -p {base_path}/style-extraction/)
```

### Validation Commands
```bash
# Check if already extracted
bash(test -f {base_path}/style-extraction/style-1/design-tokens.json && echo "exists")

# Count variants
bash(ls {base_path}/style-extraction/style-* -d | wc -l)

# Validate JSON structure
bash(cat {base_path}/style-extraction/style-1/design-tokens.json | grep -q "colors" && echo "valid")
```

### File Operations
```bash
# Load brainstorming context
bash(test -f .brainstorming/synthesis-specification.md && cat it)

# Create directories
bash(mkdir -p {base_path}/style-extraction/style-{{1..3}})

# Verify output
bash(ls {base_path}/style-extraction/style-1/)
bash(test -f {base_path}/.intermediates/style-analysis/design-space-analysis.json && echo "saved")
```

## Output Structure

```
{base_path}/
├── .intermediates/                  # Intermediate analysis files
│   └── style-analysis/
│       ├── computed-styles.json     # Extracted CSS values from DOM (if URL available)
│       └── design-space-analysis.json  # Design directions (explore mode only)
└── style-extraction/                # Final design systems
    ├── style-1/
    │   ├── design-tokens.json       # Production-ready design tokens
    │   └── style-guide.md           # Design philosophy and usage guide
    ├── style-2/ (same structure)
    └── style-N/ (same structure)
```

## design-tokens.json Format

```json
{
  "colors": {
    "brand": {"primary": "oklch(...)", "secondary": "oklch(...)", "accent": "oklch(...)"},
    "surface": {"background": "oklch(...)", "elevated": "oklch(...)", "overlay": "oklch(...)"},
    "semantic": {"success": "oklch(...)", "warning": "oklch(...)", "error": "oklch(...)", "info": "oklch(...)"},
    "text": {"primary": "oklch(...)", "secondary": "oklch(...)", "tertiary": "oklch(...)", "inverse": "oklch(...)"},
    "border": {"default": "oklch(...)", "strong": "oklch(...)", "subtle": "oklch(...)"}
  },
  "typography": {"font_family": {...}, "font_size": {...}, "font_weight": {...}, "line_height": {...}, "letter_spacing": {...}},
  "spacing": {"0": "0", "1": "0.25rem", ..., "24": "6rem"},
  "border_radius": {"none": "0", "sm": "0.25rem", ..., "full": "9999px"},
  "shadows": {"sm": "...", "md": "...", "lg": "...", "xl": "..."},
  "breakpoints": {"sm": "640px", ..., "2xl": "1536px"}
}
```

**Requirements**: OKLCH colors, complete coverage, semantic naming, WCAG AA compliance

## Error Handling

### Common Errors
```
ERROR: No images found
→ Check glob pattern

ERROR: Invalid prompt
→ Provide non-empty string

ERROR: Claude JSON parsing error
→ Retry with stricter format
```

## Key Features

- **Direct Design System Generation** - Complete design-tokens.json + style-guide.md in one step
- **Hybrid Extraction Strategy** - Combines computed CSS values (ground truth) with AI visual analysis
- **Pixel-Perfect Accuracy** - Chrome DevTools extracts exact border-radius, shadows, spacing values
- **AI-Driven Design Space Exploration** - 6D attribute space analysis for maximum contrast
- **Variant-Specific Directions** - Each variant has unique philosophy, keywords, anti-patterns
- **Maximum Contrast Guarantee** - Variants maximally distant in attribute space
- **Flexible Input** - Images, text, URLs, or hybrid mode
- **Graceful Fallback** - Falls back to pure visual inference if URL unavailable
- **Production-Ready** - OKLCH colors, WCAG AA compliance, semantic naming
- **Agent-Driven** - Autonomous multi-file generation with ui-design-agent

## Integration

**Input**: Reference images or text prompts
**Output**: `style-extraction/style-{N}/` with design-tokens.json + style-guide.md
**Next**: `/workflow:ui-design:layout-extract --session {session_id}` OR `/workflow:ui-design:generate --session {session_id}`

**Note**: This command extracts visual style (colors, typography, spacing) and generates production-ready design systems. For layout structure extraction, use `/workflow:ui-design:layout-extract`.
