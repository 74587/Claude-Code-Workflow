---
name: style-extract
description: Extract design style from reference images or text prompts using Claude's analysis
argument-hint: "[--base-path <path>] [--session <id>] [--images "<glob>"] [--urls "<list>"] [--prompt "<desc>"] [--mode <imitate|explore>] [--variants <count>]"
allowed-tools: TodoWrite(*), Read(*), Write(*), Glob(*), mcp__chrome-devtools__navigate_page(*), mcp__chrome-devtools__evaluate_script(*)
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
# Priority: --urls + --images + --prompt → hybrid-url | --urls + --images → url-image | --urls → url | --images + --prompt → hybrid | --images → image | --prompt → text

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
    primary_url = url_list[0].url  # First URL as primary source
ELSE:
    has_urls = false

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

### Step 2: Extract Computed Styles (URL Mode - Auto-Trigger)
```bash
# AUTO-TRIGGER: If URLs are available (from --urls parameter or capture metadata), automatically extract real CSS values
# This provides accurate design tokens to supplement visual analysis

# Priority 1: Check for --urls parameter
IF has_urls:
    url_to_extract = primary_url
    url_source = "--urls parameter"

# Priority 2: Check for URL metadata from capture phase
ELSE IF exists({base_path}/.metadata/capture-urls.json):
    capture_urls = Read({base_path}/.metadata/capture-urls.json)
    url_to_extract = capture_urls[0]  # Use first URL
    url_source = "capture metadata"
ELSE:
    url_to_extract = null

# Execute extraction if URL available
IF url_to_extract AND mcp_chrome_devtools_available:
    REPORT: "🔍 Auto-triggering URL mode: Extracting computed styles from {url_source}"
    REPORT: "   URL: {url_to_extract}"

    # Read extraction script
    script_content = Read(~/.claude/scripts/extract-computed-styles.js)

    # Open page in Chrome DevTools
    mcp__chrome-devtools__navigate_page(url=url_to_extract)

    # Execute extraction script directly
    result = mcp__chrome-devtools__evaluate_script(function=script_content)

    # Save computed styles to intermediates directory
    bash(mkdir -p {base_path}/.intermediates/style-analysis)
    Write({base_path}/.intermediates/style-analysis/computed-styles.json, result)

    computed_styles_available = true
    REPORT: "   ✅ Computed styles extracted and saved"
ELSE:
    computed_styles_available = false
    IF url_to_extract:
        REPORT: "⚠️ Chrome DevTools MCP not available, falling back to visual analysis"
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

**Phase 0 Output**: `input_mode`, `base_path`, `extraction_mode`, `variants_count`, `loaded_images[]` or `prompt_guidance`, `has_urls`, `url_list[]`, `computed_styles_available`

## Phase 1: Design Direction Generation (Explore Mode Only)

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
bash(test -f {base_path}/.brainstorming/role analysis documents && cat it)
```

### Step 3: Generate Design Direction Options (Agent Task 1)
**Executor**: `Task(ui-design-agent)`

Launch agent to generate `variants_count` design direction options with previews:

```javascript
Task(ui-design-agent): `
  [DESIGN_DIRECTION_GENERATION_TASK]
  Generate {variants_count} maximally contrasting design directions with visual previews

  SESSION: {session_id} | MODE: explore | BASE_PATH: {base_path}

  ## Input Analysis
  - User prompt: {prompt_guidance}
  - Visual references: {loaded_images if available}
  - Project context: {brainstorming_context if available}

  ## Analysis Rules
  - Analyze 6D attribute space: color saturation, visual weight, formality, organic/geometric, innovation, density
  - Generate {variants_count} directions with MAXIMUM contrast
  - Each direction must be distinctly different (min distance score: 0.7)

  ## Generate for EACH Direction
  1. **Core Philosophy**:
     - philosophy_name (2-3 words, e.g., "Minimalist & Airy")
     - design_attributes (6D scores 0-1)
     - search_keywords (3-5 keywords)
     - anti_keywords (2-3 keywords to avoid)
     - rationale (why this is distinct from others)

  2. **Visual Preview Elements**:
     - primary_color (OKLCH format)
     - secondary_color (OKLCH format)
     - accent_color (OKLCH format)
     - font_family_heading (specific font name)
     - font_family_body (specific font name)
     - border_radius_base (e.g., "0.5rem")
     - mood_description (1-2 sentences describing the feel)

  ## Output
  Write single JSON file: {base_path}/.intermediates/style-analysis/analysis-options.json

  Use schema from INTERACTIVE-DATA-SPEC.md (Style Extract: analysis-options.json)

  CRITICAL: Use Write() tool immediately after generating complete JSON
