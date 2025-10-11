---
name: style-extract
description: Extract design style from reference images or text prompts using Claude's analysis
argument-hint: "[--base-path <path>] [--session <id>] [--images "<glob>"] [--prompt "<desc>"] [--mode <imitate|explore>] [--variants <count>]"
allowed-tools: TodoWrite(*), Read(*), Write(*), Glob(*)
---

# Style Extraction Command

## Overview
Extract design style from reference images or text prompts using Claude's built-in analysis. Generates `style-cards.json` with multiple design variants containing token proposals for consolidation.

**Strategy**: AI-Driven Design Space Exploration
- **Claude-Native**: 100% Claude analysis, no external tools
- **Single Output**: `style-cards.json` with embedded token proposals
- **Flexible Input**: Images, text prompts, or both (hybrid mode)
- **Maximum Contrast**: AI generates maximally divergent design directions

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

### Step 2: Load Inputs
```bash
# For image mode
bash(ls {images_pattern})  # Expand glob pattern
Read({image_path})  # Load each image

# For text mode
# Validate --prompt is non-empty

# Create output directory
bash(mkdir -p {base_path}/style-extraction/)
```

### Step 3: Memory Check (Skip if Already Done)
```bash
# Check if already extracted
bash(test -f {base_path}/style-extraction/style-cards.json && echo "exists")
```

**If exists**: Skip to completion message

**Output**: `input_mode`, `base_path`, `extraction_mode`, `variants_count`, `loaded_images[]` or `prompt_guidance`

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
bash(echo '{design_space_analysis}' > {base_path}/style-extraction/design-space-analysis.json)

# Verify output
bash(test -f design-space-analysis.json && echo "saved")
```

**Output**: `design-space-analysis.json` for consolidation phase

## Phase 2: Style Synthesis & File Write

### Step 1: Claude Native Analysis
AI generates `variants_count` design style proposals:

**Input**:
- Input mode (image/text/hybrid)
- Visual references or text guidance
- Design space analysis (explore mode only)
- Variant-specific directions (explore mode only)

**Analysis Rules**:
- **Explore mode**: Each variant follows pre-defined philosophy and attributes, maintains maximum contrast
- **Imitate mode**: High-fidelity replication of reference design
- OKLCH color format
- Complete token proposals (colors, typography, spacing, border_radius, shadows, breakpoints)
- WCAG AA accessibility (4.5:1 text, 3:1 UI)

**Output Format**: `style-cards.json` with:
- extraction_metadata (session_id, input_mode, extraction_mode, timestamp, variants_count)
- style_cards[] (id, name, description, design_philosophy, preview, proposed_tokens)

### Step 2: Write Style Cards
```bash
bash(echo '{style_cards_json}' > {base_path}/style-extraction/style-cards.json)
```

**Output**: `style-cards.json` with `variants_count` complete variants

## Completion

### Todo Update
```javascript
TodoWrite({todos: [
  {content: "Setup and input validation", status: "completed", activeForm: "Validating inputs"},
  {content: "Design space analysis (explore mode)", status: "completed", activeForm: "Analyzing design space"},
  {content: "Style synthesis and file write", status: "completed", activeForm: "Generating style cards"}
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

{IF extraction_mode == "explore":
Design Space Analysis:
- {variants_count} maximally contrasting design directions
- Min contrast distance: {design_space_analysis.contrast_verification.min_pairwise_distance}
}

Generated Variants:
{FOR each card: - {card.name} - {card.design_philosophy}}

Output Files:
- {base_path}/style-extraction/style-cards.json
{IF extraction_mode == "explore": - {base_path}/style-extraction/design-space-analysis.json}

Next: /workflow:ui-design:consolidate --session {session_id} --variants {variants_count}
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
bash(test -f {base_path}/style-extraction/style-cards.json && echo "exists")

# Count variants
bash(cat style-cards.json | grep -c "\"id\": \"variant-")

# Validate JSON
bash(cat style-cards.json | grep -q "extraction_metadata" && echo "valid")
```

### File Operations
```bash
# Load brainstorming context
bash(test -f .brainstorming/synthesis-specification.md && cat it)

# Write output
bash(echo '{json}' > {base_path}/style-extraction/style-cards.json)

# Verify output
bash(test -f design-space-analysis.json && echo "saved")
```

## Output Structure

```
{base_path}/style-extraction/
├── style-cards.json              # Complete style variants with token proposals
└── design-space-analysis.json    # Design directions (explore mode only)
```

## style-cards.json Format

```json
{
  "extraction_metadata": {"session_id": "...", "input_mode": "image|text|hybrid", "extraction_mode": "imitate|explore", "timestamp": "...", "variants_count": N},
  "style_cards": [
    {
      "id": "variant-1", "name": "Style Name", "description": "...",
      "design_philosophy": "Core principles",
      "preview": {"primary": "oklch(...)", "background": "oklch(...)", "font_heading": "...", "border_radius": "..."},
      "proposed_tokens": {
        "colors": {"brand": {...}, "surface": {...}, "semantic": {...}, "text": {...}, "border": {...}},
        "typography": {"font_family": {...}, "font_size": {...}, "font_weight": {...}, "line_height": {...}, "letter_spacing": {...}},
        "spacing": {"0": "0", ..., "24": "6rem"},
        "border_radius": {"none": "0", ..., "full": "9999px"},
        "shadows": {"sm": "...", ..., "xl": "..."},
        "breakpoints": {"sm": "640px", ..., "2xl": "1536px"}
      }
    }
    // Repeat for all variants
  ]
}
```

**Requirements**: All colors in OKLCH format, complete token proposals, semantic naming

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

- **AI-Driven Design Space Exploration** - 6D attribute space analysis for maximum contrast
- **Variant-Specific Directions** - Each variant has unique philosophy, keywords, anti-patterns
- **Maximum Contrast Guarantee** - Variants maximally distant in attribute space
- **Claude-Native** - No external tools, fast deterministic synthesis
- **Flexible Input** - Images, text, or hybrid mode
- **Production-Ready** - OKLCH colors, WCAG AA, semantic naming

## Integration

**Input**: Reference images or text prompts
**Output**: `style-cards.json` for consolidation
**Next**: `/workflow:ui-design:consolidate --session {session_id} --variants {count}`

**Note**: This command only extracts visual style (colors, typography, spacing). For layout structure extraction, use `/workflow:ui-design:layout-extract`.