`
```

### Step 4: Verify Options File Created
```bash
bash(test -f {base_path}/.intermediates/style-analysis/analysis-options.json && echo "created")

# Quick validation
bash(cat {base_path}/.intermediates/style-analysis/analysis-options.json | grep -q "design_directions" && echo "valid")
```

**Output**: `analysis-options.json` with design direction options

---

## Phase 1.5: User Confirmation (Explore Mode Only - INTERACTIVE)

**Purpose**: Allow user to select preferred design direction(s) before generating full design systems

### Step 1: Load and Present Options
```bash
# Read options file
options = Read({base_path}/.intermediates/style-analysis/analysis-options.json)

# Parse design directions
design_directions = options.design_directions
```

### Step 2: Present Options to User
```
📋 Design Direction Options

We've generated {variants_count} contrasting design directions for your review.
Please select the direction(s) you'd like to develop into complete design systems.

{FOR each direction in design_directions:
  ═══════════════════════════════════════════════════
  Option {direction.index}: {direction.philosophy_name}
  ═══════════════════════════════════════════════════

  Philosophy: {direction.rationale}

  Visual Preview:
  • Colors: {direction.preview.primary_color} (primary), {direction.preview.accent_color} (accent)
  • Typography: {direction.preview.font_family_heading} (headings), {direction.preview.font_family_body} (body)
  • Border Radius: {direction.preview.border_radius_base}
  • Mood: {direction.preview.mood_description}

  Design Attributes:
  • Color Saturation: {direction.design_attributes.color_saturation * 100}%
  • Visual Weight: {direction.design_attributes.visual_weight * 100}%
  • Formality: {direction.design_attributes.formality * 100}%
  • Innovation: {direction.design_attributes.innovation * 100}%

  Keywords: {join(direction.search_keywords, ", ")}
  Avoiding: {join(direction.anti_keywords, ", ")}
}

═══════════════════════════════════════════════════
```

### Step 3: Capture User Selection
```javascript
// Use AskUserQuestion tool for selection
AskUserQuestion({
  questions: [{
    question: "Which design direction would you like to develop into a complete design system?",
    header: "Style Choice",
    multiSelect: false,  // Single selection for Phase 1
    options: [
      {FOR each direction:
        label: "Option {direction.index}: {direction.philosophy_name}",
        description: "{direction.mood_description}"
      }
    ]
  }]
})

// Parse user response (e.g., "Option 1: Minimalist & Airy")
selected_option_text = user_answer

// Check for user cancellation
IF selected_option_text == null OR selected_option_text == "":
    REPORT: "⚠️ User canceled selection. Workflow terminated."
    EXIT workflow

// Extract option index from response format "Option N: Name"
match = selected_option_text.match(/Option (\d+):/)
IF match:
    selected_index = parseInt(match[1])
ELSE:
    ERROR: "Invalid selection format. Expected 'Option N: ...' format"
    EXIT workflow
```

### Step 4: Write User Selection File
```bash
# Create user selection JSON
selection_data = {
  "metadata": {
    "selected_at": "{current_timestamp}",
    "selection_type": "single",
    "session_id": "{session_id}"
  },
  "selected_indices": [selected_index],
  "refinements": {
    "enabled": false
  }
}

# Write to file
bash(echo '{selection_data}' > {base_path}/.intermediates/style-analysis/user-selection.json)

# Verify
bash(test -f {base_path}/.intermediates/style-analysis/user-selection.json && echo "saved")
```

### Step 5: Confirmation Message
```
✅ Selection recorded!

You selected: Option {selected_index} - {selected_direction.philosophy_name}

Proceeding to generate complete design system based on your selection...
```

**Output**: `user-selection.json` with user's choice

## Phase 2: Design System Generation (Agent Task 2)

**Executor**: `Task(ui-design-agent)` for selected variant(s)

### Step 1: Load User Selection (Explore Mode)
```bash
# For explore mode, read user selection
IF extraction_mode == "explore":
    selection = Read({base_path}/.intermediates/style-analysis/user-selection.json)
    selected_indices = selection.selected_indices
    refinements = selection.refinements

    # Also read the selected direction details from options
    options = Read({base_path}/.intermediates/style-analysis/analysis-options.json)
    selected_directions = [options.design_directions[i-1] for i in selected_indices]  # 0-indexed

    # For Phase 1, we only allow single selection
    selected_direction = selected_directions[0]
    actual_variants_count = 1
ELSE:
    # Imitate mode - generate single variant without selection
    selected_direction = null
    actual_variants_count = 1
```

### Step 2: Create Output Directory
```bash
# Create directory for selected variant only
bash(mkdir -p {base_path}/style-extraction/style-1)
```

### Step 3: Launch Agent Task
Generate design system for selected direction:
```javascript
Task(ui-design-agent): `
  [DESIGN_SYSTEM_GENERATION_TASK]
  Generate production-ready design system based on user-selected direction

  SESSION: {session_id} | MODE: {extraction_mode} | BASE_PATH: {base_path}

  ${extraction_mode == "explore" ? `
  USER SELECTION:
  - Selected Direction: ${selected_direction.philosophy_name}
  - Design Attributes: ${JSON.stringify(selected_direction.design_attributes)}
  - Search Keywords: ${selected_direction.search_keywords.join(", ")}
  - Anti-keywords: ${selected_direction.anti_keywords.join(", ")}
  - Rationale: ${selected_direction.rationale}
  - Preview Colors: Primary=${selected_direction.preview.primary_color}, Accent=${selected_direction.preview.accent_color}
  - Preview Typography: Heading=${selected_direction.preview.font_family_heading}, Body=${selected_direction.preview.font_family_body}
  - Preview Border Radius: ${selected_direction.preview.border_radius_base}

  ${refinements.enabled ? `
  USER REFINEMENTS:
  ${refinements.primary_color ? "- Primary Color Override: " + refinements.primary_color : ""}
  ${refinements.font_family_heading ? "- Heading Font Override: " + refinements.font_family_heading : ""}
  ${refinements.font_family_body ? "- Body Font Override: " + refinements.font_family_body : ""}
  ` : ""}
  ` : ""}

  ## Input Analysis
  - Input mode: {input_mode} (image/text/hybrid${has_urls ? "/url" : ""})
  - Visual references: {loaded_images OR prompt_guidance}
  ${computed_styles_available ? "- Computed styles: Use as ground truth (Read from .intermediates/style-analysis/computed-styles.json)" : ""}

  ## Generation Rules
  ${extraction_mode == "explore" ? `
  - **Explore Mode**: Develop the selected design direction into a complete design system
  - Use preview elements as foundation and expand with full token coverage
  - Apply design_attributes to all token values:
    * color_saturation → OKLCH chroma values
    * visual_weight → font weights, shadow depths
    * density → spacing scale compression/expansion
    * formality → typography choices, border radius
    * organic_geometric → border radius, shape patterns
    * innovation → token naming, experimental values
  - Honor search_keywords for design inspiration
  - Avoid anti_keywords patterns
  ` : `
  - **Imitate Mode**: High-fidelity replication of reference design
  ${computed_styles_available ? "- Use computed styles as ground truth for all measurements" : "- Use visual inference for measurements"}
  `}
  - All colors in OKLCH format ${computed_styles_available ? "(convert from computed RGB)" : ""}
  - WCAG AA compliance: 4.5:1 text contrast, 3:1 UI contrast

  ## Generate
  Create complete design system in {base_path}/style-extraction/style-1/

  1. **design-tokens.json**:
     - Complete token structure: colors (brand, surface, semantic, text, border), typography (families, sizes, weights, line heights, letter spacing), spacing (0-24 scale), border_radius (none to full), shadows (sm to xl), breakpoints (sm to 2xl)
     - All colors in OKLCH format
     ${extraction_mode == "explore" ? "- Start from preview colors and expand to full palette" : ""}
     ${extraction_mode == "explore" && refinements.enabled ? "- Apply user refinements where specified" : ""}

  2. **style-guide.md**:
     - Design philosophy (${extraction_mode == "explore" ? "expand on: " + selected_direction.philosophy_name : "describe the reference design"})
     - Complete color system documentation with accessibility notes
     - Typography scale and usage guidelines
     - Spacing system explanation
     - Component examples and usage patterns

  ## Critical Requirements
  - ✅ Use Write() tool immediately for each file
  - ✅ Write to style-1/ directory (single output)
  - ❌ NO external research or MCP calls (pure AI generation)
  - ✅ Maintain consistency with user-selected direction
  ${refinements.enabled ? "- ✅ Apply user refinements precisely" : ""}
`
```

**Output**: Agent generates 2 files (design-tokens.json, style-guide.md) for selected direction

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
- Input Mode: {input_mode} (image/text/hybrid{"/url" if has_urls else ""})
- Variants: {variants_count}
- Production-Ready: Complete design systems generated
{IF has_urls AND computed_styles_available:
- 🔍 URL Mode: Computed styles extracted from {len(url_list)} URL(s)
- Accuracy: Pixel-perfect design tokens from DOM
}
{IF has_urls AND NOT computed_styles_available:
- ⚠️ URL Mode: Chrome DevTools unavailable, used visual analysis fallback
}

{IF extraction_mode == "explore":
Design Direction Selection:
- You selected: Option {selected_index} - {selected_direction.philosophy_name}
- Generated from {variants_count} contrasting design direction options
}

Generated Files:
{base_path}/style-extraction/
└── style-1/ (design-tokens.json, style-guide.md)

{IF computed_styles_available:
Intermediate Analysis:
{base_path}/.intermediates/style-analysis/computed-styles.json (extracted from {primary_url})
}
{IF extraction_mode == "explore":
{base_path}/.intermediates/style-analysis/analysis-options.json (design direction options)
{base_path}/.intermediates/style-analysis/user-selection.json (your selection)
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
bash(test -f .brainstorming/role analysis documents && cat it)

# Create directories
bash(mkdir -p {base_path}/style-extraction/style-{{1..3}})

# Verify output
bash(ls {base_path}/style-extraction/style-1/)
bash(test -f {base_path}/.intermediates/style-analysis/analysis-options.json && echo "saved")
```

## Output Structure

```
{base_path}/
├── .intermediates/                  # Intermediate analysis files
│   └── style-analysis/
│       ├── computed-styles.json     # Extracted CSS values from DOM (if URL available)
│       ├── analysis-options.json    # Design direction options (explore mode only)
│       └── user-selection.json      # User's selected direction (explore mode only)
└── style-extraction/                # Final design system
    └── style-1/
        ├── design-tokens.json       # Production-ready design tokens
        └── style-guide.md           # Design philosophy and usage guide
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

- **Auto-Trigger URL Mode** - Automatically extracts computed styles when --urls provided (no manual flag needed)
- **Direct Design System Generation** - Complete design-tokens.json + style-guide.md in one step
- **Hybrid Extraction Strategy** - Combines computed CSS values (ground truth) with AI visual analysis
- **Pixel-Perfect Accuracy** - Chrome DevTools extracts exact border-radius, shadows, spacing values
- **AI-Driven Design Space Exploration** - 6D attribute space analysis for maximum contrast
- **Variant-Specific Directions** - Each variant has unique philosophy, keywords, anti-patterns
- **Maximum Contrast Guarantee** - Variants maximally distant in attribute space
- **Flexible Input** - Images, text, URLs, or hybrid mode
- **Graceful Fallback** - Falls back to pure visual inference if Chrome DevTools unavailable
- **Production-Ready** - OKLCH colors, WCAG AA compliance, semantic naming
- **Agent-Driven** - Autonomous multi-file generation with ui-design-agent

## Integration

**Input**: Reference images or text prompts
**Output**: `style-extraction/style-{N}/` with design-tokens.json + style-guide.md
**Next**: `/workflow:ui-design:layout-extract --session {session_id}` OR `/workflow:ui-design:generate --session {session_id}`

**Note**: This command extracts visual style (colors, typography, spacing) and generates production-ready design systems. For layout structure extraction, use `/workflow:ui-design:layout-extract`.
